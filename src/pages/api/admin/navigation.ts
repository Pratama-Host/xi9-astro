import type { APIRoute } from 'astro';
import { isAdminRequest, unauthorizedResponse } from '../../../lib/admin-auth';
import { cleanText, logCmsAction, validInternalHref } from '../../../lib/cms-admin';
import { getSupabaseAdmin } from '../../../lib/supabase';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  if (!isAdminRequest(request)) return unauthorizedResponse();
  const db = getSupabaseAdmin();
  if (!db) return Response.json({ error: 'Supabase belum tersedia.' }, { status: 503 });
  const { data, error } = await db.from('site_navigation').select('*').order('sort_order');
  if (error) return Response.json({ error: 'Navigasi gagal dibaca. Jalankan migration CMS.' }, { status: 500 });
  return Response.json({ data: data || [] }, { headers: { 'Cache-Control': 'no-store' } });
};

export const PUT: APIRoute = async ({ request }) => {
  if (!isAdminRequest(request)) return unauthorizedResponse();
  const db = getSupabaseAdmin();
  if (!db) return Response.json({ error: 'Supabase belum tersedia.' }, { status: 503 });
  let body: any;
  try { body = await request.json(); } catch { return Response.json({ error: 'JSON tidak valid.' }, { status: 400 }); }
  if (!Array.isArray(body?.items) || body.items.length > 15) return Response.json({ error: 'Daftar menu tidak valid (maksimal 15).' }, { status: 400 });
  const items: any[] = [];
  for (let i = 0; i < body.items.length; i++) {
    const item = body.items[i];
    const id = cleanText(item?.id, 50).toLowerCase();
    const href = validInternalHref(item?.href);
    const label = cleanText(item?.label, 60);
    if (!/^[a-z0-9-]{1,50}$/.test(id) || !href || !label) return Response.json({ error: `Data menu urutan ${i + 1} tidak valid.` }, { status: 400 });
    items.push({ id, label, href, icon: cleanText(item.icon, 50), sort_order: i, enabled: item.enabled !== false, updated_at: new Date().toISOString() });
  }
  const { data: existing, error: existingError } = await db.from('site_navigation').select('id');
  if (existingError) return Response.json({ error: 'Menu lama gagal dibaca.' }, { status: 500 });
  const keep = new Set(items.map((item) => item.id));
  const removed = (existing || []).filter((row) => !keep.has(row.id)).map((row) => row.id);
  if (removed.length && body.confirmDelete !== true) {
    return Response.json({ error: `Ada ${removed.length} menu yang akan dihapus. Konfirmasi diperlukan.`, removed }, { status: 409 });
  }
  const { error } = items.length ? await db.from('site_navigation').upsert(items, { onConflict: 'id' }) : { error: null };
  if (error) return Response.json({ error: 'Navigasi gagal disimpan.' }, { status: 500 });
  for (const row of existing || []) if (!keep.has(row.id)) await db.from('site_navigation').delete().eq('id', row.id);
  await logCmsAction(db, 'update', 'site_navigation', null, `${items.length} item navigasi disimpan`);
  return Response.json({ ok: true, data: items });
};
