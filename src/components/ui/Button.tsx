import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';

import { useLayout } from '@/src/components/ui/useLayout';
import { colors, fonts, radii } from '@/src/theme';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

type Props = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  fullWidth = true,
  style,
  testID,
}: Props) {
  const { phone } = useLayout();
  return (
    <Pressable
      accessibilityRole="button"
      testID={testID}
      onPress={onPress}
      style={(state) => {
        const hovered = 'hovered' in state && Boolean(state.hovered);
        return [
          styles.base,
          phone && styles.basePhone,
          fullWidth && styles.full,
          variantStyle(variant, state.pressed, hovered),
          style,
        ];
      }}>
      <Text style={[styles.label, phone && styles.labelPhone, labelColor(variant)]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

function variantStyle(variant: Variant, pressed: boolean, hovered: boolean): ViewStyle {
  switch (variant) {
    case 'primary':
      return {
        backgroundColor: pressed || hovered ? colors.accentPressed : colors.accent,
      };
    case 'secondary':
      return {
        backgroundColor: pressed || hovered ? colors.bgSoft : colors.bgElevated,
        borderWidth: 1,
        borderColor: colors.borderStrong,
      };
    case 'ghost':
      return {
        backgroundColor: pressed || hovered ? 'rgba(255,255,255,0.04)' : 'transparent',
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

function labelColor(variant: Variant) {
  switch (variant) {
    case 'primary':
      return { color: colors.accentText };
    case 'secondary':
    case 'ghost':
      return { color: colors.text };
    case 'danger':
      return { color: '#FFFFFF' };
    default: {
      const _exhaustive: never = variant;
      return _exhaustive;
    }
  }
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  basePhone: {
    minHeight: 36,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  full: {
    alignSelf: 'stretch',
  },
  label: {
    fontFamily: fonts.bodyExtra,
    fontSize: 16,
    lineHeight: 22,
    letterSpacing: 0.1,
    textAlign: 'center',
  },
  labelPhone: {
    fontSize: 14,
    lineHeight: 18,
  },
});
