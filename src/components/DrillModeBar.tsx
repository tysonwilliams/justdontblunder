import { StyleSheet, View } from 'react-native';

import { Chip } from '@/src/components/ui/Chip';

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
      {MODES.map((item) => (
        <Chip
          key={item.id}
          label={item.label}
          selected={item.id === mode}
          testID={`mode-${item.id}`}
          onPress={() => onChange(item.id)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
});