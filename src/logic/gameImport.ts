import { type Color } from 'chess.js';

import { blundersInGame, readPastedGame, yieldToMain } from '@/src/logic/gameBlunders';
import { analyzeGame } from '@/src/logic/scanWorkerClient';
import type { DrillPosition } from '@/src/logic/drills';
import { fenKey } from '@/src/logic/reviewPile';
import { throwIfAborted } from '@/src/logic/scanAbort';
import {
  cleanUsername,
  emptyCursor,
  markArchiveDone,
  monthsToRead,
  rememberGame,
  snapshotCursor,
  type GameSite,
  type ScanCursor,
} from '@/src/logic/scanCursor';
import {
  ImportError,
  politeFetch,
  sleepWithSignal,
  type GameFetch,
  type GameResponse,
  type Sleep,
} from '@/src/logic/politeFetch';

export { cleanUsername };
export type { GameSite };
export { ImportError };
export type { GameFetch, GameResponse };

/** Games scanned before the search stops, even if fewer blunders were found. */
export const IMPORT_GAME_LIMIT = 250;
/** Newest unique blunders kept from a public search. */
export const IMPORT_DRILL_LIMIT = 100;
export const LICHESS_PAGE_SIZE = 30;
const MAX_ARCHIVE_MONTHS = 12;

const CHESS_COM_SPEEDS = new Set(['blitz', 'rapid', 'classical', 'daily']);
const LICHESS_SPEEDS = new Set(['blitz', 'rapid', 'classical']);

export const CHESS_COM_USER_AGENT = 'JustDontBlunder/1.0 (habit trainer; public games only)';

export type GameRecord = {
  id?: string;
  pgn: string;
  playedAt: number;
  speed: string;
  userColor: Color;
  opponent?: string;
  url?: string;
};

export type ChessComGame = {
  url?: string;
  uuid?: string;
  pgn?: string;
  rules?: string;
  time_class?: string;
  end_time?: number;
  white?: { username?: string };
  black?: { username?: string };
};

export type ScanUpdate = {
  found: number;
  games: number;
  drills: readonly DrillPosition[];
  /** False once this source will not yield more blunders. */
  incoming: boolean;
  cursor: ScanCursor;
};

