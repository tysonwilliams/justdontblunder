import { describe, expect, it } from 'vitest';

import bankJson from '@/src/data/beginner-blunders.json';
import { createLocalProgressRepo } from '@/src/data/sync/localRepo';
import { snapshotFromProgress } from '@/src/data/sync/map';
import { createMemorySyncClient } from '@/src/data/sync/memoryClient';
import { createSupabaseProgressRepo } from '@/src/data/sync/supabaseRepo';
import type { SyncSnapshot } from '@/src/data/sync/types';
import type { DrillPosition } from '@/src/logic/drills';
import { ownDrillId } from '@/src/logic/personalDrill';
import { emptyCursor } from '@/src/logic/scanCursor';
import { blankPersisted, type PersistedProgress } from '@/src/store/progressMigrate';
import type { ScanProgress } from '@/src/store/progressTypes';

const bank = bankJson as DrillPosition[];
const USER = '11111111-1111-1111-1111-111111111111';
const PGN = 'c:171:ada:bob:20:1. e4 e5';

function personal(index: number, gameId: string): DrillPosition {
  const base = bank[index];
  if (!base) throw new Error(`missing bank row ${index}`);
  return { ...base, id: ownDrillId(base.fen), source: { gameId, move: 'Qh5' } };
}

function snapshot(
  patch: {
    training?: Partial<PersistedProgress['training']>;
    review?: Partial<PersistedProgress['review']>;
    library?: Partial<PersistedProgress['library']>;
    preferences?: Partial<PersistedProgress['preferences']>;
    scan?: Partial<ScanProgress>;
  } = {},
  options?: Parameters<typeof snapshotFromProgress>[1],
): SyncSnapshot {
  const blank = blankPersisted();
  return snapshotFromProgress(
    {
      training: { ...blank.training, ...patch.training },
      review: { ...blank.review, ...patch.review },
      library: { ...blank.library, ...patch.library },
      preferences: { ...blank.preferences, ...patch.preferences },
      scan: { ...blank.scan, ...patch.scan },
    },
    options,
  );
}

function repoFor(memory: ReturnType<typeof createMemorySyncClient>, saved: { current: PersistedProgress | null }) {
  return createSupabaseProgressRepo(memory, USER, {
    load: () => saved.current ?? blankPersisted(),
    save: (progress) => {
      saved.current = progress;
    },
  });
}

