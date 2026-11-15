import { describe, expect, it, vi } from 'vitest';

import {
  AUTH_LINK_ERROR,
  EMAIL_CONFIRMED_MESSAGE,
  finishAuthCallback,
  openPasswordUpdate,
  parseAuthQuery,
  resetAuthAttemptsForTests,
  routeAfterAuth,
  shareAuthAttempt,
  type AuthQuery,
} from '@/src/auth/callback';
import { authCallbackUrl, browserAuthSearch, clearAuthSearch, passwordUpdateUrl } from '@/src/auth/redirect';
import type { AuthApi } from '@/src/auth/types';

function query(patch: Partial<AuthQuery> = {}): AuthQuery {
  return {
    code: null,
    tokenHash: null,
    type: null,
    next: null,
    error: null,
    flowId: null,
    accessToken: null,
    refreshToken: null,
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
    setSession: fail,
    resend: fail,
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

  it('reads an implicit session from the hash and clears it', () => {
    const history = { state: { route: 1 }, replaceState: vi.fn() };
    vi.stubGlobal('window', {
      location: {
        pathname: '/auth/callback',
        search: '?next=/progress',
        hash: '#access_token=access-1&refresh_token=refresh-1&expires_in=3600&token_type=bearer&type=magiclink',
      },
      history,
    });
    try {
      const search = browserAuthSearch();
      expect(search).toBe(
        'next=/progress&access_token=access-1&refresh_token=refresh-1&expires_in=3600&token_type=bearer&type=magiclink',
      );
      expect(parseAuthQuery(search)).toMatchObject({
        next: '/progress',
        accessToken: 'access-1',
        refreshToken: 'refresh-1',
        type: 'magiclink',
        code: null,
        error: null,
      });
      clearAuthSearch();
      expect(history.replaceState).toHaveBeenCalledWith({ route: 1 }, '', '/auth/callback');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('reads an error description from the hash', () => {
    const parsed = parseAuthQuery(
      '#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired',
    );
    expect(parsed.error).toBe('Email link is invalid or has expired');
    expect(parsed.accessToken).toBeNull();
    expect(parsed.refreshToken).toBeNull();
  });

  it('stores an implicit session and opens progress', async () => {
    const setSession = vi.fn(async () => ({ data: null, error: null }));
    const exchangeCodeForSession = vi.fn();
    const result = await finishAuthCallback(
      api({ setSession, exchangeCodeForSession }),
      parseAuthQuery('#access_token=access-1&refresh_token=refresh-1&type=magiclink'),
    );
    expect(setSession).toHaveBeenCalledWith({ accessToken: 'access-1', refreshToken: 'refresh-1' });
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
    expect(result).toEqual({ status: 'ready', next: '/progress' });
  });

  it('stores a recovery hash and opens the password screen', async () => {
    const setSession = vi.fn(async () => ({ data: null, error: null }));
    const result = await finishAuthCallback(
      api({ setSession }),
      parseAuthQuery('#access_token=access-1&refresh_token=refresh-1&type=recovery'),
    );
    expect(result).toEqual({ status: 'ready', next: '/auth/update-password' });
  });

  it('prefers hash tokens over a code', async () => {
    const setSession = vi.fn(async () => ({ data: null, error: null }));
    const exchangeCodeForSession = vi.fn();
    const result = await finishAuthCallback(
      api({ setSession, exchangeCodeForSession }),
      query({ code: 'auth-code', accessToken: 'access-1', refreshToken: 'refresh-1', type: 'signup' }),
    );
    expect(setSession).toHaveBeenCalledOnce();
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
    expect(result).toEqual({ status: 'ready', next: '/progress' });
  });

  it('does not store a session when the hash already failed', async () => {
    const setSession = vi.fn();
    const result = await finishAuthCallback(
      api({ setSession }),
      parseAuthQuery(
        '#error=access_denied&error_description=Email+link+is+invalid+or+has+expired&access_token=access-1&refresh_token=refresh-1',
      ),
    );
    expect(setSession).not.toHaveBeenCalled();
    expect(result).toEqual({ status: 'error', message: AUTH_LINK_ERROR });
  });

  it('treats a hash access_denied as a canceled sign-in', async () => {
    const result = await finishAuthCallback(api(), parseAuthQuery('#error=access_denied'));
    expect(result).toEqual({ status: 'error', message: 'The sign-in was canceled.' });
  });

  it('exchanges a signup code when this device still has the verifier', async () => {
    const exchangeCodeForSession = vi.fn(async () => ({ data: null, error: null }));
    const result = await finishAuthCallback(
      api({ exchangeCodeForSession }),
      query({ code: 'auth-code', type: 'signup' }),
    );
    expect(result).toEqual({ status: 'ready', next: '/progress' });
  });

  it('says the email is confirmed when a signup code cannot be exchanged', async () => {
    const exchangeCodeForSession = vi.fn(async () => ({
      data: null,
      error: { message: 'PKCE code verifier not found in storage' },
    }));
    const signup = await finishAuthCallback(
      api({ exchangeCodeForSession }),
      query({ code: 'auth-code', type: 'signup' }),
    );
    const email = await finishAuthCallback(api({ exchangeCodeForSession }), query({ code: 'auth-code', type: 'email' }));
    expect(signup).toEqual({ status: 'error', message: EMAIL_CONFIRMED_MESSAGE });
    expect(email).toEqual({ status: 'error', message: EMAIL_CONFIRMED_MESSAGE });
  });

  it('keeps the expired message when another kind of code cannot be exchanged', async () => {
    const exchangeCodeForSession = vi.fn(async () => ({ data: null, error: { message: 'missing' } }));
    const magic = await finishAuthCallback(
      api({ exchangeCodeForSession }),
      query({ code: 'auth-code', type: 'magiclink' }),
    );
    const plain = await finishAuthCallback(api({ exchangeCodeForSession }), query({ code: 'auth-code' }));
    expect(magic).toEqual({ status: 'error', message: AUTH_LINK_ERROR });
    expect(plain).toEqual({ status: 'error', message: AUTH_LINK_ERROR });
  });

  it('opens the password form from an implicit recovery hash', async () => {
    const setSession = vi.fn(async () => ({ data: null, error: null }));
    const getSession = vi.fn(async () => ({ userId: 'user-1' }));
    const result = await openPasswordUpdate(
      api({ setSession, getSession }),
      parseAuthQuery('#access_token=access-1&refresh_token=refresh-1&type=recovery'),
    );
    expect(setSession).toHaveBeenCalledWith({ accessToken: 'access-1', refreshToken: 'refresh-1' });
    expect(result).toEqual({ status: 'ready' });
  });

  it('reports a failed implicit session without asking for the password', async () => {
    const setSession = vi.fn(async () => ({ data: null, error: { message: 'bad' } }));
    const getSession = vi.fn();
    const result = await openPasswordUpdate(
      api({ setSession, getSession }),
      parseAuthQuery('#access_token=access-1&refresh_token=refresh-1&type=recovery'),
    );
    expect(getSession).not.toHaveBeenCalled();
    expect(result).toEqual({ status: 'error', message: AUTH_LINK_ERROR });
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
