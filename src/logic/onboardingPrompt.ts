import { ONBOARDING_SESSION_KEY } from '@/src/storage/sessionKeys';

export type OnboardingPrompt = 'welcome' | 'username';

type SessionStore = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

let memory: OnboardingPrompt | null = null;

export function resetOnboardingSessionForTests(): void {
  memory = null;
}

function isPrompt(value: string | null): value is OnboardingPrompt {
  return value === 'welcome' || value === 'username';
}

function browserSession(): SessionStore | null {
  if (typeof sessionStorage === 'undefined') return null;
  return sessionStorage;
}

function read(storage: SessionStore | null): OnboardingPrompt | null {
  if (memory) return memory;
  if (!storage) return null;
  try {
    const stored = storage.getItem(ONBOARDING_SESSION_KEY);
    if (!isPrompt(stored)) return null;
    memory = stored;
    return stored;
  } catch {
    return null;
  }
}

/**
 * One onboarding card per tab. The first card to claim the session keeps it.
 * A later card in the same tab waits until the tab closes.
 */
export function claimOnboarding(kind: OnboardingPrompt, storage: SessionStore | null = browserSession()): boolean {
  const current = read(storage);
  if (current === kind) return true;
  if (current) return false;
  memory = kind;
  try {
    storage?.setItem(ONBOARDING_SESSION_KEY, kind);
  } catch {
    // The in-memory claim still covers this document.
  }
  return true;
}

export function shouldOfferWelcome(input: {
  hydrated: boolean;
  experience: string | null;
  welcomeSkipped: boolean;
}): boolean {
  return input.hydrated && !input.experience && !input.welcomeSkipped;
}

export function shouldOfferUsernameSheet(input: {
  hydrated: boolean;
  skipped: boolean;
  closed: boolean;
  scanPromptDismissed: boolean;
  hasProfile: boolean;
  phase: 'ask' | 'scanning' | 'done';
  showingResult: boolean;
  drillsCompleted: number;
}): boolean {
  if (!input.hydrated || input.skipped || input.closed || input.scanPromptDismissed) return false;
  if (input.hasProfile && input.phase === 'ask' && !input.showingResult) return false;
  if (input.drillsCompleted < 1) return false;
  return true;
}
