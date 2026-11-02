import { StyleSheet } from 'react-native';

import { fontSizes, letterSpacing, lineHeights, spacing } from '@/src/theme';

export const lessonStyles = StyleSheet.create({
  guidePhone: {
    padding: spacing.sm,
    gap: spacing.xs,
  },
  eyebrowPhone: {
    flex: 1,
    fontSize: fontSizes[11],
    lineHeight: lineHeights[14],
    letterSpacing: letterSpacing.pill,
  },
});
