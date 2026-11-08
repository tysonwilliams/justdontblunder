export const FEEDBACK_STORAGE_KEY = 'jdb-feedback-v1';

export type FeedbackPrefs = {
  sound: boolean;
  haptics: boolean;
};

/** Sound and haptics both start on. Stored apart from progress and the theme. */
export const DEFAULT_FEEDBACK: FeedbackPrefs = {
  sound: true,
  haptics: true,
};

/** Anything other than two booleans is ignored. */
export function feedbackFromUnknown(value: unknown): FeedbackPrefs | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as { sound?: unknown; haptics?: unknown };
  if (typeof record.sound !== 'boolean' || typeof record.haptics !== 'boolean') return null;
  return { sound: record.sound, haptics: record.haptics };
}

/** Synchronous read for the first web paint. Native storage is async. */
export function readStoredFeedback(): FeedbackPrefs | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(FEEDBACK_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { state?: unknown };
    return feedbackFromUnknown(parsed?.state);
  } catch {
    return null;
  }
}
