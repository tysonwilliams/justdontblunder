import { StyleSheet, View } from 'react-native';

import { useLayout } from '@/src/components/ui/useLayout';
import { colors } from '@/src/theme';

export function ProgressTrack({ progress }: { progress: number }) {
  const { phone } = useLayout();
  const pct = Math.max(0, Math.min(100, Math.round(progress * 100)));
  const height = phone ? 4 : 6;
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: pct }}
      style={[styles.track, { height }]}>
      <View style={[styles.fill, { width: `${pct}%`, height }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 6,
    borderRadius: 99,
    backgroundColor: colors.bgSoft,
    overflow: 'hidden',
    width: '100%',
  },
  fill: {
    height: 6,
    borderRadius: 99,
    backgroundColor: colors.accent,
  },
});
