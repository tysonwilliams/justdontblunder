import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import type { SyncClient } from '@/src/data/sync/types';

let cached: SupabaseClient | null | undefined;

/**
 * Publishable client. Null when the URL or anon key is missing, or when the
 * key is a service-role JWT. A null client leaves progress on the device.
 */
export function getSupabase(): SupabaseClient | null {
  if (cached !== undefined) return cached;
  cached = createSupabase();
  return cached;
}

export function resetSupabaseForTests(): void {
  cached = undefined;
}

export function syncClientFrom(client: SupabaseClient): SyncClient {
  return client as unknown as SyncClient;
}

/**
 * Sync is allowed unless this is exactly "false".
 * Unset and "true" both allow sync once a publishable client and a session exist.
 */
export function isSyncEnabled(): boolean {
  return process.env.EXPO_PUBLIC_SYNC_ENABLED !== 'false';
}

/** URL and publishable key, or null when the client would refuse to start. */
export function getSupabasePublicConfig(): { url: string; anonKey: string } | null {
  return publicConfig();
}

function createSupabase(): SupabaseClient | null {
  const config = publicConfig();
  if (!config) return null;
  try {
    return createClient(config.url, config.anonKey, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        // /auth/callback exchanges the code. Detecting it here would consume the code twice.
        detectSessionInUrl: false,
        flowType: 'pkce',
      },
    });
  } catch {
    return null;
  }
}

function publicConfig(): { url: string; anonKey: string } | null {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() ?? '';
  const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? '';
  if (!url || !key || isServiceRoleKey(key)) return null;
  return { url, anonKey: key };
}

function isServiceRoleKey(key: string): boolean {
  const payload = key.split('.')[1];
  if (!payload || key.split('.').length !== 3) return false;
  try {
    const json = JSON.parse(decodeBase64Url(payload)) as { role?: unknown };
    return json.role === 'service_role';
  } catch {
    return false;
  }
}

function decodeBase64Url(value: string): string {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  return globalThis.atob(padded);
}
