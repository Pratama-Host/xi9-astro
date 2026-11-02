import fallbackData from '../data/G.json';
import { getSupabaseAdmin, getStorageBucket } from './supabase';

type JsonRecord = Record<string, any>;

function cloneFallback(client?: NonNullable<ReturnType<typeof getSupabaseAdmin>> | null): JsonRecord {
  const copy = JSON.parse(JSON.stringify(fallbackData)) as JsonRecord;
  const resolveFallbackAssets = (value: any): any => {
    if (typeof value === 'string') {
      if (value.startsWith('/assets/')) return null;
      if (value.startsWith('storage://')) {
        if (!client) return null;
        const objectPath = value.slice('storage://'.length);
        return client.storage.from(getStorageBucket()).getPublicUrl(objectPath).data.publicUrl;
      }
      return value;
    }
    if (Array.isArray(value)) return value.map(resolveFallbackAssets);
    if (value && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, resolveFallbackAssets(item)]));
    }
    return value;
  };
  const cleaned = resolveFallbackAssets(copy) as JsonRecord;
  if (Array.isArray(cleaned.galeri)) cleaned.galeri = cleaned.galeri.filter((item: JsonRecord) => item?.src);
  return cleaned;
}

function deepMerge(base: any, override: any): any {
  if (Array.isArray(override)) return override;
  if (override === undefined) return base;
  if (override === null || typeof override !== 'object') return override;
  const result = base && typeof base === 'object' && !Array.isArray(base) ? { ...base } : {};
  for (const [key, value] of Object.entries(override)) {
    result[key] = value && typeof value === 'object' && !Array.isArray(value)
      ? deepMerge(result[key], value)
      : value;
  }
  return result;
}

function resolveStorageReference(value: string | null | undefined, client: NonNullable<ReturnType<typeof getSupabaseAdmin>>) {
  if (!value) return null;
  if (value.startsWith('/assets/')) return null;
  if (!value.startsWith('storage://')) return value;
  const objectPath = value.slice('storage://'.length);
  const { data } = client.storage.from(getStorageBucket()).getPublicUrl(objectPath);
  return data.publicUrl;
}

function resolveNestedStorageReferences(value: any, client: NonNullable<ReturnType<typeof getSupabaseAdmin>>): any {
  if (Array.isArray(value)) return value.map((item) => resolveNestedStorageReferences(item, client));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, resolveNestedStorageReferences(item, client)]));
  }
  if (typeof value === 'string' && value.startsWith('storage://')) return resolveStorageReference(value, client);
  // `public/assets` has been retired. Never send stale local asset paths back to public pages.
  if (typeof value === 'string' && value.startsWith('/assets/')) return null;
  return value;
}

function mapMember(row: JsonRecord, client: NonNullable<ReturnType<typeof getSupabaseAdmin>>) {
  return {
    nama: row.nama,
    nis: row.nis,
    kelas: row.kelas,
    jabatan: row.jabatan || null,
    foto: resolveStorageReference(row.foto_url, client),
    desc: row.deskripsi || '',
    audio: resolveStorageReference(row.audio_url, client),
    namaAudio: row.audio_nama || row.nama,
    fotoAudio: resolveStorageReference(row.foto_audio_url || row.foto_url, client),
    descAudio: row.deskripsi_audio || row.deskripsi || '',
    social: row.social || {},
    skills: row.skills || [],
    visible: row.visible !== false,
    urutan: row.urutan ?? 0,
  };
}

async function readSiteSettings(client: NonNullable<ReturnType<typeof getSupabaseAdmin>>) {
  const { data, error } = await client.from('site_settings').select('value').eq('key', 'site').maybeSingle();
  if (error) return undefined;
  return (data?.value || {}) as JsonRecord;
}

export async function getSettings(): Promise<JsonRecord> {
  const client = getSupabaseAdmin();
  const fallback = cloneFallback(client);
  if (!client) return fallback;
  try {
    const stored = await readSiteSettings(client);
    if (stored === undefined) return fallback;
    const resolved = resolveNestedStorageReferences(stored, client);
    return deepMerge(fallback, resolved);
  } catch {
    return fallback;
  }
}

export async function getPageSEO(pathname: string): Promise<JsonRecord> {
  const fallback: JsonRecord = {};
  const client = getSupabaseAdmin();
  if (!client) return fallback;
  try {
    const { data, error } = await client.from('site_pages').select('title, description, og_image, noindex').eq('slug', pathname).maybeSingle();
    if (error || !data) return fallback;
    const resolvedImage = resolveStorageReference(data.og_image, client);
    return { ...data, og_image: resolvedImage || (String(data.og_image || '').startsWith('/assets/') ? null : data.og_image) };
  } catch {
    return fallback;
  }
}

export async function getPageContent(pathname: string): Promise<JsonRecord> {
  const client = getSupabaseAdmin();
  if (!client) return {};
  try {
    const { data, error } = await client.from('site_pages').select('content').eq('slug', pathname).maybeSingle();
    if (error || !data?.content || typeof data.content !== 'object') return {};
    return resolveNestedStorageReferences(data.content, client) || {};
  } catch {
    return {};
  }
}

