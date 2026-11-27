import packageJson from '@/package.json';
import { getSupabasePublicConfig } from '@/src/data/supabase';
import { ERROR_REPORT_SESSION_KEY } from '@/src/storage/sessionKeys';

const MAX_REPORTS = 8;
const DEDUPE_MS = 60_000;
const MESSAGE_LIMIT = 500;
const STACK_LIMIT = 4000;
const ROUTE_LIMIT = 200;

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const IPV4 = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;
const JWT = /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g;
const BEARER = /Bearer\s+\S+/gi;
const UUID = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
const HTTP_URL = /https?:\/\/[^\s)'"<>]+/gi;
const ROUTE_PATH = /^\/[A-Za-z0-9._~/-]*$/;

export type ClientPlatform = 'web' | 'ios' | 'android';

export type ClientErrorRow = {
  message: string;
  stack: string | null;
  route: string | null;
  app_version: string;
  platform: ClientPlatform;
};

type SessionStore = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

type Bucket = {
  sent: number;
  recent: Record<string, number>;
};

let memoryBucket: Bucket = { sent: 0, recent: {} };

export function isErrorReportingEnabled(flag: string | undefined = process.env.EXPO_PUBLIC_ERROR_REPORTING): boolean {
  return flag === 'true';
}

export function resetClientErrorReporterForTests(): void {
  memoryBucket = { sent: 0, recent: {} };
}

export function scrubClientText(value: string, limit: number): string {
  return value
    .replace(HTTP_URL, (match) => {
      try {
        const url = new URL(match);
        return `${url.origin}${url.pathname}`;
      } catch {
        return '[url]';
      }
    })
    .replace(EMAIL, '[email]')
    .replace(JWT, '[token]')
    .replace(BEARER, 'Bearer [token]')
    .replace(UUID, '[id]')
    .replace(IPV4, '[ip]')
    .slice(0, limit);
}

export function clientRoute(value: string | null | undefined): string | null {
  if (!value) return null;
  const path = value.split('?')[0]?.split('#')[0] ?? '';
  if (!ROUTE_PATH.test(path) || path.length > ROUTE_LIMIT) return null;
  return path;
}

function platformName(value: string): ClientPlatform | null {
  switch (value) {
    case 'web':
    case 'ios':
    case 'android':
      return value;
    default:
      return null;
  }
}

function errorParts(error: unknown): { message: string; stack: string | null } {
  if (error instanceof Error) {
    return { message: error.message, stack: error.stack ?? null };
  }
  if (typeof error === 'string') return { message: error, stack: null };
  return { message: 'Error', stack: null };
}

export function prepareClientError(input: {
  error: unknown;
  route?: string | null;
  version: string;
  platform: string;
}): ClientErrorRow | null {
  const platform = platformName(input.platform);
  if (!platform) return null;
  const parts = errorParts(input.error);
  const message = scrubClientText(parts.message, MESSAGE_LIMIT).trim();
  if (!message) return null;
  const stack = parts.stack ? scrubClientText(parts.stack, STACK_LIMIT).trim() : '';
  const version = input.version.trim().slice(0, 40);
  if (!version) return null;
  return {
    message,
    stack: stack || null,
    route: clientRoute(input.route),
    app_version: version,
    platform,
  };
}

function readBucket(storage: SessionStore | null): Bucket {
  if (!storage) return memoryBucket;
  try {
    const raw = storage.getItem(ERROR_REPORT_SESSION_KEY);
    if (!raw) return memoryBucket;
    const parsed = JSON.parse(raw) as Partial<Bucket>;
    const sent = typeof parsed.sent === 'number' && parsed.sent >= 0 ? parsed.sent : memoryBucket.sent;
    const recent = parsed.recent && typeof parsed.recent === 'object' ? parsed.recent : {};
    memoryBucket = { sent, recent: { ...recent } };
    return memoryBucket;
  } catch {
    return memoryBucket;
  }
}

function writeBucket(storage: SessionStore | null, bucket: Bucket): void {
  memoryBucket = bucket;
  if (!storage) return;
  try {
    storage.setItem(ERROR_REPORT_SESSION_KEY, JSON.stringify(bucket));
  } catch {
    // The in-memory count still limits this document.
  }
}

export function allowClientError(key: string, now: number, storage: SessionStore | null): boolean {
  const bucket = readBucket(storage);
  const previous = bucket.recent[key];
  if (previous !== undefined && now - previous < DEDUPE_MS) return false;
  if (bucket.sent >= MAX_REPORTS) return false;
  writeBucket(storage, {
    sent: bucket.sent + 1,
    recent: { ...bucket.recent, [key]: now },
  });
  return true;
}

export function clientErrorRequest(
  config: { url: string; anonKey: string },
  row: ClientErrorRow,
): { url: string; headers: Record<string, string>; body: string } {
  return {
    url: `${config.url.replace(/\/$/, '')}/rest/v1/client_errors`,
    headers: {
      apikey: config.anonKey,
      Authorization: `Bearer ${config.anonKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      message: row.message,
      stack: row.stack,
      route: row.route,
      app_version: row.app_version,
      platform: row.platform,
    }),
  };
}

function browserSession(): SessionStore | null {
  if (typeof sessionStorage === 'undefined') return null;
  return sessionStorage;
}

function currentRoute(): string | null {
  if (typeof window === 'undefined') return null;
  return window.location.pathname;
}

async function postClientError(row: ClientErrorRow): Promise<void> {
  const config = getSupabasePublicConfig();
  if (!config) return;
  const request = clientErrorRequest(config, row);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    await fetch(request.url, {
      method: 'POST',
      headers: request.headers,
      body: request.body,
      signal: controller.signal,
    });
  } catch {
    // A failed report must not raise another error.
  } finally {
    clearTimeout(timer);
  }
}

export function reportClientError(
  error: unknown,
  options?: {
    route?: string | null;
    now?: number;
    storage?: SessionStore | null;
    version?: string;
    platform?: string;
    enabled?: boolean;
    send?: (row: ClientErrorRow) => Promise<void>;
  },
): void {
  if (!(options?.enabled ?? isErrorReportingEnabled())) return;
  const row = prepareClientError({
    error,
    route: options?.route === undefined ? currentRoute() : options.route,
    version: options?.version ?? packageJson.version,
    platform: options?.platform ?? 'web',
  });
  if (!row) return;
  const storage = options?.storage === undefined ? browserSession() : options.storage;
  const now = options?.now ?? Date.now();
  if (!allowClientError(`${row.route ?? ''}\n${row.message}`, now, storage)) return;
  const send = options?.send ?? postClientError;
  void send(row).catch(() => {
    // The sender already swallows network failures. This covers a thrown mock.
  });
}

export function startClientErrorReporting(): () => void {
  if (!isErrorReportingEnabled() || typeof window === 'undefined') return () => {};
  const onError = (event: ErrorEvent) => {
    reportClientError(event.error ?? event.message);
  };
  const onRejection = (event: PromiseRejectionEvent) => {
    reportClientError(event.reason);
  };
  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onRejection);
  return () => {
    window.removeEventListener('error', onError);
    window.removeEventListener('unhandledrejection', onRejection);
  };
}
