import type { AuthApi } from '@/src/auth/types';

/**
 * Device erase while signed in would otherwise sync the blank document and pull the account back.
 * Sign out first so the erase stays on this device. The synced copy remains until account deletion.
 */
export async function signOutBeforeDeviceErase(
  api: Pick<AuthApi, 'getSession' | 'signOut'> | null,
): Promise<'guest' | 'signed-out' | 'failed'> {
  if (!api) return 'guest';
  const session = await api.getSession();
  if (!session.userId) return 'guest';
  const { error } = await api.signOut();
  return error ? 'failed' : 'signed-out';
}
