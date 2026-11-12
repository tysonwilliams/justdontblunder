import { Chess, type Color } from 'chess.js';
import { describe, expect, it } from 'vitest';

import { blundersInGame, blundersInGameYielding } from '@/src/logic/gameBlunders';
import { collectPublicDrills, drillsFromGames, type GameRecord } from '@/src/logic/gameImport';
import { handleScanMessage } from '@/src/logic/scanWorker';

function queenHang(second: string): string {
  const game = new Chess();
  game.move('e4');
  game.move('Nf6');
  game.move(second);
  game.move('a6');
  game.move('Qh5');
  game.move('Nxh5');
  return game.pgn();
}

function record(pgn: string, playedAt: number, userColor: Color): GameRecord {
  return { pgn, playedAt, speed: 'rapid', userColor };
}

describe('blunder replay', () => {
  it('yields between moves and the worker handler keep the same blunders', async () => {
    const pgn = queenHang('a3');
    const sync = blundersInGame(pgn, 'w');
    expect(sync.length).toBeGreaterThan(0);

    let pauses = 0;
    const yielded = await blundersInGameYielding(pgn, 'w', async () => {
      pauses += 1;
    });
    const game = new Chess();
    game.loadPgn(pgn);
    expect(pauses).toBe(game.history().length);
    expect(yielded).toEqual(sync);
    expect(handleScanMessage({ id: 4, pgn, userColor: 'w' })).toEqual({ id: 4, drills: sync });
    expect(handleScanMessage({ id: 5, pgn, userColor: 'b' }).drills).toEqual(blundersInGame(pgn, 'b'));
  });

  it('matches a full public scan to the synchronous selection', async () => {
    const games = ['a3', 'a4', 'b3'].map((second, index) => record(queenHang(second), 30 - index, 'w'));
    const sync = drillsFromGames(games);
    const month = 'https://api.chess.com/pub/player/me/games/2026/11';
    const scan = await collectPublicDrills('chesscom', 'Me', {
      fetchImpl: async (url) => {
        if (String(url).endsWith('/archives')) {
          return json({ archives: [month] });
        }
        return json({
          games: games.map((game) => ({
            pgn: game.pgn,
            time_class: 'rapid',
            end_time: game.playedAt,
            white: { username: 'Me' },
            black: { username: 'them' },
          })),
        });
      },
    });
    expect(scan.drills.map((drill) => drill.id)).toEqual(sync.map((drill) => drill.id));
    expect(scan.drills.map((drill) => drill.fen)).toEqual(sync.map((drill) => drill.fen));
  });
});

function json(body: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}
