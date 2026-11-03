export const THEME_STORAGE_KEY = 'jdb-theme-v1';

export type ThemePreference = 'system' | 'light' | 'dark';

export type ResolvedScheme = 'light' | 'dark';

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'system' || value === 'light' || value === 'dark';
}

/** Stored values other than the three settings are ignored. */
export function preferenceFromUnknown(value: unknown): ThemePreference | null {
  return isThemePreference(value) ? value : null;
}

/**
 * `system` follows the platform. An unknown system scheme stays on dark,
 * which is the palette the app shipped with before a choice existed.
 */
export function resolveColorScheme(
  preference: ThemePreference,
  systemScheme: ResolvedScheme | null | undefined,
): ResolvedScheme {
  switch (preference) {
    case 'light':
    case 'dark':
      return preference;
    case 'system':
      return systemScheme === 'light' ? 'light' : 'dark';
    default: {
      const _exhaustive: never = preference;
      return _exhaustive;
    }
  }
}

/** Synchronous read for the first web paint. Native storage is async. */
export function readStoredThemePreference(): ThemePreference | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { state?: { preference?: unknown } };
    return preferenceFromUnknown(parsed?.state?.preference);
  } catch {
    return null;
  }
}

export function readSystemScheme(): ResolvedScheme | null {
  try {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return null;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } catch {
    return null;
  }
}
