/** Email OTP types Supabase accepts on verifyOtp. */
export const OTP_TYPES = ['signup', 'invite', 'magiclink', 'recovery', 'email_change', 'email'] as const;

export type OtpType = (typeof OTP_TYPES)[number];

export type OAuthProviderId = 'google' | 'apple';

export type AuthFailure = { message: string };

export type AuthCall<T> = { data: T; error: AuthFailure | null };

/**
 * The slice of Supabase Auth this app uses.
 * Screens depend on this, so tests can pass a fake and never open a socket.
 */
export type AuthApi = {
  signUp(input: {
    email: string;
    password: string;
    emailRedirectTo: string;
  }): Promise<AuthCall<{ sessionUserId: string | null }>>;
  signInWithPassword(input: { email: string; password: string }): Promise<AuthCall<{ sessionUserId: string | null }>>;
  signInWithOtp(input: { email: string; emailRedirectTo: string }): Promise<AuthCall<null>>;
  resetPasswordForEmail(input: { email: string; redirectTo: string }): Promise<AuthCall<null>>;
  updatePassword(input: { password: string }): Promise<AuthCall<null>>;
  updateUserData(input: { data: Record<string, string> }): Promise<AuthCall<null>>;
  signInWithOAuth(input: {
    provider: OAuthProviderId;
    redirectTo: string;
  }): Promise<AuthCall<{ url: string | null }>>;
  signInWithIdToken(input: { token: string; nonce?: string }): Promise<AuthCall<{ userId: string | null }>>;
  exchangeCodeForSession(code: string, flowId: string | null): Promise<AuthCall<null>>;
  verifyOtp(input: { tokenHash: string; type: OtpType }): Promise<AuthCall<null>>;
  getSession(): Promise<{ userId: string | null }>;
  signOut(): Promise<{ error: AuthFailure | null }>;
};

export function isOtpType(value: string | null | undefined): value is OtpType {
  return typeof value === 'string' && (OTP_TYPES as readonly string[]).includes(value);
}
