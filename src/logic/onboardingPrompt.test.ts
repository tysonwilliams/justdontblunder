import { beforeEach, describe, expect, it } from 'vitest';

import {
  claimOnboarding,
  clearOnboardingClaim,
  resetOnboardingSessionForTests,
  shouldOfferUsernameSheet,
  shouldOfferWelcome,
} from '@/src/logic/onboardingPrompt';
import { ONBOARDING_SESSION_KEY } from '@/src/storage/sessionKeys';

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    values,
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
    removeItem(key: string) {
      values.delete(key);
    },
  };
}

const usernameBase = {
  hydrated: true,
  skipped: false,
  closed: false,
  scanPromptDismissed: false,
  hasProfile: false,
  phase: 'ask' as const,
  showingResult: false,
  drillsCompleted: 0,
};

describe('onboarding prompts', () => {
  beforeEach(() => {
    resetOnboardingSessionForTests();
  });

  it('offers welcome until a choice or a skip is saved', () => {
    expect(shouldOfferWelcome({ hydrated: false, experience: null, welcomeSkipped: false })).toBe(false);
    expect(shouldOfferWelcome({ hydrated: true, experience: null, welcomeSkipped: false })).toBe(true);
    expect(shouldOfferWelcome({ hydrated: true, experience: 'basics', welcomeSkipped: false })).toBe(false);
    expect(shouldOfferWelcome({ hydrated: true, experience: null, welcomeSkipped: true })).toBe(false);
  });

  it('holds the username sheet until a drill is finished', () => {
    expect(shouldOfferUsernameSheet(usernameBase)).toBe(false);
    expect(shouldOfferUsernameSheet({ ...usernameBase, drillsCompleted: 1 })).toBe(true);
    expect(shouldOfferUsernameSheet({ ...usernameBase, drillsCompleted: 1, skipped: true })).toBe(false);
    expect(shouldOfferUsernameSheet({ ...usernameBase, drillsCompleted: 4, hasProfile: true })).toBe(false);
  });

  it('shows at most one card in a tab', () => {
    const storage = memoryStorage();
    expect(claimOnboarding('welcome', storage)).toBe(true);
    expect(storage.values.get(ONBOARDING_SESSION_KEY)).toBe('welcome');
    expect(claimOnboarding('username', storage)).toBe(false);
    expect(shouldOfferUsernameSheet({ ...usernameBase, drillsCompleted: 1 })).toBe(true);
  });

  it('lets the username card claim the next tab after a drill', () => {
    const first = memoryStorage();
    claimOnboarding('welcome', first);
    resetOnboardingSessionForTests();
    const next = memoryStorage();
    expect(shouldOfferUsernameSheet({ ...usernameBase, drillsCompleted: 1 })).toBe(true);
    expect(claimOnboarding('username', next)).toBe(true);
    expect(claimOnboarding('welcome', next)).toBe(false);
  });

  it('releases the tab claim when clearOnboardingClaim is called', () => {
    const storage = memoryStorage();
    expect(claimOnboarding('username', storage)).toBe(true);
    expect(claimOnboarding('welcome', storage)).toBe(false);
    clearOnboardingClaim(storage);
    expect(storage.values.has(ONBOARDING_SESSION_KEY)).toBe(false);
    expect(claimOnboarding('welcome', storage)).toBe(true);
  });
});
