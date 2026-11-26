import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createGoogleNonce } from '@/src/auth/googleNonce';
import { startOAuthSignIn, webGoogleIdTokenRequest } from '@/src/auth/oauth';
import { shownOAuthProviders } from '@/src/auth/providers';
import {
  googleButtonConfig,
  googleButtonKind,
  googleButtonWidth,
  googleClientId,
  googleIdentityConfig,
  paintGoogleButton,
} from '@/src/auth/googleSignIn';
import type { AuthApi } from '@/src/auth/types';

function restore(name: 'EXPO_PUBLIC_GOOGLE_CLIENT_ID' | 'EXPO_PUBLIC_OAUTH_PROVIDERS', previous: string | undefined) {
  if (previous === undefined) delete process.env[name];
  else process.env[name] = previous;
}

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

describe('google button gating', () => {
  const previousClient = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;
  const previousOAuth = process.env.EXPO_PUBLIC_OAUTH_PROVIDERS;

  afterEach(() => {
    restore('EXPO_PUBLIC_GOOGLE_CLIENT_ID', previousClient);
    restore('EXPO_PUBLIC_OAUTH_PROVIDERS', previousOAuth);
  });

  it('uses GIS on web only when Google is shown and the client id is set', () => {
    expect(
      googleButtonKind({
        shown: ['google'],
        platform: 'web',
        clientId: '129452132407-example.apps.googleusercontent.com',
      }),
    ).toBe('gis');
    expect(googleButtonKind({ shown: ['apple', 'google'], platform: 'web', clientId: ' id ' })).toBe('gis');
  });

  it('falls back to the redirect when the client id is missing', () => {
    expect(googleButtonKind({ shown: ['google'], platform: 'web', clientId: null })).toBe('redirect');
    expect(googleButtonKind({ shown: ['google'], platform: 'web', clientId: '   ' })).toBe('redirect');
    expect(googleButtonKind({ shown: ['google'], platform: 'web', clientId: undefined })).toBe('redirect');
  });

  it('keeps the redirect on native even with a client id', () => {
    const clientId = 'id.apps.googleusercontent.com';
    expect(googleButtonKind({ shown: ['google'], platform: 'ios', clientId })).toBe('redirect');
    expect(googleButtonKind({ shown: ['google'], platform: 'android', clientId })).toBe('redirect');
  });

  it('hides Google when the allow-list leaves it out', () => {
    delete process.env.EXPO_PUBLIC_OAUTH_PROVIDERS;
    process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID = 'id.apps.googleusercontent.com';
    const shown = shownOAuthProviders({ google: 'on', apple: 'on' });
    expect(shown).toEqual([]);
    expect(googleButtonKind({ shown, platform: 'web', clientId: googleClientId() })).toBe('hidden');
    expect(googleButtonKind({ shown: ['apple'], platform: 'web', clientId: 'id' })).toBe('hidden');
    expect(googleButtonKind({ shown: [], platform: 'web', clientId: 'id' })).toBe('hidden');
  });

  it('reads the public client id and treats an explicit null as missing', () => {
    delete process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;
    expect(googleClientId()).toBeNull();
    expect(googleClientId('')).toBeNull();
    expect(googleClientId('  ')).toBeNull();
    process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID = '  id.apps.googleusercontent.com  ';
    expect(googleClientId()).toBe('id.apps.googleusercontent.com');
    expect(googleClientId(null)).toBeNull();
  });
});

describe('google button', () => {
  it('caps the official button at 400 pixels and follows the color scheme', () => {
    expect(googleButtonWidth(0)).toBeNull();
    expect(googleButtonWidth(320)).toBe(320);
    expect(googleButtonWidth(720.8)).toBe(400);
    expect(googleButtonConfig('dark', 720)).toEqual({
      type: 'standard',
      theme: 'outline_dark',
      size: 'large',
      text: 'continue_with',
      shape: 'rectangular',
      logo_alignment: 'left',
      width: 400,
      locale: 'en',
    });
    expect(googleButtonConfig('light', 280)?.theme).toBe('outline');
    expect(googleButtonConfig('light', 280)?.width).toBe(280);
    expect(googleButtonConfig('dark', 0)).toBeNull();
  });

  it('clears the host before rendering the official button', () => {
    const options = googleButtonConfig('light', 300);
    if (!options) throw new Error('expected button options');
    const parent = { replaceChildren: vi.fn() } as unknown as HTMLElement;
    const google = { initialize: vi.fn(), renderButton: vi.fn() };
    paintGoogleButton(google, parent, options);
    expect(parent.replaceChildren).toHaveBeenCalledOnce();
    expect(google.renderButton).toHaveBeenCalledWith(parent, options);
  });
});

describe('GIS nonce handoff', () => {
  it('gives Google the hash and Supabase the raw nonce', async () => {
    const bytes = Uint8Array.from({ length: 32 }, (_, index) => index + 1);
    const nonce = await createGoogleNonce(bytes);
    expect(nonce.hashed).toBe(createHash('sha256').update(nonce.raw).digest('hex'));
    const signInWithIdToken = vi.fn(async () => ({ data: { userId: 'user-1' }, error: null }));
    const config = googleIdentityConfig({
      clientId: 'client.apps.googleusercontent.com',
      hashedNonce: nonce.hashed,
      onCredential: (credential) => {
        void startOAuthSignIn(api({ signInWithIdToken }), webGoogleIdTokenRequest(credential, nonce.raw));
      },
    });
    expect(config.nonce).toBe(nonce.hashed);
    expect(config.ux_mode).toBe('popup');
    expect(config.auto_select).toBe(false);
    config.callback({});
    config.callback({ credential: 'id-token' });
    await vi.waitFor(() => expect(signInWithIdToken).toHaveBeenCalledOnce());
    expect(signInWithIdToken).toHaveBeenCalledWith({
      provider: 'google',
      token: 'id-token',
      nonce: nonce.raw,
    });
  });
});
