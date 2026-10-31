import { StyleSheet, View } from 'react-native';

import { colors } from '@/src/theme';

export function ProgressTrack({ progress }: { progress: number }) {
  const pct = Math.max(0, Math.min(100, Math.round(progress * 100)));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: pct }}
      style={styles.track}>
      <View style={[styles.fill, { width: `${pct}%` }]} />
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
