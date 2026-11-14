import { describe, expect, it, vi } from 'vitest';

import { requestAccountDeletion } from '@/src/legal/requestAccountDeletion';

describe('requestAccountDeletion', () => {
  it('stays inert until accounts can call delete_my_account', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('should not fetch'));
    try {
      await expect(requestAccountDeletion()).resolves.toEqual({ status: 'unavailable' });
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
  });
});
