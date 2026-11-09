import { StyleSheet } from 'react-native';

import { fontSizes, letterSpacing, lineHeights, radii, spacing } from '@/src/theme';

export const lessonStyles = StyleSheet.create({
  guidePhone: {
    padding: spacing.sm,
    gap: spacing.xs,
  },
  metaPhone: {
    height: 20,
    overflow: 'hidden',
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
    minHeight: 32,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
  },
  backPressed: {
    opacity: 0.7,
  },
  cardAside: {
    paddingHorizontal: spacing[10],
    paddingVertical: spacing[6],
    gap: spacing.xs,
    overflow: 'hidden',
  },
});
