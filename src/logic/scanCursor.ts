/** Public games are read by username. The site never asks for a password. */
export type GameSite = 'chesscom' | 'lichess';

/**
 * Where a username scan stopped.
 * `seen` is the games already analyzed. A later scan skips them.
 * Chess.com months in `doneArchives` are not downloaded again, except the
 * newest month, which can still grow. Lichess `lichessUntil` is the next
 * older page when the backfill was interrupted.
 */
export type ScanCursor = {
  site: GameSite;
  username: string;
  seen: string[];
  /** Newest analyzed game, in milliseconds. 0 when nothing is analyzed yet. */
  newestMs: number;
  doneArchives: string[];
  lichessUntil: number | null;
  /** Older history does not need another walk. A rescan only looks for new games. */
  backfillDone: boolean;
  /** Games analyzed for this username, not counting ones skipped as already seen. */
  games: number;
  /**
   * True only after a saved in-progress scan is loaded.
   * Opening the app continues that scan. A scan the player stopped stays false.
   */
  resume: boolean;
};

export const SEEN_CAP = 2000;

export const SCAN_PAUSED_MESSAGE = 'Scan paused.';
export const SCAN_LOOKING_MESSAGE = 'Looking at recent games.';
export const SCAN_CONTINUING_MESSAGE = 'Continuing your scan.';

const USERNAME_PATTERN = /^[A-Za-z0-9_-]{2,25}$/;

export function cleanUsername(value: string): string | null {
  const name = value.trim();
  if (!USERNAME_PATTERN.test(name)) return null;
  return name;
}

export function emptyCursor(site: GameSite, username: string): ScanCursor {
  return {
    site,
    username,
    seen: [],
    newestMs: 0,
    doneArchives: [],
    lichessUntil: null,
    backfillDone: false,
    games: 0,
    resume: false,
  };
}

export function snapshotCursor(cursor: ScanCursor): ScanCursor {
  return {
    ...cursor,
    seen: cursor.seen.slice(),
    doneArchives: cursor.doneArchives.slice(),
  };
}

export function sameScan(cursor: ScanCursor | null, site: GameSite, username: string): cursor is ScanCursor {
  if (!cursor) return false;
  return cursor.site === site && cursor.username.toLowerCase() === username.toLowerCase();
}

function archiveMonthKey(url: string): number | null {
  const match = url.match(/\/(\d{4})\/(\d{2})\/?$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return null;
  return year * 100 + month;
}

function monthKeyFromMs(ms: number): number | null {
  if (!Number.isFinite(ms) || ms <= 0) return null;
  const d = new Date(ms);
  return d.getUTCFullYear() * 100 + (d.getUTCMonth() + 1);
}

/**
 * Chess.com months still worth a request. Once backfill has settled, recheck the newest month
 * plus any archive down to the month of `cursor.newestMs` so end-of-month games aren't lost on rollover.
 */
export function monthsToRead(archivesNewestFirst: readonly string[], cursor: ScanCursor): string[] {
  const done = new Set(cursor.doneArchives);
  const newest = archivesNewestFirst[0];
  const cutoffMonth = cursor.backfillDone ? monthKeyFromMs(cursor.newestMs) : null;
  const urls: string[] = [];
  for (const url of archivesNewestFirst) {
    if (cursor.backfillDone) {
      if (url === newest) {
        urls.push(url);
        continue;
      }
      const key = archiveMonthKey(url);
      if (cutoffMonth != null && key != null && (key === cutoffMonth || (!done.has(url) && key > cutoffMonth))) {
        urls.push(url);
      }
      continue;
    }
    if (done.has(url)) continue;
    urls.push(url);
  }
  return urls;
}

export function markArchiveDone(cursor: ScanCursor, url: string): ScanCursor {
  if (cursor.doneArchives.includes(url)) return cursor;
  return { ...cursor, doneArchives: [...cursor.doneArchives, url] };
}

export function rememberGame(cursor: ScanCursor, id: string, playedAt: number): ScanCursor {
  const seen = cursor.seen.includes(id) ? cursor.seen : [id, ...cursor.seen].slice(0, SEEN_CAP);
  return {
    ...cursor,
    seen,
    newestMs: Math.max(cursor.newestMs, playedAt),
    games: cursor.games + (cursor.seen.includes(id) ? 0 : 1),
  };
}

export function cursorFromSaved(value: unknown): ScanCursor | null {
  if (!value || typeof value !== 'object') return null;
  const cursor = value as Partial<ScanCursor>;
  if (cursor.site !== 'chesscom' && cursor.site !== 'lichess') return null;
  if (typeof cursor.username !== 'string') return null;
  const username = cleanUsername(cursor.username);
  if (!username) return null;
  const newestMs = finite(cursor.newestMs);
  const lichessUntil =
    typeof cursor.lichessUntil === 'number' && Number.isFinite(cursor.lichessUntil) && cursor.lichessUntil >= 0
      ? cursor.lichessUntil
      : null;
  return {
    site: cursor.site,
    username,
    seen: idList(cursor.seen).slice(0, SEEN_CAP),
    newestMs,
    doneArchives: idList(cursor.doneArchives)
      .filter((url) => url.startsWith('https://api.chess.com/pub/'))
      .slice(0, 36),
    lichessUntil,
    backfillDone: cursor.backfillDone === true,
    games: finite(cursor.games),
    resume: false,
  };
}

function finite(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;
}

function idList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (typeof item !== 'string') continue;
    const id = item.trim();
    if (id.length === 0 || id.length > 180 || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}
