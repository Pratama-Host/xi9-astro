import type { APIRoute } from 'astro';
import { randomUUID } from 'node:crypto';
import { isAdminRequest, unauthorizedResponse } from '../../../lib/admin-auth';
import { cleanText, logCmsAction } from '../../../lib/cms-admin';
import { getSupabaseAdmin, getStorageBucket } from '../../../lib/supabase';

export const prerender = false;
const MAX_FILE_BYTES = 20 * 1024 * 1024;
const ALLOWED_CATEGORIES = new Set(['anggota', 'galeri', 'assets-global', 'background', 'icons', 'documents', 'assets']);
const GLOBAL_TYPES = new Set(['logo', 'alternate_logo', 'favicon', 'audio', 'background', 'og']);
const EXTENSIONS: Record<string, Set<string>> = {
  image: new Set(['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'avif', 'ico']),
  audio: new Set(['mp3', 'wav', 'ogg', 'm4a', 'aac', 'weba', 'flac']),
  document: new Set(['pdf']),
};
const safeFilename = (name: string) => name.normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase().slice(-120);
const getExtension = (name: string) => name.split('.').pop()?.toLowerCase() || '';
const MIME_BY_EXTENSION: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif',
  svg: 'image/svg+xml', avif: 'image/avif', ico: 'image/x-icon', mp3: 'audio/mpeg', wav: 'audio/wav',
  ogg: 'audio/ogg', m4a: 'audio/mp4', aac: 'audio/aac', weba: 'audio/webm', flac: 'audio/flac', pdf: 'application/pdf',
};
const effectiveMime = (file: File) => {
  const supplied = file.type.toLowerCase();
  if (supplied && !['application/octet-stream', 'binary/octet-stream'].includes(supplied)) return supplied;
  return MIME_BY_EXTENSION[getExtension(file.name)] || 'application/octet-stream';
};
const isImage = (file: File) => EXTENSIONS.image.has(getExtension(file.name)) && effectiveMime(file).startsWith('image/');
const isAudio = (file: File) => EXTENSIONS.audio.has(getExtension(file.name)) && effectiveMime(file).startsWith('audio/');

export const GET: APIRoute = async ({ request, url }) => {
  if (!isAdminRequest(request)) return unauthorizedResponse();
  const db = getSupabaseAdmin();
  if (!db) return Response.json({ error: 'Supabase belum tersedia.' }, { status: 503 });
  const { data: indexed, error: indexError } = await db.from('media_assets').select('*').order('created_at', { ascending: false }).limit(500);
  const indexedRows = indexError ? [] : (indexed || []);
  const warnings: string[] = [];
  if (indexError) warnings.push('Tabel indeks media belum tersedia; daftar ditampilkan langsung dari Supabase Storage. Jalankan atau verifikasi migration CMS pada project yang sama.');
  const indexedPaths = new Set(indexedRows.map((item) => item.object_path));
  const storage = db.storage.from(getStorageBucket());
  const storageFiles: any[] = [];
  const walk = async (prefix = '', depth = 0) => {
    if (depth > 4 || storageFiles.length >= 1000) return;
    const { data, error: listError } = await storage.list(prefix, { limit: 1000, offset: 0, sortBy: { column: 'name', order: 'asc' } });
    if (listError || !data) {
      if (listError) warnings.push(`Folder Storage '${prefix || '/'}' gagal dibaca.`);
      return;
    }
    for (const item of data) {
      const objectPath = prefix ? `${prefix}/${item.name}` : item.name;
      if (!item.id || !item.metadata) {
        await walk(objectPath, depth + 1);
        continue;
      }
      if (indexedPaths.has(objectPath)) continue;
      const { data: publicData } = storage.getPublicUrl(objectPath);
      storageFiles.push({
        id: `storage:${objectPath}`, object_path: objectPath, public_url: publicData.publicUrl,
        filename: item.name, title: item.name, alt_text: '',
        category: objectPath.split('/')[0] || 'assets', mime_type: item.metadata.mimetype || 'application/octet-stream',
        size_bytes: item.metadata.size || 0, created_at: item.created_at || item.updated_at || null,
        updated_at: item.updated_at || null, indexed: false,
      });
      if (storageFiles.length >= 1000) break;
    }
  };
  await walk();
  let results = [...indexedRows.map((item) => ({ ...item, indexed: true })), ...storageFiles];
  const category = url.searchParams.get('category');
  const search = cleanText(url.searchParams.get('q'), 100).toLowerCase();
  if (category) results = results.filter((item) => item.category === category || (category === 'assets-global' && String(item.category).startsWith('global-')));
  if (search) results = results.filter((item) => `${item.filename} ${item.title || ''} ${item.alt_text || ''}`.toLowerCase().includes(search));
  results.sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
  return Response.json({ data: results, warnings: [...new Set(warnings)] }, { headers: { 'Cache-Control': 'no-store' } });
};

export const POST: APIRoute = async ({ request }) => {
  if (!isAdminRequest(request)) return unauthorizedResponse();
  const db = getSupabaseAdmin();
  if (!db) return Response.json({ error: 'Supabase belum tersedia.' }, { status: 503 });
  let form: FormData;
  try { form = await request.formData(); } catch { return Response.json({ error: 'Form upload tidak valid.' }, { status: 400 }); }
  const file = form.get('file');
  const category = String(form.get('category') || 'assets');
  const globalType = String(form.get('global_type') || '');
  const galleryCaption = cleanText(form.get('caption'), 240);
  const memberNis = cleanText(form.get('member_nis'), 40);
  const replacePath = cleanText(form.get('replace_path'), 500);
  if (replacePath && (replacePath.startsWith('/') || replacePath.split('/').includes('..') || replacePath.includes('\\'))) {
    return Response.json({ error: 'Path media untuk penggantian tidak valid.' }, { status: 400 });
  }
  const effectiveGlobalType = globalType || (replacePath.startsWith('assets-global/') ? replacePath.split('/')[1] : '');
  if (!(file instanceof File) || file.size <= 0) return Response.json({ error: 'Pilih file terlebih dahulu.' }, { status: 400 });
  if (file.size > MAX_FILE_BYTES) return Response.json({ error: 'Ukuran maksimum file adalah 20 MB.' }, { status: 413 });
  if (!ALLOWED_CATEGORIES.has(category)) return Response.json({ error: 'Kategori upload tidak dikenal.' }, { status: 400 });
  const filename = safeFilename(file.name);
  if (!filename || filename === '.' || filename === '..') return Response.json({ error: 'Nama file tidak valid.' }, { status: 400 });
  if (category === 'assets-global' && !replacePath && !GLOBAL_TYPES.has(globalType)) return Response.json({ error: 'Jenis aset global tidak dikenal.' }, { status: 400 });
  if (['anggota', 'galeri', 'icons', 'background'].includes(category) || (category === 'assets-global' && ['logo', 'alternate_logo', 'favicon', 'background', 'og'].includes(effectiveGlobalType))) {
    if (!isImage(file)) return Response.json({ error: 'Kategori ini hanya menerima gambar dengan ekstensi yang didukung.' }, { status: 415 });
  }
  if (category === 'assets-global' && effectiveGlobalType === 'audio' && !isAudio(file)) return Response.json({ error: 'Aset audio harus berupa MP3, WAV, OGG, M4A, AAC, WEBA, atau FLAC.' }, { status: 415 });
  if (category === 'documents' && (!EXTENSIONS.document.has(getExtension(file.name)) || effectiveMime(file) !== 'application/pdf')) return Response.json({ error: 'Dokumen yang didukung saat ini hanya PDF.' }, { status: 415 });
  if (category === 'anggota' && !memberNis && !replacePath) return Response.json({ error: 'NIS anggota diperlukan untuk memasang foto profil.' }, { status: 400 });

  const prefix = category === 'assets-global' ? `assets-global/${globalType || effectiveGlobalType}` : category;
  const objectPath = replacePath || `${prefix}/${Date.now()}-${randomUUID().slice(0, 8)}-${filename}`;
  if (replacePath) {
    const oldExtension = getExtension(objectPath.split('/').pop() || '');
    if (oldExtension !== getExtension(filename)) return Response.json({ error: 'Format file pengganti harus memiliki ekstensi yang sama agar URL media tetap konsisten.' }, { status: 400 });
  }
  const bytes = Buffer.from(await file.arrayBuffer());
  const storage = db.storage.from(getStorageBucket());
  const uploadResult = replacePath
    ? await storage.update(objectPath, bytes, { contentType: effectiveMime(file), cacheControl: '3600' })
    : await storage.upload(objectPath, bytes, { upsert: false, contentType: effectiveMime(file), cacheControl: '3600' });
  const uploadError = uploadResult.error;
  if (uploadError) return Response.json({ error: 'Upload ke Storage gagal.' }, { status: 400 });
  const { data: urlData } = db.storage.from(getStorageBucket()).getPublicUrl(objectPath);
  const publicUrl = urlData.publicUrl;

  if (category === 'assets-global' && !replacePath) {
    const { data: settingsRow } = await db.from('site_settings').select('value').eq('key', 'site').maybeSingle();
    const current = (settingsRow?.value || {}) as Record<string, any>;
    const media = { ...(current.media || {}) };
    const appearance = { ...(current.appearance || {}) };
    if (globalType === 'background') appearance.background_image_url = publicUrl;
    else if (globalType === 'og') current.ogImage = publicUrl;
    else media[`${globalType}_url`] = publicUrl;
    const { error } = await db.from('site_settings').upsert({ key: 'site', value: { ...current, media, appearance, updated_at: new Date().toISOString() }, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    if (error) return Response.json({ error: 'File terunggah, tetapi pengaturan global gagal diperbarui.', publicUrl, objectPath }, { status: 500 });
  }
  if (category === 'galeri' && !replacePath) {
    const { data: last } = await db.from('galeri').select('urutan').order('urutan', { ascending: false }).limit(1).maybeSingle();
    const nextOrder = Number(last?.urutan ?? -1) + 1;
    let galleryInsert = await db.from('galeri').insert({
      src: publicUrl, caption: galleryCaption, title: galleryCaption || filename, alt_text: galleryCaption || filename,
      category: 'Kegiatan', urutan: nextOrder, visible: true, updated_at: new Date().toISOString(),
    });
    const missingCmsColumn = Boolean(galleryInsert.error && /column .* does not exist|could not find the .* column|schema cache/i.test(galleryInsert.error.message || ''));
    if (missingCmsColumn) {
      galleryInsert = await db.from('galeri').insert({ src: publicUrl, caption: galleryCaption, urutan: nextOrder });
    }
    if (galleryInsert.error) return Response.json({ error: 'File sudah tersimpan di Storage, tetapi baris galeri gagal dibuat. Jangan unggah ulang file yang sama; periksa struktur tabel galeri.', publicUrl, objectPath }, { status: 500 });
  }
  if (category === 'anggota' && !replacePath) {
    const { error } = await db.from('anggota').update({ foto_url: publicUrl, updated_at: new Date().toISOString() }).eq('nis', memberNis);
    if (error) return Response.json({ error: 'File terunggah, tetapi foto anggota gagal dipasang.', publicUrl, objectPath }, { status: 500 });
  }

  let asset: any;
  let metadataError: any;
  if (replacePath) {
    const { data: existingAsset } = await db.from('media_assets').select('*').eq('object_path', objectPath).maybeSingle();
    if (existingAsset) {
      const updated = await db.from('media_assets').update({ filename, mime_type: effectiveMime(file), size_bytes: file.size, updated_at: new Date().toISOString() }).eq('object_path', objectPath).select().single();
      asset = updated.data; metadataError = updated.error;
    } else {
      const inserted = await db.from('media_assets').insert({
        object_path: objectPath, public_url: publicUrl, filename, title: filename,
        category: category, mime_type: effectiveMime(file), size_bytes: file.size,
        metadata: { replaced_legacy_storage_object: true },
      }).select().single();
      asset = inserted.data; metadataError = inserted.error;
    }
  } else {
    const inserted = await db.from('media_assets').insert({
      object_path: objectPath, public_url: publicUrl, filename, title: filename,
      category: category,
      mime_type: effectiveMime(file), size_bytes: file.size,
      metadata: { linked_member_nis: memberNis || null, caption: galleryCaption || null, global_type: globalType || null },
    }).select().single();
    asset = inserted.data; metadataError = inserted.error;
  }
  if (metadataError) return Response.json({ ok: true, warning: 'File tersimpan di Storage, tetapi indeks media library belum tersimpan.', publicUrl, objectPath, category }, { status: 201 });
  await logCmsAction(db, replacePath ? 'replace' : 'upload', 'media_assets', asset.id, `Media ${filename} ${replacePath ? 'diganti' : 'diunggah'}`);
  return Response.json({ ok: true, replaced: Boolean(replacePath), publicUrl, objectPath, category, asset }, { status: 201 });
};

export const PATCH: APIRoute = async ({ request }) => {
  if (!isAdminRequest(request)) return unauthorizedResponse();
  const db = getSupabaseAdmin();
  if (!db) return Response.json({ error: 'Supabase belum tersedia.' }, { status: 503 });
  let body: any;
  try { body = await request.json(); } catch { return Response.json({ error: 'JSON tidak valid.' }, { status: 400 }); }
  const id = cleanText(body?.id, 80);
  if (!id) return Response.json({ error: 'ID media wajib diisi.' }, { status: 400 });
  const patch = {
    title: cleanText(body.title, 180) || null,
    alt_text: cleanText(body.alt_text, 240) || null,
    category: cleanText(body.category, 60) || 'assets',
    updated_at: new Date().toISOString(),
  };
  let data: any;
  let error: any;
  if (id.startsWith('storage:')) {
    const objectPath = cleanText(body.object_path, 500);
    if (!objectPath || objectPath.startsWith('/') || objectPath.split('/').includes('..')) return Response.json({ error: 'Path file tidak valid.' }, { status: 400 });
    const { data: publicData } = db.storage.from(getStorageBucket()).getPublicUrl(objectPath);
    const { data: inserted, error: insertError } = await db.from('media_assets').insert({
      object_path: objectPath, public_url: publicData.publicUrl, filename: objectPath.split('/').pop() || 'file',
      ...patch, mime_type: cleanText(body.mime_type, 120) || 'application/octet-stream', size_bytes: Math.max(0, Number(body.size_bytes) || 0),
    }).select().single();
    data = inserted; error = insertError;
  } else {
    const result = await db.from('media_assets').update(patch).eq('id', id).select().single();
    data = result.data; error = result.error;
  }
  if (error) return Response.json({ error: 'Metadata media gagal diperbarui.' }, { status: 500 });
  await logCmsAction(db, 'update', 'media_assets', id, `Metadata media ${data.filename} diperbarui`);
  return Response.json({ ok: true, data });
};

export const DELETE: APIRoute = async ({ request }) => {
  if (!isAdminRequest(request)) return unauthorizedResponse();
  const db = getSupabaseAdmin();
  if (!db) return Response.json({ error: 'Supabase belum tersedia.' }, { status: 503 });
  let body: any;
  try { body = await request.json(); } catch { return Response.json({ error: 'JSON tidak valid.' }, { status: 400 }); }
  const id = cleanText(body?.id, 80);
  if (!id || body?.confirm !== true) return Response.json({ error: 'Konfirmasi penghapusan wajib diberikan.' }, { status: 400 });
  let asset: any = null;
  if (!id.startsWith('storage:')) {
    const { data, error: readError } = await db.from('media_assets').select('*').eq('id', id).maybeSingle();
    if (readError) return Response.json({ error: 'Metadata media gagal dibaca.' }, { status: 500 });
    asset = data;
  }
  if (!asset && id.startsWith('storage:')) {
    const objectPath = cleanText(body.object_path || id.slice('storage:'.length), 500);
    if (!objectPath || objectPath.startsWith('/') || objectPath.split('/').includes('..')) return Response.json({ error: 'Path file tidak valid.' }, { status: 400 });
    const { data } = db.storage.from(getStorageBucket()).getPublicUrl(objectPath);
    asset = { id, object_path: objectPath, public_url: data.publicUrl, filename: objectPath.split('/').pop() };
  }
  if (!asset) return Response.json({ error: 'Media tidak ditemukan.' }, { status: 404 });
  const [members, gallery, settings, pages] = await Promise.all([
    db.from('anggota').select('nis,foto_url,audio_url,foto_audio_url'),
    db.from('galeri').select('id,src'),
    db.from('site_settings').select('value').eq('key', 'site').maybeSingle(),
    db.from('site_pages').select('slug,og_image,content'),
  ]);
  const readErrors = [members.error, gallery.error, settings.error, pages.error].filter(Boolean);
  if (readErrors.length) return Response.json({ error: 'Referensi media belum dapat diperiksa. Penghapusan dibatalkan.' }, { status: 503 });
  const needle = [asset.public_url, asset.object_path, `storage://${asset.object_path}`].filter(Boolean);
  const references: string[] = [];
  for (const row of members.data || []) if (needle.some((v) => [row.foto_url, row.audio_url, row.foto_audio_url].includes(v))) references.push(`anggota:${row.nis}`);
  for (const row of gallery.data || []) if (needle.includes(row.src)) references.push(`galeri:${row.id}`);
  if (settings.data?.value && needle.some((v) => JSON.stringify(settings.data.value).includes(v))) references.push('site_settings');
  for (const row of pages.data || []) if (needle.includes(row.og_image) || needle.some((v) => JSON.stringify(row.content || {}).includes(v))) references.push(`site_pages:${row.slug}`);
  if (references.length) return Response.json({ error: 'Media masih digunakan dan tidak dapat dihapus.', references }, { status: 409 });
  const { error: storageError } = await db.storage.from(getStorageBucket()).remove([asset.object_path]);
  if (storageError) return Response.json({ error: 'File di Storage gagal dihapus.' }, { status: 500 });
  if (!id.startsWith('storage:')) {
    const { error } = await db.from('media_assets').delete().eq('id', id);
    if (error) return Response.json({ error: 'File terhapus dari Storage, tetapi metadata gagal dihapus.' }, { status: 500 });
  }
  await logCmsAction(db, 'delete', 'media_assets', id, `Media ${asset.filename} dihapus`);
  return Response.json({ ok: true });
};
