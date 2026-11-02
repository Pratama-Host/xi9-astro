import type { APIRoute } from 'astro';
import { isAdminRequest, unauthorizedResponse } from '../../../lib/admin-auth';
import { isPlainRecord, logCmsAction } from '../../../lib/cms-admin';
import { getSupabaseAdmin } from '../../../lib/supabase';

export const prerender = false;
const TABLES = ['anggota', 'galeri', 'guru', 'skills', 'site_pages', 'site_navigation', 'site_sections', 'media_assets', 'content_revisions', 'admin_audit_logs'] as const;

export const GET: APIRoute = async ({ request }) => {
  if (!isAdminRequest(request)) return unauthorizedResponse();
  const db = getSupabaseAdmin();
  if (!db) return Response.json({ error: 'Supabase belum tersedia.' }, { status: 503 });
  const bundle: Record<string, unknown> = {
    format: 'tkj-xi9-cms-backup',
    version: 1,
    exported_at: new Date().toISOString(),
  };
  const settings = await db.from('site_settings').select('*').eq('key', 'site').maybeSingle();
  if (settings.error) return Response.json({ error: 'Pengaturan situs gagal diekspor.' }, { status: 500 });
  bundle.site_settings = settings.data ? [settings.data] : [];
  for (const table of TABLES) {
    const result = await db.from(table).select('*');
    if (result.error) return Response.json({ error: `Ekspor ${table} gagal. Pastikan migration CMS sudah dijalankan.` }, { status: 500 });
    bundle[table] = result.data || [];
  }
  return new Response(JSON.stringify(bundle, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="tkj-xi9-cms-${new Date().toISOString().slice(0, 10)}.json"`,
      'Cache-Control': 'no-store',
    },
  });
};

export const POST: APIRoute = async ({ request }) => {
  if (!isAdminRequest(request)) return unauthorizedResponse();
  const db = getSupabaseAdmin();
  if (!db) return Response.json({ error: 'Supabase belum tersedia.' }, { status: 503 });
  const length = Number(request.headers.get('content-length') || 0);
  if (length > 5 * 1024 * 1024) return Response.json({ error: 'File backup maksimum 5 MB.' }, { status: 413 });
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: 'File backup bukan JSON valid.' }, { status: 400 }); }
  if (!isPlainRecord(body) || body.format !== 'tkj-xi9-cms-backup' || body.version !== 1) return Response.json({ error: 'Format backup tidak dikenali.' }, { status: 400 });
  if (body.confirm !== true) return Response.json({ error: 'Import memerlukan konfirmasi eksplisit.' }, { status: 400 });

  const settingsRows = Array.isArray(body.site_settings) ? body.site_settings : [];
  if (settingsRows.length) {
    const value = settingsRows[0]?.value;
    if (!isPlainRecord(value)) return Response.json({ error: 'Data pengaturan dalam backup tidak valid.' }, { status: 400 });
    const { error } = await db.from('site_settings').upsert({ key: 'site', value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    if (error) return Response.json({ error: 'Pengaturan situs gagal dipulihkan.' }, { status: 500 });
  }

  const upsertSpecs: Array<{ key: typeof TABLES[number]; conflict: string }> = [
    { key: 'anggota', conflict: 'nis' }, { key: 'galeri', conflict: 'src' }, { key: 'guru', conflict: 'nama' },
    { key: 'skills', conflict: 'nama' }, { key: 'site_pages', conflict: 'slug' }, { key: 'site_navigation', conflict: 'id' },
    { key: 'site_sections', conflict: 'id' }, { key: 'media_assets', conflict: 'object_path' },
    { key: 'content_revisions', conflict: 'id' }, { key: 'admin_audit_logs', conflict: 'id' },
  ];
  for (const spec of upsertSpecs) {
    const rows = body[spec.key];
    if (rows === undefined) continue;
    if (!Array.isArray(rows) || rows.length > 2000 || rows.some((row) => !isPlainRecord(row))) return Response.json({ error: `Data ${spec.key} dalam backup tidak valid.` }, { status: 400 });
    if (!rows.length) continue;
    const { error } = await db.from(spec.key).upsert(rows, { onConflict: spec.conflict });
    if (error) return Response.json({ error: `Pemulihan ${spec.key} gagal. Data sebelumnya tidak dihapus.` }, { status: 500 });
  }
  await logCmsAction(db, 'import', 'backup', null, 'Backup konten CMS diimpor (upsert, tanpa menghapus baris lama)');
  return Response.json({ ok: true, message: 'Data backup berhasil diimpor. Baris yang tidak ada di backup tetap dipertahankan.' });
};
