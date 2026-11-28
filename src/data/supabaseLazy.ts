import type { SupabaseClient } from '@supabase/supabase-js';

import type { AuthApi } from '@/src/auth/types';
import { getSupabasePublicConfig } from '@/src/data/supabaseConfig';

/**
 * Loads the Supabase client lazily so `@supabase/supabase-js` stays out of the
 * initial bundle and never downloads when accounts are not configured.
 */
export async function loadSupabase(): Promise<SupabaseClient | null> {
  if (!getSupabasePublicConfig()) return null;
  try {
    const mod = await import('@/src/data/supabaseBundle');
    return mod.getSupabase();
  } catch {
    return null;
  }
}

export async function loadSupabaseAuth(): Promise<AuthApi | null> {
  if (!getSupabasePublicConfig()) return null;
  try {
    const mod = await import('@/src/data/supabaseBundle');
    const client = mod.getSupabase();
    return client ? mod.authFrom(client) : null;
  } catch {
    return null;
  }
}
