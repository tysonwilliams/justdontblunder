import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { getSupabasePublicConfig, isSyncEnabled } from '@/src/data/supabaseConfig';
import type { SyncClient } from '@/src/data/sync/types';

export { getSupabasePublicConfig, isSyncEnabled };

/** Implicit email client. Distinct from the PKCE storage key so GoTrue does not warn. */
export const EMAIL_LINK_STORAGE_KEY = 'jdb-implicit-email';

let cached: SupabaseClient | null | undefined;
let emailCached: SupabaseClient | null | undefined;

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
  emailCached = undefined;
}

/**
 * Sends magic links, signup confirmations, password resets, and resends.
 * Implicit flow puts the session in the URL hash, so the link works in a
 * browser that does not have the PKCE code verifier. This client does not
 * persist that session. The callback calls setSession on the PKCE client.
 */
export function getEmailLinkClient(): SupabaseClient | null {
  if (emailCached !== undefined) return emailCached;
  emailCached = createEmailLinkClient();
  return emailCached;
}

export function syncClientFrom(client: SupabaseClient): SyncClient {
  return client as unknown as SyncClient;
}

function createSupabase(): SupabaseClient | null {
  const config = getSupabasePublicConfig();
  if (!config) return null;
  try {
    return createClient(config.url, config.anonKey, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        // /auth/callback reads the code and the implicit hash. Detecting either here would consume it twice.
        detectSessionInUrl: false,
        flowType: 'pkce',
      },
    });
  } catch {
    return null;
  }
}

function createEmailLinkClient(): SupabaseClient | null {
  const config = getSupabasePublicConfig();
  if (!config) return null;
  try {
    return createClient(config.url, config.anonKey, {
      auth: {
        flowType: 'implicit',
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        storageKey: EMAIL_LINK_STORAGE_KEY,
      },
    });
  } catch {
    return null;
  }
}
