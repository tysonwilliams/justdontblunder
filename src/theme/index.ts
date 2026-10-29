export const colors = {
  bg: '#0E1116',
  bgElevated: '#161B22',
  bgSoft: '#1C2330',
  border: '#2A3344',
  text: '#F2F5F9',
  textMuted: '#9AA6B2',
  textDim: '#6B7785',
  accent: '#3DDC97',
  accentSoft: 'rgba(61, 220, 151, 0.16)',
  warn: '#F5C542',
  danger: '#FF5C5C',
  dangerSoft: 'rgba(255, 92, 92, 0.22)',
  success: '#3DDC97',
  successSoft: 'rgba(61, 220, 151, 0.18)',
  boardLight: '#D7DEEA',
  boardDark: '#3A4A63',
  boardSelected: 'rgba(61, 220, 151, 0.42)',
  boardLegal: 'rgba(242, 245, 249, 0.28)',
  boardLastMove: 'rgba(245, 197, 66, 0.34)',
  boardAttention: '#F5C54299',
  boardBlunder: '#FF5C5C8C',
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
  md: 14,
  lg: 22,
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
