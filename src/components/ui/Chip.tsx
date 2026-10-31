import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useLayout } from '@/src/components/ui/useLayout';
import { colors, fonts, radii } from '@/src/theme';

type ChipProps = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  testID?: string;
  size?: 'sm' | 'md';
};

export function Chip({ label, selected = false, onPress, testID, size = 'md' }: ChipProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      testID={testID}
      onPress={onPress}
      style={(state) => {
        const hovered = 'hovered' in state && Boolean(state.hovered);
        return [
          styles.chip,
          size === 'sm' && styles.chipSm,
          selected && styles.chipOn,
          (state.pressed || hovered) && !selected && styles.chipHover,
        ];
      }}>
      <Text
        style={[styles.chipText, size === 'sm' && styles.chipTextSm, selected && styles.chipTextOn]}
        numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

export function FilterChips<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
}) {
  const { contentW } = useLayout();
  const compact = contentW < 520;
  const items = options.map((item) => (
    <Chip
      key={item.id}
      label={item.label}
      size={compact ? 'sm' : 'md'}
      selected={item.id === value}
      onPress={() => onChange(item.id)}
    />
  ));

  return <View style={[styles.wrap, compact && styles.wrapTight]}>{items}</View>;
}

export function StatusPill({ children }: { children: ReactNode }) {
  return (
    <View style={styles.pill}>
      <Text style={styles.pillText}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 40,
    paddingHorizontal: 12,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
    flexGrow: 0,
    flexShrink: 0,
    cursor: 'pointer',
  },
  chipSm: {
    paddingHorizontal: 8,
  },
  chipOn: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  chipHover: {
    backgroundColor: colors.bgSoft,
  },
  chipText: {
    fontFamily: fonts.bodyBold,
    color: colors.text,
    fontSize: 14,
    lineHeight: 18,
  },
  chipTextSm: {
    fontSize: 13,
    lineHeight: 16,
  },
  chipTextOn: {
    color: colors.accentText,
  },
  wrap: {
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  wrapTight: {
    gap: 4,
  },
  pill: {
    alignSelf: 'flex-start',
    backgroundColor: colors.accentSoft,
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
    minHeight: 28,
    justifyContent: 'center',
  },
  pillText: {
    fontFamily: fonts.bodyBold,
    color: colors.accent,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
});
