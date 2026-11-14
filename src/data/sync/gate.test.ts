import { afterEach, describe, expect, it, vi } from 'vitest';

const getSupabase = vi.hoisted(() => vi.fn());

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async () => null,
    setItem: async () => undefined,
    removeItem: async () => undefined,
  },
}));

vi.mock('@/src/data/supabase', () => ({
  getSupabase,
  isSyncEnabled: () => process.env.EXPO_PUBLIC_SYNC_ENABLED === 'true',
  syncClientFrom: vi.fn(),
}));

import { shouldSyncNow, startProgressSync } from '@/src/data/sync/gate';

describe('progress sync gate', () => {
  afterEach(() => {
    delete process.env.EXPO_PUBLIC_SYNC_ENABLED;
    getSupabase.mockReset();
  });

  it('does not create a client when the flag is off', () => {
    const stop = startProgressSync();
    expect(getSupabase).not.toHaveBeenCalled();
    stop();
  });

  it('stops before opening a socket when the flag is on and no client exists', () => {
    process.env.EXPO_PUBLIC_SYNC_ENABLED = 'true';
    getSupabase.mockReturnValue(null);
    const stop = startProgressSync();
    expect(getSupabase).toHaveBeenCalledOnce();
    stop();
  });

  it('requires a session, a hydrated store, and a quiet scan', () => {
    expect(
      shouldSyncNow({ enabled: true, configured: true, userId: 'user-1', hydrated: true, scanning: false }),
    ).toBe(true);
    expect(
      shouldSyncNow({ enabled: false, configured: true, userId: 'user-1', hydrated: true, scanning: false }),
    ).toBe(false);
    expect(
      shouldSyncNow({ enabled: true, configured: false, userId: 'user-1', hydrated: true, scanning: false }),
    ).toBe(false);
    expect(shouldSyncNow({ enabled: true, configured: true, userId: null, hydrated: true, scanning: false })).toBe(
      false,
    );
    expect(
      shouldSyncNow({ enabled: true, configured: true, userId: 'user-1', hydrated: false, scanning: false }),
    ).toBe(false);
    expect(
      shouldSyncNow({ enabled: true, configured: true, userId: 'user-1', hydrated: true, scanning: true }),
    ).toBe(false);
  });
});
