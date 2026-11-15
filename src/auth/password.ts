import { authErrorMessage } from '@/src/auth/messages';
import type { AuthApi } from '@/src/auth/types';

export const MIN_PASSWORD_LENGTH = 6;

export const CONFIRM_EMAIL_MESSAGE =
  'Check your email to confirm the account. The link opens in any browser. If you already have an account, sign in instead.';

export const MAGIC_LINK_MESSAGE = 'Check your email for a sign-in link. It opens in any browser.';

export const PASSWORD_RESET_MESSAGE =
  'If that email can receive mail, a reset link is on its way. It opens in any browser.';

export const PASSWORD_UPDATED_MESSAGE = 'Password saved.';

export type PasswordResult =
  | { status: 'signed-in' }
  | { status: 'updated' }
  | { status: 'confirm-email'; message: string }
  | { status: 'sent'; message: string }
  | { status: 'invalid'; message: string }
  | { status: 'error'; message: string };

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function emailProblem(value: string): string | null {
  const email = normalizeEmail(value);
  if (!email) return 'Enter an email address.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "That email doesn't look right.";
  return null;
}

export function passwordProblem(password: string, confirm?: string): string | null {
  if (!password) return 'Enter a password.';
  if (password.length < MIN_PASSWORD_LENGTH) return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  if (confirm !== undefined && password !== confirm) return "Those passwords don't match.";
  return null;
}

export async function signUpWithPassword(
  api: AuthApi,
  input: { email: string; password: string; confirm: string; emailRedirectTo: string },
): Promise<PasswordResult> {
  const emailError = emailProblem(input.email);
  if (emailError) return { status: 'invalid', message: emailError };
  const passwordError = passwordProblem(input.password, input.confirm);
  if (passwordError) return { status: 'invalid', message: passwordError };
  const { data, error } = await api.signUp({
    email: normalizeEmail(input.email),
    password: input.password,
    emailRedirectTo: input.emailRedirectTo,
  });
  if (error) return { status: 'error', message: authErrorMessage(error.message) };
  if (!data.sessionUserId) return { status: 'confirm-email', message: CONFIRM_EMAIL_MESSAGE };
  return { status: 'signed-in' };
}

export async function signInWithEmailPassword(
  api: AuthApi,
  input: { email: string; password: string },
): Promise<PasswordResult> {
  const emailError = emailProblem(input.email);
  if (emailError) return { status: 'invalid', message: emailError };
  if (!input.password) return { status: 'invalid', message: 'Enter a password.' };
  const { data, error } = await api.signInWithPassword({
    email: normalizeEmail(input.email),
    password: input.password,
  });
  if (error) return { status: 'error', message: authErrorMessage(error.message) };
  if (!data.sessionUserId) return { status: 'error', message: authErrorMessage('invalid login') };
  return { status: 'signed-in' };
}

export async function sendMagicLink(
  api: AuthApi,
  input: { email: string; emailRedirectTo: string },
): Promise<PasswordResult> {
  const emailError = emailProblem(input.email);
  if (emailError) return { status: 'invalid', message: emailError };
  const { error } = await api.signInWithOtp({
    email: normalizeEmail(input.email),
    emailRedirectTo: input.emailRedirectTo,
  });
  if (error) return { status: 'error', message: authErrorMessage(error.message) };
  return { status: 'sent', message: MAGIC_LINK_MESSAGE };
}

export async function sendPasswordReset(
  api: AuthApi,
  input: { email: string; redirectTo: string },
): Promise<PasswordResult> {
  const emailError = emailProblem(input.email);
  if (emailError) return { status: 'invalid', message: emailError };
  const { error } = await api.resetPasswordForEmail({
    email: normalizeEmail(input.email),
    redirectTo: input.redirectTo,
  });
  if (error) return { status: 'error', message: authErrorMessage(error.message) };
  return { status: 'sent', message: PASSWORD_RESET_MESSAGE };
}

export async function changePassword(
  api: AuthApi,
  input: { password: string; confirm: string },
): Promise<PasswordResult> {
  const passwordError = passwordProblem(input.password, input.confirm);
  if (passwordError) return { status: 'invalid', message: passwordError };
  const { error } = await api.updatePassword({ password: input.password });
  if (error) return { status: 'error', message: authErrorMessage(error.message) };
  return { status: 'updated' };
}
