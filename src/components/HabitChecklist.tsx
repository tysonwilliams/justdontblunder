import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { colors, fonts, radii, spacing } from '@/src/theme';

export type HabitKey = 'checks' | 'captures' | 'threats' | 'hanging';

export type HabitState = Record<HabitKey, boolean>;

export const EMPTY_HABITS: HabitState = {
  checks: false,
  captures: false,
  threats: false,
  hanging: false,
};

const ITEMS: { key: HabitKey; label: string; hint: string }[] = [
  { key: 'checks', label: 'Checks', hint: 'Can they check you?' },
  { key: 'captures', label: 'Captures', hint: 'What can they take?' },
  { key: 'threats', label: 'Threats', hint: 'Forks, pins, mates?' },
  { key: 'hanging', label: 'Hanging?', hint: 'Anything of yours loose?' },
];

type Props = {
  value: HabitState;
  onChange: (next: HabitState) => void;
  required?: boolean;
};

export function habitsComplete(value: HabitState): boolean {
  return ITEMS.every((item) => value[item.key]);
}

export function HabitChecklist({ value, onChange, required = false }: Props) {
  const { width } = useWindowDimensions();
  const stacked = width < 460;
  const done = habitsComplete(value);

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.title}>Before you move</Text>
        <Text style={[styles.badge, done && styles.badgeDone]}>
          {done ? 'Ready' : required ? 'Check all four' : 'Quick scan'}
        </Text>
      </View>
      <View style={styles.grid}>
        {ITEMS.map((item) => {
          const on = value[item.key];
          return (
            <Pressable
              key={item.key}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              onPress={() => onChange({ ...value, [item.key]: !on })}
              style={(state) => [
                styles.chip,
                stacked ? styles.chipFull : styles.chipHalf,
                on && styles.chipOn,
                state.pressed && styles.chipPressed,
              ]}>
              <View style={[styles.box, on && styles.boxOn]}>
                <Text style={[styles.boxMark, on && styles.boxMarkOn]}>{on ? '✓' : ''}</Text>
              </View>
              <View style={styles.copy}>
                <Text style={styles.chipLabel}>{item.label}</Text>
                <Text style={styles.chipHint}>{item.hint}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    fontFamily: fonts.bodyBold,
    color: colors.text,
    fontSize: 15,
  },
  badge: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: colors.warn,
    backgroundColor: colors.warnSoft,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.pill,
    overflow: 'hidden',
  },
  badgeDone: {
    color: colors.success,
    backgroundColor: colors.successSoft,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 12,
    cursor: 'pointer',
  },
  chipHalf: {
    width: '48%',
    flexGrow: 1,
    minWidth: 160,
  },
  chipFull: {
    width: '100%',
  },
  chipOn: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  chipPressed: {
    opacity: 0.85,
  },
  box: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxOn: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  boxMark: {
    fontFamily: fonts.bodyExtra,
    fontSize: 13,
    color: colors.accentText,
    lineHeight: 16,
  },
  boxMarkOn: {
    color: colors.accentText,
  },
  copy: {
    flex: 1,
  },
  chipLabel: {
    fontFamily: fonts.bodyBold,
    color: colors.text,
    fontSize: 14,
  },
  chipHint: {
    fontFamily: fonts.body,
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 1,
  },
});
