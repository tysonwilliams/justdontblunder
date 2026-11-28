import { StyleSheet } from 'react-native';

import { fontSizes, letterSpacing, lineHeights, radii, spacing } from '@/src/theme';

export const lessonStyles = StyleSheet.create({
  guidePhone: {
    padding: spacing.sm,
    gap: spacing.xs,
  },
  metaPhone: {
    height: 30,
    alignItems: 'center',
  },
  metaActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
    flexShrink: 0,
  },
  eyebrowPhone: {
    flex: 1,
    fontSize: fontSizes[11],
    lineHeight: lineHeights[14],
    letterSpacing: letterSpacing.pill,
  },
  kicker: {
    flex: 1,
  },
  back: {
    minHeight: 30,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
    cursor: 'pointer',
  },
  backPressed: {
    opacity: 0.7,
  },
  cardAside: {
    paddingHorizontal: spacing[10],
    paddingVertical: spacing[8],
    gap: spacing[6],
  },
  doneActions: {
    gap: spacing.sm,
  },
  doneActionsPhone: {
    flexDirection: 'row',
    gap: spacing[6],
  },
  doneActionPhone: {
    flex: 1,
    flexBasis: 0,
  },
});
