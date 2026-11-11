import { Chess, type Color } from 'chess.js';

import { drillFromBlunder } from '@/src/logic/personalDrill';
import type { DrillPosition } from '@/src/logic/drills';
import { fenKey } from '@/src/logic/reviewPile';

export const IMPORT_GAME_LIMIT = 20;
export const IMPORT_DRILL_LIMIT = 8;

export const CHESS_COM_USER_AGENT = 'JustDontBlunder/1.0 (habit trainer; public games only)';

export type GameSite = 'chesscom' | 'lichess';

export type GameRecord = {
  pgn: string;
  playedAt: number;
  speed: string;
  userColor: Color;
};

export type ChessComGame = {
  pgn?: string;
  time_class?: string;
  end_time?: number;
  white?: { username?: string };
  black?: { username?: string };
};

export type LichessGame = {
  speed?: string;
  createdAt?: number;
  pgn?: string;
  players?: {
    white?: { user?: { name?: string }; name?: string };
    black?: { user?: { name?: string }; name?: string };
  };
};

export class ImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ImportError';
  }
}

type GameResponse = {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
  text: () => Promise<string>;
};

export type GameFetch = (url: string, init?: RequestInit) => Promise<GameResponse>;

export function cleanUsername(value: string): string | null {
  const name = value.trim();
  if (!/^[A-Za-z0-9_-]{2,25}$/.test(name)) return null;
  return name;
}

/** Last 20 public rapid or blitz games. Bullet is skipped. The archive is not stored. */
export async function loadPublicGames(
  site: GameSite,
  username: string,
  fetchImpl: GameFetch = fetch,
): Promise<GameRecord[]> {
  const name = cleanUsername(username);
  if (!name) throw new ImportError('Use the public username, with no spaces.');
  switch (site) {
    case 'chesscom':
      return loadChessCom(name, fetchImpl);
    case 'lichess':
      return loadLichess(name, fetchImpl);
    default: {
      const _exhaustive: never = site;
      return _exhaustive;
    }
  }
}

export function recordsFromChessCom(username: string, games: readonly ChessComGame[]): GameRecord[] {
  const records: GameRecord[] = [];
  for (const game of games) {
    const speed = game.time_class ?? '';
    if (speed !== 'blitz' && speed !== 'rapid') continue;
    if (!game.pgn) continue;
    const userColor = colorFor(username, game.white?.username, game.black?.username);
    if (!userColor) continue;
    records.push({
      pgn: game.pgn,
      playedAt: (game.end_time ?? 0) * 1000,
      speed,
      userColor,
    });
  }
  return records;
}

export function recordsFromLichess(username: string, games: readonly LichessGame[]): GameRecord[] {
  const records: GameRecord[] = [];
  for (const game of games) {
    const speed = (game.speed ?? '').toLowerCase();
    if (speed !== 'blitz' && speed !== 'rapid') continue;
    if (!game.pgn) continue;
    const userColor = colorFor(username, lichessName(game.players?.white), lichessName(game.players?.black));
    if (!userColor) continue;
    records.push({
      pgn: game.pgn,
      playedAt: game.createdAt ?? 0,
      speed,
      userColor,
    });
  }
  return records;
}

/**
 * Replay each game and keep positions where that user's move fails the drill material rule.
 * Newest game first, and within a game the latest blunder first. At most 8, one per position.
 */
export function drillsFromGames(games: readonly GameRecord[], limit = IMPORT_DRILL_LIMIT): DrillPosition[] {
  const sorted = [...games].sort((a, b) => b.playedAt - a.playedAt);
  const seen = new Set<string>();
  const drills: DrillPosition[] = [];
  for (const game of sorted) {
    if (isBullet(game.speed)) continue;
    const found = userBlunders(game.pgn, game.userColor);
    for (let index = found.length - 1; index >= 0; index -= 1) {
      const drill = found[index];
      if (!drill) continue;
      const key = fenKey(drill.fen);
      if (seen.has(key)) continue;
      seen.add(key);
      drills.push(drill);
      if (drills.length >= limit) return drills;
    }
  }
  return drills;
}

