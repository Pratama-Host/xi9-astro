import type { APIRoute } from 'astro';
import { isAdminRequest, unauthorizedResponse } from '../../../lib/admin-auth';
import { cleanText, logCmsAction } from '../../../lib/cms-admin';
import { getSupabaseAdmin } from '../../../lib/supabase';

export const prerender = false;
const ALLOWED = new Set([
  '/:hero', '/:stats', '/:teachers', '/anggota:list', '/galeri:featured', '/galeri:grid',
  '/struktur:organization', '/keahlian:list', '/tkj:overview', '/tkj:subjects', '/tkj:curriculum', '/tkj:careers', '/tkj:tools', '/pengembang:story',
]);

export const GET: APIRoute = async ({ request }) => {
  if (!isAdminRequest(request)) return unauthorizedResponse();
  const db = getSupabaseAdmin();
  if (!db) return Response.json({ error: 'Supabase belum tersedia.' }, { status: 503 });
  const { data, error } = await db.from('site_sections').select('*').order('page_slug').order('sort_order');
  if (error) return Response.json({ error: 'Section gagal dibaca. Jalankan migration CMS.' }, { status: 500 });
  return Response.json({ data: data || [] }, { headers: { 'Cache-Control': 'no-store' } });
};

export const PUT: APIRoute = async ({ request }) => {
  if (!isAdminRequest(request)) return unauthorizedResponse();
  const db = getSupabaseAdmin();
  if (!db) return Response.json({ error: 'Supabase belum tersedia.' }, { status: 503 });
  let body: any;
  try { body = await request.json(); } catch { return Response.json({ error: 'JSON tidak valid.' }, { status: 400 }); }
  if (!Array.isArray(body?.items) || body.items.length > 50) return Response.json({ error: 'Daftar section tidak valid.' }, { status: 400 });
  const items = [];
  for (let i = 0; i < body.items.length; i++) {
    const item = body.items[i];
    const page_slug = cleanText(item?.page_slug, 80);
    const section_key = cleanText(item?.section_key, 50);
    if (!ALLOWED.has(`${page_slug}:${section_key}`)) return Response.json({ error: `Section ${page_slug}/${section_key} tidak didukung.` }, { status: 400 });
    items.push({ id: `${page_slug === '/' ? 'home' : page_slug.slice(1)}.${section_key}`, page_slug, section_key, label: cleanText(item.label, 100), sort_order: Number.isFinite(Number(item.sort_order)) ? Number(item.sort_order) : i, enabled: item.enabled !== false, updated_at: new Date().toISOString() });
  }
  const { error } = items.length ? await db.from('site_sections').upsert(items, { onConflict: 'id' }) : { error: null };
  if (error) return Response.json({ error: 'Pengaturan section gagal disimpan.' }, { status: 500 });
  await logCmsAction(db, 'update', 'site_sections', null, `${items.length} section diperbarui`);
  return Response.json({ ok: true, data: items });
};
