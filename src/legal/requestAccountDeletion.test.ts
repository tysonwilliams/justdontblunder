import { describe, expect, it, vi } from 'vitest';

import { deleteSignedInAccount, requestAccountDeletion } from '@/src/legal/requestAccountDeletion';

vi.mock('@/src/data/supabase', () => ({
  getSupabase: () => null,
}));

vi.mock('@/src/store/eraseDeviceData', () => ({
  eraseDeviceData: vi.fn(),
}));

describe('deleteSignedInAccount', () => {
  it('calls the RPC, signs out, then erases the device', async () => {
    const calls: string[] = [];
    const result = await deleteSignedInAccount({
      getUserId: async () => {
        calls.push('session');
        return 'user-1';
      },
      deleteAccount: async () => {
        calls.push('rpc');
      },
      signOut: async () => {
        calls.push('sign-out');
      },
      eraseLocal: async () => {
        calls.push('erase');
      },
    });
    expect(result).toEqual({ status: 'deleted' });
    expect(calls).toEqual(['session', 'rpc', 'sign-out', 'erase']);
  });

  it('does not call the RPC for a guest', async () => {
    const calls: string[] = [];
    const result = await deleteSignedInAccount({
      getUserId: async () => null,
      deleteAccount: async () => {
        calls.push('rpc');
      },
      signOut: async () => {
        calls.push('sign-out');
      },
      eraseLocal: async () => {
        calls.push('erase');
      },
    });
    expect(result).toEqual({ status: 'guest' });
    expect(calls).toEqual([]);
  });

  it('leaves the device copy in place when the RPC fails', async () => {
    const calls: string[] = [];
    const result = await deleteSignedInAccount({
      getUserId: async () => 'user-1',
      deleteAccount: async () => {
        calls.push('rpc');
        throw new Error('not authenticated');
      },
      signOut: async () => {
        calls.push('sign-out');
      },
      eraseLocal: async () => {
        calls.push('erase');
      },
    });
    expect(result).toEqual({ status: 'failed' });
    expect(calls).toEqual(['rpc']);
  });

  it('still erases the device when sign-out fails after the account is gone', async () => {
    const calls: string[] = [];
    const result = await deleteSignedInAccount({
      getUserId: async () => 'user-1',
      deleteAccount: async () => {
        calls.push('rpc');
      },
      signOut: async () => {
        calls.push('sign-out');
        throw new Error('session already ended');
      },
      eraseLocal: async () => {
        calls.push('erase');
      },
    });
    expect(result).toEqual({ status: 'deleted' });
    expect(calls).toEqual(['rpc', 'sign-out', 'erase']);
  });

  it('reports a deleted account when the device erase fails', async () => {
    const result = await deleteSignedInAccount({
      getUserId: async () => 'user-1',
      deleteAccount: async () => undefined,
      signOut: async () => undefined,
      eraseLocal: async () => {
        throw new Error('storage');
      },
    });
    expect(result).toEqual({ status: 'deleted-local-failed' });
  });
});

describe('requestAccountDeletion without a client', () => {
  it('stays on the device and does not fetch', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('should not fetch'));
    try {
      await expect(requestAccountDeletion()).resolves.toEqual({ status: 'guest' });
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
  });
});
