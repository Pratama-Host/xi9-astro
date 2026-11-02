import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import process from 'node:process';

let adminClient: SupabaseClient | null | undefined;

/** Client service-role hanya boleh dipakai di modul server/API Astro. */
export function getSupabaseAdmin(): SupabaseClient | null {
  if (adminClient !== undefined) return adminClient;

  const url = process.env.SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_KEY?.trim();

  if (!url || !serviceKey) {
    adminClient = null;
    return adminClient;
  }

  adminClient = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { 'X-Client-Info': 'tkj-xi9-astro-server' } },
  });
  return adminClient;
}

export function getStorageBucket(): string {
  return process.env.SUPABASE_STORAGE_BUCKET?.trim() || 'astro';
}
