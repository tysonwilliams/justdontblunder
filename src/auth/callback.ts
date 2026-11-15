import { isOtpType, type AuthApi, type OtpType } from '@/src/auth/types';

export type AuthDestination = '/progress' | '/auth/update-password';

export type AuthQuery = {
  code: string | null;
  tokenHash: string | null;
  type: string | null;
  next: string | null;
  error: string | null;
  flowId: string | null;
};

export type AuthCallbackResult =
  | { status: 'ready'; next: AuthDestination }
  | { status: 'error'; message: string };

export const AUTH_LINK_ERROR = 'This sign-in link is incomplete or has expired. Request a new one from the account page.';

const attempts = new Map<string, Promise<unknown>>();

/**
 * Strict mode mounts twice. Share one exchange for the same link so the code is used once,
 * and both mounts can read the result.
 */
export function shareAuthAttempt<T>(key: string, run: () => Promise<T>): Promise<T> {
  const existing = attempts.get(key);
  if (existing) return existing as Promise<T>;
  const pending = run();
  attempts.set(key, pending);
  return pending;
}

export function resetAuthAttemptsForTests(): void {
  attempts.clear();
}

export function parseAuthQuery(search: string): AuthQuery {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  return {
    code: blankToNull(params.get('code')),
    tokenHash: blankToNull(params.get('token_hash')),
    type: blankToNull(params.get('type')),
    next: blankToNull(params.get('next')),
    error: blankToNull(params.get('error_description')) ?? blankToNull(params.get('error')),
    flowId: blankToNull(params.get('sb_flow_id')),
  };
}

/**
 * Recovery opens the password screen. Every other successful link opens Progress.
 * `next` may only choose those two in-app routes. A full URL is reduced to its path.
 */
export function routeAfterAuth(type: string | null, next: string | null): AuthDestination {
  if (type === 'recovery') return '/auth/update-password';
  if (nextPath(next) === '/auth/update-password') return '/auth/update-password';
  return '/progress';
}

export type PasswordLinkResult = { status: 'ready' } | { status: 'missing' } | { status: 'error'; message: string };

/** Exchanges a recovery link when one is present, then checks for a session that can set a password. */
export async function openPasswordUpdate(api: AuthApi, query: AuthQuery): Promise<PasswordLinkResult> {
  if (query.code || query.tokenHash || query.error) {
    const result = await finishAuthCallback(api, query);
    if (result.status === 'error') return result;
  }
  const session = await api.getSession();
  return session.userId ? { status: 'ready' } : { status: 'missing' };
}

export async function finishAuthCallback(api: AuthApi, query: AuthQuery): Promise<AuthCallbackResult> {
  if (query.error) return { status: 'error', message: linkError(query.error) };
  if (query.code) {
    const { error } = await api.exchangeCodeForSession(query.code, query.flowId);
    if (error) return { status: 'error', message: AUTH_LINK_ERROR };
    return { status: 'ready', next: routeAfterAuth(query.type, query.next) };
  }
  if (query.tokenHash) {
    if (!isOtpType(query.type)) return { status: 'error', message: AUTH_LINK_ERROR };
    const type: OtpType = query.type;
    const { error } = await api.verifyOtp({ tokenHash: query.tokenHash, type });
    if (error) return { status: 'error', message: AUTH_LINK_ERROR };
    return { status: 'ready', next: routeAfterAuth(type, query.next) };
  }
  return { status: 'error', message: AUTH_LINK_ERROR };
}

function linkError(error: string): string {
  const text = error.toLowerCase();
  if (text.includes('access_denied') || text.includes('canceled') || text.includes('cancelled')) {
    return 'The sign-in was canceled.';
  }
  return AUTH_LINK_ERROR;
}

function nextPath(next: string | null): string | null {
  if (!next) return null;
  if (next.startsWith('/') && !next.startsWith('//')) return next.split('?')[0] ?? next;
  try {
    return new URL(next).pathname;
  } catch {
    return null;
  }
}

function blankToNull(value: string | null): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed ? trimmed : null;
}
