/**
 * Shared design tokens.
 *
 * Colors live on a palette keyed by scheme. `dark` is the original UI.
 * `light` uses the same keys. `useTheme()` picks one from the saved preference
 * and the system scheme.
 *
 * Numeric values match the UI this module was extracted from, so swapping a
 * literal for a token does not move pixels.
 */

export type ColorScheme = 'dark' | 'light';

export type Palette = {
  background: string;
  surface: string;
  surfaceRaised: string;
  border: string;
  borderStrong: string;
  text: string;
  textMuted: string;
  textDim: string;
  /**
   * The one filled action color. Primary buttons use this and nothing else
   * should paint a solid accent fill.
   */
  accent: string;
  accentPressed: string;
  accentText: string;
  accentSoft: string;
  /** Amber warning. */
  warning: string;
  warningSoft: string;
  /** Red for blunders. */
  danger: string;
  dangerPressed: string;
  dangerSoft: string;
  success: string;
  successSoft: string;
  /** Blue arrows and the safe-move key. */
  info: string;
  onInfo: string;
  onDanger: string;
  overlay: string;
  hover: string;
  transparent: string;
  shadow: string;
  boardLight: string;
  boardDark: string;
  /** Square highlights. */
  boardSelected: string;
  boardLegalOnDark: string;
  boardLegalOnLight: string;
  boardCaptureOnDark: string;
  boardCaptureOnLight: string;
  boardLastMove: string;
  boardAttention: string;
  boardBlunder: string;
  boardSave: string;
  boardFrame: string;
  boardFrameBg: string;
  boardMeta: string;
  /** Coordinate ink on a light square. */
  boardCoordOnLight: string;
  /** Coordinate ink on a dark square. */
  boardCoordOnDark: string;
  /** Bones while a screen is loading. Distinct from the page background. */
  skeleton: string;
  whitePiece: string;
  whitePieceStroke: string;
  blackPiece: string;
};

const darkPalette = {
  background: '#1C1B19',
  surface: '#2A2826',
  surfaceRaised: '#343230',
  border: 'rgba(255,255,255,0.08)',
  borderStrong: 'rgba(255,255,255,0.14)',
  text: '#F6F3EE',
  textMuted: '#D5D0C8',
  textDim: '#C8C2B8',
  accent: '#8EBF55',
  accentPressed: '#7AAB45',
  accentText: '#14210C',
  accentSoft: 'rgba(142, 191, 85, 0.16)',
  warning: '#E8B84A',
  warningSoft: 'rgba(232, 184, 74, 0.16)',
  danger: '#E25B5B',
  dangerPressed: '#C94B4B',
  dangerSoft: 'rgba(226, 91, 91, 0.16)',
  success: '#8EBF55',
  successSoft: 'rgba(142, 191, 85, 0.16)',
  info: '#8EB4E8',
  onInfo: '#142033',
  onDanger: '#FFFFFF',
  overlay: 'rgba(10, 9, 8, 0.72)',
  hover: 'rgba(255,255,255,0.04)',
  transparent: 'transparent',
  shadow: '#000',
  skeleton: '#3A3834',
  boardLight: '#F6EFE0',
  boardDark: '#58763E',
  boardSelected: 'rgba(214, 168, 48, 0.55)',
  boardLegalOnDark: 'rgba(247, 246, 239, 0.94)',
  boardLegalOnLight: 'rgba(30, 44, 22, 0.66)',
  boardCaptureOnDark: 'rgba(255, 228, 210, 0.5)',
  boardCaptureOnLight: 'rgba(70, 36, 24, 0.45)',
  boardLastMove: 'rgba(230, 186, 48, 0.55)',
  boardAttention: 'rgba(210, 140, 40, 0.40)',
  boardBlunder: 'rgba(226, 70, 70, 0.16)',
  boardSave: 'rgba(56, 150, 72, 0.42)',
  boardFrame: '#24301C',
  boardFrameBg: '#1A2218',
  boardMeta: '#C8D0C0',
  boardCoordOnLight: '#1E2C16',
  boardCoordOnDark: '#F7F6EF',
  whitePiece: '#FFF6E8',
  whitePieceStroke: '#1A2230',
  blackPiece: '#0B1018',
} satisfies Palette;

/**
 * Warm paper and a cream/sage board. Text tokens clear WCAG AA on the page.
 * Coordinates use their own inks so they stay readable on both squares.
 * Arrow inks stay saturated; the coordinate inks carry the text contrast.
 */
