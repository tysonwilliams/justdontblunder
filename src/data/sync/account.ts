import { SyncError } from '@/src/data/sync/types';

type RpcClient = {
  rpc(fn: string): PromiseLike<{ error: { message: string } | null }>;
};

/** Deletes the signed-in account. There is no button for this yet. */
export async function deleteMyAccount(client: RpcClient): Promise<void> {
  const { error } = await client.rpc('delete_my_account');
  if (error) throw new SyncError(error.message);
}
