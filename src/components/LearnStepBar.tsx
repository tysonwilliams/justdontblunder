import { StyleSheet, View } from 'react-native';

import { Chip } from '@/src/components/ui/Chip';

export type LearnStep = 'pick' | 'play';

const STEPS: { id: LearnStep; label: string }[] = [
  { id: 'pick', label: 'Pick the safe move' },
  { id: 'play', label: 'Play the move' },
];

export function LearnStepBar({
  step,
  onChange,
}: {
  step: LearnStep;
  onChange: (step: LearnStep) => void;
}) {
  return (
    <View style={styles.row}>
      {STEPS.map((item) => (
        <Chip
          key={item.id}
          label={item.label}
          selected={item.id === step}
          testID={`learn-step-${item.id}`}
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
