import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from 'react-native-reanimated';

import { colors, fonts, radii } from '@/src/theme';

type Props = {
  streak: number;
  label?: string;
  celebrate?: boolean;
};

export function StreakBadge({ streak, label = 'day streak', celebrate = false }: Props) {
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
      <Animated.View style={[styles.badge, anim]}>
        <View style={styles.dot} />
        <Text style={styles.count}>{streak}</Text>
        <Text style={styles.label}>{label}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'flex-start',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.bg,
    borderColor: colors.borderStrong,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.pill,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
  },
  count: {
    fontFamily: fonts.display,
    color: colors.text,
    fontSize: 18,
  },
  label: {
    fontFamily: fonts.bodyBold,
    color: colors.textMuted,
    fontSize: 13,
  },
});
