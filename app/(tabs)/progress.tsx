import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { StreakBadge } from '@/src/components/StreakBadge';
import { Button } from '@/src/components/ui/Button';
import { Dialog } from '@/src/components/ui/Dialog';
import { Screen } from '@/src/components/ui/Screen';
import { themeLabel, type DrillTheme } from '@/src/logic/drills';
import { drillsDoneCount } from '@/src/store/drillStats';
import { missesForDate, useProgressStore } from '@/src/store/progress';
import { colors, fonts, radii, spacing } from '@/src/theme';

export default function ProgressScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const compact = width < 520;
  const [confirmReset, setConfirmReset] = useState(false);
  const {
    dailyStreak,
    recordStreak,
    bestPuzzleStreak,
    missedDate,
    missedIds,
    drillsCompleted,
    drillsCorrect,
    blundersAvoided,
    blundersMade,
    practiceMoves,
    themeStats,
    resetProgress,
  } = useProgressStore();

  const accuracy = drillsCompleted > 0 ? Math.round((drillsCorrect / drillsCompleted) * 100) : 0;
  const missCount = missesForDate(missedDate, missedIds).length;

  return (
    <Screen maxWidth={760}>
      <Text style={styles.eyebrow}>This device</Text>
      <Text style={styles.heading}>Progress</Text>
      <Text style={styles.sub}>Stored locally. No account.</Text>

      {dailyStreak > 0 ? (
        <StreakBadge streak={dailyStreak} celebrate={dailyStreak > 1} />
      ) : (
        <Text style={styles.zero}>No streak yet. Finish a drill to start one.</Text>
      )}

      <View style={styles.categories}>
        {(['hanging', 'fork', 'pin', 'back_rank', 'missed_mate'] as const).map((theme) => (
          <CategoryStat key={theme} theme={theme} tally={themeStats[theme]} wide={!compact} />
        ))}
      </View>

      <View style={styles.badges}>
        {badgeList(dailyStreak, recordStreak, bestPuzzleStreak, blundersAvoided).map((badge) => (
          <View
            key={badge.title}
            style={[styles.badge, badge.earned ? styles.badgeOn : styles.badgeOff]}>
            <Text style={[styles.badgeState, badge.earned ? styles.badgeStateOn : styles.badgeStateOff]}>
              {badge.earned ? 'Earned' : 'Locked'}
            </Text>
            <Text style={[styles.badgeTitle, !badge.earned && styles.badgeTitleOff]}>{badge.title}</Text>
            <Text style={[styles.badgeDetail, badge.earned && styles.badgeDetailOn]}>{badge.detail}</Text>
          </View>
        ))}
      </View>

      <View style={styles.grid}>
        <Stat label="Drills done" value={String(drillsDoneCount(drillsCorrect))} wide={!compact} />
        <Stat label="Accuracy" value={`${accuracy}%`} wide={!compact} />
        <Stat label="Saves" value={String(blundersAvoided)} wide={!compact} />
        <Stat label="Blunders" value={String(blundersMade)} wide={!compact} />
        <Stat label="Practice moves" value={String(practiceMoves)} wide={!compact} />
        <Stat label="Best day streak" value={String(recordStreak)} wide={!compact} />
        <Stat label="Best run" value={String(bestPuzzleStreak)} wide={!compact} />
      </View>

      <Button
        label={missCount > 0 ? `Review today's misses (${missCount})` : 'No misses today'}
        variant={missCount > 0 ? 'primary' : 'secondary'}
        onPress={() => {
          if (missCount === 0) return;
          router.push('/learn?review=1');
        }}
      />

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

function badgeList(
  dailyStreak: number,
  recordStreak: number,
  bestPuzzleStreak: number,
  saves: number,
): { title: string; detail: string; earned: boolean }[] {
  const days = Math.max(dailyStreak, recordStreak);
  return [
    { title: 'First save', detail: 'Save a piece', earned: saves >= 1 },
    { title: 'On a roll', detail: '3-day streak', earned: days >= 3 },
    { title: 'Week', detail: '7-day streak', earned: days >= 7 },
    { title: 'Hot run', detail: '5 in a row', earned: bestPuzzleStreak >= 5 },
    { title: 'Flawless', detail: '10 in a row', earned: bestPuzzleStreak >= 10 },
  ];
}

function CategoryStat({
  theme,
  tally,
  wide,
}: {
  theme: DrillTheme;
  tally: { attempts: number; correct: number } | undefined;
  wide: boolean;
}) {
  const attempts = tally?.attempts ?? 0;
  const correct = tally?.correct ?? 0;
  const accuracy = attempts > 0 ? Math.round((correct / attempts) * 100) : 0;
  return (
    <View style={[styles.stat, wide ? styles.statWide : styles.statFull]}>
      <Text style={styles.statValue}>{attempts === 0 ? '—' : `${accuracy}%`}</Text>
      <Text style={styles.statLabel}>
        {themeLabel(theme)}
        {attempts === 0 ? ' · not started' : ` · ${correct}/${attempts}`}
      </Text>
    </View>
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
  zero: {
    fontFamily: fonts.bodyBold,
    color: colors.text,
    fontSize: 16,
  },
  categories: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  eyebrow: {
    fontFamily: fonts.bodyBold,
    color: colors.accent,
    fontSize: 14,
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
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  badge: {
    borderRadius: radii.md,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minWidth: 108,
  },
  badgeOn: {
    borderColor: colors.accent,
    backgroundColor: colors.accent,
  },
  badgeOff: {
    borderStyle: 'dashed',
    borderColor: colors.textDim,
    backgroundColor: 'transparent',
  },
  badgeState: {
    fontFamily: fonts.bodyExtra,
    fontSize: 14,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  badgeStateOn: {
    color: colors.accentText,
  },
  badgeStateOff: {
    color: colors.textMuted,
  },
  badgeTitle: {
    fontFamily: fonts.bodyExtra,
    color: colors.accentText,
    fontSize: 16,
  },
  badgeTitleOff: {
    color: colors.text,
  },
  badgeDetail: {
    marginTop: 2,
    fontFamily: fonts.body,
    color: colors.textMuted,
    fontSize: 15,
  },
  badgeDetailOn: {
    color: colors.accentText,
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
    fontSize: 15,
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
