import { useSyncExternalStore } from 'react';
import { Appearance, useColorScheme as useNativeColorScheme } from 'react-native';

import { setActivePalette } from '@/src/theme/active';
import {
  readSystemScheme,
  resolveColorScheme,
  type ResolvedScheme,
} from '@/src/theme/preference';
import { themeFor, type Theme } from '@/src/theme/tokens';
import { useThemePreference } from '@/src/store/themePreference';

function knownScheme(value: string | null | undefined): ResolvedScheme | null {
  return value === 'light' || value === 'dark' ? value : null;
}

const schemeListeners = new Set<() => void>();
let cachedScheme: ResolvedScheme | null = null;
let schemeTeardown: (() => void) | null = null;

function notifyScheme(next: ResolvedScheme | null) {
  if (next === cachedScheme) return;
  cachedScheme = next;
  for (const listener of schemeListeners) listener();
}

function bindScheme() {
  if (schemeTeardown) return;
  cachedScheme = readSystemScheme() ?? knownScheme(Appearance.getColorScheme());
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => notifyScheme(media.matches ? 'dark' : 'light');
    media.addEventListener('change', onChange);
    schemeTeardown = () => media.removeEventListener('change', onChange);
    return;
  }
  const subscription = Appearance.addChangeListener(({ colorScheme }) => {
    const next = knownScheme(colorScheme);
    if (next) notifyScheme(next);
  });
  schemeTeardown = () => subscription.remove();
}

function subscribeScheme(listener: () => void): () => void {
  schemeListeners.add(listener);
  bindScheme();
  return () => {
    schemeListeners.delete(listener);
    if (schemeListeners.size === 0) {
      schemeTeardown?.();
      schemeTeardown = null;
    }
  };
}

function getSchemeSnapshot(): ResolvedScheme | null {
  if (!schemeTeardown) {
    cachedScheme = readSystemScheme() ?? knownScheme(Appearance.getColorScheme());
  }
  return cachedScheme;
}

function getServerSchemeSnapshot(): ResolvedScheme | null {
  return null;
}

/** System light or dark. Web reads `prefers-color-scheme` before the first paint. */
export function useSystemScheme(): ResolvedScheme | null {
  const native = useNativeColorScheme();
  const shared = useSyncExternalStore(subscribeScheme, getSchemeSnapshot, getServerSchemeSnapshot);
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    return shared;
  }
  return knownScheme(native) ?? shared;
}

export function useTheme(): Theme {
  const preference = useThemePreference((state) => state.preference);
  const boardTheme = useThemePreference((state) => state.boardTheme);
  const system = useSystemScheme();
  const theme = themeFor(resolveColorScheme(preference, system), boardTheme);
  setActivePalette(theme.colors);
  return theme;
}
