import type { APIRoute } from 'astro';
import { isAdminRequest, unauthorizedResponse } from '../../../lib/admin-auth';
import { cleanText, logCmsAction } from '../../../lib/cms-admin';
import { getSupabaseAdmin, getStorageBucket } from '../../../lib/supabase';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  if (!isAdminRequest(request)) return unauthorizedResponse();
  const db = getSupabaseAdmin();
  if (!db) return Response.json({ error: 'Supabase belum tersedia.' }, { status: 503 });
  const { data, error } = await db.from('galeri').select('*').order('urutan');
  if (error) return Response.json({ error: 'Data galeri gagal dibaca. Periksa koneksi Supabase dan struktur tabel galeri.' }, { status: 500 });
  const storage = db.storage.from(getStorageBucket());
  const items = (data || []).map((row) => {
    const rawSrc = typeof row.src === 'string' ? row.src : '';
    let src: string | null = rawSrc || null;
    if (rawSrc.startsWith('storage://')) src = storage.getPublicUrl(rawSrc.slice('storage://'.length)).data.publicUrl;
    else if (rawSrc.startsWith('/assets/')) src = null;
    return { ...row, src, visible: row.visible !== false };
  });
  return Response.json({ data: items }, { headers: { 'Cache-Control': 'no-store' } });
};

export const PUT: APIRoute = async ({ request }) => {
  if (!isAdminRequest(request)) return unauthorizedResponse();
  const db = getSupabaseAdmin();
  if (!db) return Response.json({ error: 'Supabase belum tersedia.' }, { status: 503 });
  let body: any;
  try { body = await request.json(); } catch { return Response.json({ error: 'JSON tidak valid.' }, { status: 400 }); }
  const id = cleanText(body?.id, 80);
  if (!id) return Response.json({ error: 'ID galeri wajib diisi.' }, { status: 400 });
  const patch = {
    title: cleanText(body.title, 180) || null,
    caption: cleanText(body.caption, 240) || null,
    description: cleanText(body.description, 3000) || null,
    category: cleanText(body.category, 80) || 'Kegiatan',
    taken_at: /^\d{4}-\d{2}-\d{2}$/.test(String(body.taken_at || '')) ? body.taken_at : null,
    alt_text: cleanText(body.alt_text, 240) || null,
    urutan: Math.max(0, Math.min(10000, Number(body.urutan) || 0)),
    visible: body.visible !== false,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await db.from('galeri').update(patch).eq('id', id).select().single();
  if (error) return Response.json({ error: 'Item galeri gagal diperbarui.' }, { status: 500 });
  await logCmsAction(db, 'update', 'galeri', id, `Metadata galeri ${patch.title || patch.caption || id} diperbarui`);
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
  const { error } = await db.from('galeri').delete().eq('id', id);
  if (error) return Response.json({ error: 'Item galeri gagal dihapus.' }, { status: 500 });
  await logCmsAction(db, 'delete', 'galeri', id, `Item galeri ${id} dihapus`);
  return Response.json({ ok: true });
};
