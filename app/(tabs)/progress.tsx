import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { StreakBadge } from '@/src/components/StreakBadge';
import { useProgressStore } from '@/src/store/progress';
import { colors, fonts, radii, spacing } from '@/src/theme';

export default function ProgressScreen() {
  const insets = useSafeAreaInsets();
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

  const accuracy =
    drillsCompleted > 0 ? Math.round((drillsCorrect / drillsCompleted) * 100) : 0;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.xl },
      ]}>
      <Text style={styles.heading}>Progress</Text>
      <Text style={styles.sub}>Local only — no account required.</Text>

      <StreakBadge streak={dailyStreak} celebrate={dailyStreak > 1} />

      <View style={styles.grid}>
        <Stat label="Drills done" value={String(drillsCompleted)} />
        <Stat label="Drill accuracy" value={`${accuracy}%`} />
        <Stat label="Blunders avoided" value={String(blundersAvoided)} />
        <Stat label="Blunders made" value={String(blundersMade)} />
        <Stat label="Practice moves" value={String(practiceMoves)} />
        <Stat label="Best streak" value={String(recordStreak)} />
      </View>

      <Pressable style={styles.reset} onPress={resetProgress}>
        <Text style={styles.resetText}>Reset local progress</Text>
      </Pressable>
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
    alignItems: 'stretch',
  },
  heading: {
    fontFamily: fonts.display,
    color: colors.text,
    fontSize: 28,
  },
  sub: {
    fontFamily: fonts.body,
    color: colors.textMuted,
    fontSize: 14,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  stat: {
    width: '47%',
    backgroundColor: colors.bgElevated,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  statValue: {
    fontFamily: fonts.display,
    color: colors.text,
    fontSize: 28,
  },
  statLabel: {
    marginTop: 4,
    fontFamily: fonts.body,
    color: colors.textMuted,
    fontSize: 13,
  },
  reset: {
    marginTop: spacing.md,
    alignItems: 'center',
    paddingVertical: 12,
  },
  resetText: {
    fontFamily: fonts.bodyBold,
    color: colors.danger,
  },
});