/** Same selection as `drillsFromGames`, yielding between games so a long history can paint. */
export async function collectImportedDrills(
  games: readonly GameRecord[],
  limit = IMPORT_DRILL_LIMIT,
): Promise<DrillPosition[]> {
  const sorted = [...games].sort((a, b) => b.playedAt - a.playedAt);
  const found: DrillPosition[] = [];
  const seen = new Set<string>();
  for (const game of sorted) {
    if (found.length >= limit) break;
    for (const drill of drillsFromGames([game], limit - found.length)) {
      const key = fenKey(drill.fen);
      if (seen.has(key)) continue;
      seen.add(key);
      found.push(drill);
      if (found.length >= limit) break;
    }
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  return found;
}

export function pastedGameDrills(
  pgn: string,
  userColor: Color,
): { readable: boolean; drills: DrillPosition[] } {
  const trimmed = pgn.trim();
  if (!trimmed) return { readable: false, drills: [] };
  try {
    const parsed = new Chess();
    parsed.loadPgn(trimmed);
    if (parsed.history().length === 0) return { readable: false, drills: [] };
  } catch {
    return { readable: false, drills: [] };
  }
  return {
    readable: true,
    drills: drillsFromGames(
      [{ pgn: trimmed, playedAt: Date.now(), speed: 'rapid', userColor }],
      IMPORT_DRILL_LIMIT,
    ),
  };
}

function userBlunders(pgn: string, userColor: Color): DrillPosition[] {
  let game: Chess;
  try {
    game = new Chess();
    game.loadPgn(pgn);
  } catch {
    return [];
  }
  const moves = game.history({ verbose: true });
  for (let index = moves.length - 1; index >= 0; index -= 1) game.undo();
  const found: DrillPosition[] = [];
  for (const move of moves) {
    const before = game.fen();
    const side = game.turn();
    let played;
    try {
      played = game.move({ from: move.from, to: move.to, promotion: move.promotion });
    } catch {
      break;
    }
    if (!played) break;
    if (side !== userColor) continue;
    const drill = drillFromBlunder({
      fen: before,
      from: played.from,
      to: played.to,
      san: played.san,
    });
    if (drill) found.push(drill);
  }
  return found;
}

async function loadChessCom(username: string, fetchImpl: GameFetch): Promise<GameRecord[]> {
  const archiveUrl = `https://api.chess.com/pub/player/${encodeURIComponent(username)}/games/archives`;
  const archiveRes = await chessFetch(archiveUrl, fetchImpl);
  if (archiveRes.status === 404) throw new ImportError('No Chess.com player by that name.');
  if (!archiveRes.ok) throw new ImportError('Chess.com did not return games. Paste a PGN from one game.');
  let body: { archives?: unknown };
  try {
    body = (await archiveRes.json()) as { archives?: unknown };
  } catch {
    throw new ImportError('Chess.com did not return games. Paste a PGN from one game.');
  }
  const archives = Array.isArray(body.archives)
    ? body.archives.filter(
        (url): url is string => typeof url === 'string' && url.startsWith('https://api.chess.com/pub/'),
      )
    : [];
  const collected: GameRecord[] = [];
  for (const url of archives.slice(-2).reverse()) {
    const res = await chessFetch(url, fetchImpl);
    if (!res.ok) continue;
    let month: { games?: ChessComGame[] };
    try {
      month = (await res.json()) as { games?: ChessComGame[] };
    } catch {
      continue;
    }
    collected.push(...recordsFromChessCom(username, month.games ?? []));
  }
  return capGames(collected);
}

async function loadLichess(username: string, fetchImpl: GameFetch): Promise<GameRecord[]> {
  const url =
    `https://lichess.org/api/games/user/${encodeURIComponent(username)}` +
    '?max=20&perfType=blitz,rapid&pgnInJson=true&clocks=false&evals=false&opening=false&moves=true';
  const res = await publicFetch(
    url,
    'application/x-ndjson',
    fetchImpl,
    'Could not reach Lichess. Paste a PGN from one game.',
  );
  if (res.status === 404) throw new ImportError('No Lichess player by that name.');
  if (!res.ok) throw new ImportError('Lichess did not return games. Paste a PGN from one game.');
  const text = await res.text();
  const games: LichessGame[] = [];
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      games.push(JSON.parse(trimmed) as LichessGame);
    } catch {
      continue;
    }
  }
  return capGames(recordsFromLichess(username, games));
}

async function chessFetch(url: string, fetchImpl: GameFetch): Promise<GameResponse> {
  return publicFetch(url, 'application/json', fetchImpl, 'Could not reach Chess.com. Paste a PGN from one game.');
}

/** Both sites reject anonymous clients. Browsers forbid setting this header, so retry without it. */
async function publicFetch(
  url: string,
  accept: string,
  fetchImpl: GameFetch,
  unreachable: string,
): Promise<GameResponse> {
  try {
    return await fetchImpl(url, {
      headers: { Accept: accept, 'User-Agent': CHESS_COM_USER_AGENT },
    });
  } catch {
    try {
      return await fetchImpl(url, { headers: { Accept: accept } });
    } catch {
      throw new ImportError(unreachable);
    }
  }
}

function capGames(games: readonly GameRecord[]): GameRecord[] {
  return [...games].sort((a, b) => b.playedAt - a.playedAt).slice(0, IMPORT_GAME_LIMIT);
}

function colorFor(username: string, white: string | undefined, black: string | undefined): Color | null {
  const name = username.toLowerCase();
  if ((white ?? '').toLowerCase() === name) return 'w';
  if ((black ?? '').toLowerCase() === name) return 'b';
  return null;
}

function lichessName(player: { user?: { name?: string }; name?: string } | undefined): string | undefined {
  return player?.user?.name ?? player?.name;
}

function isBullet(speed: string): boolean {
  const name = speed.toLowerCase();
  return name === 'bullet' || name === 'ultrabullet';
}
