import { useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { StreakBadge } from '@/src/components/StreakBadge';
import { Button } from '@/src/components/ui/Button';
import { Dialog } from '@/src/components/ui/Dialog';
import { Screen } from '@/src/components/ui/Screen';
import { useProgressStore } from '@/src/store/progress';
import { colors, fonts, radii, spacing } from '@/src/theme';

export default function ProgressScreen() {
  const { width } = useWindowDimensions();
  const compact = width < 520;
  const [confirmReset, setConfirmReset] = useState(false);
  const {
    dailyStreak,
    recordStreak,
    drillsCompleted,
    drillsCorrect,
    blundersAvoided,
    blundersMade,
    practiceMoves,
    resetProgress,
  } = useProgressStore();

  const accuracy = drillsCompleted > 0 ? Math.round((drillsCorrect / drillsCompleted) * 100) : 0;

  return (
    <Screen maxWidth={760}>
      <Text style={styles.eyebrow}>This device</Text>
      <Text style={styles.heading}>Progress</Text>
      <Text style={styles.sub}>Stored locally. No account.</Text>

      <StreakBadge streak={dailyStreak} celebrate={dailyStreak > 1} />

      <View style={styles.grid}>
        <Stat label="Drills done" value={String(drillsCompleted)} wide={!compact} />
        <Stat label="Accuracy" value={`${accuracy}%`} wide={!compact} />
        <Stat label="Saves" value={String(blundersAvoided)} wide={!compact} />
        <Stat label="Blunders" value={String(blundersMade)} wide={!compact} />
        <Stat label="Practice moves" value={String(practiceMoves)} wide={!compact} />
        <Stat label="Best streak" value={String(recordStreak)} wide={!compact} />
      </View>

      <Button label="Reset local progress" variant="secondary" onPress={() => setConfirmReset(true)} />

      <Dialog visible={confirmReset}>
        <Text style={styles.dialogTitle}>Reset progress?</Text>
        <Text style={styles.dialogBody}>
          Streaks, drill results, and practice counts on this device will go back to zero.
        </Text>
        <Button
          label="Reset"
          variant="danger"
          onPress={() => {
            resetProgress();
            setConfirmReset(false);
          }}
        />
        <Button label="Cancel" variant="ghost" onPress={() => setConfirmReset(false)} />
      </Dialog>
    </Screen>
  );
}

function Stat({ label, value, wide }: { label: string; value: string; wide: boolean }) {
  return (
    <View style={[styles.stat, wide ? styles.statWide : styles.statFull]}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  eyebrow: {
    fontFamily: fonts.bodyBold,
    color: colors.accent,
    fontSize: 12,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  heading: {
    fontFamily: fonts.display,
    color: colors.text,
    fontSize: 32,
    letterSpacing: -0.5,
  },
  sub: {
    fontFamily: fonts.body,
    color: colors.textMuted,
    fontSize: 15,
    marginBottom: spacing.xs,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  stat: {
    backgroundColor: colors.bgElevated,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  statWide: {
    width: '31%',
    flexGrow: 1,
    minWidth: 140,
  },
  statFull: {
    width: '47%',
    flexGrow: 1,
  },
  statValue: {
    fontFamily: fonts.display,
    color: colors.text,
    fontSize: 30,
    letterSpacing: -0.5,
  },
  statLabel: {
    marginTop: 4,
    fontFamily: fonts.body,
    color: colors.textMuted,
    fontSize: 13,
  },
  dialogTitle: {
    fontFamily: fonts.display,
    fontSize: 24,
    color: colors.text,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  dialogBody: {
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
});
