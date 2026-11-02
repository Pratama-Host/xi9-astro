import type { APIRoute } from 'astro';
import { isAdminRequest, unauthorizedResponse } from '../../../lib/admin-auth';
import { getSupabaseAdmin } from '../../../lib/supabase';
import { logCmsAction } from '../../../lib/cms-admin';

export const prerender = false;

function unavailable() {
  return Response.json({ error: 'Supabase belum dikonfigurasi. Isi SUPABASE_URL dan SUPABASE_SERVICE_KEY.' }, { status: 503 });
}

function cleanMember(body: Record<string, unknown>) {
  return {
    nis: String(body.nis || '').trim(),
    nama: String(body.nama || '').trim(),
    kelas: String(body.kelas || 'XI-9').trim(),
    jabatan: String(body.jabatan || '').trim() || null,
    deskripsi: String(body.deskripsi || body.desc || '').trim() || null,
    foto_url: String(body.foto_url || body.foto || '').trim() || null,
    audio_url: String(body.audio_url || body.audio || '').trim() || null,
    audio_nama: String(body.audio_nama || body.namaAudio || '').trim() || null,
    foto_audio_url: String(body.foto_audio_url || body.fotoAudio || '').trim() || null,
    deskripsi_audio: String(body.deskripsi_audio || body.descAudio || '').trim() || null,
    social: body.social && typeof body.social === 'object' ? body.social : {},
    skills: Array.isArray(body.skills) ? body.skills.slice(0, 30) : [],
    visible: body.visible !== false,
    urutan: Number.isFinite(Number(body.urutan)) ? Number(body.urutan) : 0,
    updated_at: new Date().toISOString(),
  };
}

export const GET: APIRoute = async ({ request }) => {
  if (!isAdminRequest(request)) return unauthorizedResponse();
  const supabase = getSupabaseAdmin();
  if (!supabase) return unavailable();
  const { data, error } = await supabase.from('anggota').select('*').order('urutan', { ascending: true }).order('nama', { ascending: true });
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ data }, { headers: { 'Cache-Control': 'no-store' } });
};

export const POST: APIRoute = async ({ request }) => {
  if (!isAdminRequest(request)) return unauthorizedResponse();
  const supabase = getSupabaseAdmin();
  if (!supabase) return unavailable();
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return Response.json({ error: 'JSON tidak valid.' }, { status: 400 }); }
  const member = cleanMember(body);
  if (!member.nis || !member.nama) return Response.json({ error: 'Nama dan NIS wajib diisi.' }, { status: 400 });
  const { data, error } = await supabase.from('anggota').upsert(member, { onConflict: 'nis' }).select().single();
  if (error) return Response.json({ error: error.message }, { status: 400 });
  await logCmsAction(supabase, 'create', 'anggota', member.nis, `Anggota ${member.nama} disimpan`);
  return Response.json({ data }, { status: 201 });
};

export const PUT: APIRoute = async ({ request }) => {
  if (!isAdminRequest(request)) return unauthorizedResponse();
  const supabase = getSupabaseAdmin();
  if (!supabase) return unavailable();
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return Response.json({ error: 'JSON tidak valid.' }, { status: 400 }); }
  const originalNis = String(body.original_nis || '').trim();
  const member = cleanMember(body);
  if (!originalNis || !member.nis || !member.nama) return Response.json({ error: 'NIS asal, NIS baru, dan nama wajib diisi.' }, { status: 400 });
  const { data, error } = await supabase.from('anggota').update(member).eq('nis', originalNis).select().single();
  if (error) return Response.json({ error: error.message }, { status: 400 });
  await logCmsAction(supabase, 'update', 'anggota', member.nis, `Anggota ${member.nama} diperbarui`);
  return Response.json({ data });
};

export const DELETE: APIRoute = async ({ request }) => {
  if (!isAdminRequest(request)) return unauthorizedResponse();
  const supabase = getSupabaseAdmin();
  if (!supabase) return unavailable();
  let body: { nis?: string; confirm?: boolean };
  try { body = await request.json(); } catch { return Response.json({ error: 'JSON tidak valid.' }, { status: 400 }); }
  const nis = String(body.nis || '').trim();
  if (!nis || body.confirm !== true) return Response.json({ error: 'NIS dan konfirmasi penghapusan wajib diisi.' }, { status: 400 });
  const { error } = await supabase.from('anggota').delete().eq('nis', nis);
  if (error) return Response.json({ error: error.message }, { status: 400 });
  await logCmsAction(supabase, 'delete', 'anggota', nis, `Anggota dengan NIS ${nis} dihapus`);
  return Response.json({ ok: true });
};
