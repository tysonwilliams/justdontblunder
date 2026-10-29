import { Pressable, StyleSheet, Text, View } from 'react-native';

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
  { key: 'hanging', label: 'Hanging?', hint: 'Did you leave anything loose?' },
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
  const done = habitsComplete(value);

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.title}>Before you move</Text>
        <Text style={[styles.badge, done && styles.badgeDone]}>
          {done ? 'Ready' : required ? 'Check all' : 'Quick scan'}
        </Text>
      </View>
      <View style={styles.grid}>
        {ITEMS.map((item) => {
          const on = value[item.key];
          return (
            <Pressable
              key={item.key}
              onPress={() => onChange({ ...value, [item.key]: !on })}
              style={[styles.chip, on && styles.chipOn]}>
              <Text style={[styles.chipMark, on && styles.chipMarkOn]}>{on ? '✓' : '○'}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.chipLabel, on && styles.chipLabelOn]}>{item.label}</Text>
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
    backgroundColor: 'rgba(245,197,66,0.14)',
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
    paddingVertical: 10,
  },
  chipOn: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  chipMark: {
    fontFamily: fonts.bodyExtra,
    fontSize: 16,
    color: colors.textDim,
    width: 22,
  },
  chipMarkOn: {
    color: colors.accent,
  },
  chipLabel: {
    fontFamily: fonts.bodyBold,
    color: colors.text,
    fontSize: 14,
  },
  chipLabelOn: {
    color: colors.accent,
  },
  chipHint: {
    fontFamily: fonts.body,
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 1,
  },
});
