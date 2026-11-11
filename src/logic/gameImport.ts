import { Chess, type Color } from 'chess.js';

import { drillFromBlunder } from '@/src/logic/personalDrill';
import type { DrillPosition } from '@/src/logic/drills';
import { fenKey } from '@/src/logic/reviewPile';

/** Games scanned before the search stops, even if fewer blunders were found. */
export const IMPORT_GAME_LIMIT = 250;
/** Newest unique blunders kept from a public search. */
export const IMPORT_DRILL_LIMIT = 100;
export const LICHESS_PAGE_SIZE = 30;
const MAX_ARCHIVE_MONTHS = 12;

const CHESS_COM_SPEEDS = new Set(['blitz', 'rapid', 'classical', 'daily']);
const LICHESS_SPEEDS = new Set(['blitz', 'rapid', 'classical']);

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

export type ScanUpdate = {
  found: number;
  games: number;
  drills: readonly DrillPosition[];
};

export type PublicScan = {
  drills: DrillPosition[];
  games: number;
};

export type LichessGame = {
  id?: string;
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

/** Public blitz, rapid, classical, and Chess.com daily games. Bullet is skipped. The archive is not stored. */
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

/**
 * Fetch and scan until 100 unique blunders, about 250 games, or the public history runs out.
 * Yields between games. The PGN archive is not stored.
 */
export async function collectPublicDrills(
  site: GameSite,
  username: string,
  options?: {
    fetchImpl?: GameFetch;
    onProgress?: (update: ScanUpdate) => void;
    drillLimit?: number;
    gameLimit?: number;
  },
): Promise<PublicScan> {
  const name = cleanUsername(username);
  if (!name) throw new ImportError('Use the public username, with no spaces.');
  const fetchImpl = options?.fetchImpl ?? fetch;
  const budget = emptyBudget(options?.drillLimit ?? IMPORT_DRILL_LIMIT, options?.gameLimit ?? IMPORT_GAME_LIMIT);
  switch (site) {
    case 'chesscom':
      await scanChessCom(name, fetchImpl, budget, options?.onProgress);
      break;
    case 'lichess':
      await scanLichess(name, fetchImpl, budget, options?.onProgress);
      break;
    default: {
      const _exhaustive: never = site;
      return _exhaustive;
    }
  }
  return { drills: budget.drills, games: budget.games };
}

export function recordsFromChessCom(username: string, games: readonly ChessComGame[]): GameRecord[] {
  const records: GameRecord[] = [];
  for (const game of games) {
    const speed = game.time_class ?? '';
    if (!CHESS_COM_SPEEDS.has(speed)) continue;
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
    if (!LICHESS_SPEEDS.has(speed)) continue;
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
 * Newest game first, and within a game the latest blunder first. At most 100, one per position.
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
  const archives = await chessComArchives(username, fetchImpl);
  const collected: GameRecord[] = [];
  for (const url of archives.slice(0, MAX_ARCHIVE_MONTHS)) {
    if (collected.length >= IMPORT_GAME_LIMIT) break;
    collected.push(...(await chessComMonth(url, username, fetchImpl)));
  }
  return capGames(collected);
}

async function loadLichess(username: string, fetchImpl: GameFetch): Promise<GameRecord[]> {
  const collected: GameRecord[] = [];
  const seen = new Set<string>();
  let until: number | undefined;
  let examined = 0;
  while (examined < IMPORT_GAME_LIMIT && collected.length < IMPORT_GAME_LIMIT) {
    const page = await lichessPage(username, until, fetchImpl);
    if (page.length === 0) break;
    const fresh = unseenGames(page, seen);
    if (fresh.length === 0) break;
    examined += fresh.length;
    collected.push(...recordsFromLichess(username, fresh));
    const next = nextUntil(fresh);
    if (next === null || (until !== undefined && next >= until)) break;
    until = next;
    if (page.length < LICHESS_PAGE_SIZE) break;
  }
  return capGames(collected);
}

type ScanBudget = {
  drills: DrillPosition[];
  seen: Set<string>;
  games: number;
  drillLimit: number;
  gameLimit: number;
};

function emptyBudget(drillLimit: number, gameLimit: number): ScanBudget {
  return { drills: [], seen: new Set<string>(), games: 0, drillLimit, gameLimit };
}

function budgetFull(budget: ScanBudget): boolean {
  return budget.games >= budget.gameLimit || budget.drills.length >= budget.drillLimit;
}

async function scanChessCom(
  username: string,
  fetchImpl: GameFetch,
  budget: ScanBudget,
  onProgress?: (update: ScanUpdate) => void,
): Promise<void> {
  const archives = await chessComArchives(username, fetchImpl);
  let months = 0;
  for (const url of archives) {
    if (budgetFull(budget) || months >= MAX_ARCHIVE_MONTHS) break;
    months += 1;
    const records = (await chessComMonth(url, username, fetchImpl)).sort((a, b) => b.playedAt - a.playedAt);
    const room = budget.gameLimit - budget.games;
    const stop = await absorb(records.slice(0, Math.max(room, 0)), budget, onProgress);
    if (stop) break;
  }
}

async function scanLichess(
  username: string,
  fetchImpl: GameFetch,
  budget: ScanBudget,
  onProgress?: (update: ScanUpdate) => void,
): Promise<void> {
  const seen = new Set<string>();
  let until: number | undefined;
  let examined = 0;
  while (examined < budget.gameLimit && !budgetFull(budget)) {
    const page = await lichessPage(username, until, fetchImpl);
    if (page.length === 0) break;
    const fresh = unseenGames(page, seen);
    if (fresh.length === 0) break;
    examined += fresh.length;
    const stop = await absorb(recordsFromLichess(username, fresh), budget, onProgress);
    const next = nextUntil(fresh);
    if (next === null || (until !== undefined && next >= until)) break;
    until = next;
    if (page.length < LICHESS_PAGE_SIZE || stop) break;
  }
}

async function absorb(
  records: readonly GameRecord[],
  budget: ScanBudget,
  onProgress?: (update: ScanUpdate) => void,
): Promise<boolean> {
  const sorted = [...records].sort((a, b) => b.playedAt - a.playedAt);
  for (const game of sorted) {
    if (budgetFull(budget)) return true;
    if (isBullet(game.speed)) continue;
    budget.games += 1;
    const found = userBlunders(game.pgn, game.userColor);
    for (let index = found.length - 1; index >= 0; index -= 1) {
      const drill = found[index];
      if (!drill) continue;
      const key = fenKey(drill.fen);
      if (budget.seen.has(key)) continue;
      budget.seen.add(key);
      budget.drills.push(drill);
      if (budget.drills.length >= budget.drillLimit) break;
    }
    onProgress?.({
      found: budget.drills.length,
      games: budget.games,
      drills: budget.drills.slice(),
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    if (budgetFull(budget)) return true;
  }
  return budgetFull(budget);
}

async function chessComArchives(username: string, fetchImpl: GameFetch): Promise<string[]> {
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
  return archives.reverse();
}

async function chessComMonth(url: string, username: string, fetchImpl: GameFetch): Promise<GameRecord[]> {
  const res = await chessFetch(url, fetchImpl);
  if (!res.ok) return [];
  let month: { games?: ChessComGame[] };
  try {
    month = (await res.json()) as { games?: ChessComGame[] };
  } catch {
    return [];
  }
  return recordsFromChessCom(username, month.games ?? []);
}

function lichessGamesUrl(username: string, until?: number): string {
  const params = new URLSearchParams({
    max: String(LICHESS_PAGE_SIZE),
    perfType: 'blitz,rapid,classical',
    pgnInJson: 'true',
    clocks: 'false',
    evals: 'false',
    opening: 'false',
    moves: 'true',
  });
  if (until !== undefined) params.set('until', String(until));
  return `https://lichess.org/api/games/user/${encodeURIComponent(username)}?${params.toString()}`;
}

async function lichessPage(username: string, until: number | undefined, fetchImpl: GameFetch): Promise<LichessGame[]> {
  const res = await publicFetch(
    lichessGamesUrl(username, until),
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
  return games;
}

function unseenGames(games: readonly LichessGame[], seen: Set<string>): LichessGame[] {
  const fresh: LichessGame[] = [];
  for (const game of games) {
    const id = game.id ?? `${game.createdAt ?? 0}:${game.pgn?.slice(0, 24) ?? ''}`;
    if (seen.has(id)) continue;
    seen.add(id);
    fresh.push(game);
  }
  return fresh;
}

function nextUntil(games: readonly LichessGame[]): number | null {
  let oldest = Number.POSITIVE_INFINITY;
  for (const game of games) {
    if (typeof game.createdAt === 'number' && game.createdAt < oldest) oldest = game.createdAt;
  }
  if (!Number.isFinite(oldest)) return null;
  return oldest - 1;
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

export type GameProfile = {
  site: GameSite;
  username: string;
};

export function profileFromSaved(value: unknown): GameProfile | null {
  if (!value || typeof value !== 'object') return null;
  const profile = value as { site?: unknown; username?: unknown };
  if (profile.site !== 'chesscom' && profile.site !== 'lichess') return null;
  if (typeof profile.username !== 'string') return null;
  const username = cleanUsername(profile.username);
  if (!username) return null;
  return { site: profile.site, username };
}

function isBullet(speed: string): boolean {
  const name = speed.toLowerCase();
  return name === 'bullet' || name === 'ultrabullet';
}
