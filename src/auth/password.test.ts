import { describe, expect, it, vi } from 'vitest';

import {
  CONFIRM_EMAIL_MESSAGE,
  MAGIC_LINK_MESSAGE,
  PASSWORD_RESET_MESSAGE,
  changePassword,
  sendMagicLink,
  sendPasswordReset,
  signInWithEmailPassword,
  signUpWithPassword,
} from '@/src/auth/password';
import type { AuthApi } from '@/src/auth/types';

const REDIRECT = 'https://justdontblunder.com/auth/callback';
const RESET = 'https://justdontblunder.com/auth/update-password';

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

describe('password sign-up and sign-in', () => {
  it('sends a confirmation redirect and waits when no session comes back', async () => {
    const signUp = vi.fn(async () => ({ data: { sessionUserId: null }, error: null }));
    const result = await signUpWithPassword(api({ signUp }), {
      email: ' Ada@Example.com ',
      password: 'correct horse',
      confirm: 'correct horse',
      emailRedirectTo: REDIRECT,
    });
    expect(signUp).toHaveBeenCalledWith({
      email: 'ada@example.com',
      password: 'correct horse',
      emailRedirectTo: REDIRECT,
    });
    expect(result).toEqual({ status: 'confirm-email', message: CONFIRM_EMAIL_MESSAGE });
  });

  it('signs in immediately when email confirmation is already satisfied', async () => {
    const signUp = vi.fn(async () => ({ data: { sessionUserId: 'user-1' }, error: null }));
    const result = await signUpWithPassword(api({ signUp }), {
      email: 'ada@example.com',
      password: 'correct horse',
      confirm: 'correct horse',
      emailRedirectTo: REDIRECT,
    });
    expect(result).toEqual({ status: 'signed-in' });
  });

  it('does not call sign-up when the passwords disagree or the password is short', async () => {
    const signUp = vi.fn();
    const client = api({ signUp });
    await expect(
      signUpWithPassword(client, {
        email: 'ada@example.com',
        password: 'short',
        confirm: 'short',
        emailRedirectTo: REDIRECT,
      }),
    ).resolves.toMatchObject({ status: 'invalid' });
    await expect(
      signUpWithPassword(client, {
        email: 'ada@example.com',
        password: 'correct horse',
        confirm: 'other horse',
        emailRedirectTo: REDIRECT,
      }),
    ).resolves.toMatchObject({ status: 'invalid', message: "Those passwords don't match." });
    expect(signUp).not.toHaveBeenCalled();
  });

  it('signs in with the email and password', async () => {
    const signInWithPassword = vi.fn(async () => ({ data: { sessionUserId: 'user-1' }, error: null }));
    const result = await signInWithEmailPassword(api({ signInWithPassword }), {
      email: 'Ada@Example.com',
      password: 'correct horse',
    });
    expect(signInWithPassword).toHaveBeenCalledWith({ email: 'ada@example.com', password: 'correct horse' });
    expect(result).toEqual({ status: 'signed-in' });
  });

  it('maps a rejected password to a calm message', async () => {
    const signInWithPassword = vi.fn(async () => ({
      data: { sessionUserId: null },
      error: { message: 'Invalid login credentials' },
    }));
    const result = await signInWithEmailPassword(api({ signInWithPassword }), {
      email: 'ada@example.com',
      password: 'wrong horse',
    });
    expect(result).toEqual({ status: 'error', message: "That email and password don't match." });
  });
});

describe('magic link and password reset', () => {
  it('emails a magic link to the callback', async () => {
    const signInWithOtp = vi.fn(async () => ({ data: null, error: null }));
    const result = await sendMagicLink(api({ signInWithOtp }), {
      email: 'ada@example.com',
      emailRedirectTo: REDIRECT,
    });
    expect(signInWithOtp).toHaveBeenCalledWith({ email: 'ada@example.com', emailRedirectTo: REDIRECT });
    expect(result).toEqual({ status: 'sent', message: MAGIC_LINK_MESSAGE });
  });

  it('requests a reset link without saying whether the account exists', async () => {
    const resetPasswordForEmail = vi.fn(async () => ({ data: null, error: null }));
    const result = await sendPasswordReset(api({ resetPasswordForEmail }), {
      email: 'missing@example.com',
      redirectTo: RESET,
    });
    expect(resetPasswordForEmail).toHaveBeenCalledWith({ email: 'missing@example.com', redirectTo: RESET });
    expect(result.status).toBe('sent');
    if (result.status === 'sent') {
      expect(result.message).toBe(PASSWORD_RESET_MESSAGE);
      expect(result.message).not.toMatch(/no account|not found/i);
    }
  });

  it('saves a new password after the reset link', async () => {
    const updatePassword = vi.fn(async () => ({ data: null, error: null }));
    const result = await changePassword(api({ updatePassword }), {
      password: 'better horse',
      confirm: 'better horse',
    });
    expect(updatePassword).toHaveBeenCalledWith({ password: 'better horse' });
    expect(result).toEqual({ status: 'updated' });
  });

  it('does not update the password when the confirmation disagrees', async () => {
    const updatePassword = vi.fn();
    const result = await changePassword(api({ updatePassword }), {
      password: 'better horse',
      confirm: 'worse horse',
    });
    expect(updatePassword).not.toHaveBeenCalled();
    expect(result).toMatchObject({ status: 'invalid' });
  });

  it('surfaces a rate limit on the reset email', async () => {
    const resetPasswordForEmail = vi.fn(async () => ({
      data: null,
      error: { message: 'Email rate limit exceeded' },
    }));
    const result = await sendPasswordReset(api({ resetPasswordForEmail }), {
      email: 'ada@example.com',
      redirectTo: RESET,
    });
    expect(result).toEqual({ status: 'error', message: 'Wait a minute, then try again.' });
  });
});
