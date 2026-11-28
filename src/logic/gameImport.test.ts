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
  recordsFromChessCom,
  type GameRecord,
} from '@/src/logic/gameImport';
import { FETCH_ATTEMPTS, RETRY_BACKOFF_MS } from '@/src/logic/politeFetch';
import { abortError } from '@/src/logic/scanAbort';
import { monthsToRead, type ScanCursor } from '@/src/logic/scanCursor';
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
    expect(again.some((drill) => /You played Qh5\. Nxh5 wins your queen on h5\./.test(drill.note))).toBe(true);

    // Classic opening pawn gambits (1. e4 e5 2. f4 / 1. d4 d5 2. c4) should not flood personal drills.
    const gambit = new Chess();
    for (const san of ['d4', 'd5', 'c4', 'dxc4', 'e3']) gambit.move(san);
    expect(drillsFromGames([record(gambit.pgn(), 5, 'rapid', 'w')])).toHaveLength(0);
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

  it('sends no custom headers from a browser, so the public API allows the request', async () => {
    vi.stubGlobal('window', {});
    const calls: (RequestInit | undefined)[] = [];
    try {
      await loadPublicGames('chesscom', 'Me', async (url, init) => {
        calls.push(init);
        if (String(url).endsWith('/archives')) return json({ archives: [] });
        return json({ games: [] });
      });
    } finally {
      vi.unstubAllGlobals();
    }
    expect(calls.length).toBeGreaterThan(0);
    for (const init of calls) expect(init?.headers).toBeUndefined();
  });

  it('calls fetch with a receiver so a browser fetch does not throw', async () => {
    const receivers: unknown[] = [];
    function boundFetch(this: unknown, url: string): Promise<Response> {
      receivers.push(this);
      if (String(url).endsWith('/archives')) return Promise.resolve(json({ archives: [] }));
      return Promise.resolve(json({ games: [] }));
    }
    await loadPublicGames('chesscom', 'Me', boundFetch);
    expect(receivers[0]).toBe(globalThis);
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

  it('retries a busy response with backoff, then stops if it stays busy', async () => {
    const waits: number[] = [];
    let tries = 0;
    const month = 'https://api.chess.com/pub/player/me/games/2026/10';
    const scan = await collectPublicDrills('chesscom', 'Me', {
      sleep: async (ms) => {
        waits.push(ms);
      },
      fetchImpl: async (url) => {
        if (!String(url).endsWith('/archives')) {
          return json({
            games: [
              {
                pgn: queenHang('a3'),
                time_class: 'rapid',
                end_time: 20,
                white: { username: 'Me' },
                black: { username: 'them' },
              },
            ],
          });
        }
        tries += 1;
        if (tries < 3) {
          return { ok: false, status: 503, headers: { get: () => null }, json: async () => ({}), text: async () => '' };
        }
        return json({ archives: [month] });
      },
    });
    expect(waits).toEqual([RETRY_BACKOFF_MS[0], RETRY_BACKOFF_MS[1]]);
    expect(scan.drills.length).toBeGreaterThan(0);

    let limited = 0;
    await expect(
      collectPublicDrills('chesscom', 'Me', {
        sleep: async () => {},
        fetchImpl: async () => {
          limited += 1;
          return {
            ok: false,
            status: 429,
            headers: { get: () => '1' },
            json: async () => ({}),
            text: async () => '',
          };
        },
      }),
    ).rejects.toThrow(/busy/);
    expect(limited).toBe(FETCH_ATTEMPTS);
  });

  it('stops waiting when the scan is aborted', async () => {
    const controller = new AbortController();
    let opened!: () => void;
    const openedWait = new Promise<void>((resolve) => {
      opened = resolve;
    });
    const pending = collectPublicDrills('chesscom', 'Me', {
      signal: controller.signal,
      sleep: (_ms, signal) =>
        new Promise((resolve, reject) => {
          const onAbort = () => reject(abortError());
          if (signal.aborted) {
            onAbort();
            opened();
            return;
          }
          signal.addEventListener('abort', onAbort, { once: true });
          opened();
          void resolve;
        }),
      fetchImpl: async () => ({
        ok: false,
        status: 429,
        headers: { get: () => null },
        json: async () => ({}),
        text: async () => '',
      }),
    });
    await openedWait;
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('does not page Lichess games that were already scanned', async () => {
    const cursor: ScanCursor = {
      site: 'lichess',
      username: 'Me',
      seen: ['l:old'],
      newestMs: 4000,
      doneArchives: [],
      lichessUntil: 1000,
      backfillDone: true,
      games: 4,
      resume: false,
    };
    const analyzed: string[] = [];
    const calls: string[] = [];
    const head = [
      lichessGame('new', 5000, queenHang('g3')),
      lichessGame('old', 4000, queenHang('a3')),
    ].join('\n');
    await collectPublicDrills('lichess', 'Me', {
      cursor,
      onAnalyze: (id) => analyzed.push(id),
      fetchImpl: async (url) => {
        calls.push(String(url));
        expect(String(url)).not.toContain('until=');
        return ndjson(head);
      },
    });
    expect(calls).toHaveLength(1);
    expect(analyzed).toEqual(['l:new']);
  });

  it('continues an interrupted Lichess scan from the saved page', async () => {
    const seen = Array.from({ length: LICHESS_PAGE_SIZE }, (_, index) => `l:old${index}`);
    const cursor: ScanCursor = {
      site: 'lichess',
      username: 'Me',
      seen,
      newestMs: 5000,
      doneArchives: [],
      lichessUntil: 3999,
      backfillDone: false,
      games: seen.length,
      resume: false,
    };
    const head = seen
      .map((id, index) => lichessGame(id.slice(2), 5000 - index, '1. e4 e5'))
      .join('\n');
    const analyzed: string[] = [];
    const calls: string[] = [];
    await collectPublicDrills('lichess', 'Me', {
      cursor,
      onAnalyze: (id) => analyzed.push(id),
      fetchImpl: async (url) => {
        const href = String(url);
        calls.push(href);
        if (!href.includes('until=')) return ndjson(head);
        expect(href).toContain('until=3999');
        return ndjson(lichessGame('older', 3000, queenHang('a4')));
      },
    });
    expect(calls).toHaveLength(2);
    expect(analyzed).toEqual(['l:older']);
  });

  it('does not skip new Lichess games that arrived after the saved page', async () => {
    const cursor: ScanCursor = {
      site: 'lichess',
      username: 'Me',
      seen: ['l:old'],
      newestMs: 1000,
      doneArchives: [],
      lichessUntil: 1000,
      backfillDone: false,
      games: 1,
      resume: false,
    };
    const head = Array.from({ length: LICHESS_PAGE_SIZE }, (_, index) =>
      lichessGame(`new${index}`, 9000 - index, '1. e4 e5'),
    ).join('\n');
    const calls: string[] = [];
    await collectPublicDrills('lichess', 'Me', {
      cursor,
      fetchImpl: async (url) => {
        const href = String(url);
        calls.push(href);
        if (!href.includes('until=')) return ndjson(head);
        expect(href).not.toContain('until=1000');
        return ndjson(lichessGame('old', 1000, '1. e4 e5'));
      },
    });
    expect(calls.length).toBeGreaterThan(1);
    expect(calls[1]).toContain('until=8970');
  });

  it('sends Accept: application/x-ndjson for Lichess in browsers and flags unexpected non-JSON responses', async () => {
    vi.stubGlobal('window', {});
    const headersSeen: (HeadersInit | undefined)[] = [];
    try {
      const games = await loadPublicGames('lichess', 'Me', async (_url, init) => {
        headersSeen.push(init?.headers);
        return ndjson(lichessGame('ok1', 5000, queenHang('a3')));
      });
      expect(games).toHaveLength(1);
      expect(headersSeen[0]).toEqual({ Accept: 'application/x-ndjson' });

      await expect(
        loadPublicGames('lichess', 'Me', async () => ndjson('[Event "Live Chess"]\n1. e4 e5 1-0')),
      ).rejects.toThrow(/unexpected format/i);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('skips Chess.com variants and rechecks the prior month on month rollover', () => {
    const records = recordsFromChessCom('Me', [
      {
        pgn: '1. e4 e5',
        rules: 'chess960',
        time_class: 'rapid',
        end_time: 100,
        white: { username: 'Me' },
        black: { username: 'them' },
      },
      {
        pgn: '1. e4 e5',
        rules: 'chess',
        time_class: 'rapid',
        end_time: 101,
        white: { username: 'Me' },
        black: { username: 'them' },
      },
    ]);
    expect(records).toHaveLength(1);
    expect(records[0]?.playedAt).toBe(101_000);

    const dec = 'https://api.chess.com/pub/player/me/games/2026/12';
    const nov = 'https://api.chess.com/pub/player/me/games/2026/11';
    const oct = 'https://api.chess.com/pub/player/me/games/2026/10';
    const cursor: ScanCursor = {
      site: 'chesscom',
      username: 'Me',
      seen: [],
      newestMs: Date.UTC(2026, 10, 25), // Nov 25, 2026
      doneArchives: [nov, oct],
      lichessUntil: null,
      backfillDone: true,
      games: 10,
      resume: false,
    };
    expect(monthsToRead([dec, nov, oct], cursor)).toEqual([dec, nov]);
  });
});

function lichessGame(id: string, createdAt: number, pgn: string): string {
  return JSON.stringify({
    id,
    speed: 'rapid',
    createdAt,
    pgn,
    players: { white: { user: { name: 'Me' } }, black: { user: { name: 'them' } } },
  });
}

function ndjson(body: string) {
  return { ok: true, status: 200, json: async () => ({}), text: async () => body };
}

function json(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response;
}
