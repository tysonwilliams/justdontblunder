import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';

import { colors, fonts, radii } from '@/src/theme';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

type Props = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Button({ label, onPress, variant = 'primary', fullWidth = true, style }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={(state) => {
        const hovered = 'hovered' in state && Boolean(state.hovered);
        return [
          styles.base,
          fullWidth && styles.full,
          variantStyle(variant, state.pressed, hovered),
          style,
        ];
      }}>
      <Text style={[styles.label, labelColor(variant)]}>{label}</Text>
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
    minHeight: 52,
    paddingHorizontal: 18,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  full: {
    alignSelf: 'stretch',
  },
  label: {
    fontFamily: fonts.bodyExtra,
    fontSize: 17,
    letterSpacing: 0.1,
  },
});
