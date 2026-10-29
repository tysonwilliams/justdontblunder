import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { colors, fonts, radii, spacing } from '@/src/theme';

type Props = {
  streak: number;
  label?: string;
  celebrate?: boolean;
};

export function StreakBadge({ streak, label = 'day streak', celebrate = false }: Props) {
  const scale = useSharedValue(1);
  const burst = useSharedValue(0);

  useEffect(() => {
    if (celebrate && streak > 0) {
      scale.value = withSequence(withSpring(1.12), withSpring(1));
      burst.value = withSequence(withTiming(1, { duration: 220 }), withTiming(0, { duration: 600 }));
    }
  }, [celebrate, streak, scale, burst]);

  const anim = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const confetti = useAnimatedStyle(() => ({
    opacity: burst.value,
    transform: [{ scale: 0.8 + burst.value * 0.4 }],
  }));

  return (
    <View style={styles.wrap}>
      <Animated.View style={[styles.badge, anim]}>
        <Text style={styles.fire}>✦</Text>
        <Text style={styles.count}>{streak}</Text>
        <Text style={styles.label}>{label}</Text>
      </Animated.View>
      <Animated.View pointerEvents="none" style={[styles.confetti, confetti]}>
        <Text style={styles.confettiText}>✦  ·  ✦  ·  ✦</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.bgElevated,
    borderColor: colors.accent,
    borderWidth: 1.5,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radii.pill,
  },
  fire: {
    color: colors.accent,
    fontSize: 16,
  },
  count: {
    fontFamily: fonts.display,
    color: colors.text,
    fontSize: 22,
  },
  label: {
    fontFamily: fonts.bodyBold,
    color: colors.textMuted,
    fontSize: 13,
  },
  confetti: {
    position: 'absolute',
    top: -18,
  },
  confettiText: {
    color: colors.warn,
    fontFamily: fonts.bodyBold,
    letterSpacing: 2,
  },
});
