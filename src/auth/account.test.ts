import { describe, expect, it } from 'vitest';

import { reachedAccountMilestone } from '@/src/auth/milestone';
import { ACCOUNT_PROMPT_KEY, accountPromptDismissed, dismissAccountPrompt } from '@/src/auth/promptDismissal';
import { identityFromUser } from '@/src/auth/session';
import { signOutBeforeDeviceErase } from '@/src/auth/deviceSession';

describe('account milestone', () => {
  it('waits for a 3-day streak or a saved drill', () => {
    expect(reachedAccountMilestone({ dailyStreak: 2, recordStreak: 1, savedDrills: 0 })).toBe(false);
    expect(reachedAccountMilestone({ dailyStreak: 3, recordStreak: 0, savedDrills: 0 })).toBe(true);
    expect(reachedAccountMilestone({ dailyStreak: 0, recordStreak: 3, savedDrills: 0 })).toBe(true);
    expect(reachedAccountMilestone({ dailyStreak: 0, recordStreak: 0, savedDrills: 1 })).toBe(true);
  });
});

describe('account prompt dismissal', () => {
  it('stores the dismissal outside the progress document', async () => {
    const memory = new Map<string, string>();
    const storage = {
      getItem: async (key: string) => memory.get(key) ?? null,
      setItem: async (key: string, value: string) => {
        memory.set(key, value);
      },
    };
    expect(await accountPromptDismissed(storage)).toBe(false);
    await dismissAccountPrompt(storage);
    expect(memory.get(ACCOUNT_PROMPT_KEY)).toBe('dismissed');
    expect(ACCOUNT_PROMPT_KEY).not.toBe('jdb-progress-v1');
    expect(await accountPromptDismissed(storage)).toBe(true);
  });
});

describe('account label', () => {
  it('prefers the email and falls back to a display name', () => {
    expect(identityFromUser({ id: '1', email: 'ada@example.com', user_metadata: { full_name: 'Ada' } }).label).toBe(
      'ada@example.com',
    );
    expect(identityFromUser({ id: '1', email: null, user_metadata: { full_name: 'Ada Lovelace' } }).label).toBe(
      'Ada Lovelace',
    );
    expect(identityFromUser({ id: '1' }).label).toBe('your account');
  });
});

describe('signOutBeforeDeviceErase', () => {
  it('signs out a session before the device erase and leaves a guest alone', async () => {
    const calls: string[] = [];
    await expect(
      signOutBeforeDeviceErase({
        getSession: async () => ({ userId: 'user-1' }),
        signOut: async () => {
          calls.push('sign-out');
          return { error: null };
        },
      }),
    ).resolves.toBe('signed-out');
    expect(calls).toEqual(['sign-out']);

    await expect(
      signOutBeforeDeviceErase({
        getSession: async () => ({ userId: null }),
        signOut: async () => {
          calls.push('sign-out');
          return { error: null };
        },
      }),
    ).resolves.toBe('guest');
    expect(calls).toEqual(['sign-out']);
    await expect(signOutBeforeDeviceErase(null)).resolves.toBe('guest');
  });

  it('does not pretend sign-out worked', async () => {
    await expect(
      signOutBeforeDeviceErase({
        getSession: async () => ({ userId: 'user-1' }),
        signOut: async () => ({ error: { message: 'offline' } }),
      }),
    ).resolves.toBe('failed');
  });
});
