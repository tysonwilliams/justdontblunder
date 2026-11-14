import { describe, expect, it } from 'vitest';

import { deleteMyAccount } from '@/src/data/sync/account';
import { SyncError } from '@/src/data/sync/types';

describe('deleteMyAccount', () => {
  it('calls the account RPC and surfaces a database error', async () => {
    const calls: string[] = [];
    await deleteMyAccount({
      rpc(fn) {
        calls.push(fn);
        return Promise.resolve({ error: null });
      },
    });
    expect(calls).toEqual(['delete_my_account']);

    await expect(
      deleteMyAccount({
        rpc() {
          return Promise.resolve({ error: { message: 'not authenticated' } });
        },
      }),
    ).rejects.toBeInstanceOf(SyncError);
  });
});
