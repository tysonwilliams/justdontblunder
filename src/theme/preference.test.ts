import { describe, expect, it, vi } from 'vitest';

import {
  preferenceFromUnknown,
  readStoredThemePreference,
  resolveColorScheme,
  THEME_STORAGE_KEY,
} from '@/src/theme/preference';

describe('resolveColorScheme', () => {
  it('follows the system scheme only when the preference is system', () => {
    expect(resolveColorScheme('system', 'dark')).toBe('dark');
    expect(resolveColorScheme('system', 'light')).toBe('light');
    expect(resolveColorScheme('light', 'dark')).toBe('light');
    expect(resolveColorScheme('dark', 'light')).toBe('dark');
    expect(resolveColorScheme('light', null)).toBe('light');
    expect(resolveColorScheme('dark', undefined)).toBe('dark');
  });

  it('stays on the original dark palette when the system scheme is unknown', () => {
    expect(resolveColorScheme('system', null)).toBe('dark');
    expect(resolveColorScheme('system', undefined)).toBe('dark');
  });
});

describe('stored theme preference', () => {
  it('accepts only system, light, and dark', () => {
    expect(preferenceFromUnknown('system')).toBe('system');
    expect(preferenceFromUnknown('light')).toBe('light');
    expect(preferenceFromUnknown('dark')).toBe('dark');
    expect(preferenceFromUnknown('blue')).toBeNull();
    expect(preferenceFromUnknown(null)).toBeNull();
    expect(preferenceFromUnknown(1)).toBeNull();
  });

  it('reads the persisted Zustand value and ignores anything else', () => {
    const saved = new Map<string, string>();
    const storage = {
      getItem: (key: string) => saved.get(key) ?? null,
      setItem: (key: string, value: string) => {
        saved.set(key, value);
      },
      removeItem: (key: string) => {
        saved.delete(key);
      },
      clear: () => saved.clear(),
      key: () => null,
      length: 0,
    };
    vi.stubGlobal('localStorage', storage);

    expect(readStoredThemePreference()).toBeNull();

    saved.set(THEME_STORAGE_KEY, JSON.stringify({ state: { preference: 'light' }, version: 0 }));
    expect(readStoredThemePreference()).toBe('light');

    saved.set(THEME_STORAGE_KEY, JSON.stringify({ state: { preference: 'nope' }, version: 0 }));
    expect(readStoredThemePreference()).toBeNull();

    saved.set(THEME_STORAGE_KEY, '{');
    expect(readStoredThemePreference()).toBeNull();

    vi.unstubAllGlobals();
  });
});
