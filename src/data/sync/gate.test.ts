import { afterEach, describe, expect, it, vi } from 'vitest';

const loadSupabase = vi.hoisted(() => vi.fn());
const getSupabasePublicConfig = vi.hoisted(() => vi.fn());
const createSupabaseProgressRepo = vi.hoisted(() => vi.fn());

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async () => null,
    setItem: async () => undefined,
    removeItem: async () => undefined,
  },
}));

vi.mock('@/src/data/supabaseConfig', () => ({
  getSupabasePublicConfig,
  isSyncEnabled: () => process.env.EXPO_PUBLIC_SYNC_ENABLED !== 'false',
}));

vi.mock('@/src/data/supabaseLazy', () => ({
  loadSupabase,
}));

vi.mock('@/src/data/sync/supabaseRepo', () => ({
  createSupabaseProgressRepo,
}));

import { shouldSyncNow, startProgressSync } from '@/src/data/sync/gate';
import { useProgressStore } from '@/src/store/progress';

function authClient(session: { user: { id: string } } | null) {
  return {
    auth: {
      onAuthStateChange(callback: (event: string, next: { user: { id: string } } | null) => void) {
        callback(session ? 'SIGNED_IN' : 'INITIAL_SESSION', session);
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      },
    },
  };
}

describe('progress sync gate', () => {
  afterEach(() => {
    vi.useRealTimers();
    delete process.env.EXPO_PUBLIC_SYNC_ENABLED;
    loadSupabase.mockReset();
    getSupabasePublicConfig.mockReset();
    createSupabaseProgressRepo.mockReset();
    useProgressStore.getState().resetProgress();
  });

  it('does not load Supabase when the kill switch is false or config is missing', () => {
    getSupabasePublicConfig.mockReturnValue({ url: 'https://example.supabase.co', anonKey: 'sb_publishable_test' });
    process.env.EXPO_PUBLIC_SYNC_ENABLED = 'false';
    const stopKill = startProgressSync();
    expect(loadSupabase).not.toHaveBeenCalled();
    stopKill();

    delete process.env.EXPO_PUBLIC_SYNC_ENABLED;
    getSupabasePublicConfig.mockReturnValue(null);
    const stopUnconfigured = startProgressSync();
    expect(loadSupabase).not.toHaveBeenCalled();
    stopUnconfigured();
  });

  it('stops before opening a socket when no client exists', async () => {
    getSupabasePublicConfig.mockReturnValue({ url: 'https://example.supabase.co', anonKey: 'sb_publishable_test' });
    loadSupabase.mockResolvedValue(null);
    const stop = startProgressSync();
    await Promise.resolve();
    expect(loadSupabase).toHaveBeenCalledOnce();
    expect(createSupabaseProgressRepo).not.toHaveBeenCalled();
    stop();
  });

  it('does not sync a guest when the flag is unset', async () => {
    await useProgressStore.persist.rehydrate();
    getSupabasePublicConfig.mockReturnValue({ url: 'https://example.supabase.co', anonKey: 'sb_publishable_test' });
    loadSupabase.mockResolvedValue(authClient(null));
    vi.useFakeTimers();
    const stop = startProgressSync();
    await vi.advanceTimersByTimeAsync(2000);
    expect(loadSupabase).toHaveBeenCalledOnce();
    expect(createSupabaseProgressRepo).not.toHaveBeenCalled();
    stop();
  });

  it('merges once on sign-in and pushes subsequent local edits without reverting them', async () => {
    await useProgressStore.persist.rehydrate();
    getSupabasePublicConfig.mockReturnValue({ url: 'https://example.supabase.co', anonKey: 'sb_publishable_test' });
    const mergeOnSignIn = vi.fn(async () => ({}));
    const push = vi.fn(async () => undefined);
    createSupabaseProgressRepo.mockReturnValue({ mergeOnSignIn, push });
    loadSupabase.mockResolvedValue(authClient({ user: { id: 'user-1' } }));
    vi.useFakeTimers();
    const stop = startProgressSync();
    await vi.advanceTimersByTimeAsync(1600);
    expect(createSupabaseProgressRepo).toHaveBeenCalledWith(expect.anything(), 'user-1', expect.anything());
    expect(mergeOnSignIn).toHaveBeenCalledOnce();
    expect(push).not.toHaveBeenCalled();
    expect(mergeOnSignIn).toHaveBeenCalledWith(
      expect.objectContaining({
        progress: expect.objectContaining({
          training: expect.objectContaining({ xp: useProgressStore.getState().xp }),
        }),
      }),
    );

    // A later local edit (e.g. saving a review card) must push, never re-merge against stale remote.
    useProgressStore.getState().markDrillResult(true, 'hanging');
    await vi.advanceTimersByTimeAsync(1600);
    expect(mergeOnSignIn).toHaveBeenCalledOnce();
    expect(push).toHaveBeenCalledOnce();
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
