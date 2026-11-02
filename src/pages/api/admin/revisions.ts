import type { APIRoute } from 'astro';
import { isAdminRequest, unauthorizedResponse } from '../../../lib/admin-auth';
import { cleanText, logCmsAction } from '../../../lib/cms-admin';
import { getSupabaseAdmin } from '../../../lib/supabase';

export const prerender = false;

export const GET: APIRoute = async ({ request, url }) => {
  if (!isAdminRequest(request)) return unauthorizedResponse();
  const db = getSupabaseAdmin();
  if (!db) return Response.json({ error: 'Supabase belum tersedia.' }, { status: 503 });
  const slug = cleanText(url.searchParams.get('slug') || 'site-settings', 100);
  const { data, error } = await db.from('content_revisions').select('id,page_slug,version,seo,created_at').eq('page_slug', slug).order('version', { ascending: false }).limit(30);
  if (error) return Response.json({ error: 'Riwayat versi belum tersedia. Jalankan migration CMS.' }, { status: 500 });
  return Response.json({ data: data || [] }, { headers: { 'Cache-Control': 'no-store' } });
};

export const POST: APIRoute = async ({ request }) => {
  if (!isAdminRequest(request)) return unauthorizedResponse();
  const db = getSupabaseAdmin();
  if (!db) return Response.json({ error: 'Supabase belum tersedia.' }, { status: 503 });
  let body: any;
  try { body = await request.json(); } catch { return Response.json({ error: 'JSON tidak valid.' }, { status: 400 }); }
  const id = cleanText(body?.id, 80);
  if (!id || body?.confirm !== true) return Response.json({ error: 'Pemulihan versi memerlukan konfirmasi.' }, { status: 400 });
  const { data: revision, error: readError } = await db.from('content_revisions').select('*').eq('id', id).maybeSingle();
  if (readError || !revision) return Response.json({ error: 'Versi tidak ditemukan.' }, { status: 404 });
  if (revision.page_slug === 'site-settings') {
    const { error } = await db.from('site_settings').upsert({ key: 'site', value: revision.content || {}, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    if (error) return Response.json({ error: 'Versi pengaturan gagal dipulihkan.' }, { status: 500 });
  } else {
    const seo = revision.seo || {};
    const { error } = await db.from('site_pages').upsert({
      slug: revision.page_slug,
      title: seo.title || null,
      description: seo.description || null,
      og_image: seo.og_image || null,
      noindex: Boolean(seo.noindex),
      content: revision.content || {},
      updated_at: new Date().toISOString(),
    }, { onConflict: 'slug' });
    if (error) return Response.json({ error: 'Versi halaman gagal dipulihkan.' }, { status: 500 });
  }
  await logCmsAction(db, 'restore', 'content_revisions', id, `Versi ${revision.version} untuk ${revision.page_slug} dipulihkan`);
  return Response.json({ ok: true, message: `Versi ${revision.version} berhasil dipulihkan.` });
};
