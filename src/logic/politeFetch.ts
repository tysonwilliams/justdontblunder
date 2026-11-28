import { abortError, isAbortError, throwIfAborted } from '@/src/logic/scanAbort';
import type { GameSite } from '@/src/logic/scanCursor';

export class ImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ImportError';
  }
}

export type GameResponse = {
  ok: boolean;
  status: number;
  headers?: { get(name: string): string | null };
  json: () => Promise<unknown>;
  text: () => Promise<string>;
};

export type GameFetch = (url: string, init?: RequestInit) => Promise<GameResponse>;

export type Sleep = (ms: number, signal: AbortSignal) => Promise<void>;

/** One try plus retries. A 429 does not end the scan on the first response. */
export const FETCH_ATTEMPTS = 5;

/** Waits used when a response has no Retry-After. */
export const RETRY_BACKOFF_MS = [500, 1000, 2000, 4000, 8000] as const;

const TRANSIENT = new Set([408, 429, 500, 502, 503, 504]);
const MAX_WAIT_MS = 120_000;

export function busyMessage(site: GameSite, kind: 'limited' | 'offline'): string {
  if (kind === 'offline') return 'Connection trouble. Trying again.';
  return site === 'lichess' ? 'Lichess is busy. Trying again.' : 'Chess.com is busy. Trying again.';
}

export function gaveUpMessage(site: GameSite, kind: 'limited' | 'offline'): string {
  if (kind === 'offline') {
    return site === 'lichess'
      ? 'Could not reach Lichess. Paste a PGN from one game.'
      : 'Could not reach Chess.com. Paste a PGN from one game.';
  }
  return site === 'lichess' ? 'Lichess is busy. Scan again to continue.' : 'Chess.com is busy. Scan again to continue.';
}

export function retryDelayMs(header: string | null, attempt: number, now: number): number {
  const listed = retryAfterMs(header, now);
  if (listed != null) return listed;
  return backoffMs(attempt);
}

export function backoffMs(attempt: number): number {
  return RETRY_BACKOFF_MS[Math.min(Math.max(attempt, 0), RETRY_BACKOFF_MS.length - 1)] ?? 8000;
}

export function retryAfterMs(header: string | null, now: number): number | null {
  if (!header) return null;
  const trimmed = header.trim();
  if (trimmed.length === 0) return null;
  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    const seconds = Number(trimmed);
    if (!Number.isFinite(seconds) || seconds < 0) return null;
    return Math.min(seconds * 1000, MAX_WAIT_MS);
  }
  const date = Date.parse(trimmed);
  if (!Number.isFinite(date)) return null;
  return Math.min(Math.max(0, date - now), MAX_WAIT_MS);
}

export function sleepWithSignal(ms: number, signal: AbortSignal): Promise<void> {
  throwIfAborted(signal);
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(finish, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(abortError());
    };
    function finish(): void {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

export async function politeFetch(input: {
  url: string;
  accept: string;
  site: GameSite;
  userAgent: string;
  fetchImpl: GameFetch;
  signal: AbortSignal;
  sleep: Sleep;
  now: () => number;
  onStatus?: (message: string) => void;
}): Promise<GameResponse> {
  let kind: 'limited' | 'offline' = 'offline';
  for (let attempt = 0; attempt < FETCH_ATTEMPTS; attempt += 1) {
    throwIfAborted(input.signal);
    try {
      const res = await fetchOnce(input);
      if (res.ok || !TRANSIENT.has(res.status)) return res;
      kind = 'limited';
      if (attempt === FETCH_ATTEMPTS - 1) break;
      input.onStatus?.(busyMessage(input.site, 'limited'));
      const header = res.headers?.get('retry-after') ?? null;
      await input.sleep(retryDelayMs(header, attempt, input.now()), input.signal);
    } catch (error) {
      if (isAbortError(error)) throw error;
      if (!(error instanceof ImportError)) throw error;
      kind = 'offline';
      if (attempt === FETCH_ATTEMPTS - 1) break;
      input.onStatus?.(busyMessage(input.site, 'offline'));
      await input.sleep(backoffMs(attempt), input.signal);
    }
  }
  throw new ImportError(gaveUpMessage(input.site, kind));
}

/**
 * Node sends Accept and User-Agent. A browser cannot send User-Agent, and
 * Accept: application/json makes Chess.com's preflight fail (it only allows
 * Origin). Lichess requires Accept: application/x-ndjson (a CORS-safelisted
 * header) or it returns raw PGN instead of NDJSON. A throw outside the browser
 * is retried once with no custom headers.
 */
async function fetchOnce(input: {
  url: string;
  accept: string;
  userAgent: string;
  fetchImpl: GameFetch;
  signal: AbortSignal;
  site: GameSite;
}): Promise<GameResponse> {
  const unreachable = gaveUpMessage(input.site, 'offline');
  const browser = typeof window !== 'undefined';
  try {
    if (browser) {
      const init: RequestInit =
        input.site === 'lichess'
          ? { headers: { Accept: input.accept }, signal: input.signal }
          : { signal: input.signal };
      return await callFetch(input.fetchImpl, input.url, init);
    }
    return await callFetch(input.fetchImpl, input.url, {
      headers: { Accept: input.accept, 'User-Agent': input.userAgent },
      signal: input.signal,
    });
  } catch (error) {
    if (isAbortError(error)) throw error;
    if (browser) throw new ImportError(unreachable);
    try {
      return await callFetch(input.fetchImpl, input.url, { signal: input.signal });
    } catch (retryError) {
      if (isAbortError(retryError)) throw retryError;
      throw new ImportError(unreachable);
    }
  }
}

/** `window.fetch` throws if it is called without its receiver. */
function callFetch(fetchImpl: GameFetch, url: string, init?: RequestInit): Promise<GameResponse> {
  return fetchImpl.call(globalThis, url, init);
}
