import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async () => null,
    setItem: async () => undefined,
    removeItem: async () => undefined,
  },
}));

import {
  getEmailLinkClient,
  getSupabase,
  getSupabasePublicConfig,
  isSyncEnabled,
  resetSupabaseForTests,
} from '@/src/data/supabase';

function token(payload: Record<string, unknown>): string {
  const part = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${part({ alg: 'none', typ: 'JWT' })}.${part(payload)}.sig`;
}

describe('getSupabase', () => {
  beforeEach(() => {
    resetSupabaseForTests();
    delete process.env.EXPO_PUBLIC_SUPABASE_URL;
    delete process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    delete process.env.EXPO_PUBLIC_SYNC_ENABLED;
  });

  afterEach(() => {
    resetSupabaseForTests();
    delete process.env.EXPO_PUBLIC_SUPABASE_URL;
    delete process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    delete process.env.EXPO_PUBLIC_SYNC_ENABLED;
  });

  it('stays null until both publishable settings are present', () => {
    expect(getSupabase()).toBeNull();
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    resetSupabaseForTests();
    expect(getSupabase()).toBeNull();
  });

  it('rejects a service-role JWT and accepts a publishable key', () => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = token({ role: 'service_role' });
    expect(getSupabase()).toBeNull();
    expect(getEmailLinkClient()).toBeNull();

    resetSupabaseForTests();
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'sb_publishable_test';
    expect(getSupabase()).not.toBeNull();

    resetSupabaseForTests();
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = token({ role: 'anon' });
    expect(getSupabase()).not.toBeNull();
  });

  it('allows sync unless the flag is exactly false', () => {
    expect(isSyncEnabled()).toBe(true);
    process.env.EXPO_PUBLIC_SYNC_ENABLED = 'true';
    expect(isSyncEnabled()).toBe(true);
    process.env.EXPO_PUBLIC_SYNC_ENABLED = 'TRUE';
    expect(isSyncEnabled()).toBe(true);
    process.env.EXPO_PUBLIC_SYNC_ENABLED = 'false';
    expect(isSyncEnabled()).toBe(false);
  });

  it('returns the publishable config and refuses a service-role key', () => {
    expect(getSupabasePublicConfig()).toBeNull();
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = token({ role: 'service_role' });
    expect(getSupabasePublicConfig()).toBeNull();
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = token({ role: 'anon' });
    expect(getSupabasePublicConfig()).toEqual({
      url: 'https://example.supabase.co',
      anonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    });
  });
});
