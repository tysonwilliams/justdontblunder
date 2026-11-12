import { Chess, type Color } from 'chess.js';
import { describe, expect, it, vi } from 'vitest';

import {
  CHESS_COM_USER_AGENT,
  collectPublicDrills,
  drillsFromGames,
  IMPORT_DRILL_LIMIT,
  LICHESS_PAGE_SIZE,
  loadPublicGames,
  pastedGameDrills,
  type GameRecord,
} from '@/src/logic/gameImport';
import { fenKey } from '@/src/logic/reviewPile';

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

function record(pgn: string, playedAt: number, speed: string, userColor: Color): GameRecord {
  return { pgn, playedAt, speed, userColor };
}

describe('game import', () => {
  it('keeps the user’s newest blunders, skips bullet, and caps the list', () => {
    const openings = ['a3', 'a4', 'b3', 'b4', 'c3', 'c4', 'd3', 'Nc3'];
    const games = openings.map((second, index) => record(queenHang(second), index, 'rapid', 'w'));
    games.push(record(queenHang('a3'), 100, 'bullet', 'w'));
    const drills = drillsFromGames(games, 8);
    expect(drills).toHaveLength(8);
    const newest = new Chess();
    newest.move('e4');
    newest.move('Nf6');
    newest.move('Nc3');
    newest.move('a6');
    expect(fenKey(drills[0]?.fen ?? '')).toBe(fenKey(newest.fen()));
    expect(new Set(drills.map((drill) => fenKey(drill.fen))).size).toBe(8);

    const again = drillsFromGames([
      record(queenHang('a3'), 2, 'blitz', 'w'),
      record(queenHang('a3'), 1, 'rapid', 'w'),
    ]);
    const once = drillsFromGames([record(queenHang('a3'), 2, 'blitz', 'w')]);
    expect(again).toHaveLength(once.length);
    expect(again.some((drill) => /You played Qh5\. The knight on f6 takes it\./.test(drill.note))).toBe(true);
  });

  it('ignores the opponent’s blunders', () => {
    const game = new Chess();
    game.move('e4');
    game.move('e5');
    game.move('Nf3');
    game.move('Qh4');
    game.move('Nxh4');
    const pgn = game.pgn();
    const white = drillsFromGames([record(pgn, 1, 'blitz', 'w')]);
    const black = drillsFromGames([record(pgn, 1, 'blitz', 'b')]);
    expect(white.some((drill) => drill.note.includes('Qh4'))).toBe(false);
    expect(black.some((drill) => drill.note.includes('Qh4'))).toBe(true);
    expect(black.every((drill) => drill.sideToMove === 'b')).toBe(true);
  });

  it('reads one pasted game and rejects text that is not a game', () => {
    const pasted = pastedGameDrills(queenHang('c3'), 'w');
    expect(pasted.readable).toBe(true);
    expect(pasted.drills[0]?.note).toMatch(/Qh5/);
    expect(pastedGameDrills('hello', 'w')).toEqual({ readable: false, drills: [] });
  });

  it('loads public Chess.com and Lichess games and skips bullet', async () => {
    const pgn = queenHang('a3');
    const chessFetch = vi.fn(async (url: string, init?: RequestInit) => {
      if (String(url).endsWith('/archives')) {
        return json({ archives: ['https://api.chess.com/pub/player/me/games/2026/10', 'https://evil.example/games'] });
      }
      const headers = init?.headers as Record<string, string>;
      expect(headers['User-Agent']).toBe(CHESS_COM_USER_AGENT);
      expect(String(url)).toBe('https://api.chess.com/pub/player/me/games/2026/10');
      return json({
        games: [
          { pgn, time_class: 'bullet', end_time: 50, white: { username: 'Me' }, black: { username: 'them' } },
          { pgn, time_class: 'rapid', end_time: 40, white: { username: 'Me' }, black: { username: 'them' } },
          { pgn, time_class: 'blitz', end_time: 30, white: { username: 'other' }, black: { username: 'Me' } },
          { pgn, time_class: 'daily', end_time: 20, white: { username: 'Me' }, black: { username: 'them' } },
        ],
      });
    });
    const chessGames = await loadPublicGames('chesscom', 'Me', chessFetch);
    expect(chessGames.map((game) => game.speed).sort()).toEqual(['blitz', 'daily', 'rapid']);
    expect(chessGames.find((game) => game.speed === 'rapid')?.userColor).toBe('w');
    expect(chessGames.find((game) => game.speed === 'blitz')?.userColor).toBe('b');

    const rapid = JSON.stringify({
      speed: 'rapid',
      createdAt: 9,
      pgn,
      players: { white: { user: { name: 'Me' } }, black: { user: { name: 'them' } } },
    });
    const bullet = JSON.stringify({
      speed: 'bullet',
      createdAt: 8,
      pgn,
      players: { white: { user: { name: 'Me' } }, black: { user: { name: 'them' } } },
    });
    const classical = JSON.stringify({
      id: 'c1',
      speed: 'classical',
      createdAt: 7,
      pgn,
      players: { white: { user: { name: 'Me' } }, black: { user: { name: 'them' } } },
    });
    const lichessFetch = vi.fn(async (url: string, init?: RequestInit) => {
      expect(String(url)).toContain('perfType=blitz%2Crapid%2Cclassical');
      expect(String(url)).toContain(`max=${LICHESS_PAGE_SIZE}`);
      expect(String(url)).toContain('/api/games/user/Me');
      const headers = init?.headers as Record<string, string>;
      expect(headers['User-Agent']).toBe(CHESS_COM_USER_AGENT);
      return {
        ok: true,
        status: 200,
        json: async () => ({}),
        text: async () => `${rapid}\n${classical}\n${bullet}\n`,
      };
    });
    const lichessGames = await loadPublicGames('lichess', 'Me', lichessFetch);
    expect(lichessGames.map((game) => game.speed).sort()).toEqual(['classical', 'rapid']);

    await expect(
      loadPublicGames('lichess', 'nobody', async () => ({
        ok: false,
        status: 404,
        json: async () => ({}),
        text: async () => '',
      })),
    ).rejects.toThrow(/No Lichess player/);
    await expect(loadPublicGames('chesscom', 'has space')).rejects.toThrow(/username/);
    expect(IMPORT_DRILL_LIMIT).toBe(100);
  });

  it('pages Lichess with until, and stops Chess.com once the blunder cap is full', async () => {
    const bulletGames = Array.from({ length: LICHESS_PAGE_SIZE }, (_, index) =>
      JSON.stringify({
        id: `b${index}`,
        speed: 'bullet',
        createdAt: 3000 - index,
        pgn: '1. e4 e5',
        players: { white: { user: { name: 'Me' } }, black: { user: { name: 'them' } } },
      }),
    ).join('\n');
    const lichessFetch = vi.fn(async (url: string) => {
      const text = String(url).includes('until=') ? '' : `${bulletGames}\n`;
      return { ok: true, status: 200, json: async () => ({}), text: async () => text };
    });
    const paged = await loadPublicGames('lichess', 'Me', lichessFetch);
    expect(paged).toHaveLength(0);
    expect(lichessFetch).toHaveBeenCalledTimes(2);
    expect(String(lichessFetch.mock.calls[1]?.[0])).toContain('until=2970');

    const pgn = queenHang('a3');
    const newer = 'https://api.chess.com/pub/player/me/games/2026/11';
    const older = 'https://api.chess.com/pub/player/me/games/2026/10';
    const chessFetch = vi.fn(async (url: string) => {
      if (String(url).endsWith('/archives')) return json({ archives: [older, newer] });
      expect(String(url)).toBe(newer);
      return json({
        games: [{ pgn, time_class: 'rapid', end_time: 9, white: { username: 'Me' }, black: { username: 'them' } }],
      });
    });
    const scan = await collectPublicDrills('chesscom', 'Me', { fetchImpl: chessFetch, drillLimit: 1 });
    expect(scan.drills.length).toBeGreaterThan(0);
    expect(scan.drills.length).toBeLessThanOrEqual(1);
    expect(chessFetch.mock.calls.some((call) => String(call[0]) === older)).toBe(false);
  });

  it('reports that a short history is finished even when fewer than 3 blunders were found', async () => {
    const month = 'https://api.chess.com/pub/player/me/games/2026/10';
    const fetchImpl = vi.fn(async (url: string) => {
      if (String(url).endsWith('/archives')) return json({ archives: [month] });
      return json({
        games: ['a3'].map((second, index) => ({
          pgn: queenHang(second),
          time_class: 'rapid',
          end_time: 20 - index,
          white: { username: 'Me' },
          black: { username: 'them' },
        })),
      });
    });
    const incoming: boolean[] = [];
    const scan = await collectPublicDrills('chesscom', 'Me', {
      fetchImpl,
      onProgress: (update) => incoming.push(update.incoming),
    });
    expect(scan.drills.length).toBeGreaterThan(0);
    expect(scan.drills.length).toBeLessThan(3);
    expect(incoming.length).toBeGreaterThan(1);
    expect(incoming.slice(0, -1).every(Boolean)).toBe(true);
    expect(incoming[incoming.length - 1]).toBe(false);
  });
});

function json(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response;
}
