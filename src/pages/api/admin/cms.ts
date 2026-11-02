import type { APIRoute } from 'astro';
import { isAdminRequest, unauthorizedResponse } from '../../../lib/admin-auth';
import { getSupabaseAdmin, getStorageBucket } from '../../../lib/supabase';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  if (!isAdminRequest(request)) return unauthorizedResponse();
  const db = getSupabaseAdmin();
  if (!db) return Response.json({ error: 'Supabase belum tersedia.' }, { status: 503 });

  const [members, gallery, teachers, skills, pages, media, navigation, sections, logs] = await Promise.all([
    db.from('anggota').select('nis', { count: 'exact', head: true }),
    db.from('galeri').select('id', { count: 'exact', head: true }),
    db.from('guru').select('nama', { count: 'exact', head: true }),
    db.from('skills').select('nama', { count: 'exact', head: true }),
    db.from('site_pages').select('slug', { count: 'exact', head: true }),
    db.from('media_assets').select('object_path,size_bytes', { count: 'exact' }),
    db.from('site_navigation').select('id', { count: 'exact', head: true }),
    db.from('site_sections').select('id', { count: 'exact', head: true }),
    db.from('admin_audit_logs').select('id,action,entity,entity_id,summary,created_at').order('created_at', { ascending: false }).limit(12),
  ]);

  const requiredErrors = [members.error, gallery.error, teachers.error, skills.error, pages.error, navigation.error, sections.error].filter(Boolean);
  if (requiredErrors.length) {
    return Response.json({ error: 'Schema CMS belum lengkap. Jalankan migrations/20261101_cms.sql di Supabase SQL Editor.' }, { status: 503 });
  }
  // Count existing legacy Storage objects too, not just files uploaded after the CMS migration.
  const mediaByPath = new Map<string, number>();
  for (const row of media.data || []) mediaByPath.set(row.object_path, Number(row.size_bytes || 0));
  let storageReadFailed = false;
  let scannedObjects = 0;
  const storage = db.storage.from(getStorageBucket());
  const scanStorage = async (prefix = '', depth = 0): Promise<void> => {
    if (depth > 4 || scannedObjects >= 2000) return;
    const { data, error } = await storage.list(prefix, { limit: 1000, offset: 0, sortBy: { column: 'name', order: 'asc' } });
    if (error || !data) { storageReadFailed = true; return; }
    for (const item of data) {
      const path = prefix ? `${prefix}/${item.name}` : item.name;
      if (!item.id || !item.metadata) {
        await scanStorage(path, depth + 1);
        continue;
      }
      scannedObjects++;
      if (!mediaByPath.has(path)) mediaByPath.set(path, Number(item.metadata.size || 0));
      if (scannedObjects >= 2000) break;
    }
  };
  await scanStorage();
  const totalBytes = [...mediaByPath.values()].reduce((sum, bytes) => sum + bytes, 0);
  const mediaCount = mediaByPath.size || media.count || 0;
  return Response.json({
    ok: true,
    status: 'connected',
    counts: {
      members: members.count || 0,
      gallery: gallery.count || 0,
      teachers: teachers.count || 0,
      skills: skills.count || 0,
      pages: pages.count || 0,
      media: mediaCount,
      navigation: navigation.count || 0,
      sections: sections.count || 0,
      content: (pages.count || 0) + (teachers.count || 0) + (skills.count || 0),
    },
    media: { files: mediaCount, bytes: totalBytes, storageScanComplete: !storageReadFailed && scannedObjects < 2000 },
    activities: logs.data || [],
    warnings: media.error || logs.error || storageReadFailed || scannedObjects >= 2000 ? ['Sebagian informasi media atau aktivitas belum tersedia.'] : [],
  }, { headers: { 'Cache-Control': 'no-store' } });
};
