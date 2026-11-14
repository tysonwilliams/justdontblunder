import { useCallback } from 'react';

/**
 * Later this calls the `delete_my_account` RPC and deletes the signed-in
 * account plus its synced rows. Accounts are not wired up, so the call does nothing.
 */
export type AccountDeletionResult = { status: 'unavailable' };

export async function requestAccountDeletion(): Promise<AccountDeletionResult> {
  return { status: 'unavailable' };
}

export function useRequestAccountDeletion(): () => Promise<AccountDeletionResult> {
  return useCallback(() => requestAccountDeletion(), []);
}
