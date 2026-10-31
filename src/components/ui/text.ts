import { StyleSheet } from 'react-native';

import { colors, fonts } from '@/src/theme';

export const text = StyleSheet.create({
  eyebrow: {
    fontFamily: fonts.bodyBold,
    color: colors.accent,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 1.15,
    textTransform: 'uppercase',
  },
  display: {
    fontFamily: fonts.display,
    color: colors.text,
    fontSize: 36,
    lineHeight: 42,
    letterSpacing: -0.7,
  },
  title: {
    fontFamily: fonts.display,
    color: colors.text,
    fontSize: 26,
    lineHeight: 32,
    letterSpacing: -0.45,
  },
  habit: {
    fontFamily: fonts.bodyBold,
    color: colors.warn,
    fontSize: 16,
    lineHeight: 22,
  },
  body: {
    fontFamily: fonts.body,
    color: colors.text,
    fontSize: 16,
    lineHeight: 24,
  },
  bodyStrong: {
    fontFamily: fonts.bodyBold,
    color: colors.text,
    fontSize: 16,
    lineHeight: 24,
  },
  muted: {
    fontFamily: fonts.body,
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
  },
  meta: {
    fontFamily: fonts.bodyBold,
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  section: {
    fontFamily: fonts.bodyBold,
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  hero: {
    fontFamily: fonts.display,
    color: colors.text,
    fontSize: 56,
    lineHeight: 60,
    letterSpacing: -1.4,
  },
  stat: {
    fontFamily: fonts.display,
    color: colors.text,
    fontSize: 30,
    lineHeight: 34,
    letterSpacing: -0.6,
  },
});
