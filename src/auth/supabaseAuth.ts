import type { EmailOtpType, SupabaseClient } from '@supabase/supabase-js';

import type { AuthApi, AuthCall } from '@/src/auth/types';

/**
 * Maps the publishable client onto AuthApi.
 * OAuth on the web redirects the browser. The code verifier stays in AsyncStorage (PKCE).
 */
export function authFrom(client: SupabaseClient): AuthApi {
  return {
    async signUp({ email, password, emailRedirectTo }) {
      const { data, error } = await client.auth.signUp({
        email,
        password,
        options: { emailRedirectTo },
      });
      return call({ sessionUserId: data.session?.user.id ?? null }, error);
    },
    async signInWithPassword({ email, password }) {
      const { data, error } = await client.auth.signInWithPassword({ email, password });
      return call({ sessionUserId: data.session?.user.id ?? null }, error);
    },
    async signInWithOtp({ email, emailRedirectTo }) {
      const { error } = await client.auth.signInWithOtp({
        email,
        options: { emailRedirectTo, shouldCreateUser: true },
      });
      return call(null, error);
    },
    async resetPasswordForEmail({ email, redirectTo }) {
      const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo });
      return call(null, error);
    },
    async updatePassword({ password }) {
      const { error } = await client.auth.updateUser({ password });
      return call(null, error);
    },
    async updateUserData({ data }) {
      const { error } = await client.auth.updateUser({ data });
      return call(null, error);
    },
    async signInWithOAuth({ provider, redirectTo }) {
      const { data, error } = await client.auth.signInWithOAuth({
        provider,
        options: { redirectTo, skipBrowserRedirect: false },
      });
      return call({ url: data.url }, error);
    },
    async signInWithIdToken({ token, nonce }) {
      const { data, error } = await client.auth.signInWithIdToken({
        provider: 'apple',
        token,
        ...(nonce ? { nonce } : {}),
      });
      return call({ userId: data.user?.id ?? null }, error);
    },
    async exchangeCodeForSession(code, flowId) {
      const { error } = await client.auth.exchangeCodeForSession(code, flowId ? { flowId } : undefined);
      return call(null, error);
    },
    async verifyOtp({ tokenHash, type }) {
      const { error } = await client.auth.verifyOtp({ token_hash: tokenHash, type: type as EmailOtpType });
      return call(null, error);
    },
    async getSession() {
      const { data } = await client.auth.getSession();
      return { userId: data.session?.user.id ?? null };
    },
    async signOut() {
      const { error } = await client.auth.signOut();
      return { error: error ? { message: error.message } : null };
    },
  };
}

function call<T>(data: T, error: { message: string } | null): AuthCall<T> {
  return { data, error: error ? { message: error.message } : null };
}
