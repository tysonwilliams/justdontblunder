import { useEffect, useState } from 'react';
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

/** System light or dark. Web reads `prefers-color-scheme` before the first paint. */
export function useSystemScheme(): ResolvedScheme | null {
  const native = useNativeColorScheme();
  const [scheme, setScheme] = useState<ResolvedScheme | null>(() => readSystemScheme() ?? knownScheme(native));

  useEffect(() => {
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') return;
    const next = knownScheme(native);
    if (next) setScheme(next);
  }, [native]);

  useEffect(() => {
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      const media = window.matchMedia('(prefers-color-scheme: dark)');
      const onChange = () => setScheme(media.matches ? 'dark' : 'light');
      media.addEventListener('change', onChange);
      return () => media.removeEventListener('change', onChange);
    }
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      const next = knownScheme(colorScheme);
      if (next) setScheme(next);
    });
    return () => subscription.remove();
  }, []);

  return scheme;
}

export function useTheme(): Theme {
  const preference = useThemePreference((state) => state.preference);
  const system = useSystemScheme();
  const theme = themeFor(resolveColorScheme(preference, system));
  setActivePalette(theme.colors);
  return theme;
}
