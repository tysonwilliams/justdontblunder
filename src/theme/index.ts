import { theme } from './tokens';

/**
 * Active tokens. Always the dark scheme until a light palette is added.
 * StyleSheets import the same objects this returns.
 */
export function useTheme(): typeof theme {
  return theme;
}

export type { ColorScheme, Palette, Theme } from './tokens';
export {
  colors,
  expoStarter,
  fontSizes,
  fontWeight,
  fonts,
  layout,
  letterSpacing,
  lineHeights,
  palettes,
  radii,
  shadows,
  spacing,
  theme,
  typeRole,
  typography,
} from './tokens';