const lightPalette = {
  background: '#F3EFE6',
  surface: '#FFFCF7',
  surfaceRaised: '#E6DFD2',
  border: 'rgba(28, 25, 21, 0.10)',
  borderStrong: 'rgba(28, 25, 21, 0.18)',
  text: '#1C1915',
  textMuted: '#534E45',
  textDim: '#5F584E',
  accent: '#2B6432',
  accentPressed: '#214E27',
  accentText: '#F4FBF4',
  accentSoft: 'rgba(43, 100, 50, 0.14)',
  warning: '#7C5200',
  warningSoft: 'rgba(124, 82, 0, 0.16)',
  danger: '#B4232A',
  dangerPressed: '#8E1B21',
  dangerSoft: 'rgba(180, 35, 42, 0.12)',
  success: '#2B6432',
  successSoft: 'rgba(43, 100, 50, 0.14)',
  info: '#1E4E9E',
  onInfo: '#F5F8FD',
  onDanger: '#FFFFFF',
  overlay: 'rgba(28, 25, 21, 0.48)',
  hover: 'rgba(28, 25, 21, 0.06)',
  transparent: 'transparent',
  shadow: '#1C1915',
  skeleton: '#D9CDB8',
  boardLight: '#F6EFE0',
  boardDark: '#58763E',
  boardSelected: 'rgba(214, 168, 48, 0.55)',
  boardLegalOnDark: 'rgba(247, 246, 239, 0.94)',
  boardLegalOnLight: 'rgba(30, 44, 22, 0.66)',
  boardCaptureOnDark: 'rgba(255, 228, 210, 0.5)',
  boardCaptureOnLight: 'rgba(70, 36, 24, 0.45)',
  boardLastMove: 'rgba(230, 186, 48, 0.55)',
  boardAttention: 'rgba(210, 140, 40, 0.40)',
  boardBlunder: 'rgba(180, 40, 40, 0.16)',
  boardSave: 'rgba(46, 140, 64, 0.42)',
  boardFrame: '#3E5632',
  boardFrameBg: '#F8F4EA',
  boardMeta: '#3E4A34',
  boardCoordOnLight: '#1E2C16',
  boardCoordOnDark: '#F7F6EF',
  whitePiece: '#FFF6E8',
  whitePieceStroke: '#1A2230',
  blackPiece: '#0B1018',
} satisfies Palette;

export const palettes: { dark: Palette; light: Palette } = {
  dark: darkPalette,
  light: lightPalette,
};

/**
 * Arrow and threat colors. Dark matches the palette so the existing board
 * does not shift. Light uses brighter inks that stay visible on both squares
 * while the palette tokens stay dark enough for text and buttons.
 */
export const marks = {
  dark: {
    danger: darkPalette.danger,
    warning: darkPalette.warning,
    info: darkPalette.info,
    success: darkPalette.success,
  },
  light: {
    danger: '#FF5C5C',
    warning: '#E07020',
    info: '#4C8DFF',
    success: '#3EAD4E',
  },
} as const;

/** Steps already in use. Named keys are the original scale; numeric keys fill the gaps. */
export const spacing = {
  0: 0,
  1: 1,
  2: 2,
  3: 3,
  4: 4,
  5: 5,
  6: 6,
  7: 7,
  8: 8,
  10: 10,
  12: 12,
  14: 14,
  15: 15,
  16: 16,
  18: 18,
  20: 20,
  24: 24,
  28: 28,
  32: 32,
  48: 48,
  50: 50,
  none: 0,
  hairline: 1,
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radii = {
  swatch: 3,
  dot: 4,
  sm: 8,
  md: 12,
  lg: 16,
  /** Half of the 28px lesson index and check marks. */
  badge: 14,
  /** Half of the 26, 36, and 40px round controls (badge and choice key). */
  circleSm: 13,
  circleMd: 18,
  circleLg: 20,
  xl: 22,
  /** Progress track. Not the full pill. */
  track: 99,
  pill: 999,
} as const;

export const shadows = {
  board: {
    shadowColor: darkPalette.shadow,
    shadowOpacity: 0.28,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
  },
  dialog: {
    shadowColor: darkPalette.shadow,
    shadowOpacity: 0.4,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 16 },
    elevation: 12,
  },
} as const;

/**
 * Loaded faces already include their weight. Use these families in styles.
 * Applying `fontWeight` as well makes web synthesize a second bold.
 */
export const fonts = {
  display: 'SpaceGrotesk_700Bold',
  displayMedium: 'SpaceGrotesk_500Medium',
  body: 'Nunito_500Medium',
  bodyBold: 'Nunito_700Bold',
  bodyExtra: 'Nunito_800ExtraBold',
} as const;

export const fontWeight = {
  medium: '500',
  bold: '700',
  extraBold: '800',
} as const;

export const fontSizes = {
  10: 10,
  11: 11,
  12: 12,
  13: 13,
  14: 14,
  15: 15,
  16: 16,
  17: 17,
  18: 18,
  20: 20,
  22: 22,
  24: 24,
  26: 26,
  30: 30,
  36: 36,
  56: 56,
} as const;

