import { beforeEach, describe, expect, it, vi } from 'vitest';

const memory = vi.hoisted(() => new Map<string, string>());

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (key: string) => memory.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      memory.set(key, value);
    },
    removeItem: async (key: string) => {
      memory.delete(key);
    },
  },
}));

import AsyncStorage from '@react-native-async-storage/async-storage';

import { FEEDBACK_STORAGE_KEY } from '@/src/feedback/settings';
import { eraseDeviceData } from '@/src/store/eraseDeviceData';
import { resetOwnScanForTests, runOwnScan } from '@/src/store/ownGames';
import { useProgressStore } from '@/src/store/progress';
import { blankPersisted, partializeProgress, PROGRESS_STORAGE_KEY } from '@/src/store/progressMigrate';
import {
  beginCoalescedPersist,
  flushCoalescedPersistForTests,
  resetProgressPersistForTests,
  setScanPersistIntervalForTests,
} from '@/src/store/progressStorage';
import type { ScanProgress } from '@/src/store/progressTypes';
import { THEME_STORAGE_KEY } from '@/src/theme/preference';

const CURSOR = {
  site: 'lichess' as const,
  username: 'Ada',
  seen: ['pending-game'],
  newestMs: 1_700_000_000_000,
  doneArchives: [],
  lichessUntil: 1_699_000_000_000,
  backfillDone: false,
  games: 4,
  resume: true,
};

function pausedScan(): ScanProgress {
  return {
    phase: 'paused',
    found: 2,
    games: 4,
    message: 'Scan paused.',
    incoming: false,
    cursor: { ...CURSOR, seen: [...CURSOR.seen] },
  };
}

