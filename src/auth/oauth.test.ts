import { describe, expect, it, vi } from 'vitest';

import { oauthUnavailableMessage } from '@/src/auth/messages';
import { nativeAppleRequest, startOAuthSignIn, webProviderRequest } from '@/src/auth/oauth';
import { loadOAuthAvailability, parseOAuthAvailability, visibleOAuthProviders } from '@/src/auth/providers';
import type { AuthApi } from '@/src/auth/types';

function api(partial: Partial<AuthApi>): AuthApi {
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
    exchangeCodeForSession: fail,
    verifyOtp: fail,
    getSession: async () => ({ userId: null }),
    signOut: async () => ({ error: null }),
    ...partial,
  };
}

describe('web and native sign-in', () => {
  it('starts Google and Apple through the web redirect', async () => {
    const signInWithOAuth = vi.fn(async () => ({ data: { url: 'https://provider.example' }, error: null }));
    const client = api({ signInWithOAuth });
    const google = await startOAuthSignIn(client, webProviderRequest('google', 'https://justdontblunder.com'));
    const apple = await startOAuthSignIn(client, webProviderRequest('apple', 'https://justdontblunder.com/'));
    expect(google).toEqual({ status: 'redirecting' });
    expect(apple).toEqual({ status: 'redirecting' });
    expect(signInWithOAuth).toHaveBeenNthCalledWith(1, {
      provider: 'google',
      redirectTo: 'https://justdontblunder.com/auth/callback',
    });
    expect(signInWithOAuth).toHaveBeenNthCalledWith(2, {
      provider: 'apple',
      redirectTo: 'https://justdontblunder.com/auth/callback',
    });
  });

  it('explains a provider that is not configured', async () => {
    const signInWithOAuth = vi.fn(async () => ({
      data: { url: null },
      error: { message: 'Unsupported provider: provider is not enabled' },
    }));
    const result = await startOAuthSignIn(api({ signInWithOAuth }), webProviderRequest('apple', 'http://localhost:43127'));
    expect(result).toEqual({ status: 'unavailable', message: oauthUnavailableMessage('apple') });
  });

  it('signs in with an Apple identity token and keeps the name from the first authorization', async () => {
    const signInWithIdToken = vi.fn(async () => ({ data: { userId: 'user-1' }, error: null }));
    const updateUserData = vi.fn(async () => ({ data: null, error: null }));
    const request = nativeAppleRequest({
      identityToken: 'apple-token',
      nonce: 'nonce-1',
      fullName: { givenName: 'Ada', familyName: 'Lovelace' },
    });
    const result = await startOAuthSignIn(api({ signInWithIdToken, updateUserData }), request);
    expect(result).toEqual({ status: 'signed-in' });
    expect(signInWithIdToken).toHaveBeenCalledWith({ token: 'apple-token', nonce: 'nonce-1' });
    expect(updateUserData).toHaveBeenCalledWith({
      data: { full_name: 'Ada Lovelace', given_name: 'Ada', family_name: 'Lovelace' },
    });
  });

  it('skips the name update when Apple does not send one', async () => {
    const signInWithIdToken = vi.fn(async () => ({ data: { userId: 'user-1' }, error: null }));
    const updateUserData = vi.fn();
    const result = await startOAuthSignIn(
      api({ signInWithIdToken, updateUserData }),
      nativeAppleRequest({ identityToken: 'apple-token' }),
    );
    expect(result).toEqual({ status: 'signed-in' });
    expect(updateUserData).not.toHaveBeenCalled();
  });
});

describe('provider availability', () => {
  it('hides a provider Auth marks off and keeps one it cannot check', () => {
    expect(visibleOAuthProviders({ google: 'off', apple: 'on' })).toEqual(['apple']);
    expect(visibleOAuthProviders({ google: 'unknown', apple: 'off' })).toEqual(['google']);
    expect(visibleOAuthProviders({ google: 'off', apple: 'off' })).toEqual([]);
  });

  it('reads the public settings payload', () => {
    expect(parseOAuthAvailability({ external: { google: false, apple: true } })).toEqual({
      google: 'off',
      apple: 'on',
    });
    expect(parseOAuthAvailability(null)).toEqual({ google: 'unknown', apple: 'unknown' });
  });

  it('treats a failed settings request as unknown', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('offline');
    });
    await expect(loadOAuthAvailability({ url: 'https://example.supabase.co/', anonKey: 'anon' }, fetchImpl)).resolves.toEqual({
      google: 'unknown',
      apple: 'unknown',
    });
    expect(fetchImpl).toHaveBeenCalledWith('https://example.supabase.co/auth/v1/settings', {
      headers: { apikey: 'anon', Authorization: 'Bearer anon' },
    });
  });
});
