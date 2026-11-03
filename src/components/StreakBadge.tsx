import { useEffect } from 'react';
import { Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from 'react-native-reanimated';

import { useTheme } from '@/src/theme/useTheme';
import { themedStyleSheet } from '@/src/theme/themed';
import { fonts, fontSizes, radii, spacing } from '@/src/theme';

type Props = {
  streak: number;
  label?: string;
  celebrate?: boolean;
  compact?: boolean;
};

export function StreakBadge({ streak, label = 'day streak', celebrate = false, compact = false }: Props) {
  useTheme();
  const scale = useSharedValue(1);

  useEffect(() => {
    if (celebrate && streak > 0) {
      scale.value = withSequence(withSpring(1.06), withSpring(1));
    }
  }, [celebrate, streak, scale]);

  const anim = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <View style={styles.wrap}>
      <Animated.View style={[styles.badge, compact && styles.badgeCompact, anim]}>
        <View style={[styles.dot, compact && styles.dotCompact]} />
        <Text style={[styles.count, compact && styles.countCompact]}>{streak}</Text>
        <Text style={[styles.label, compact && styles.labelCompact]}>{label}</Text>
      </Animated.View>
    </View>
  );
}

const styles = themedStyleSheet((colors) => ({
  wrap: {
    alignItems: 'flex-start',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderColor: colors.borderStrong,
    borderWidth: 1,
    paddingHorizontal: spacing[12],
    paddingVertical: spacing[6],
    minHeight: 36,
    borderRadius: radii.pill,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: radii.dot,
    backgroundColor: colors.accent,
  },
  count: {
    fontFamily: fonts.display,
    color: colors.text,
    fontSize: fontSizes[18],
  },
  label: {
    fontFamily: fonts.bodyBold,
    color: colors.textMuted,
    fontSize: fontSizes[15],
  },
  badgeCompact: {
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    minHeight: 22,
  },
  dotCompact: {
    width: 6,
    height: 6,
  },
  countCompact: {
    fontSize: fontSizes[13],
  },
  labelCompact: {
    fontSize: fontSizes[11],
  },
}));
