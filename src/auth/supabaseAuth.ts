import type { EmailOtpType, SupabaseClient } from '@supabase/supabase-js';

import type { AuthApi, AuthCall } from '@/src/auth/types';
import { getEmailLinkClient } from '@/src/data/supabase';

/**
 * Maps the publishable client onto AuthApi.
 * Google and Apple stay on the PKCE client. Email links use the implicit client
 * when one exists, so the redirect carries the session in the hash.
 * Pass `emailClient` from tests. `null` keeps those calls on `client`.
 */
export function authFrom(client: SupabaseClient, emailClient?: SupabaseClient | null): AuthApi {
  const emailSender = (): SupabaseClient => {
    if (emailClient) return emailClient;
    if (emailClient === null) return client;
    return getEmailLinkClient() ?? client;
  };

  return {
    async signUp({ email: address, password, emailRedirectTo }) {
      const sender = emailSender();
      const { data, error } = await sender.auth.signUp({
        email: address,
        password,
        options: { emailRedirectTo },
      });
      const session = data.session;
      if (!error && session?.access_token && session.refresh_token && sender !== client) {
        const copied = await client.auth.setSession({
          access_token: session.access_token,
          refresh_token: session.refresh_token,
        });
        if (copied.error) return call({ sessionUserId: null }, copied.error);
      }
      return call({ sessionUserId: session?.user.id ?? null }, error);
    },
    async signInWithPassword({ email: address, password }) {
      const { data, error } = await client.auth.signInWithPassword({ email: address, password });
      return call({ sessionUserId: data.session?.user.id ?? null }, error);
    },
    async signInWithOtp({ email: address, emailRedirectTo }) {
      const { error } = await emailSender().auth.signInWithOtp({
        email: address,
        options: { emailRedirectTo, shouldCreateUser: true },
      });
      return call(null, error);
    },
    async resetPasswordForEmail({ email: address, redirectTo }) {
      const { error } = await emailSender().auth.resetPasswordForEmail(address, { redirectTo });
      return call(null, error);
    },
    async resend({ email: address, type, emailRedirectTo }) {
      const { error } = await emailSender().auth.resend({
        type,
        email: address,
        options: { emailRedirectTo },
      });
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
    async setSession({ accessToken, refreshToken }) {
      const { error } = await client.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
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
