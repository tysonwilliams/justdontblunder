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

import { Chess } from 'chess.js';

import { pastedGameDrills } from '@/src/logic/gameImport';
import { localDateKey } from '@/src/logic/localDate';
import { drillFromHang } from '@/src/logic/personalDrill';
import { SCAN_PAUSED_MESSAGE } from '@/src/logic/scanCursor';
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
      cursor: null,
    });
  });

  it('keeps an older miss list that has not been stored as review entries', () => {
    const migrated = migrateProgress({ missedIds: ['hang-q-01'] }, 0);
    expect(migrated.review.review).toEqual([
      { id: 'hang-q-01', saves: 0, intervalDays: 0, dueOn: localDateKey() },
    ]);
    expect(migrated.review.missedIds).toEqual(['hang-q-01']);
  });

  it('drops a scan that was still running and fills a partial welcome seed', () => {
    expect(migrateProgress({ scan: { phase: 'scanning', found: 3, games: 8, message: 'Looking', incoming: true } }, 0).scan).toEqual(
      { phase: 'idle', found: 0, games: 0, message: '', incoming: false, cursor: null },
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

  it('loads a saved v0 document through the store and writes the current version', async () => {
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

  it('reloads a flat blob without losing a streak, xp, an own- miss, or a pasted game', async () => {
    const game = new Chess();
    game.move('e4');
    game.move('Nf6');
    game.move('c3');
    game.move('a6');
    game.move('Qh5');
    game.move('Nxh5');
    const pasted = pastedGameDrills(game.pgn(), 'w').drills[0];
    const missed = drillFromHang(HANGING_QUEEN);
    const scanned = drillFromHang('rnb1kbnr/ppp1pppp/8/3q4/8/2N5/PPPP1PPP/R1BQKBNR b KQkq - 1 3');
    expect(pasted?.id.startsWith('own-')).toBe(true);
    expect(missed?.id.startsWith('own-')).toBe(true);
    expect(scanned?.id.startsWith('own-')).toBe(true);
    if (!pasted || !missed || !scanned) return;
    expect(new Set([pasted.id, missed.id, scanned.id]).size).toBe(3);

    memory.set(
      PROGRESS_STORAGE_KEY,
      JSON.stringify(
        legacyBlob({
          dailyStreak: 6,
          lastDrillDate: '2026-11-13',
          xp: 80,
          missedIds: ['hang-q-01', missed.id, 'own-without-a-drill'],
          review: [
            { id: 'hang-q-01', saves: 1 },
            { id: missed.id, saves: 0, drill: missed },
            { id: 'own-without-a-drill', saves: 0 },
          ],
          ownDrills: [pasted, scanned],
          pastedIds: [pasted.id],
        }),
      ),
    );

    await useProgressStore.persist.rehydrate();
    const state = useProgressStore.getState();
    expect(state.dailyStreak).toBe(6);
    expect(state.lastDrillDate).toBe('2026-11-13');
    expect(state.xp).toBe(80);
    expect(state.review.find((entry) => entry.id === 'hang-q-01')).toMatchObject({
      saves: 0,
      intervalDays: 0,
      dueOn: localDateKey(),
    });
    expect(state.review.find((entry) => entry.id === missed.id)?.drill).toMatchObject({
      id: missed.id,
      fen: missed.fen,
      note: missed.note,
    });
    expect(state.review.some((entry) => entry.id === 'own-without-a-drill')).toBe(false);
    expect(state.missedIds).toEqual(['hang-q-01', missed.id]);
    expect(state.ownDrills.map((drill) => drill.id)).toEqual([pasted.id, scanned.id]);
    expect(state.ownDrills[0]).toMatchObject({ fen: pasted.fen, note: pasted.note });
    expect(state.ownDrills[1]).toMatchObject({ fen: scanned.fen, note: scanned.note });
    expect(state.pastedIds).toEqual([pasted.id]);

    const written = JSON.parse(memory.get(PROGRESS_STORAGE_KEY) ?? '') as {
      version: number;
      state: {
        training: { dailyStreak: number; xp: number };
        review: { review: { id: string; drill?: { fen: string } }[]; missedIds: string[] };
        library: { ownDrills: { id: string; fen: string }[]; pastedIds: string[] };
      };
    };
    expect(written.version).toBe(PROGRESS_VERSION);
    expect(written.state.training).toMatchObject({ dailyStreak: 6, xp: 80 });
    expect(written.state.review.missedIds).toEqual(['hang-q-01', missed.id]);
    expect(written.state.review.review.find((entry) => entry.id === missed.id)?.drill?.fen).toBe(missed.fen);
    expect(written.state.library.pastedIds).toEqual([pasted.id]);
    expect(written.state.library.ownDrills.map((drill) => drill.fen)).toEqual([pasted.fen, scanned.fen]);
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

  it('keeps a v2 cursor when a scan was still running, and drops a v1 scan that cannot resume', () => {
    const sliced = {
      training: { dailyStreak: 2 },
      review: { review: [] },
      library: { ownDrills: [] },
      preferences: { welcomeSkipped: true },
      scan: { phase: 'scanning', found: 3, games: 8, message: 'Looking', incoming: true },
    };
    expect(migrateProgress(sliced, 1).scan).toMatchObject({ phase: 'idle', cursor: null });

    const cursor = {
      site: 'chesscom',
      username: 'Me',
      seen: ['c:1'],
      newestMs: 30_000,
      doneArchives: ['https://api.chess.com/pub/player/me/games/2026/11'],
      lichessUntil: null,
      backfillDone: false,
      games: 6,
      resume: false,
    };
    const running = migrateProgress(
      {
        ...sliced,
        scan: { phase: 'scanning', found: 4, games: 6, message: 'Found 4 of your blunders.', incoming: true, cursor },
      },
      2,
    );
    expect(running.scan.phase).toBe('paused');
    expect(running.scan.found).toBe(4);
    expect(running.scan.games).toBe(6);
    expect(running.scan.incoming).toBe(false);
    expect(running.scan.message).toBe(SCAN_PAUSED_MESSAGE);
    expect(running.scan.cursor).toMatchObject({
      seen: ['c:1'],
      resume: true,
      backfillDone: false,
      doneArchives: ['https://api.chess.com/pub/player/me/games/2026/11'],
    });
    expect(running.training.dailyStreak).toBe(2);
  });

  it('round-trips the blank store and leaves the scan prompt out of the document', () => {
    useProgressStore.getState().resetProgress();
    useProgressStore.setState({ scanPromptDismissed: true });
    const saved = partializeProgress(useProgressStore.getState());
    expect(saved).toEqual(blankPersisted());
    expect(saved).not.toHaveProperty('scanPromptDismissed');
    expect(JSON.stringify(saved)).not.toContain('markDrillResult');
  });

  it('persists Daily 7 completion and keeps dailyHistory capped to the latest 14 days', async () => {
    const today = localDateKey();
    useProgressStore.getState().markDrillResult(true, 'hanging');
    useProgressStore.getState().markDrillResult(false, 'fork');
    useProgressStore.getState().markDailyComplete([true, false, true, true, true, true, true]);
    await flushCoalescedPersistForTests();

    const state = useProgressStore.getState();
    expect(state.dailyCompletedDate).toBe(today);
    expect(state.dailyOutcomes).toEqual([true, false, true, true, true, true, true]);
    expect(state.dailyHistory[today]).toEqual({ done: 2, correct: 1 });

    const manyDays: Record<string, { done: number; correct: number }> = {};
    for (let day = 1; day <= 20; day += 1) {
      const key = `2026-10-${String(day).padStart(2, '0')}`;
      manyDays[key] = { done: 3, correct: 2 };
    }
    const migrated = migrateProgress({ training: { dailyHistory: manyDays } }, PROGRESS_VERSION);
    const history = migrated.training.dailyHistory ?? {};
    expect(Object.keys(history)).toHaveLength(14);
    expect(history['2026-10-01']).toBeUndefined();
    expect(history['2026-10-20']).toEqual({ done: 3, correct: 2 });
  });

  it('deduplicates embedded ownDrills inside persisted review entries and rehydrates them on load', () => {
    const drill = drillFromHang(HANGING_QUEEN);
    expect(drill).toBeTruthy();
    if (!drill) return;
    useProgressStore.setState({
      ownDrills: [drill],
      review: [{ id: drill.id, saves: 1, intervalDays: 1, dueOn: localDateKey(), drill }],
    });
    const saved = partializeProgress(useProgressStore.getState());
    expect(saved.review.review[0]?.drill).toBeUndefined();
    expect(saved.library.ownDrills[0]?.id).toBe(drill.id);

    const restored = migrateProgress(saved, PROGRESS_VERSION);
    expect(restored.review.review[0]?.drill?.fen).toBe(drill.fen);
  });
});