describe('erase device data', () => {
  beforeEach(async () => {
    memory.clear();
    resetOwnScanForTests();
    resetProgressPersistForTests();
    if (!useProgressStore.persist.hasHydrated()) await useProgressStore.persist.rehydrate();
    useProgressStore.getState().resetProgress();
    await flushCoalescedPersistForTests();
    memory.delete(PROGRESS_STORAGE_KEY);
  });

  it('clears saved progress and the scan cursor, and leaves theme and sound', async () => {
    memory.set(THEME_STORAGE_KEY, JSON.stringify({ state: { preference: 'dark' }, version: 0 }));
    memory.set(FEEDBACK_STORAGE_KEY, JSON.stringify({ state: { sound: false, haptics: true }, version: 0 }));
    useProgressStore.setState({
      xp: 80,
      dailyStreak: 3,
      experience: 'basics',
      welcomeSkipped: true,
      drillsPromptSkipped: true,
      gameProfile: { site: 'lichess', username: 'Ada' },
      review: [{ id: 'hang-q-01', saves: 1, intervalDays: 1, dueOn: '2026-04-01' }],
      missedIds: ['hang-q-01'],
      scan: pausedScan(),
      scanPromptDismissed: true,
    });
    await flushCoalescedPersistForTests();
    expect(memory.get(PROGRESS_STORAGE_KEY)).toContain('pending-game');

    await eraseDeviceData();

    const state = useProgressStore.getState();
    expect(partializeProgress(state)).toEqual(blankPersisted());
    expect(state.scan.cursor).toBeNull();
    expect(state.scan.phase).toBe('idle');
    expect(state.xp).toBe(0);
    expect(state.gameProfile).toBeNull();
    expect(state.experience).toBeNull();
    expect(state.welcomeSkipped).toBe(false);
    expect(state.review).toEqual([]);
    expect(state.scanPromptDismissed).toBe(false);
    expect(state.markDrillResult).toEqual(expect.any(Function));
    expect(memory.has(PROGRESS_STORAGE_KEY)).toBe(false);
    expect(memory.get(THEME_STORAGE_KEY)).toContain('dark');
    expect(memory.get(FEEDBACK_STORAGE_KEY)).toContain('haptics');

    await useProgressStore.persist.rehydrate();
    expect(useProgressStore.getState().xp).toBe(0);
    expect(useProgressStore.getState().scan.cursor).toBeNull();
    expect(memory.get(THEME_STORAGE_KEY)).toContain('dark');
  });

  it('drops a scan cursor that is still waiting to be written', async () => {
    setScanPersistIntervalForTests(60_000);
    beginCoalescedPersist();
    useProgressStore.setState({ xp: 1 });
    await flushCoalescedPersistForTests();
    useProgressStore.setState({ xp: 40, scan: pausedScan() });
    expect(memory.get(PROGRESS_STORAGE_KEY) ?? '').not.toContain('pending-game');

    await eraseDeviceData();
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(useProgressStore.getState().xp).toBe(0);
    expect(useProgressStore.getState().scan.cursor).toBeNull();
    expect(memory.get(PROGRESS_STORAGE_KEY) ?? '').not.toContain('pending-game');
    expect(memory.has(PROGRESS_STORAGE_KEY)).toBe(false);
  });

  it('does not let an in-flight save put the old cursor back', async () => {
    let release = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let started = () => {};
    const startedPromise = new Promise<void>((resolve) => {
      started = resolve;
    });
    const setItem = vi.spyOn(AsyncStorage, 'setItem').mockImplementation(async (key, value) => {
      if (String(value).includes('pending-game')) {
        started();
        await gate;
      }
      memory.set(String(key), String(value));
    });

    try {
      useProgressStore.setState({ xp: 80, scan: pausedScan() });
      await startedPromise;
      const erasing = eraseDeviceData();
      release();
      await erasing;
      await flushCoalescedPersistForTests();
      expect(memory.has(PROGRESS_STORAGE_KEY)).toBe(false);
      expect(useProgressStore.getState().scan.cursor).toBeNull();
      expect(useProgressStore.getState().xp).toBe(0);
    } finally {
      release();
      setItem.mockRestore();
    }
  });

  it('stops a running username scan from saving its cursor after the erase', async () => {
    setScanPersistIntervalForTests(60_000);
    let release = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const pending = runOwnScan(
      'lichess',
      'Ada',
      async () => {
        await gate;
        return {
          ok: true,
          status: 200,
          headers: { get: () => null },
          json: async () => ({}),
          text: async () => '',
        };
      },
      { sleep: async () => undefined },
    );
    await vi.waitFor(() => {
      expect(useProgressStore.getState().scan.phase).toBe('scanning');
    });

    const erasing = eraseDeviceData();
    release();
    await erasing;
    await pending;

    expect(useProgressStore.getState().scan.phase).toBe('idle');
    expect(useProgressStore.getState().scan.cursor).toBeNull();
    expect(useProgressStore.getState().gameProfile).toBeNull();
    expect(memory.get(PROGRESS_STORAGE_KEY) ?? '').not.toContain('Ada');
  });

  it('ignores a progress read that finishes after the erase starts', async () => {
    useProgressStore.setState({ xp: 55, scan: pausedScan(), experience: 'basics' });
    await flushCoalescedPersistForTests();
    const saved = memory.get(PROGRESS_STORAGE_KEY);
    expect(saved).toContain('pending-game');
    useProgressStore.setState({ xp: 0, scan: { phase: 'idle', found: 0, games: 0, message: '', incoming: false, cursor: null } });

    let release = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const getItem = vi.spyOn(AsyncStorage, 'getItem').mockImplementation(async (key) => {
      if (String(key) === PROGRESS_STORAGE_KEY) {
        await gate;
        return saved ?? null;
      }
      return memory.get(String(key)) ?? null;
    });
    try {
      const hydrating = useProgressStore.persist.rehydrate();
      const erasing = eraseDeviceData();
      release();
      await erasing;
      await hydrating;
      expect(useProgressStore.getState().xp).toBe(0);
      expect(useProgressStore.getState().scan.cursor).toBeNull();
      expect(useProgressStore.getState().experience).toBeNull();
      expect(memory.get(PROGRESS_STORAGE_KEY) ?? '').not.toContain('pending-game');
    } finally {
      release();
      getItem.mockRestore();
    }
  });

  it('saves a new drill after the erase without the old cursor', async () => {
    useProgressStore.setState({ xp: 80, scan: pausedScan(), gameProfile: { site: 'chesscom', username: 'Ada' } });
    await flushCoalescedPersistForTests();
    await eraseDeviceData();

    useProgressStore.getState().markDrillResult(true, 'fork');
    await flushCoalescedPersistForTests();

    const raw = memory.get(PROGRESS_STORAGE_KEY);
    expect(raw).toBeTruthy();
    const saved = JSON.parse(raw ?? '') as {
      state: { training: { drillsCompleted: number }; scan: { cursor: unknown; phase: string } };
    };
    expect(saved.state.training.drillsCompleted).toBe(1);
    expect(saved.state.scan.cursor).toBeNull();
    expect(saved.state.scan.phase).toBe('idle');
    expect(raw).not.toContain('pending-game');
    expect(raw).not.toContain('Ada');
  });
});
