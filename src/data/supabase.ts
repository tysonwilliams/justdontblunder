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

export function isSyncEnabled(): boolean {
  return process.env.EXPO_PUBLIC_SYNC_ENABLED === 'true';
}

function createSupabase(): SupabaseClient | null {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() ?? '';
  const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? '';
  if (!url || !key || isServiceRoleKey(key)) return null;
  try {
    return createClient(url, key, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
        flowType: 'pkce',
      },
    });
  } catch {
    return null;
  }
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
