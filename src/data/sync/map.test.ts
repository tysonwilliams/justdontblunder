import { describe, expect, it } from 'vitest';

import { isPublicGameId } from '@/src/data/sync/gameIds';
import { rowsFromSnapshot, snapshotFromProgress } from '@/src/data/sync/map';
import type { SyncSnapshot } from '@/src/data/sync/types';
import { emptyCursor } from '@/src/logic/scanCursor';
import { blankPersisted } from '@/src/store/progressMigrate';

const PGN = 'c:171:ada:bob:20:1. e4 e5';

function chessComSnapshot(): SyncSnapshot {
  const blank = blankPersisted();
  return snapshotFromProgress({
    ...blank,
    library: { ...blank.library, gameProfile: { site: 'chesscom', username: 'ada' } },
    scan: {
      phase: 'done',
      found: 1,
      games: 2,
      message: 'Done.',
      incoming: false,
      cursor: {
        ...emptyCursor('chesscom', 'ada'),
        seen: ['https://www.chess.com/game/live/99', PGN],
        games: 2,
        resume: true,
      },
    },
  });
}

describe('rowsFromSnapshot', () => {
  it('rejects game ids that embed a PGN and accepts a public id', () => {
    expect(isPublicGameId('l:abcdefgh')).toBe(true);
    expect(isPublicGameId('https://www.chess.com/game/live/99')).toBe(true);
    expect(isPublicGameId(PGN)).toBe(false);
    expect(isPublicGameId('l:171:1. e4 e5')).toBe(false);
    expect(isPublicGameId('p:paste')).toBe(false);
  });

  it('stores Chess.com as unverified and leaves PGN text out of the upload', () => {
    const rows = rowsFromSnapshot(chessComSnapshot(), 'user-1');
    expect(rows.linkedAccounts).toEqual([
      expect.objectContaining({
        provider: 'chesscom',
        username: 'ada',
        verified: false,
      }),
    ]);
    const cursor = rows.linkedAccounts[0]?.scan_cursor;
    expect(cursor).not.toHaveProperty('seen');
    expect(cursor).not.toHaveProperty('resume');
    expect(JSON.stringify(rows)).not.toContain(PGN);
    expect(rows.scannedGames.map((row) => row.game_id)).toEqual(['https://www.chess.com/game/live/99']);
    expect(rows.scannedProvider).toBe('chesscom');
  });

  it('omits verified for Lichess so a later verification is left alone', () => {
    const blank = blankPersisted();
    const rows = rowsFromSnapshot(
      snapshotFromProgress({
        ...blank,
        library: { ...blank.library, gameProfile: { site: 'lichess', username: 'ada' } },
      }),
      'user-1',
    );
    expect(rows.linkedAccounts[0]?.provider).toBe('lichess');
    expect(rows.linkedAccounts[0]?.verified).toBeUndefined();
  });

  it('does not store a scan that is still running as running', () => {
    const blank = blankPersisted();
    const rows = rowsFromSnapshot(
      snapshotFromProgress({
        ...blank,
        scan: {
          phase: 'scanning',
          found: 1,
          games: 1,
          message: 'Looking.',
          incoming: true,
          cursor: { ...emptyCursor('lichess', 'ada'), resume: true, games: 1 },
        },
      }),
      'user-1',
    );
    expect(rows.profile.scan_phase).toBe('paused');
  });
});
