import type { APIRoute } from 'astro';
import { isAdminRequest, unauthorizedResponse } from '../../../lib/admin-auth';
import { cleanText, logCmsAction } from '../../../lib/cms-admin';
import { getSupabaseAdmin } from '../../../lib/supabase';

export const prerender = false;
const ALLOWED_SLUGS = new Set(['/', '/anggota', '/galeri', '/struktur', '/keahlian', '/tkj', '/pengembang']);

export const GET: APIRoute = async ({ request }) => {
  if (!isAdminRequest(request)) return unauthorizedResponse();
  const db = getSupabaseAdmin();
  if (!db) return Response.json({ error: 'Supabase belum tersedia.' }, { status: 503 });
  const { data, error } = await db.from('site_pages').select('*').order('slug');
  if (error) return Response.json({ error: 'Metadata halaman gagal dibaca. Pastikan migration CMS sudah dijalankan.' }, { status: 500 });
  return Response.json({ data: data || [] }, { headers: { 'Cache-Control': 'no-store' } });
};

export const PUT: APIRoute = async ({ request }) => {
  if (!isAdminRequest(request)) return unauthorizedResponse();
  const db = getSupabaseAdmin();
  if (!db) return Response.json({ error: 'Supabase belum tersedia.' }, { status: 503 });
  let body: any;
  try { body = await request.json(); } catch { return Response.json({ error: 'JSON tidak valid.' }, { status: 400 }); }
  const slug = cleanText(body?.slug, 100);
  if (!ALLOWED_SLUGS.has(slug)) return Response.json({ error: 'Halaman tidak dikenali.' }, { status: 400 });
  if (body.content !== undefined && (!body.content || typeof body.content !== 'object' || Array.isArray(body.content))) return Response.json({ error: 'Konten halaman harus berupa JSON object.' }, { status: 400 });
  const { data: current } = await db.from('site_pages').select('title,description,og_image,noindex,content').eq('slug', slug).maybeSingle();
  const record = {
    slug,
    title: cleanText(body.title, 180) || null,
    description: cleanText(body.description, 320) || null,
    og_image: cleanText(body.og_image, 1000) || null,
    noindex: Boolean(body.noindex),
    content: body.content && typeof body.content === 'object' ? body.content : current?.content || {},
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await db.from('site_pages').upsert(record, { onConflict: 'slug' }).select().single();
  if (error) return Response.json({ error: 'Metadata halaman gagal disimpan.' }, { status: 500 });
  const { data: lastRevision } = await db.from('content_revisions').select('version').eq('page_slug', slug).order('version', { ascending: false }).limit(1).maybeSingle();
  await db.from('content_revisions').insert({
    page_slug: slug,
    version: Number(lastRevision?.version || 0) + 1,
    content: data.content || {},
    seo: { title: data.title, description: data.description, og_image: data.og_image, noindex: data.noindex },
  });
  await logCmsAction(db, 'update', 'site_pages', slug, `SEO halaman ${slug} diperbarui`);
  return Response.json({ ok: true, data });
};