export const lineHeights = {
  13: 13,
  14: 14,
  15: 15,
  16: 16,
  17: 17,
  18: 18,
  20: 20,
  22: 22,
  24: 24,
  26: 26,
  28: 28,
  30: 30,
  32: 32,
  34: 34,
  40: 40,
  42: 42,
  60: 60,
} as const;

export const letterSpacing = {
  eyebrow: 1.15,
  display: -0.7,
  title: -0.45,
  tight: -0.3,
  pill: 0.6,
  section: 1.1,
  hero: -1.4,
  heroCompact: -0.8,
  stat: -0.6,
  button: 0.1,
  badge: 0.7,
  pillCompact: 0.4,
} as const;

/**
 * Shared text roles. `*Compact` is the phone size (`useLayout().phone`).
 * Color stays at the call site so one role can sit on more than one color.
 */
export const typeRole = {
  eyebrow: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes[12],
    lineHeight: lineHeights[16],
    letterSpacing: letterSpacing.eyebrow,
    textTransform: 'uppercase' as const,
  },
  display: {
    fontFamily: fonts.display,
    fontSize: fontSizes[36],
    lineHeight: lineHeights[42],
    letterSpacing: letterSpacing.display,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: fontSizes[26],
    lineHeight: lineHeights[32],
    letterSpacing: letterSpacing.title,
  },
  titleCompact: {
    fontSize: fontSizes[18],
    lineHeight: lineHeights[22],
    letterSpacing: letterSpacing.tight,
  },
  habit: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes[16],
    lineHeight: lineHeights[22],
  },
  habitCompact: {
    fontSize: fontSizes[13],
    lineHeight: lineHeights[17],
  },
  body: {
    fontFamily: fonts.body,
    fontSize: fontSizes[16],
    lineHeight: lineHeights[24],
  },
  bodyCompact: {
    fontSize: fontSizes[13],
    lineHeight: lineHeights[17],
  },
  bodyStrong: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes[16],
    lineHeight: lineHeights[24],
  },
  muted: {
    fontFamily: fonts.body,
    fontSize: fontSizes[15],
    lineHeight: lineHeights[22],
  },
  mutedCompact: {
    fontSize: fontSizes[12],
    lineHeight: lineHeights[16],
  },
  meta: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes[14],
    lineHeight: lineHeights[20],
  },
  metaCompact: {
    fontSize: fontSizes[12],
    lineHeight: lineHeights[16],
  },
  section: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes[12],
    lineHeight: lineHeights[16],
    letterSpacing: letterSpacing.section,
    textTransform: 'uppercase' as const,
  },
  hero: {
    fontFamily: fonts.display,
    fontSize: fontSizes[56],
    lineHeight: lineHeights[60],
    letterSpacing: letterSpacing.hero,
  },
  heroCompact: {
    fontSize: fontSizes[36],
    lineHeight: lineHeights[40],
    letterSpacing: letterSpacing.heroCompact,
  },
  stat: {
    fontFamily: fonts.display,
    fontSize: fontSizes[30],
    lineHeight: lineHeights[34],
    letterSpacing: letterSpacing.stat,
  },
} as const;

export const typography = {
  family: fonts,
  weight: fontWeight,
  size: fontSizes,
  lineHeight: lineHeights,
  letterSpacing,
  role: typeRole,
} as const;

/** Breakpoints and frame sizes shared by the tab bar and every screen. */
export const layout = {
  /** Side-by-side board + panel. Also requires enough viewport height. */
  split: 720,
  splitMinHeight: 640,
  /** Top navigation instead of the bottom tab bar. */
  nav: 900,
  stageMax: 1680,
  pageMax: 1040,
  asideMin: 300,
  asideMax: 440,
  /** Safety cap for very tall windows. Normal desktops are height-limited first. */
  boardMax: 1040,
  tabBar: 64,
  /** Bottom tab bar without a home-indicator inset: padding + row + minimum inset. */
  tabBarPhone: 54,
  padPhone: spacing.xs,
  padTablet: spacing[20],
  padDesktop: spacing[28],
} as const;

const themeBase = {
  spacing,
  radii,
  shadows,
  fonts,
  fontWeight,
  fontSizes,
  lineHeights,
  letterSpacing,
  typeRole,
  typography,
  layout,
} as const;

const themes = {
  dark: { scheme: 'dark' as const, colors: palettes.dark, ...themeBase },
  light: { scheme: 'light' as const, colors: palettes.light, ...themeBase },
};

/** Stable object per scheme, so style caches and effects can depend on it. */
export function themeFor(scheme: ColorScheme): Theme {
  return themes[scheme];
}

export const theme = themes.dark;

export type Theme = (typeof themes)['dark'] | (typeof themes)['light'];

export const colors = palettes.dark;