const DEFAULT_NAVIGATION = [
  { id: 'home', label: 'Home', href: '/', icon: 'fa-house', sort_order: 0, enabled: true },
  { id: 'developer', label: 'Developer', href: '/pengembang', icon: 'fa-code', sort_order: 1, enabled: true },
  { id: 'struktur', label: 'Struktur', href: '/struktur', icon: 'fa-sitemap', sort_order: 2, enabled: true },
  { id: 'anggota', label: 'Anggota', href: '/anggota', icon: 'fa-users', sort_order: 3, enabled: true },
  { id: 'keahlian', label: 'Skills', href: '/keahlian', icon: 'fa-code', sort_order: 4, enabled: true },
  { id: 'galeri', label: 'Galeri', href: '/galeri', icon: 'fa-images', sort_order: 5, enabled: true },
  { id: 'tkj', label: 'TKJ', href: '/tkj', icon: 'fa-network-wired', sort_order: 6, enabled: true },
];

export async function getNavigation() {
  const client = getSupabaseAdmin();
  if (!client) return DEFAULT_NAVIGATION;
  try {
    const { data, error } = await client.from('site_navigation').select('id,label,href,icon,sort_order,enabled').eq('enabled', true).order('sort_order', { ascending: true });
    return error || data === null ? DEFAULT_NAVIGATION : data;
  } catch {
    return DEFAULT_NAVIGATION;
  }
}

export async function getSections(pageSlug: string) {
  const client = getSupabaseAdmin();
  if (!client) return [];
  try {
    const { data, error } = await client.from('site_sections').select('section_key,sort_order,enabled').eq('page_slug', pageSlug).order('sort_order', { ascending: true });
    return error || !data ? [] : data;
  } catch {
    return [];
  }
}

export async function getAnggota() {
  const client = getSupabaseAdmin();
  const fallback = cloneFallback(client);
  if (!client) return fallback.namaSiswa;
  try {
    const { data, error } = await client.from('anggota').select('*').order('urutan', { ascending: true }).order('nama', { ascending: true });
    if (error || !data) return fallback.namaSiswa;
    return data.filter((row) => row.visible !== false).map((row) => mapMember(row, client));
  } catch {
    return fallback.namaSiswa;
  }
}

export async function getGaleri() {
  const client = getSupabaseAdmin();
  const fallback = cloneFallback(client);
  if (!client) return fallback.galeri;
  try {
    const { data, error } = await client.from('galeri').select('*').order('urutan', { ascending: true });
    if (error || !data) return fallback.galeri;
    return data.filter((row) => row.visible !== false).map((row) => ({
      id: row.id,
      src: resolveStorageReference(row.src, client),
      caption: row.caption || '',
      title: row.title || row.caption || '',
      description: row.description || '',
      category: row.category || 'Kegiatan',
      taken_at: row.taken_at || null,
      alt_text: row.alt_text || row.caption || 'Foto galeri TKJ XI-9',
      urutan: row.urutan ?? 0,
    })).filter((item) => item.src);
  } catch {
    return fallback.galeri;
  }
}

export async function getSiteData(): Promise<JsonRecord> {
  const client = getSupabaseAdmin();
  const fallback = cloneFallback(client);
  if (!client) return fallback;
  try {
    const [storedSettings, membersResult, galleryResult, teachersResult, skillsResult] = await Promise.all([
      readSiteSettings(client),
      client.from('anggota').select('*').order('urutan', { ascending: true }).order('nama', { ascending: true }),
      client.from('galeri').select('*').order('urutan', { ascending: true }),
      client.from('guru').select('nama, mapel, peran, quote, expertise, urutan').order('urutan', { ascending: true }),
      client.from('skills').select('nama, level, icon, deskripsi, urutan').order('urutan', { ascending: true }),
    ]);
    const resolvedSettings = resolveNestedStorageReferences(storedSettings || {}, client);
    const result: JsonRecord = deepMerge(fallback, resolvedSettings);

    if (!membersResult.error && membersResult.data) {
      const members = membersResult.data.filter((row) => row.visible !== false).map((row) => mapMember(row, client));
      result.namaSiswa = members;
      result.strukturOrg = members.filter((member: JsonRecord) => member.jabatan).map((member: JsonRecord) => ({ nama: member.nama, jabatan: member.jabatan, foto: member.foto, desc: member.desc }));
    }
    if (!galleryResult.error && galleryResult.data) {
      result.galeri = galleryResult.data.filter((row) => row.visible !== false).map((row) => ({
        id: row.id,
        src: resolveStorageReference(row.src, client),
        caption: row.caption || '', title: row.title || row.caption || '',
        description: row.description || '', category: row.category || 'Kegiatan',
        taken_at: row.taken_at || null, alt_text: row.alt_text || row.caption || 'Foto galeri TKJ XI-9',
      })).filter((item) => item.src);
    }
    if (!teachersResult.error && teachersResult.data) {
      result.guru = teachersResult.data.map((row) => ({ nama: row.nama, mapel: row.mapel, peran: row.peran, quote: row.quote, expertise: row.expertise || [] }));
    }
    if (!skillsResult.error && skillsResult.data) {
      result.skills = skillsResult.data.map((row) => ({ nama: row.nama, level: row.level, icon: row.icon, desc: row.deskripsi }));
    }
    return result;
  } catch {
    return fallback;
  }
}
