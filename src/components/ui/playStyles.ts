import { themedStyleSheet } from '@/src/theme/themed';
import { fonts, fontSizes, letterSpacing, lineHeights, radii, spacing } from '@/src/theme';

export const play = themedStyleSheet((colors) => ({
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
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  guideTight: {
    paddingVertical: spacing[10],
    paddingHorizontal: spacing[12],
    gap: spacing[6],
  },
  phoneTitle: {
    width: '100%',
    fontFamily: fonts.display,
    color: colors.text,
    fontSize: fontSizes[20],
    lineHeight: lineHeights[26],
    letterSpacing: letterSpacing.tight,
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
    gap: spacing.sm,
  },
  link: {
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing[14],
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  linkText: {
    fontFamily: fonts.bodyBold,
    color: colors.text,
    fontSize: fontSizes[15],
    lineHeight: lineHeights[20],
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
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing[14],
    minHeight: 84,
    justifyContent: 'center',
    cursor: 'pointer',
  },
  cardOn: {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.borderStrong,
  },
  cardTitle: {
    fontFamily: fonts.bodyBold,
    color: colors.text,
    fontSize: fontSizes[16],
    lineHeight: lineHeights[22],
  },
  cardBody: {
    marginTop: spacing.xs,
    fontFamily: fonts.body,
    color: colors.textMuted,
    fontSize: fontSizes[14],
    lineHeight: lineHeights[20],
  },
  done: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  miss: {
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
}));
