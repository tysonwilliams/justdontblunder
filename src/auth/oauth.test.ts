import { afterEach, describe, expect, it, vi } from 'vitest';

import { oauthFailedMessage, oauthUnavailableMessage } from '@/src/auth/messages';
import { nativeAppleRequest, startOAuthSignIn, webGoogleIdTokenRequest, webProviderRequest } from '@/src/auth/oauth';
import {
  enabledOAuthProviders,
  loadOAuthAvailability,
  parseOAuthAvailability,
  shownOAuthProviders,
  visibleOAuthProviders,
} from '@/src/auth/providers';
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
    setSession: fail,
    resend: fail,
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
    expect(signInWithIdToken).toHaveBeenCalledWith({ provider: 'apple', token: 'apple-token', nonce: 'nonce-1' });
    expect(updateUserData).toHaveBeenCalledWith({
      data: { full_name: 'Ada Lovelace', given_name: 'Ada', family_name: 'Lovelace' },
    });
  });

  it('signs in with a Google ID token and the raw nonce', async () => {
    const signInWithIdToken = vi.fn(async () => ({ data: { userId: 'user-1' }, error: null }));
    const result = await startOAuthSignIn(api({ signInWithIdToken }), webGoogleIdTokenRequest('google-jwt', 'raw-nonce'));
    expect(result).toEqual({ status: 'signed-in' });
    expect(signInWithIdToken).toHaveBeenCalledWith({
      provider: 'google',
      token: 'google-jwt',
      nonce: 'raw-nonce',
    });
  });

  it('explains a Google provider that is not configured', async () => {
    const signInWithIdToken = vi.fn(async () => ({
      data: { userId: null },
      error: { message: 'Provider (issuer "https://accounts.google.com") is not enabled' },
    }));
    const result = await startOAuthSignIn(api({ signInWithIdToken }), webGoogleIdTokenRequest('google-jwt', 'raw-nonce'));
    expect(result).toEqual({ status: 'unavailable', message: oauthUnavailableMessage('google') });
  });

  it('rejects a Google credential that never arrived', async () => {
    const signInWithIdToken = vi.fn();
    const result = await startOAuthSignIn(api({ signInWithIdToken }), webGoogleIdTokenRequest('', 'raw-nonce'));
    expect(result).toEqual({ status: 'error', message: oauthFailedMessage() });
    expect(signInWithIdToken).not.toHaveBeenCalled();
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
  const previousFlag = process.env.EXPO_PUBLIC_OAUTH_PROVIDERS;

  afterEach(() => {
    if (previousFlag === undefined) delete process.env.EXPO_PUBLIC_OAUTH_PROVIDERS;
    else process.env.EXPO_PUBLIC_OAUTH_PROVIDERS = previousFlag;
  });

  it('hides a provider Auth marks off and keeps one it cannot check', () => {
    expect(visibleOAuthProviders({ google: 'off', apple: 'on' })).toEqual(['apple']);
    expect(visibleOAuthProviders({ google: 'unknown', apple: 'off' })).toEqual(['google']);
    expect(visibleOAuthProviders({ google: 'off', apple: 'off' })).toEqual([]);
  });

  it('shows no buttons when EXPO_PUBLIC_OAUTH_PROVIDERS is unset', () => {
    delete process.env.EXPO_PUBLIC_OAUTH_PROVIDERS;
    expect(enabledOAuthProviders()).toEqual([]);
    expect(enabledOAuthProviders('')).toEqual([]);
    expect(enabledOAuthProviders('   ')).toEqual([]);
    expect(shownOAuthProviders({ google: 'on', apple: 'unknown' })).toEqual([]);
  });

  it('parses a comma list and ignores unknown names', () => {
    expect(enabledOAuthProviders('google,apple')).toEqual(['google', 'apple']);
    expect(enabledOAuthProviders(' apple , google ')).toEqual(['apple', 'google']);
    expect(enabledOAuthProviders('Google,APPLE,google')).toEqual(['google', 'apple']);
    expect(enabledOAuthProviders('facebook,, google')).toEqual(['google']);
    expect(enabledOAuthProviders('google;apple')).toEqual([]);
  });

  it('shows only listed providers, and still hides one Auth marks off', () => {
    const both = ['google', 'apple'] as const;
    expect(shownOAuthProviders({ google: 'off', apple: 'on' }, both)).toEqual(['apple']);
    expect(shownOAuthProviders({ google: 'unknown', apple: 'off' }, both)).toEqual(['google']);
    expect(shownOAuthProviders({ google: 'on', apple: 'on' }, ['apple'])).toEqual(['apple']);
    expect(shownOAuthProviders({ google: 'on', apple: 'unknown' }, [])).toEqual([]);
  });

  it('reads the build flag when the screen does not pass a list', () => {
    process.env.EXPO_PUBLIC_OAUTH_PROVIDERS = 'apple';
    expect(shownOAuthProviders({ google: 'on', apple: 'on' })).toEqual(['apple']);
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
