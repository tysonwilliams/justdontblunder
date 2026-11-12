import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';

import { controlA11y } from '@/src/components/ui/a11y';
import { useLayout } from '@/src/components/ui/useLayout';
import { useTheme } from '@/src/theme/useTheme';
import { fonts, fontSizes, letterSpacing, lineHeights, radii, spacing } from '@/src/theme';
import type { Palette } from '@/src/theme/tokens';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

type Props = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  fullWidth?: boolean;
  /** Short row used inside the fixed phone tray. */
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  selected?: boolean;
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  fullWidth = true,
  compact = false,
  style,
  testID,
  selected = false,
}: Props) {
  const { colors } = useTheme();
  const { phone } = useLayout();
  return (
    <Pressable
      {...controlA11y('button', label, selected)}
      testID={testID}
      hitSlop={compact ? spacing[6] : 0}
      onPress={onPress}
      style={(state) => {
        const hovered = 'hovered' in state && Boolean(state.hovered);
        return [
          styles.base,
          phone && styles.basePhone,
          compact && styles.compact,
          fullWidth ? styles.full : styles.hug,
          variantStyle(colors, variant, state.pressed, hovered),
          state.pressed && styles.pressed,
          style,
        ];
      }}>
      <Text
        style={[
          styles.label,
          phone && styles.labelPhone,
          compact && styles.labelCompact,
          labelColor(colors, variant),
        ]}
        numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

function variantStyle(colors: Palette, variant: Variant, pressed: boolean, hovered: boolean): ViewStyle {
  switch (variant) {
    case 'primary':
      return {
        backgroundColor: pressed || hovered ? colors.accentPressed : colors.accent,
      };
    case 'secondary':
      return {
        backgroundColor: pressed || hovered ? colors.surfaceRaised : colors.surface,
        borderWidth: 1,
        borderColor: colors.borderStrong,
      };
    case 'ghost':
      return {
        backgroundColor: pressed || hovered ? colors.hover : colors.transparent,
      };
    case 'danger':
      return {
        backgroundColor: pressed || hovered ? colors.dangerPressed : colors.danger,
      };
    default: {
      const _exhaustive: never = variant;
      return _exhaustive;
    }
  }
}

function labelColor(colors: Palette, variant: Variant) {
  switch (variant) {
    case 'primary':
      return { color: colors.accentText };
    case 'secondary':
    case 'ghost':
      return { color: colors.text };
    case 'danger':
      return { color: colors.onDanger };
    default: {
      const _exhaustive: never = variant;
      return _exhaustive;
    }
  }
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    paddingHorizontal: spacing[18],
    paddingVertical: spacing[12],
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  basePhone: {
    minHeight: 44,
    paddingHorizontal: spacing[12],
    paddingVertical: spacing.sm,
  },
  compact: {
    minHeight: 32,
    paddingHorizontal: spacing[10],
    paddingVertical: 0,
  },
  pressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.92,
  },
  full: {
    alignSelf: 'stretch',
  },
  hug: {
    alignSelf: 'flex-start',
    flexGrow: 0,
    flexShrink: 0,
    maxWidth: '100%',
  },
  label: {
    fontFamily: fonts.bodyExtra,
    fontSize: fontSizes[16],
    lineHeight: lineHeights[22],
    letterSpacing: letterSpacing.button,
    textAlign: 'center',
  },
  labelPhone: {
    fontSize: fontSizes[15],
    lineHeight: lineHeights[18],
  },
  labelCompact: {
    fontSize: fontSizes[13],
    lineHeight: lineHeights[16],
  },
});
