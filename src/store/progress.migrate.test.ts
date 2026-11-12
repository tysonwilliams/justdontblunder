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

import { drillFromHang } from '@/src/logic/personalDrill';
import {
  blankPersisted,
  migrateProgress,
  partializeProgress,
  PROGRESS_STORAGE_KEY,
  PROGRESS_VERSION,
} from '@/src/store/progressMigrate';
import { flushCoalescedPersistForTests } from '@/src/store/progressStorage';
import { useProgressStore } from '@/src/store/progress';

const HANGING_QUEEN = 'rnbqkb1r/pppp1ppp/5n2/4p2Q/4P3/8/PPPP1PPP/RNB1KBNR w KQkq - 2 3';

function legacyBlob(state: Record<string, unknown>, version: number | undefined = 0) {
  return version === undefined ? { state } : { state, version };
}

describe('progress migration', () => {
  beforeEach(async () => {
    memory.clear();
    if (!useProgressStore.persist.hasHydrated()) await useProgressStore.persist.rehydrate();
    useProgressStore.getState().resetProgress();
    await flushCoalescedPersistForTests();
  });

  it('lifts a flat v0 blob into slices without dropping saved progress', () => {
    const drill = drillFromHang(HANGING_QUEEN);
    expect(drill).toBeTruthy();
    if (!drill) return;
    const migrated = migrateProgress(
      {
        dailyStreak: 4,
        lastDrillDate: '2026-11-11',
        drillsCompleted: 9,
        drillsCorrect: 6,
        blundersAvoided: 7,
        blundersMade: 3,
        practiceMoves: 5,
        themeStats: { hanging: { attempts: 2, correct: 1 }, junk: { attempts: 1, correct: 0 } },
        recordStreak: 8,
        bestPuzzleStreak: 4,
        xp: 60,
        completedLessons: ['hanging', 'hanging', 3],
        missedDate: '2026-11-01',
        missedIds: ['stale-id'],
        review: [
          { id: 'hang-q-01', saves: 1 },
          { id: drill.id, saves: 0, drill },
        ],
        ownDrills: [drill, { id: 'bad' }],
        pastedIds: [drill.id, drill.id, 4],
        gameProfile: { site: 'lichess', username: 'Me' },
        experience: 'basics',
        welcomeSkipped: true,
        drillsPromptSkipped: true,
        scan: { phase: 'done', found: 1, games: 4, message: '1 from your games.', incoming: true },
        scanPromptDismissed: true,
      },
      0,
    );

    expect(migrated.training).toMatchObject({
      dailyStreak: 4,
      lastDrillDate: '2026-11-11',
      drillsCompleted: 9,
      drillsCorrect: 6,
      blundersAvoided: 7,
      blundersMade: 3,
      practiceMoves: 5,
      recordStreak: 8,
      bestPuzzleStreak: 4,
      xp: 60,
      completedLessons: ['hanging'],
    });
    expect(migrated.training.themeStats).toEqual({ hanging: { attempts: 2, correct: 1 } });
    expect(migrated.review.review.map((entry) => entry.id)).toEqual(['hang-q-01', drill.id]);
    expect(migrated.review.missedIds).toEqual(['hang-q-01', drill.id]);
    expect(migrated.review.missedDate).toBe('2026-11-01');
    expect(migrated.review.review[1]?.drill?.fen).toBe(drill.fen);
    expect(migrated.library.ownDrills.map((item) => item.id)).toEqual([drill.id]);
    expect(migrated.library.pastedIds).toEqual([drill.id]);
    expect(migrated.library.gameProfile).toEqual({ site: 'lichess', username: 'Me' });
    expect(migrated.preferences).toEqual({
      experience: 'basics',
      welcomeSkipped: true,
      drillsPromptSkipped: true,
    });
    expect(migrated.scan).toEqual({
      phase: 'done',
      found: 1,
      games: 4,
      message: '1 from your games.',
      incoming: false,
    });
  });

  it('keeps an older miss list that has not been stored as review entries', () => {
    const migrated = migrateProgress({ missedIds: ['hang-q-01'] }, 0);
    expect(migrated.review.review).toEqual([{ id: 'hang-q-01', saves: 0 }]);
    expect(migrated.review.missedIds).toEqual(['hang-q-01']);
  });

  it('drops a scan that was still running and fills a partial welcome seed', () => {
    expect(migrateProgress({ scan: { phase: 'scanning', found: 3, games: 8, message: 'Looking', incoming: true } }, 0).scan).toEqual(
      { phase: 'idle', found: 0, games: 0, message: '', incoming: false },
    );
    const seeded = migrateProgress(
      { welcomeSkipped: true, experience: 'basics', drillsPromptSkipped: true },
      0,
    );
    expect(seeded.preferences).toEqual({
      experience: 'basics',
      welcomeSkipped: true,
      drillsPromptSkipped: true,
    });
    expect(seeded.training.dailyStreak).toBe(0);
    expect(seeded.library.ownDrills).toEqual([]);
    expect(seeded.review.review).toEqual([]);
    expect(seeded.scan.phase).toBe('idle');
  });

  it('loads a saved v0 document through the store and writes version 1', async () => {
    const drill = drillFromHang(HANGING_QUEEN);
    expect(drill).toBeTruthy();
    if (!drill) return;
    memory.set(
      PROGRESS_STORAGE_KEY,
      JSON.stringify(
        legacyBlob({
          dailyStreak: 4,
          lastDrillDate: '2026-11-11',
          drillsCompleted: 9,
          xp: 60,
          completedLessons: ['fork'],
          review: [{ id: drill.id, saves: 0, drill }],
          ownDrills: [drill],
          pastedIds: [drill.id],
          gameProfile: { site: 'chesscom', username: 'Me' },
          experience: 'new',
          welcomeSkipped: true,
          drillsPromptSkipped: false,
          bestPuzzleStreak: 2,
          scan: { phase: 'error', found: 1, games: 2, message: 'Stopped', incoming: true },
          scanPromptDismissed: true,
        }),
      ),
    );

    await useProgressStore.persist.rehydrate();
    const state = useProgressStore.getState();
    expect(state.dailyStreak).toBe(4);
    expect(state.lastDrillDate).toBe('2026-11-11');
    expect(state.drillsCompleted).toBe(9);
    expect(state.xp).toBe(60);
    expect(state.completedLessons).toEqual(['fork']);
    expect(state.review[0]?.drill?.fen).toBe(drill.fen);
    expect(state.missedIds).toEqual([drill.id]);
    expect(state.ownDrills).toHaveLength(1);
    expect(state.pastedIds).toEqual([drill.id]);
    expect(state.gameProfile).toEqual({ site: 'chesscom', username: 'Me' });
    expect(state.experience).toBe('new');
    expect(state.welcomeSkipped).toBe(true);
    expect(state.bestPuzzleStreak).toBe(2);
    expect(state.scan).toMatchObject({ phase: 'error', incoming: false, found: 1 });
    expect(state.scanPromptDismissed).toBe(false);
    expect(state.markDrillResult).toEqual(expect.any(Function));

    const raw = memory.get(PROGRESS_STORAGE_KEY);
    expect(raw).toBeTruthy();
    const written = JSON.parse(raw ?? '') as { version: number; state: { training: { dailyStreak: number }; library: { ownDrills: unknown[] } } };
    expect(written.version).toBe(PROGRESS_VERSION);
    expect(written.state.training.dailyStreak).toBe(4);
    expect(written.state.library.ownDrills).toHaveLength(1);

    useProgressStore.getState().resetProgress();
    await flushCoalescedPersistForTests();
    memory.set(PROGRESS_STORAGE_KEY, raw ?? '');
    await useProgressStore.persist.rehydrate();
    expect(useProgressStore.getState().dailyStreak).toBe(4);
    expect(useProgressStore.getState().ownDrills[0]?.fen).toBe(drill.fen);
    expect(useProgressStore.getState().review[0]?.id).toBe(drill.id);
    expect(useProgressStore.getState().experience).toBe('new');
    expect(useProgressStore.getState().scan.phase).toBe('error');
    expect(useProgressStore.getState().markDrillResult).toEqual(expect.any(Function));
  });

  it('loads a versionless flat blob, and the next save is sliced', async () => {
    memory.set(
      PROGRESS_STORAGE_KEY,
      JSON.stringify({
        state: { dailyStreak: 3, welcomeSkipped: true, experience: 'basics', xp: 20 },
      }),
    );
    await useProgressStore.persist.rehydrate();
    expect(useProgressStore.getState().dailyStreak).toBe(3);
    expect(useProgressStore.getState().xp).toBe(20);
    expect(useProgressStore.getState().welcomeSkipped).toBe(true);
    expect(useProgressStore.getState().experience).toBe('basics');

    useProgressStore.getState().skipDrillsPrompt();
    await flushCoalescedPersistForTests();
    const written = JSON.parse(memory.get(PROGRESS_STORAGE_KEY) ?? '') as {
      version: number;
      state: { training: { dailyStreak: number; xp: number }; preferences: { drillsPromptSkipped: boolean } };
    };
    expect(written.version).toBe(PROGRESS_VERSION);
    expect(written.state.training).toMatchObject({ dailyStreak: 3, xp: 20 });
    expect(written.state.preferences.drillsPromptSkipped).toBe(true);
  });

  it('round-trips the blank store and leaves the scan prompt out of the document', () => {
    useProgressStore.getState().resetProgress();
    useProgressStore.setState({ scanPromptDismissed: true });
    const saved = partializeProgress(useProgressStore.getState());
    expect(saved).toEqual(blankPersisted());
    expect(saved).not.toHaveProperty('scanPromptDismissed');
    expect(JSON.stringify(saved)).not.toContain('markDrillResult');
  });
});
