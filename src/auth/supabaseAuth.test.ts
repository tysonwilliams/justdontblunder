import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

import { authFrom } from '@/src/auth/supabaseAuth';

type Call = { method: string; args: unknown[] };

function fakeClient() {
  const calls: Call[] = [];
  const ok = (method: string) => async (...args: unknown[]) => {
    calls.push({ method, args });
    return { data: { session: null, user: null, url: null }, error: null };
  };
  const client = {
    auth: {
      signUp: ok('signUp'),
      signInWithPassword: ok('signInWithPassword'),
      signInWithOtp: ok('signInWithOtp'),
      resetPasswordForEmail: ok('resetPasswordForEmail'),
      updateUser: vi.fn(async (args: unknown) => {
        calls.push({ method: 'updateUser', args: [args] });
        return { data: { user: null }, error: null };
      }),
      signInWithOAuth: ok('signInWithOAuth'),
      signInWithIdToken: ok('signInWithIdToken'),
      exchangeCodeForSession: ok('exchangeCodeForSession'),
      verifyOtp: ok('verifyOtp'),
      getSession: async () => ({ data: { session: null }, error: null }),
      signOut: async () => ({ error: null }),
    },
  };
  return { client: client as unknown as SupabaseClient, calls };
}

describe('authFrom', () => {
  it('calls the publishable auth methods with the redirect and provider arguments', async () => {
    const { client, calls } = fakeClient();
    const api = authFrom(client, client);
    await api.signInWithOtp({ email: 'ada@example.com', emailRedirectTo: 'https://justdontblunder.com/auth/callback' });
    await api.signUp({
      email: 'ada@example.com',
      password: 'secret',
      emailRedirectTo: 'https://justdontblunder.com/auth/callback',
    });
    await api.signInWithPassword({ email: 'ada@example.com', password: 'secret' });
    await api.resetPasswordForEmail({
      email: 'ada@example.com',
      redirectTo: 'https://justdontblunder.com/auth/update-password',
    });
    await api.updatePassword({ password: 'newer' });
    await api.signInWithOAuth({ provider: 'google', redirectTo: 'https://justdontblunder.com/auth/callback' });
    await api.signInWithOAuth({ provider: 'apple', redirectTo: 'https://justdontblunder.com/auth/callback' });
    await api.signInWithIdToken({ token: 'apple-token', nonce: 'n' });
    await api.exchangeCodeForSession('code-1', 'flow-1');
    await api.verifyOtp({ tokenHash: 'hash-1', type: 'recovery' });

    expect(calls.map((call) => call.method)).toEqual([
      'signInWithOtp',
      'signUp',
      'signInWithPassword',
      'resetPasswordForEmail',
      'updateUser',
      'signInWithOAuth',
      'signInWithOAuth',
      'signInWithIdToken',
      'exchangeCodeForSession',
      'verifyOtp',
    ]);
    expect(calls[0]?.args[0]).toEqual({
      email: 'ada@example.com',
      options: { emailRedirectTo: 'https://justdontblunder.com/auth/callback', shouldCreateUser: true },
    });
    expect(calls[1]?.args[0]).toMatchObject({
      options: { emailRedirectTo: 'https://justdontblunder.com/auth/callback' },
    });
    expect(calls[3]?.args).toEqual(['ada@example.com', { redirectTo: 'https://justdontblunder.com/auth/update-password' }]);
    expect(calls[4]?.args[0]).toEqual({ password: 'newer' });
    expect(calls[5]?.args[0]).toMatchObject({ provider: 'google', options: { skipBrowserRedirect: false } });
    expect(calls[6]?.args[0]).toMatchObject({ provider: 'apple' });
    expect(calls[7]?.args[0]).toEqual({ provider: 'apple', token: 'apple-token', nonce: 'n' });
    expect(calls[8]?.args).toEqual(['code-1', { flowId: 'flow-1' }]);
    expect(calls[9]?.args[0]).toEqual({ token_hash: 'hash-1', type: 'recovery' });
  });

  it('sends email through the implicit client and copies an immediate session onto the main client', async () => {
    const mainCalls: Call[] = [];
    const emailCalls: Call[] = [];
    const track = (calls: Call[], method: string) => async (...args: unknown[]) => {
      calls.push({ method, args });
      return { data: { session: null, user: null, url: null }, error: null };
    };
    const main = {
      auth: {
        setSession: vi.fn(async (args: unknown) => {
          mainCalls.push({ method: 'setSession', args: [args] });
          return { data: { session: { user: { id: 'user-1' } } }, error: null };
        }),
        signInWithOAuth: track(mainCalls, 'signInWithOAuth'),
      },
    } as unknown as SupabaseClient;
    const email = {
      auth: {
        signInWithOtp: track(emailCalls, 'signInWithOtp'),
        signUp: vi.fn(async (args: unknown) => {
          emailCalls.push({ method: 'signUp', args: [args] });
          return {
            data: {
              user: { id: 'user-1' },
              session: { user: { id: 'user-1' }, access_token: 'access-1', refresh_token: 'refresh-1' },
            },
            error: null,
          };
        }),
        resetPasswordForEmail: track(emailCalls, 'resetPasswordForEmail'),
        resend: track(emailCalls, 'resend'),
      },
    } as unknown as SupabaseClient;

    const api = authFrom(main, email);
    await api.signInWithOtp({ email: 'ada@example.com', emailRedirectTo: 'https://justdontblunder.com/auth/callback' });
    const signedUp = await api.signUp({
      email: 'ada@example.com',
      password: 'secret',
      emailRedirectTo: 'https://justdontblunder.com/auth/callback',
    });
    await api.resetPasswordForEmail({
      email: 'ada@example.com',
      redirectTo: 'https://justdontblunder.com/auth/update-password',
    });
    await api.resend({
      email: 'ada@example.com',
      type: 'signup',
      emailRedirectTo: 'https://justdontblunder.com/auth/callback',
    });
    await api.signInWithOAuth({ provider: 'google', redirectTo: 'https://justdontblunder.com/auth/callback' });

    expect(signedUp).toEqual({ data: { sessionUserId: 'user-1' }, error: null });
    expect(emailCalls.map((call) => call.method)).toEqual([
      'signInWithOtp',
      'signUp',
      'resetPasswordForEmail',
      'resend',
    ]);
    expect(mainCalls.map((call) => call.method)).toEqual(['setSession', 'signInWithOAuth']);
    expect(mainCalls[0]?.args[0]).toEqual({ access_token: 'access-1', refresh_token: 'refresh-1' });
    expect(emailCalls[3]?.args[0]).toEqual({
      type: 'signup',
      email: 'ada@example.com',
      options: { emailRedirectTo: 'https://justdontblunder.com/auth/callback' },
    });
    expect(mainCalls[1]?.args[0]).toMatchObject({ provider: 'google' });
  });
});
