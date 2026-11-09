import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { useReducedMotion } from '@/src/components/Board/useReducedMotion';
import { useProgressStore } from '@/src/store/progress';
import { useHydrated } from '@/src/store/useHydrated';
import { useTheme } from '@/src/theme/useTheme';
import { themedStyleSheet } from '@/src/theme/themed';
import { fonts, fontSizes, lineHeights, radii, spacing } from '@/src/theme/tokens';

export function XpChip() {
  const { colors } = useTheme();
  const xp = useProgressStore((state) => state.xp);
  const hydrated = useHydrated(useProgressStore.persist);
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);
  const seen = useRef(xp);
  const [bump, setBump] = useState<number | null>(null);

  useEffect(() => {
    const gained = xp - seen.current;
    seen.current = xp;
    if (gained <= 0) return;
    setBump(gained);
    if (!reduced) {
      scale.value = 1.08;
      scale.value = withSpring(1, { damping: 14, stiffness: 220 });
    }
    const timer = setTimeout(() => setBump(null), 900);
    return () => clearTimeout(timer);
  }, [reduced, scale, xp]);

  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  if (!hydrated) return null;

  return (
    <Animated.View style={[styles.chip, anim]} testID="xp-chip">
      <Text style={styles.label}>{xp} XP</Text>
      {bump ? (
        <View style={[styles.bump, { backgroundColor: colors.success }]}>
          <Text style={[styles.bumpText, { color: colors.accentText }]}>+{bump}</Text>
        </View>
      ) : null}
    </Animated.View>
  );
}

const styles = themedStyleSheet((colors) => ({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[6],
    minHeight: 32,
    paddingHorizontal: spacing[10],
    borderRadius: radii.pill,
    backgroundColor: colors.accentSoft,
  },
  label: {
    fontFamily: fonts.bodyBold,
    color: colors.accent,
    fontSize: fontSizes[14],
    lineHeight: lineHeights[18],
  },
  bump: {
    borderRadius: radii.pill,
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[2],
  },
  bumpText: {
    fontFamily: fonts.bodyExtra,
    fontSize: fontSizes[12],
    lineHeight: lineHeights[16],
  },
}));