describe('supabase progress repo', () => {
  it('round-trips a guest snapshot and leaves PGN text on the device', async () => {
    const drill = personal(0, 'l:fromdrill');
    const memory = createMemorySyncClient();
    memory.rows('puzzles').push({ id: 'hang-q-01' });
    const saved = { current: null as PersistedProgress | null };
    const repo = repoFor(memory, saved);
    const guest = snapshot(
      {
        training: {
          xp: 12,
          dailyStreak: 2,
          lastDrillDate: '2026-03-01',
          completedLessons: ['hang-1'],
          themeStats: { hanging: { attempts: 4, correct: 3 } },
        },
        review: {
          missedDate: '2026-03-02',
          review: [
            { id: 'hang-q-01', saves: 1 },
            { id: drill.id, saves: 0, drill },
          ],
        },
        library: {
          ownDrills: [drill],
          pastedIds: [drill.id],
          gameProfile: { site: 'lichess', username: 'ada' },
        },
        preferences: { experience: 'basics', welcomeSkipped: true, drillsPromptSkipped: false },
        scan: {
          phase: 'done',
          found: 1,
          games: 3,
          message: 'Found one.',
          incoming: false,
          cursor: {
            ...emptyCursor('lichess', 'ada'),
            seen: ['l:fromseen', PGN],
            games: 3,
            resume: true,
          },
        },
      },
      {
        timezone: 'America/Los_Angeles',
        attempts: [
          {
            clientId: 'att-1',
            drillId: drill.id,
            move: 'e2e4',
            outcome: 'blunder',
            createdAt: '2026-03-01T00:00:00.000Z',
          },
        ],
        streakDates: ['2026-02-28'],
        lastScannedAt: '2026-03-01T12:00:00.000Z',
        reviewMeta: [{ id: 'hang-q-01', dueOn: '2026-04-01', intervalDays: 3, missHistory: ['Nf6'] }],
      },
    );

    await repo.push(guest);
    const pulled = await repo.pull();
    expect(pulled?.timezone).toBe('America/Los_Angeles');
    expect(pulled?.progress.training.xp).toBe(12);
    expect(pulled?.progress.training.themeStats.hanging).toEqual({ attempts: 4, correct: 3 });
    expect(pulled?.progress.training.completedLessons).toEqual(['hang-1']);
    expect(pulled?.progress.preferences.experience).toBe('basics');
    expect(pulled?.progress.library.ownDrills.map((row) => row.id)).toEqual([drill.id]);
    expect(pulled?.progress.library.ownDrills[0]?.source).toEqual({ gameId: 'l:fromdrill', move: 'Qh5' });
    expect(pulled?.progress.library.pastedIds).toEqual([drill.id]);
    expect(pulled?.progress.review.review.map((entry) => [entry.id, entry.saves])).toEqual([
      ['hang-q-01', 1],
      [drill.id, 0],
    ]);
    expect(pulled?.reviewMeta.find((meta) => meta.id === 'hang-q-01')).toMatchObject({
      dueOn: '2026-04-01',
      intervalDays: 3,
    });
    expect(pulled?.progress.scan.cursor?.resume).toBe(false);
    expect(pulled?.progress.scan.cursor?.seen).toEqual(['l:fromseen', 'l:fromdrill']);
    expect(JSON.stringify(memory.rows('scanned_games'))).not.toContain(PGN);
    expect(pulled?.attempts).toEqual([
      expect.objectContaining({ clientId: 'att-1', outcome: 'blunder', move: 'e2e4' }),
    ]);
    expect(pulled?.streakDates).toEqual(['2026-02-28', '2026-03-01']);
    expect(memory.rows('linked_accounts')[0]?.verified).toBeUndefined();
  });

  it('does not update or delete an attempt that was already stored', async () => {
    const drill = personal(0, 'l:fromdrill');
    const memory = createMemorySyncClient();
    const repo = repoFor(memory, { current: null });
    const attempt = {
      clientId: 'att-1',
      drillId: drill.id,
      move: 'e2e4',
      outcome: 'blunder' as const,
      createdAt: '2026-03-01T00:00:00.000Z',
    };
    await repo.push(snapshot({ library: { ownDrills: [drill] } }, { attempts: [attempt] }));
    await repo.push(
      snapshot({ library: { ownDrills: [drill] } }, { attempts: [{ ...attempt, outcome: 'safe' }] }),
    );
    await repo.push(snapshot({ library: { ownDrills: [drill] } }));
    const pulled = await repo.pull();
    expect(pulled?.attempts).toEqual([expect.objectContaining({ clientId: 'att-1', outcome: 'blunder' })]);
    expect(memory.rows('attempts')).toHaveLength(1);
    expect(memory.ops.filter((op) => op.table === 'attempts' && (op.kind === 'update' || op.kind === 'delete'))).toEqual(
      [],
    );
  });

  it('drops a drill the device no longer has', async () => {
    const first = personal(0, 'l:one');
    const second = personal(1, 'l:two');
    const memory = createMemorySyncClient();
    const repo = repoFor(memory, { current: null });
    await repo.push(snapshot({ library: { ownDrills: [first, second] } }));
    await repo.push(snapshot({ library: { ownDrills: [first] } }));
    const pulled = await repo.pull();
    expect(pulled?.progress.library.ownDrills.map((drill) => drill.id)).toEqual([first.id]);
    expect(memory.rows('user_drills').map((row) => row.local_id)).toEqual([first.id]);
  });

  it('keeps a review when its puzzle row is not visible on this push', async () => {
    const memory = createMemorySyncClient();
    memory.rows('puzzles').push({ id: 'hang-q-01' });
    const repo = repoFor(memory, { current: null });
    await repo.push(snapshot({ review: { review: [{ id: 'hang-q-01', saves: 0 }] } }));
    memory.rows('puzzles').splice(0, memory.rows('puzzles').length);
    await repo.push(snapshot({ review: { review: [{ id: 'hang-q-01', saves: 0 }] } }));
    expect(memory.rows('review_entries')).toHaveLength(1);
  });

  it('pages seen games past the first thousand rows', async () => {
    const memory = createMemorySyncClient();
    const repo = repoFor(memory, { current: null });
    await repo.push(
      snapshot({
        library: { gameProfile: { site: 'lichess', username: 'ada' } },
        scan: {
          phase: 'done',
          found: 0,
          games: 1,
          message: '',
          incoming: false,
          cursor: { ...emptyCursor('lichess', 'ada'), seen: ['l:seed'], games: 1 },
        },
      }),
    );
    const games = memory.rows('scanned_games');
    for (let index = 0; index < 1001; index += 1) {
      games.push({ id: 100_000 + index, user_id: USER, provider: 'lichess', game_id: `l:g${index}` });
    }
    const pulled = await repo.pull();
    const seen = new Set(pulled?.progress.scan.cursor?.seen);
    expect(seen.has('l:g0')).toBe(true);
    expect(seen.has('l:g1000')).toBe(true);
    expect(seen.has('l:seed')).toBe(true);
  });

  it('merges guest progress into an existing account without a push-before-pull', async () => {
    const onAccount = personal(1, 'l:account');
    const onDevice = personal(0, 'l:device');
    const memory = createMemorySyncClient();
    const saved = { current: null as PersistedProgress | null };
    const repo = repoFor(memory, saved);
    await repo.push(
      snapshot({
        training: { xp: 9 },
        library: { ownDrills: [onAccount] },
        preferences: { experience: 'new', welcomeSkipped: true, drillsPromptSkipped: true },
      }),
    );
    memory.ops.length = 0;
    const progress = await repo.mergeOnSignIn(
      snapshot(
        {
          training: { xp: 4 },
          library: { ownDrills: [onDevice] },
          preferences: { experience: 'basics', welcomeSkipped: false, drillsPromptSkipped: false },
        },
        {
          attempts: [
            {
              clientId: 'on-device',
              drillId: onDevice.id,
              move: 'e7e5',
              outcome: 'safe',
              createdAt: '2026-03-04T00:00:00.000Z',
            },
          ],
        },
      ),
    );
    const profileOps = memory.ops.filter((op) => op.table === 'profiles').map((op) => op.kind);
    expect(profileOps.indexOf('select')).toBeGreaterThanOrEqual(0);
    expect(profileOps.indexOf('select')).toBeLessThan(profileOps.indexOf('upsert'));
    expect(progress.training.xp).toBe(9);
    expect(progress.preferences.experience).toBe('basics');
    expect(progress.preferences.welcomeSkipped).toBe(false);
    expect(saved.current?.library.ownDrills.map((drill) => drill.id)).toEqual([onDevice.id, onAccount.id]);
    const pulled = await repo.pull();
    expect(pulled?.progress.library.ownDrills.map((drill) => drill.id)).toEqual([onDevice.id, onAccount.id]);
    expect(pulled?.attempts.map((attempt) => attempt.clientId)).toEqual(['on-device']);
  });

  it('leaves the guest document on the device when sync is the local repo', async () => {
    let writes = 0;
    const local = createLocalProgressRepo({
      read: () => blankPersisted(),
      write: () => {
        writes += 1;
      },
    });
    const guest = snapshot({ training: { xp: 3 } });
    expect(await local.pull()).toBeNull();
    expect((await local.mergeOnSignIn(guest)).training.xp).toBe(3);
    expect(writes).toBe(0);
  });
});
