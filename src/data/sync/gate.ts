import { snapshotFromProgress } from '@/src/data/sync/map';
import { createLocalProgressRepo } from '@/src/data/sync/localRepo';
import { createSupabaseProgressRepo } from '@/src/data/sync/supabaseRepo';
import { deviceTimeZone } from '@/src/data/sync/dates';
import type { SyncClient } from '@/src/data/sync/types';
import { getSupabase, isSyncEnabled, syncClientFrom } from '@/src/data/supabase';
import { ownScanRunning } from '@/src/store/ownGames';
import { useProgressStore } from '@/src/store/progress';
import { partializeProgress, type PersistedProgress } from '@/src/store/progressMigrate';

const PUSH_DELAY_MS = 1500;

export function shouldSyncNow(input: {
  enabled: boolean;
  configured: boolean;
  userId: string | null;
  hydrated: boolean;
  scanning: boolean;
}): boolean {
  return input.enabled && input.configured && input.userId !== null && input.hydrated && !input.scanning;
}

/**
 * Push local changes and pull on sign-in.
 * Returns immediately when EXPO_PUBLIC_SYNC_ENABLED is the string "false", or when no
 * publishable client exists. A guest session never calls the progress repo.
 */
export function startProgressSync(): () => void {
  if (!isSyncEnabled()) return () => undefined;
  const supabase = safeClient();
  if (!supabase) return () => undefined;
  const client = syncClientFrom(supabase);
  return watch(client, supabase);
}

function safeClient(): ReturnType<typeof getSupabase> {
  try {
    return getSupabase();
  } catch {
    return null;
  }
}

function watch(client: SyncClient, supabase: NonNullable<ReturnType<typeof getSupabase>>): () => void {
  let userId: string | null = null;
  let mergedUserId: string | null = null;
  let writing = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;
  let syncing = false;
  let again = false;
  let unsubHydration: (() => void) | null = null;

  const local = createLocalProgressRepo({
    read: () => partializeProgress(useProgressStore.getState()),
    write: (progress) => {
      // Sign-out and account deletion clear userId. A merge already in flight must not restore the old document.
      if (!userId) return;
      writing = true;
      try {
        useProgressStore.setState(progressFields(progress));
      } finally {
        writing = false;
      }
    },
  });

  const sync = () => {
    if (stopped || !userId) return;
    if (syncing) {
      again = true;
      return;
    }
    const current = useProgressStore.getState();
    if (
      !shouldSyncNow({
        enabled: isSyncEnabled(),
        configured: true,
        userId,
        hydrated: useProgressStore.persist.hasHydrated(),
        scanning: ownScanRunning() || current.scan.phase === 'scanning',
      })
    ) {
      return;
    }
    const activeUserId = userId;
    const repo = createSupabaseProgressRepo(client, activeUserId, local);
    const snapshot = snapshotFromProgress(partializeProgress(current), { timezone: deviceTimeZone() });
    const needsMerge = mergedUserId !== activeUserId;
    syncing = true;
    const op = needsMerge
      ? repo.mergeOnSignIn(snapshot).then(() => {
          if (userId === activeUserId) mergedUserId = activeUserId;
        })
      : repo.push(snapshot);
    void op
      .catch(() => undefined)
      .finally(() => {
        syncing = false;
        if (!again || stopped) {
          again = false;
          return;
        }
        again = false;
        sync();
      });
  };

  const schedule = () => {
    if (stopped) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(sync, PUSH_DELAY_MS);
  };

  const unsubStore = useProgressStore.subscribe(() => {
    if (writing || !userId) return;
    schedule();
  });

  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    const nextUserId = session?.user.id ?? null;
    if (nextUserId !== userId) {
      mergedUserId = null;
    }
    userId = nextUserId;
    if (!userId) {
      if (timer) clearTimeout(timer);
      return;
    }
    if (event !== 'SIGNED_IN' && event !== 'INITIAL_SESSION') return;
    if (useProgressStore.persist.hasHydrated()) {
      schedule();
      return;
    }
    if (unsubHydration) return;
    unsubHydration = useProgressStore.persist.onFinishHydration(() => {
      unsubHydration?.();
      unsubHydration = null;
      if (!stopped) schedule();
    });
  });

  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    unsubHydration?.();
    unsubHydration = null;
    unsubStore();
    data.subscription.unsubscribe();
  };
}

function progressFields(progress: PersistedProgress) {
  return {
    ...progress.training,
    missedDate: progress.review.missedDate,
    review: progress.review.review,
    missedIds: progress.review.missedIds,
    ownDrills: progress.library.ownDrills,
    pastedIds: progress.library.pastedIds,
    gameProfile: progress.library.gameProfile,
    experience: progress.preferences.experience,
    welcomeSkipped: progress.preferences.welcomeSkipped,
    drillsPromptSkipped: progress.preferences.drillsPromptSkipped,
    scan: progress.scan,
  };
}
