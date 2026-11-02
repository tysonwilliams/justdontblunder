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
  /** Share a single row equally. */
  fill?: boolean;
};

export function Chip({ label, selected = false, onPress, testID, size = 'md', fill = false }: ChipProps) {
  const { phone } = useLayout();
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
          phone && styles.chipPhone,
          size === 'sm' && styles.chipSm,
          fill && styles.chipFill,
          selected && styles.chipOn,
          (state.pressed || hovered) && !selected && styles.chipHover,
        ];
      }}>
      <Text
        style={[
          styles.chipText,
          phone && styles.chipTextPhone,
          size === 'sm' && styles.chipTextSm,
          selected && styles.chipTextOn,
        ]}
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
  const { phone } = useLayout();
  const items = options.map((item) => (
    <Chip
      key={item.id}
      label={item.label}
      size="sm"
      selected={item.id === value}
      onPress={() => onChange(item.id)}
    />
  ));

  return <View style={[styles.wrap, phone && styles.oneRow]}>{items}</View>;
}

export function StatusPill({ children }: { children: ReactNode }) {
  const { phone } = useLayout();
  return (
    <View style={[styles.pill, phone && styles.pillPhone]}>
      <Text style={[styles.pillText, phone && styles.pillTextPhone]} numberOfLines={1}>
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 36,
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
  chipPhone: {
    minHeight: 28,
    paddingHorizontal: 8,
  },
  chipSm: {
    paddingHorizontal: 8,
  },
  chipFill: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    minWidth: 0,
    paddingHorizontal: 3,
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
  chipTextPhone: {
    fontSize: 12,
    lineHeight: 15,
  },
  chipTextSm: {
    fontSize: 11,
    lineHeight: 14,
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
  oneRow: {
    flexWrap: 'nowrap',
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
    flexShrink: 1,
  },
  pillPhone: {
    minHeight: 22,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  pillText: {
    fontFamily: fonts.bodyBold,
    color: colors.accent,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  pillTextPhone: {
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 0.4,
  },
});
