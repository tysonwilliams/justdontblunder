export const colors = {
  bg: '#1C1B19',
  bgElevated: '#2A2826',
  bgSoft: '#343230',
  border: 'rgba(255,255,255,0.08)',
  borderStrong: 'rgba(255,255,255,0.14)',
  text: '#F6F3EE',
  textMuted: '#B7B2AA',
  textDim: '#8A857E',
  accent: '#8EBF55',
  accentPressed: '#7AAB45',
  accentText: '#14210C',
  accentSoft: 'rgba(142, 191, 85, 0.16)',
  warn: '#E8B84A',
  warnSoft: 'rgba(232, 184, 74, 0.16)',
  danger: '#E25B5B',
  dangerPressed: '#C94B4B',
  dangerSoft: 'rgba(226, 91, 91, 0.16)',
  success: '#8EBF55',
  successSoft: 'rgba(142, 191, 85, 0.16)',
  overlay: 'rgba(10, 9, 8, 0.72)',
  // Board chrome is frozen so square and piece styling stay put.
  boardLight: '#D7DEEA',
  boardDark: '#3A4A63',
  boardSelected: 'rgba(61, 220, 151, 0.42)',
  boardLegalOnDark: 'rgba(247, 249, 252, 0.78)',
  boardLegalOnLight: 'rgba(32, 44, 62, 0.62)',
  boardCaptureOnDark: 'rgba(255, 196, 196, 0.95)',
  boardCaptureOnLight: 'rgba(168, 28, 40, 0.9)',
  boardLastMove: 'rgba(245, 197, 66, 0.34)',
  boardAttention: '#F5C54299',
  boardBlunder: '#FF5C5C8C',
  boardSave: 'rgba(142, 191, 85, 0.55)',
  boardFrame: '#2A3344',
  boardFrameBg: '#1C2330',
  boardMeta: '#9AA6B2',
  whitePiece: '#FFF6E8',
  whitePieceStroke: '#1A2230',
  blackPiece: '#0B1018',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
} as const;

export const fonts = {
  display: 'SpaceGrotesk_700Bold',
  displayMedium: 'SpaceGrotesk_500Medium',
  body: 'Nunito_500Medium',
  bodyBold: 'Nunito_700Bold',
  bodyExtra: 'Nunito_800ExtraBold',
} as const;

export const theme = {
  colors,
  spacing,
  radii,
  fonts,
} as const;

export type Theme = typeof theme;
