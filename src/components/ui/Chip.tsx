import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import { controlA11y } from '@/src/components/ui/a11y';
import { useLayout } from '@/src/components/ui/useLayout';
import { useTheme } from '@/src/theme/useTheme';
import { themedStyleSheet } from '@/src/theme/themed';
import { fonts, fontSizes, letterSpacing, lineHeights, radii, spacing } from '@/src/theme';

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
  useTheme();
  const { phone } = useLayout();
  return (
    <Pressable
      {...controlA11y('button', label, selected)}
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
  options: readonly { id: T; label: string; testID?: string }[];
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
      testID={item.testID}
      onPress={() => onChange(item.id)}
    />
  ));

  return <View style={[styles.wrap, phone && styles.oneRow]}>{items}</View>;
}

export function StatusPill({ children }: { children: ReactNode }) {
  useTheme();
  const { phone } = useLayout();
  return (
    <View style={[styles.pill, phone && styles.pillPhone]}>
      <Text style={[styles.pillText, phone && styles.pillTextPhone]} numberOfLines={1}>
        {children}
      </Text>
    </View>
  );
}

const styles = themedStyleSheet((colors) => ({
  chip: {
    minHeight: 36,
    paddingHorizontal: spacing[12],
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    flexGrow: 0,
    flexShrink: 0,
    cursor: 'pointer',
  },
  chipPhone: {
    minHeight: 28,
    paddingHorizontal: spacing.sm,
  },
  chipSm: {
    paddingHorizontal: spacing.sm,
  },
  chipFill: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    minWidth: 0,
    paddingHorizontal: spacing[3],
  },
  chipOn: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  chipHover: {
    backgroundColor: colors.surfaceRaised,
  },
  chipText: {
    fontFamily: fonts.bodyBold,
    color: colors.text,
    fontSize: fontSizes[14],
    lineHeight: lineHeights[18],
  },
  chipTextPhone: {
    fontSize: fontSizes[12],
    lineHeight: lineHeights[15],
  },
  chipTextSm: {
    fontSize: fontSizes[11],
    lineHeight: lineHeights[14],
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
    gap: spacing.sm,
  },
  oneRow: {
    flexWrap: 'nowrap',
    gap: spacing.xs,
  },
  pill: {
    alignSelf: 'flex-start',
    backgroundColor: colors.accentSoft,
    borderRadius: radii.pill,
    paddingHorizontal: spacing[10],
    paddingVertical: spacing[5],
    minHeight: 28,
    justifyContent: 'center',
    flexShrink: 1,
  },
  pillPhone: {
    minHeight: 22,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
  },
  pillText: {
    fontFamily: fonts.bodyBold,
    color: colors.accent,
    fontSize: fontSizes[12],
    lineHeight: lineHeights[16],
    letterSpacing: letterSpacing.pill,
    textTransform: 'uppercase',
  },
  pillTextPhone: {
    fontSize: fontSizes[10],
    lineHeight: lineHeights[14],
    letterSpacing: letterSpacing.pillCompact,
  },
}));
