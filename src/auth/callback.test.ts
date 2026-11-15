import { describe, expect, it, vi } from 'vitest';

import {
  AUTH_LINK_ERROR,
  finishAuthCallback,
  openPasswordUpdate,
  parseAuthQuery,
  resetAuthAttemptsForTests,
  routeAfterAuth,
  shareAuthAttempt,
  type AuthQuery,
} from '@/src/auth/callback';
import { authCallbackUrl, passwordUpdateUrl } from '@/src/auth/redirect';
import type { AuthApi } from '@/src/auth/types';

function query(patch: Partial<AuthQuery> = {}): AuthQuery {
  return {
    code: null,
    tokenHash: null,
    type: null,
    next: null,
    error: null,
    flowId: null,
    ...patch,
  };
}

function api(partial: Partial<AuthApi> = {}): AuthApi {
  const fail = async () => {
    throw new Error('unexpected auth call');
  };
  return {
    signUp: fail,
    signInWithPassword: fail,
    signInWithOtp: fail,
    resetPasswordForEmail: fail,
    updatePassword: fail,
    updateUserData: fail,
    signInWithOAuth: fail,
    signInWithIdToken: fail,
    exchangeCodeForSession: vi.fn(async () => ({ data: null, error: null })),
    verifyOtp: vi.fn(async () => ({ data: null, error: null })),
    getSession: async () => ({ userId: null }),
    signOut: async () => ({ error: null }),
    ...partial,
  };
}

describe('auth callback', () => {
  it('builds the callback and password URLs', () => {
    expect(authCallbackUrl('https://justdontblunder.com/')).toBe('https://justdontblunder.com/auth/callback');
    expect(passwordUpdateUrl('http://localhost:43127')).toBe('http://localhost:43127/auth/update-password');
  });

  it('exchanges a code and opens progress', async () => {
    const exchangeCodeForSession = vi.fn(async () => ({ data: null, error: null }));
    const result = await finishAuthCallback(
      api({ exchangeCodeForSession }),
      query({ code: 'auth-code', flowId: 'flow-1' }),
    );
    expect(exchangeCodeForSession).toHaveBeenCalledWith('auth-code', 'flow-1');
    expect(result).toEqual({ status: 'ready', next: '/progress' });
  });

  it('verifies a recovery token and opens the password screen', async () => {
    const verifyOtp = vi.fn(async () => ({ data: null, error: null }));
    const parsed = parseAuthQuery('token_hash=hash-1&type=recovery&next=/auth/update-password');
    const result = await finishAuthCallback(api({ verifyOtp }), parsed);
    expect(verifyOtp).toHaveBeenCalledWith({ tokenHash: 'hash-1', type: 'recovery' });
    expect(result).toEqual({ status: 'ready', next: '/auth/update-password' });
  });

  it('keeps an external next inside the app', () => {
    expect(routeAfterAuth(null, 'https://evil.example/steal')).toBe('/progress');
    expect(routeAfterAuth(null, 'https://evil.example/auth/update-password')).toBe('/auth/update-password');
    expect(routeAfterAuth('recovery', '/progress')).toBe('/auth/update-password');
  });

  it('does not exchange a link that already failed', async () => {
    const exchangeCodeForSession = vi.fn();
    const result = await finishAuthCallback(
      api({ exchangeCodeForSession }),
      query({ error: 'access_denied', code: 'unused' }),
    );
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
    expect(result).toEqual({ status: 'error', message: 'The sign-in was canceled.' });
  });

  it('reports an incomplete link', async () => {
    const result = await finishAuthCallback(api(), query());
    expect(result).toEqual({ status: 'error', message: AUTH_LINK_ERROR });
  });

  it('opens the password form when the recovery session is present', async () => {
    const exchangeCodeForSession = vi.fn(async () => ({ data: null, error: null }));
    const getSession = vi.fn(async () => ({ userId: 'user-1' }));
    const result = await openPasswordUpdate(api({ exchangeCodeForSession, getSession }), query({ code: 'reset-code' }));
    expect(exchangeCodeForSession).toHaveBeenCalledWith('reset-code', null);
    expect(result).toEqual({ status: 'ready' });
  });

  it('asks for a new link when the recovery session is missing', async () => {
    const result = await openPasswordUpdate(api(), query());
    expect(result).toEqual({ status: 'missing' });
  });

  it('exchanges one shared attempt for a repeated mount', async () => {
    resetAuthAttemptsForTests();
    const run = vi.fn(async () => 'done');
    const [first, second] = await Promise.all([shareAuthAttempt('code-1', run), shareAuthAttempt('code-1', run)]);
    expect(first).toBe('done');
    expect(second).toBe('done');
    expect(run).toHaveBeenCalledOnce();
  });
});
