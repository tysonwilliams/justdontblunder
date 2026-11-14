import { describe, expect, it } from 'vitest';

import bankJson from '@/src/data/beginner-blunders.json';
import { snapshotFromProgress } from '@/src/data/sync/map';
import { mergeSnapshots } from '@/src/data/sync/merge';
import type { SyncSnapshot } from '@/src/data/sync/types';
import type { DrillPosition } from '@/src/logic/drills';
import { fenKey } from '@/src/logic/reviewPile';
import { emptyCursor } from '@/src/logic/scanCursor';
import { blankPersisted, type PersistedProgress } from '@/src/store/progressMigrate';
import type { ScanProgress } from '@/src/store/progressTypes';

const bank = bankJson as DrillPosition[];

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

function uniqueBank(count: number): DrillPosition[] {
  const out: DrillPosition[] = [];
  const seen = new Set<string>();
  for (const drill of bank) {
    const key = fenKey(drill.fen);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(drill);
    if (out.length === count) return out;
  }
  throw new Error(`Needed ${count} unique positions and found ${out.length}.`);
}

describe('mergeSnapshots', () => {
  it('keeps guest drills first and still adds an account drill', () => {
    const guestDrill = bank[0];
    const remoteDrill = bank[1];
    if (!guestDrill || !remoteDrill) throw new Error('bank is short');
    const merged = mergeSnapshots(
      snapshot({ library: { ownDrills: [guestDrill] }, training: { xp: 4 } }),
      snapshot({ library: { ownDrills: [remoteDrill] }, training: { xp: 9, completedLessons: ['pin'] } }),
    );
    expect(merged.progress.library.ownDrills.map((drill) => drill.id)).toEqual([guestDrill.id, remoteDrill.id]);
    expect(merged.progress.training.xp).toBe(9);
    expect(merged.progress.training.completedLessons).toEqual(['pin']);
  });

  it('caps the pool without dropping a guest drill to make room', () => {
    const drills = uniqueBank(101);
    const guest = drills.slice(0, 100);
    const extra = drills[100];
    const merged = mergeSnapshots(
      snapshot({ library: { ownDrills: guest } }),
      snapshot({ library: { ownDrills: extra ? [extra] : [] } }),
    );
    expect(merged.progress.library.ownDrills).toHaveLength(100);
    expect(merged.progress.library.ownDrills.map((drill) => drill.id)).toEqual(guest.map((drill) => drill.id));
  });

  it('takes the higher counter and caps theme correct at attempts', () => {
    const merged = mergeSnapshots(
      snapshot({
        training: {
          xp: 2,
          drillsCompleted: 4,
          themeStats: { hanging: { attempts: 3, correct: 9 } },
          lastDrillDate: '2026-01-01',
          completedLessons: ['a'],
        },
      }),
      snapshot({
        training: {
          xp: 5,
          drillsCompleted: 4,
          themeStats: { hanging: { attempts: 4, correct: 1 } },
          lastDrillDate: '2026-02-01',
          completedLessons: ['b'],
        },
      }),
    );
    expect(merged.progress.training.xp).toBe(5);
    expect(merged.progress.training.drillsCompleted).toBe(4);
    expect(merged.progress.training.themeStats.hanging).toEqual({ attempts: 4, correct: 4 });
    expect(merged.progress.training.lastDrillDate).toBe('2026-02-01');
    expect(merged.progress.training.completedLessons).toEqual(['a', 'b']);
  });

  it('keeps the guest review when the save counts disagree and keeps a remote-only miss', () => {
    const merged = mergeSnapshots(
      snapshot(
        { review: { review: [{ id: 'hang-q-01', saves: 1 }], missedDate: '2026-01-02' } },
        { reviewMeta: [{ id: 'hang-q-01', dueOn: '2026-01-03', intervalDays: 1, missHistory: ['Nf6'] }] },
      ),
      snapshot(
        {
          review: {
            review: [
              { id: 'hang-q-01', saves: 0 },
              { id: 'hang-q-02', saves: 0 },
            ],
          },
        },
        { reviewMeta: [{ id: 'hang-q-01', dueOn: '2026-04-01', intervalDays: 3, missHistory: ['again'] }] },
      ),
    );
    expect(merged.progress.review.review.map((entry) => [entry.id, entry.saves])).toEqual([
      ['hang-q-01', 1],
      ['hang-q-02', 0],
    ]);
    expect(merged.reviewMeta.find((meta) => meta.id === 'hang-q-01')).toMatchObject({
      dueOn: '2026-01-03',
      intervalDays: 1,
      missHistory: ['Nf6', 'again'],
    });
  });

  it('keeps the account due date when both sides have the same save count', () => {
    const merged = mergeSnapshots(
      snapshot(
        { review: { review: [{ id: 'hang-q-01', saves: 1 }] } },
        { reviewMeta: [{ id: 'hang-q-01', dueOn: '2026-01-03', intervalDays: 1, missHistory: ['Nf6'] }] },
      ),
      snapshot(
        { review: { review: [{ id: 'hang-q-01', saves: 1 }] } },
        { reviewMeta: [{ id: 'hang-q-01', dueOn: '2026-04-01', intervalDays: 3, missHistory: ['again'] }] },
      ),
    );
    expect(merged.reviewMeta[0]).toMatchObject({
      dueOn: '2026-04-01',
      intervalDays: 3,
      missHistory: ['Nf6', 'again'],
    });
  });

  it('unions attempts and keeps the guest row when the client id matches', () => {
    const guestAttempt = {
      clientId: 'same',
      drillId: 'hang-q-01',
      move: 'e2e4',
      outcome: 'blunder' as const,
      createdAt: '2026-03-01T00:00:00.000Z',
    };
    const merged = mergeSnapshots(
      snapshot({}, { attempts: [guestAttempt] }),
      snapshot({}, {
        attempts: [
          { ...guestAttempt, outcome: 'safe' },
          {
            clientId: 'other',
            drillId: 'hang-q-02',
            move: 'd2d4',
            outcome: 'safe',
            createdAt: '2026-03-02T00:00:00.000Z',
          },
        ],
      }),
    );
    expect(merged.attempts.map((attempt) => [attempt.clientId, attempt.outcome])).toEqual([
      ['same', 'blunder'],
      ['other', 'safe'],
    ]);
  });

  it('keeps guest preferences once an experience is chosen', () => {
    const merged = mergeSnapshots(
      snapshot({ preferences: { experience: 'basics', welcomeSkipped: false, drillsPromptSkipped: false } }),
      snapshot({ preferences: { experience: 'new', welcomeSkipped: true, drillsPromptSkipped: true } }),
    );
    expect(merged.progress.preferences).toEqual({
      experience: 'basics',
      welcomeSkipped: false,
      drillsPromptSkipped: false,
    });
  });

  it('does not resume a scan that only the account had marked in progress', () => {
    const merged = mergeSnapshots(
      snapshot({}),
      snapshot({
        library: { gameProfile: { site: 'lichess', username: 'ada' } },
        scan: {
          phase: 'done',
          found: 2,
          games: 4,
          message: 'Done.',
          incoming: false,
          cursor: { ...emptyCursor('lichess', 'ada'), seen: ['l:abcdefgh'], games: 4, resume: true },
        },
      }),
    );
    expect(merged.progress.scan.phase).toBe('done');
    expect(merged.progress.scan.cursor?.resume).toBe(false);
    expect(merged.progress.scan.cursor?.seen).toEqual(['l:abcdefgh']);
    expect(merged.progress.library.gameProfile).toEqual({ site: 'lichess', username: 'ada' });
  });

  it('keeps a paused guest scan and unions seen games for the same username', () => {
    const pgn = 'c:171:ada:bob:20:1. e4 e5';
    const merged = mergeSnapshots(
      snapshot({
        scan: {
          phase: 'paused',
          found: 1,
          games: 1,
          message: 'Scan paused.',
          incoming: true,
          cursor: {
            ...emptyCursor('lichess', 'Ada'),
            seen: ['l:guest', pgn],
            games: 1,
            resume: true,
            backfillDone: false,
            lichessUntil: 50,
          },
        },
      }),
      snapshot({
        scan: {
          phase: 'done',
          found: 3,
          games: 3,
          message: 'Done.',
          incoming: false,
          cursor: {
            ...emptyCursor('lichess', 'ada'),
            seen: ['l:remote'],
            games: 3,
            resume: true,
            backfillDone: true,
            lichessUntil: 20,
          },
        },
      }),
    );
    expect(merged.progress.scan.phase).toBe('paused');
    expect(merged.progress.scan.incoming).toBe(true);
    expect(merged.progress.scan.cursor).toMatchObject({
      resume: true,
      seen: ['l:guest', pgn, 'l:remote'],
      backfillDone: false,
      lichessUntil: 20,
      games: 3,
    });
  });

  it('does not mix seen games from a different username', () => {
    const merged = mergeSnapshots(
      snapshot({
        scan: {
          phase: 'paused',
          found: 1,
          games: 1,
          message: '',
          incoming: false,
          cursor: { ...emptyCursor('chesscom', 'ada'), seen: ['c:guest'], resume: true, games: 1 },
        },
      }),
      snapshot({
        scan: {
          phase: 'done',
          found: 1,
          games: 1,
          message: '',
          incoming: false,
          cursor: { ...emptyCursor('chesscom', 'bob'), seen: ['c:remote'], games: 1 },
        },
      }),
    );
    expect(merged.progress.scan.cursor?.seen).toEqual(['c:guest']);
  });
});
