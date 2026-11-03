import { StyleSheet, type ImageStyle, type TextStyle, type ViewStyle } from 'react-native';

import { getActivePalette } from '@/src/theme/active';
import type { Palette } from '@/src/theme/tokens';

type NamedStyles<T> = { [P in keyof T]: ViewStyle | TextStyle | ImageStyle };

/**
 * Style objects keyed by the active palette. Call sites keep `styles.foo`.
 * The sheet is built once per palette and chosen when the style is read,
 * after `useTheme()` has published the palette for this render.
 */
export function themedStyleSheet<T extends NamedStyles<T>>(factory: (colors: Palette) => T): T {
  const cache = new Map<Palette, T>();
  return new Proxy({} as T, {
    get(_target, prop) {
      if (typeof prop !== 'string') return undefined;
      const colors = getActivePalette();
      let sheet = cache.get(colors);
      if (!sheet) {
        sheet = StyleSheet.create(factory(colors));
        cache.set(colors, sheet);
      }
      return sheet[prop as keyof T];
    },
  });
}
