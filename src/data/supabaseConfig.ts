/**
 * Lightweight Supabase environment checks with zero SDK dependency.
 * Keeps `@supabase/supabase-js` out of the initial bundle and off guest sessions.
 */

/**
 * Sync is allowed unless this is exactly "false".
 * Unset and "true" both allow sync once a publishable client and a session exist.
 */
export function isSyncEnabled(): boolean {
  return process.env.EXPO_PUBLIC_SYNC_ENABLED !== 'false';
}

/** URL and publishable key, or null when the client would refuse to start. */
export function getSupabasePublicConfig(): { url: string; anonKey: string } | null {
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
