import type { APIRoute } from 'astro';
import { isAdminRequest, unauthorizedResponse } from '../../../lib/admin-auth';
import { getSupabaseAdmin } from '../../../lib/supabase';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  if (!isAdminRequest(request)) return unauthorizedResponse();
  const supabase = getSupabaseAdmin();
  if (!supabase) return Response.json({ error: 'Supabase belum dikonfigurasi.' }, { status: 503 });
  const { data, error } = await supabase.from('site_settings').select('value').eq('key', 'site').maybeSingle();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ data: data?.value || {} }, { headers: { 'Cache-Control': 'no-store' } });
};

export const PUT: APIRoute = async ({ request }) => {
  if (!isAdminRequest(request)) return unauthorizedResponse();
  const supabase = getSupabaseAdmin();
  if (!supabase) return Response.json({ error: 'Supabase belum dikonfigurasi.' }, { status: 503 });
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return Response.json({ error: 'JSON tidak valid.' }, { status: 400 }); }
  const allowed = ['namaKelas', 'jurusan', 'namaSekolah', 'tahunAjaran', 'motto', 'deskripsi', 'sloganHero', 'ogImage', 'countdown', 'sosmed', 'visi', 'misi'];
  const { data: row } = await supabase.from('site_settings').select('value').eq('key', 'site').maybeSingle();
  const current = (row?.value || {}) as Record<string, unknown>;
  const next = { ...current };
  for (const key of allowed) if (key in body) next[key] = body[key];
  const { data, error } = await supabase.from('site_settings').upsert({ key: 'site', value: next, updated_at: new Date().toISOString() }, { onConflict: 'key' }).select().single();
  if (error) return Response.json({ error: error.message }, { status: 400 });
  return Response.json({ data: data.value });
};
