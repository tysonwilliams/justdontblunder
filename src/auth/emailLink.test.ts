import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async () => null,
    setItem: async () => undefined,
    removeItem: async () => undefined,
  },
}));

import { authFrom } from '@/src/auth/supabaseAuth';
import {
  EMAIL_LINK_STORAGE_KEY,
  getEmailLinkClient,
  getSupabase,
  resetSupabaseForTests,
} from '@/src/data/supabase';

const SUPABASE_URL = 'https://example.supabase.co';
const PUBLISHABLE_KEY = 'sb_publishable_test';
const CALLBACK = 'https://justdontblunder.com/auth/callback';
const RESET = 'https://justdontblunder.com/auth/update-password';

type AuthInternals = {
  flowType: string;
  storageKey: string;
  persistSession: boolean;
  autoRefreshToken: boolean;
  detectSessionInUrl: boolean;
};

type SentBody = {
  code_challenge?: string | null;
  code_challenge_method?: string | null;
};

function internals(client: NonNullable<ReturnType<typeof getSupabase>>): AuthInternals {
  return client.auth as unknown as AuthInternals;
}

function configure(): NonNullable<ReturnType<typeof getSupabase>> {
  process.env.EXPO_PUBLIC_SUPABASE_URL = SUPABASE_URL;
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = PUBLISHABLE_KEY;
  resetSupabaseForTests();
  const client = getSupabase();
  if (!client) throw new Error('expected a publishable client');
  return client;
}

describe('implicit email links', () => {
  afterEach(() => {
    resetSupabaseForTests();
    delete process.env.EXPO_PUBLIC_SUPABASE_URL;
    delete process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    vi.unstubAllGlobals();
  });

  it('uses a non-persisting implicit client with its own storage key', () => {
    const main = configure();
    const email = getEmailLinkClient();
    expect(email).not.toBeNull();
    if (!email) return;
    expect(internals(main)).toMatchObject({ flowType: 'pkce', persistSession: true });
    expect(internals(email)).toMatchObject({
      flowType: 'implicit',
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storageKey: EMAIL_LINK_STORAGE_KEY,
    });
    expect(internals(email).storageKey).not.toBe(internals(main).storageKey);
    expect(getEmailLinkClient()).toBe(email);
  });

  it('omits the PKCE challenge on email sends and keeps it for OAuth', async () => {
    const client = configure();
    const bodies: { url: string; body: SentBody | null }[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const body = init?.body ? (JSON.parse(String(init.body)) as SentBody) : null;
        bodies.push({ url, body });
        return { ok: true, status: 200, json: async () => ({}) };
      }),
    );

    const api = authFrom(client);
    await api.signInWithOtp({ email: 'ada@example.com', emailRedirectTo: CALLBACK });
    await api.signUp({ email: 'ada@example.com', password: 'secret', emailRedirectTo: CALLBACK });
    await api.resetPasswordForEmail({ email: 'ada@example.com', redirectTo: RESET });
    await api.resend({ email: 'ada@example.com', type: 'signup', emailRedirectTo: CALLBACK });
    const oauth = await api.signInWithOAuth({ provider: 'google', redirectTo: CALLBACK });

    const sent = (path: string) => {
      const match = bodies.find((call) => call.url.includes(path));
      expect(match, path).toBeTruthy();
      return match!;
    };
    for (const path of ['/otp', '/signup', '/recover', '/resend']) {
      const call = sent(path);
      expect(call.body?.code_challenge ?? null).toBeNull();
      expect(call.body?.code_challenge_method ?? null).toBeNull();
    }
    expect(new URL(sent('/otp').url).searchParams.get('redirect_to')).toBe(CALLBACK);
    expect(new URL(sent('/signup').url).searchParams.get('redirect_to')).toBe(CALLBACK);
    expect(new URL(sent('/recover').url).searchParams.get('redirect_to')).toBe(RESET);
    expect(new URL(sent('/resend').url).searchParams.get('redirect_to')).toBe(CALLBACK);
    expect(oauth.data.url).toContain('/authorize');
    expect(oauth.data.url).toContain('code_challenge=');
    expect(oauth.data.url).toContain('code_challenge_method=');
    expect(oauth.data.url).toContain(encodeURIComponent(CALLBACK));
  });
});
