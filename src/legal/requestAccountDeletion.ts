import { useCallback } from 'react';

import { deleteMyAccount } from '@/src/data/sync/account';
import { loadSupabase, loadSupabaseAuth } from '@/src/data/supabaseLazy';
import { eraseDeviceData } from '@/src/store/eraseDeviceData';

export type AccountDeletionResult =
  | { status: 'deleted' }
  | { status: 'deleted-local-failed' }
  | { status: 'guest' }
  | { status: 'failed' };

/**
 * Deletes the signed-in account, then signs out, then erases the device copy.
 * A guest never calls the RPC. A failed RPC leaves the session and the device copy in place.
 */
export async function deleteSignedInAccount(deps: {
  getUserId: () => Promise<string | null>;
  deleteAccount: () => Promise<void>;
  signOut: () => Promise<void>;
  eraseLocal: () => Promise<void>;
}): Promise<AccountDeletionResult> {
  const userId = await deps.getUserId();
  if (!userId) return { status: 'guest' };
  try {
    await deps.deleteAccount();
  } catch {
    return { status: 'failed' };
  }
  try {
    await deps.signOut();
  } catch {
    // The auth user is already gone. Still clear this device.
  }
  try {
    await deps.eraseLocal();
  } catch {
    return { status: 'deleted-local-failed' };
  }
  return { status: 'deleted' };
}

export async function requestAccountDeletion(): Promise<AccountDeletionResult> {
  const [client, api] = await Promise.all([loadSupabase(), loadSupabaseAuth()]);
  if (!client || !api) return { status: 'guest' };
  return deleteSignedInAccount({
    getUserId: async () => (await api.getSession()).userId,
    deleteAccount: () => deleteMyAccount(client),
    signOut: async () => {
      const { error } = await api.signOut();
      if (error) throw new Error(error.message);
    },
    eraseLocal: () => eraseDeviceData(),
  });
}

export function useRequestAccountDeletion(): () => Promise<AccountDeletionResult> {
  return useCallback(() => requestAccountDeletion(), []);
}
