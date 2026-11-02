import type { SupabaseClient } from '@supabase/supabase-js';

export async function logCmsAction(
  client: SupabaseClient,
  action: string,
  entity: string,
  entityId: string | null,
  summary: string,
) {
  try {
    await client.from('admin_audit_logs').insert({ action, entity, entity_id: entityId, summary });
  } catch {
    // Audit logging must not turn a successful content write into a failed request.
  }
}

export function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function cleanText(value: unknown, max = 5000): string {
  return String(value ?? '').trim().slice(0, max);
}

export function validInternalHref(value: unknown): string | null {
  const href = cleanText(value, 300);
  if (!href.startsWith('/') || href.startsWith('//') || href.includes('\\') || /[\r\n]/.test(href)) return null;
  if (/^\/(?:api\/admin|pengembang\/admin)(?:\/|$)/i.test(href)) return null;
  const pathname = href.split(/[?#]/, 1)[0];
  const allowedPaths = new Set(['/', '/pengembang', '/struktur', '/anggota', '/keahlian', '/galeri', '/tkj', '/404', '/offline']);
  if (!allowedPaths.has(pathname)) return null;
  return href;
}

export function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value);
}
