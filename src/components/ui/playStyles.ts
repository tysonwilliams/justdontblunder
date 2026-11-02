import { StyleSheet } from 'react-native';

import { colors, fonts, radii, spacing } from '@/src/theme';

export const play = StyleSheet.create({
  metaRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  metaRight: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    flexShrink: 1,
  },
  guide: {
    backgroundColor: colors.bgElevated,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  guideTight: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 6,
  },
  phoneTitle: {
    width: '100%',
    fontFamily: fonts.display,
    color: colors.text,
    fontSize: 20,
    lineHeight: 26,
    letterSpacing: -0.3,
  },
  progressGrow: {
    flex: 1,
    minWidth: 0,
  },
  stack: {
    gap: spacing.sm,
  },
  linkRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  link: {
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.bgElevated,
    paddingHorizontal: 14,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  linkText: {
    fontFamily: fonts.bodyBold,
    color: colors.text,
    fontSize: 15,
    lineHeight: 20,
  },
  cards: {
    width: '100%',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  cardsStack: {
    flexDirection: 'column',
  },
  card: {
    flex: 1,
    backgroundColor: colors.bgElevated,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    minHeight: 84,
    justifyContent: 'center',
    cursor: 'pointer',
  },
  cardOn: {
    backgroundColor: colors.bgSoft,
    borderColor: colors.borderStrong,
  },
  cardTitle: {
    fontFamily: fonts.bodyBold,
    color: colors.text,
    fontSize: 16,
    lineHeight: 22,
  },
  cardBody: {
    marginTop: 4,
    fontFamily: fonts.body,
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  done: {
    backgroundColor: colors.bgElevated,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  miss: {
    gap: 4,
    marginBottom: spacing.xs,
  },
});