export type PublicScan = {
  drills: DrillPosition[];
  games: number;
  cursor: ScanCursor;
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

export type CollectOptions = {
  fetchImpl?: GameFetch;
  onProgress?: (update: ScanUpdate) => void;
  onStatus?: (message: string) => void;
  /** Called only for a game that is actually replayed. */
  onAnalyze?: (gameId: string) => void;
  drillLimit?: number;
  gameLimit?: number;
  signal?: AbortSignal;
  cursor?: ScanCursor | null;
  /** Blunders already saved for this username. A resume keeps them in front of older finds. */
  kept?: readonly DrillPosition[];
  sleep?: Sleep;
  now?: () => number;
};

/** Public blitz, rapid, classical, and Chess.com daily games. Bullet is skipped. The archive is not stored. */
export async function loadPublicGames(
  site: GameSite,
  username: string,
  fetchImpl: GameFetch = fetch,
): Promise<GameRecord[]> {
  const name = cleanUsername(username);
  if (!name) throw new ImportError('Use the public username, with no spaces.');
  const ctx = makeContext({ fetchImpl });
  switch (site) {
    case 'chesscom':
      return loadChessCom(name, ctx);
    case 'lichess':
      return loadLichess(name, ctx);
    default: {
      const _exhaustive: never = site;
      return _exhaustive;
    }
  }
}

/**
 * Fetch and scan until 100 unique blunders, about 250 games, or the public history runs out.
 * A cursor skips games and months that were already read. Replay runs off the UI thread.
 * The PGN archive is not stored.
 */
export async function collectPublicDrills(
  site: GameSite,
  username: string,
  options?: CollectOptions,
): Promise<PublicScan> {
  const name = cleanUsername(username);
  if (!name) throw new ImportError('Use the public username, with no spaces.');
  const ctx = makeContext(options);
  throwIfAborted(ctx.signal);
  const budget = createBudget(startCursor(site, name, options?.cursor), options, ctx.signal);
  switch (site) {
    case 'chesscom':
      await scanChessCom(name, budget, ctx);
      break;
    case 'lichess':
      await scanLichess(name, budget, ctx);
      break;
    default: {
      const _exhaustive: never = site;
      return _exhaustive;
    }
  }
  budget.cursor = { ...budget.cursor, backfillDone: true, resume: false };
  const drills = listed(budget);
  const cursor = snapshotCursor(budget.cursor);
  options?.onProgress?.({
    found: drills.length,
    games: cursor.games,
    drills,
    incoming: false,
    cursor,
  });
  return { drills, games: cursor.games, cursor };
}

export function chessComGameId(game: ChessComGame): string {
  if (typeof game.uuid === 'string' && game.uuid.trim().length > 0) return `c:${game.uuid.trim()}`;
  if (typeof game.url === 'string' && game.url.startsWith('https://www.chess.com/')) return `c:${game.url}`;
  const end = game.end_time ?? 0;
  const white = (game.white?.username ?? '').toLowerCase();
  const black = (game.black?.username ?? '').toLowerCase();
  const pgn = game.pgn ?? '';
  return `c:${end}:${white}:${black}:${pgn.length}:${pgn.slice(0, 32)}`;
}

export function lichessGameId(game: LichessGame): string {
  if (typeof game.id === 'string' && game.id.trim().length > 0) return `l:${game.id.trim()}`;
  return `l:${game.createdAt ?? 0}:${(game.pgn ?? '').slice(0, 32)}`;
}

export function recordsFromChessCom(username: string, games: readonly ChessComGame[]): GameRecord[] {
  const records: GameRecord[] = [];
  for (const game of games) {
    if (game.rules && game.rules !== 'chess') continue;
    const speed = game.time_class ?? '';
    if (!CHESS_COM_SPEEDS.has(speed)) continue;
    if (!game.pgn) continue;
    const userColor = colorFor(username, game.white?.username, game.black?.username);
    if (!userColor) continue;
    const opponent = userColor === 'w' ? game.black?.username : game.white?.username;
    records.push({
      id: chessComGameId(game),
      pgn: game.pgn,
      playedAt: (game.end_time ?? 0) * 1000,
      speed,
      userColor,
      ...(opponent ? { opponent } : {}),
      ...(typeof game.url === 'string' && game.url.startsWith('https://') ? { url: game.url } : {}),
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
    const whiteName = lichessName(game.players?.white);
    const blackName = lichessName(game.players?.black);
    const userColor = colorFor(username, whiteName, blackName);
    if (!userColor) continue;
    const opponent = userColor === 'w' ? blackName : whiteName;
    const url = typeof game.id === 'string' && game.id.trim() ? `https://lichess.org/${game.id.trim()}` : undefined;
    records.push({
      id: lichessGameId(game),
      pgn: game.pgn,
      playedAt: game.createdAt ?? 0,
      speed,
      userColor,
      ...(opponent ? { opponent } : {}),
      ...(url ? { url } : {}),
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
    const found = blundersInGame(game.pgn, game.userColor);
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

/** Same selection as `drillsFromGames`, without blocking the UI on each game. */
export async function collectImportedDrills(
  games: readonly GameRecord[],
  limit = IMPORT_DRILL_LIMIT,
): Promise<DrillPosition[]> {
  const sorted = [...games].sort((a, b) => b.playedAt - a.playedAt);
  const found: DrillPosition[] = [];
  const seen = new Set<string>();
  for (const game of sorted) {
    if (found.length >= limit) break;
    if (isBullet(game.speed)) continue;
    const blunders = await analyzeGame(game.pgn, game.userColor);
    for (let index = blunders.length - 1; index >= 0 && found.length < limit; index -= 1) {
      const drill = blunders[index];
      if (!drill) continue;
      const key = fenKey(drill.fen);
      if (seen.has(key)) continue;
      seen.add(key);
      found.push(drill);
    }
    await yieldToMain();
  }
  return found;
}

export function pastedGameDrills(
  pgn: string,
  userColor: Color,
): { readable: boolean; drills: DrillPosition[] } {
  return readPastedGame(pgn, userColor);
}

type FetchContext = {
  fetchImpl: GameFetch;
  signal: AbortSignal;
  sleep: Sleep;
  now: () => number;
  onStatus?: (message: string) => void;
};

function makeContext(options?: CollectOptions): FetchContext {
  return {
    fetchImpl: options?.fetchImpl ?? fetch,
    signal: options?.signal ?? new AbortController().signal,
    sleep: options?.sleep ?? sleepWithSignal,
    now: options?.now ?? Date.now,
    onStatus: options?.onStatus,
  };
}

function startCursor(site: GameSite, username: string, cursor: ScanCursor | null | undefined): ScanCursor {
  if (!cursor || cursor.site !== site || cursor.username.toLowerCase() !== username.toLowerCase()) {
    return emptyCursor(site, username);
  }
  return snapshotCursor({ ...cursor, resume: false });
}

type Budget = {
  fresh: DrillPosition[];
  kept: DrillPosition[];
  seen: Set<string>;
  cursor: ScanCursor;
  examined: number;
  drillLimit: number;
  gameLimit: number;
  watermark: number;
  signal: AbortSignal;
  onProgress?: (update: ScanUpdate) => void;
  onAnalyze?: (gameId: string) => void;
};

function createBudget(cursor: ScanCursor, options: CollectOptions | undefined, signal: AbortSignal): Budget {
  return {
    fresh: [],
    kept: (options?.kept ?? []).slice(),
    seen: new Set(cursor.seen),
    cursor,
    examined: 0,
    drillLimit: options?.drillLimit ?? IMPORT_DRILL_LIMIT,
    gameLimit: options?.gameLimit ?? IMPORT_GAME_LIMIT,
    watermark: cursor.newestMs,
    signal,
    onProgress: options?.onProgress,
    onAnalyze: options?.onAnalyze,
  };
}

function listed(budget: Budget): DrillPosition[] {
  const out: DrillPosition[] = [];
  const fens = new Set<string>();
  const ids = new Set<string>();
  for (const drill of [...budget.fresh, ...budget.kept]) {
    const key = fenKey(drill.fen);
    if (fens.has(key) || ids.has(drill.id)) continue;
    fens.add(key);
    ids.add(drill.id);
    out.push(drill);
    if (out.length >= budget.drillLimit) break;
  }
  return out;
}

/** The pool is full and this game is not newer than the last scan. */
function blocksOlder(budget: Budget, playedAt: number): boolean {
  if (budget.examined >= budget.gameLimit) return true;
  if (listed(budget).length < budget.drillLimit) return false;
  if (budget.watermark > 0 && playedAt > budget.watermark) return false;
  return true;
}

function emit(budget: Budget, incoming: boolean): void {
  const drills = listed(budget);
  const cursor = snapshotCursor(budget.cursor);
  budget.onProgress?.({
    found: drills.length,
    games: cursor.games,
    drills,
    incoming,
    cursor,
  });
}

async function loadChessCom(username: string, ctx: FetchContext): Promise<GameRecord[]> {
  const archives = await chessComArchives(username, ctx);
  const collected: GameRecord[] = [];
  for (const url of archives.slice(0, MAX_ARCHIVE_MONTHS)) {
    if (collected.length >= IMPORT_GAME_LIMIT) break;
    collected.push(...(await chessComMonth(url, username, ctx)));
  }
  return capGames(collected);
}

async function loadLichess(username: string, ctx: FetchContext): Promise<GameRecord[]> {
  const collected: GameRecord[] = [];
  const seen = new Set<string>();
  let until: number | undefined;
  let examined = 0;
  while (examined < IMPORT_GAME_LIMIT && collected.length < IMPORT_GAME_LIMIT) {
    const page = await lichessPage(username, until, ctx);
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

async function scanChessCom(username: string, budget: Budget, ctx: FetchContext): Promise<void> {
  const archives = await chessComArchives(username, ctx);
  const newest = archives[0];
  const todo = monthsToRead(archives.slice(0, MAX_ARCHIVE_MONTHS), budget.cursor);
  if (!newest || todo.length === 0) return;
  for (const url of todo) {
    throwIfAborted(budget.signal);
    if (budget.examined >= budget.gameLimit) return;
    if (url !== newest && listed(budget).length >= budget.drillLimit) return;
    const records = (await chessComMonth(url, username, ctx)).sort((a, b) => b.playedAt - a.playedAt);
    const walk = await absorb(records, budget);
    if (walk === 'done') {
      budget.cursor = markArchiveDone(budget.cursor, url);
      emit(budget, true);
    }
    if (walk === 'stop') return;
  }
}

async function scanLichess(username: string, budget: Budget, ctx: FetchContext): Promise<void> {
  const resumeUntil = budget.cursor.backfillDone ? null : budget.cursor.lichessUntil;
  await walkLichessForward(username, budget, ctx, budget.cursor.backfillDone, resumeUntil);
}

async function walkLichessForward(
  username: string,
  budget: Budget,
  ctx: FetchContext,
  stopOnOverlap: boolean,
  resumeUntil: number | null,
): Promise<void> {
  const local = new Set<string>();
  let until: number | undefined;
  let jumpTo = resumeUntil;
  while (budget.examined < budget.gameLimit) {
    throwIfAborted(budget.signal);
    const page = await lichessPage(username, until, ctx);
    if (page.length === 0) {
      budget.cursor = { ...budget.cursor, lichessUntil: null };
      return;
    }
    const fresh = unseenGames(page, local);
    if (fresh.length === 0) return;
    const records = recordsFromLichess(username, fresh);
    const unseen = records.filter((game) => {
      const id = game.id ?? '';
      return id.length === 0 || !budget.seen.has(id);
    });
    if (records.length === 0) {
      const next = advanceLichess(budget, fresh, until, page.length);
      if (next === null) return;
      until = next;
      if (jumpTo != null && until <= jumpTo) jumpTo = null;
      continue;
    }
    const overlapped = unseen.length < records.length;
    const walk = await absorb(stopOnOverlap ? unseen : records, budget);
    if (walk === 'stop' || (stopOnOverlap && overlapped)) return;
    const natural = nextUntil(fresh);
    if (
      jumpTo != null &&
      overlapped &&
      page.length >= LICHESS_PAGE_SIZE &&
      natural != null &&
      natural > jumpTo &&
      (until === undefined || jumpTo < until)
    ) {
      budget.cursor = { ...budget.cursor, lichessUntil: jumpTo };
      emit(budget, true);
      until = jumpTo;
      jumpTo = null;
      continue;
    }
    const next = advanceLichess(budget, fresh, until, page.length);
    if (next === null) return;
    until = next;
    if (jumpTo != null && until <= jumpTo) jumpTo = null;
  }
}

/** The next older page, or null when this page was the end of the history. */
function advanceLichess(
  budget: Budget,
  fresh: readonly LichessGame[],
  until: number | undefined,
  pageLength: number,
): number | null {
  const next = nextUntil(fresh);
  if (next === null || (until !== undefined && next >= until) || pageLength < LICHESS_PAGE_SIZE) {
    budget.cursor = { ...budget.cursor, lichessUntil: null };
    return null;
  }
  budget.cursor = { ...budget.cursor, lichessUntil: next };
  emit(budget, true);
  return next;
}

type Walk = 'done' | 'stop';

async function absorb(records: readonly GameRecord[], budget: Budget): Promise<Walk> {
  const sorted = [...records].sort((a, b) => b.playedAt - a.playedAt);
  for (const game of sorted) {
    throwIfAborted(budget.signal);
    const id = recordId(game);
    if (budget.seen.has(id)) continue;
    if (isBullet(game.speed)) continue;
    if (blocksOlder(budget, game.playedAt)) return 'stop';
    budget.onAnalyze?.(id);
    const found = await analyzeGame(game.pgn, game.userColor, budget.signal);
    throwIfAborted(budget.signal);
    for (let index = found.length - 1; index >= 0; index -= 1) {
      const drill = found[index];
      if (!drill) continue;
      budget.fresh.push(withSource(drill, id, game));
    }
    budget.seen.add(id);
    budget.cursor = rememberGame(budget.cursor, id, game.playedAt);
    budget.examined += 1;
    emit(budget, true);
    await yieldToMain();
    throwIfAborted(budget.signal);
  }
  return 'done';
}

function withSource(drill: DrillPosition, gameId: string, game: GameRecord): DrillPosition {
  const existing = drill.source;
  const move = existing?.move ?? /^You played ([^.]+)\./.exec(drill.note)?.[1];
  const opponent = game.opponent ?? existing?.opponent;
  return {
    ...drill,
    source: {
      ...existing,
      gameId,
      ...(move ? { move } : {}),
      ...(opponent ? { opponent } : {}),
      ...(game.speed ? { timeClass: game.speed } : {}),
      ...(game.playedAt > 0 ? { playedAt: game.playedAt } : {}),
      ...(game.url ? { url: game.url } : {}),
    },
  };
}

function recordId(game: GameRecord): string {
  if (game.id) return game.id;
  return `p:${game.playedAt}:${game.userColor}:${game.pgn.length}:${game.pgn.slice(0, 24)}`;
}

async function chessComArchives(username: string, ctx: FetchContext): Promise<string[]> {
  const archiveUrl = `https://api.chess.com/pub/player/${encodeURIComponent(username)}/games/archives`;
  const archiveRes = await fetchPublic(archiveUrl, 'application/json', 'chesscom', ctx);
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

async function chessComMonth(url: string, username: string, ctx: FetchContext): Promise<GameRecord[]> {
  const res = await fetchPublic(url, 'application/json', 'chesscom', ctx);
  if (res.status === 404) return [];
  if (!res.ok) throw new ImportError('Chess.com did not return games. Paste a PGN from one game.');
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

async function lichessPage(
  username: string,
  until: number | undefined,
  ctx: FetchContext,
): Promise<LichessGame[]> {
  const res = await fetchPublic(lichessGamesUrl(username, until), 'application/x-ndjson', 'lichess', ctx);
  if (res.status === 404) throw new ImportError('No Lichess player by that name.');
  if (!res.ok) throw new ImportError('Lichess did not return games. Paste a PGN from one game.');
  const text = await res.text();
  const games: LichessGame[] = [];
  let sawNonEmpty = false;
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    sawNonEmpty = true;
    try {
      games.push(JSON.parse(trimmed) as LichessGame);
    } catch {
      continue;
    }
  }
  if (sawNonEmpty && games.length === 0) {
    throw new ImportError('Lichess returned an unexpected format. Try again or paste a PGN.');
  }
  return games;
}

function fetchPublic(url: string, accept: string, site: GameSite, ctx: FetchContext): Promise<GameResponse> {
  return politeFetch({
    url,
    accept,
    site,
    userAgent: CHESS_COM_USER_AGENT,
    fetchImpl: ctx.fetchImpl,
    signal: ctx.signal,
    sleep: ctx.sleep,
    now: ctx.now,
    onStatus: ctx.onStatus,
  });
}

function unseenGames(games: readonly LichessGame[], seen: Set<string>): LichessGame[] {
  const fresh: LichessGame[] = [];
  for (const game of games) {
    const id = lichessGameId(game);
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
