import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { colors, fonts, radii, spacing } from '@/src/theme';

type Props = {
  visible: boolean;
  title: string;
  message: string;
  tone?: 'danger' | 'success' | 'warn';
  hint?: string;
  actionLabel?: string;
  onDismiss?: () => void;
};

export function BlunderOverlay({
  visible,
  title,
  message,
  tone = 'danger',
  hint,
  actionLabel = 'Got it',
  onDismiss,
}: Props) {
  const scale = useSharedValue(0.9);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, { duration: 180 });
      scale.value = withSequence(withSpring(1.04), withSpring(1));
    } else {
      opacity.value = withTiming(0, { duration: 120 });
      scale.value = withTiming(0.94, { duration: 120 });
    }
  }, [visible, opacity, scale]);

  const anim = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  if (!visible) return null;

  const accent =
    tone === 'success' ? colors.success : tone === 'warn' ? colors.warn : colors.danger;
  const soft =
    tone === 'success'
      ? colors.successSoft
      : tone === 'warn'
        ? 'rgba(245,197,66,0.16)'
        : colors.dangerSoft;

  return (
    <Animated.View style={[styles.card, { borderColor: accent, backgroundColor: soft }, anim]}>
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: accent }]}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          {hint ? <Text style={styles.hint}>Try: {hint}</Text> : null}
        </View>
        {onDismiss ? (
          <Pressable onPress={onDismiss} hitSlop={12} style={styles.dismiss}>
            <Text style={styles.dismissText}>{actionLabel}</Text>
          </Pressable>
        ) : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1.5,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    fontFamily: fonts.bodyExtra,
    fontSize: 16,
    marginBottom: 2,
  },
  message: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },
  hint: {
    marginTop: 4,
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: colors.textMuted,
  },
  dismiss: {
    backgroundColor: colors.bgElevated,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dismissText: {
    fontFamily: fonts.bodyBold,
    color: colors.text,
    fontSize: 13,
  },
});
