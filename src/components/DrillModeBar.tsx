import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radii } from '@/src/theme';

export type DrillPlayMode = 'streak' | 'pick';

const MODES: { id: DrillPlayMode; label: string }[] = [
  { id: 'streak', label: 'Streak' },
  { id: 'pick', label: 'Pick the safe move' },
];

export function DrillModeBar({
  mode,
  onChange,
}: {
  mode: DrillPlayMode;
  onChange: (mode: DrillPlayMode) => void;
}) {
  return (
    <View style={styles.row}>
      {MODES.map((item) => {
        const on = item.id === mode;
        return (
          <Pressable
            key={item.id}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            testID={`mode-${item.id}`}
            onPress={() => onChange(item.id)}
            style={[styles.chip, on && styles.chipOn]}>
            <Text style={[styles.text, on && styles.textOn]}>{item.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.bgElevated,
    paddingHorizontal: 12,
    paddingVertical: 7,
    cursor: 'pointer',
  },
  chipOn: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  text: {
    fontFamily: fonts.bodyBold,
    color: colors.text,
    fontSize: 15,
  },
  textOn: {
    color: colors.accentText,
  },
});
