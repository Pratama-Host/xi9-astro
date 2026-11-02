import type { APIRoute } from 'astro';
import { isAdminRequest, unauthorizedResponse } from '../../../lib/admin-auth';
import { cleanText, logCmsAction } from '../../../lib/cms-admin';
import { getSupabaseAdmin } from '../../../lib/supabase';

export const prerender = false;
type Kind = 'guru' | 'skills';
const tableFor = (kind: Kind) => kind === 'guru' ? 'guru' : 'skills';

export const GET: APIRoute = async ({ request, url }) => {
  if (!isAdminRequest(request)) return unauthorizedResponse();
  const kind = url.searchParams.get('type') as Kind;
  if (!['guru', 'skills'].includes(kind)) return Response.json({ error: 'Jenis koleksi tidak dikenal.' }, { status: 400 });
  const db = getSupabaseAdmin();
  if (!db) return Response.json({ error: 'Supabase belum tersedia.' }, { status: 503 });
  const { data, error } = await db.from(tableFor(kind)).select('*').order('urutan');
  if (error) return Response.json({ error: 'Koleksi gagal dibaca.' }, { status: 500 });
  return Response.json({ data: data || [] }, { headers: { 'Cache-Control': 'no-store' } });
};

export const PUT: APIRoute = async ({ request, url }) => {
  if (!isAdminRequest(request)) return unauthorizedResponse();
  const kind = url.searchParams.get('type') as Kind;
  if (!['guru', 'skills'].includes(kind)) return Response.json({ error: 'Jenis koleksi tidak dikenal.' }, { status: 400 });
  const db = getSupabaseAdmin();
  if (!db) return Response.json({ error: 'Supabase belum tersedia.' }, { status: 503 });
  let body: any;
  try { body = await request.json(); } catch { return Response.json({ error: 'JSON tidak valid.' }, { status: 400 }); }
  if (!Array.isArray(body?.items) || body.items.length > 100) return Response.json({ error: 'Data koleksi harus berupa daftar maksimal 100 item.' }, { status: 400 });
  const isGuru = kind === 'guru';
  const normalized = body.items.map((item: any, index: number) => isGuru ? ({
    nama: cleanText(item.nama, 160), mapel: cleanText(item.mapel, 180), peran: cleanText(item.peran, 180),
    quote: cleanText(item.quote, 1000), expertise: Array.isArray(item.expertise) ? item.expertise.slice(0, 20) : [], urutan: index,
    updated_at: new Date().toISOString(),
  }) : ({
    nama: cleanText(item.nama, 160), level: Math.max(0, Math.min(100, Number(item.level) || 0)), icon: cleanText(item.icon, 80),
    deskripsi: cleanText(item.deskripsi ?? item.desc, 1000), urutan: index, updated_at: new Date().toISOString(),
  }));
  if (normalized.some((item: any) => !item.nama)) return Response.json({ error: 'Setiap item wajib memiliki nama.' }, { status: 400 });
  const { data: existing, error: existingError } = await db.from(tableFor(kind)).select('nama');
  if (existingError) return Response.json({ error: 'Data koleksi sebelumnya gagal dibaca.' }, { status: 500 });
  const keep = new Set(normalized.map((item: any) => item.nama));
  const removed = (existing || []).filter((row) => !keep.has(row.nama)).map((row) => row.nama);
  if (removed.length && body.confirmReplace !== true) {
    return Response.json({ error: `Penyimpanan ini akan menghapus ${removed.length} item lama. Konfirmasi penggantian diperlukan.`, removed }, { status: 409 });
  }
  if (normalized.length) {
    const { error } = await db.from(tableFor(kind)).upsert(normalized, { onConflict: 'nama' });
    if (error) return Response.json({ error: 'Koleksi gagal disimpan.' }, { status: 500 });
  }
  for (const row of existing || []) if (!keep.has(row.nama)) await db.from(tableFor(kind)).delete().eq('nama', row.nama);
  await logCmsAction(db, 'replace', kind, null, `${normalized.length} item ${kind} disimpan`);
  return Response.json({ ok: true, data: normalized });
};
