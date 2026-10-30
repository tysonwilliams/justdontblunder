import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { StreakBadge } from '@/src/components/StreakBadge';
import { Button } from '@/src/components/ui/Button';
import { ColorLegend } from '@/src/components/ui/ColorLegend';
import { Dialog } from '@/src/components/ui/Dialog';
import { Screen } from '@/src/components/ui/Screen';
import { HABIT_PROMPT, tipsOfTheDay } from '@/src/logic/drills';
import { drillsDoneCount } from '@/src/store/drillStats';
import { missesForDate, useProgressStore } from '@/src/store/progress';
import { colors, fonts, radii, spacing } from '@/src/theme';

export default function HomeScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const stacked = width < 720;
  const [hydrated, setHydrated] = useState(() => useProgressStore.persist.hasHydrated());
  const streak = useProgressStore((s) => s.dailyStreak);
  const drillsCorrect = useProgressStore((s) => s.drillsCorrect);
  const blundersAvoided = useProgressStore((s) => s.blundersAvoided);
  const habitTutorialDone = useProgressStore((s) => s.habitTutorialDone);
  const completeHabitTutorial = useProgressStore((s) => s.completeHabitTutorial);
  const missedDate = useProgressStore((s) => s.missedDate);
  const missedIds = useProgressStore((s) => s.missedIds);
  const missCount = missesForDate(missedDate, missedIds).length;
  const fresh = drillsCorrect === 0 && blundersAvoided === 0 && streak === 0;

  useEffect(() => {
    const unsub = useProgressStore.persist.onFinishHydration(() => setHydrated(true));
    if (useProgressStore.persist.hasHydrated()) setHydrated(true);
    return () => {
      unsub();
    };
  }, []);

  return (
    <Screen maxWidth={960}>
      <Text style={styles.eyebrow}>Daily trainer</Text>
      <Text style={styles.brand}>Just Don't Blunder</Text>
      <Text style={styles.tagline}>
        The habit is simple: stop hanging pieces. Look at your own side before you move.
      </Text>

      <View style={styles.hero}>
        <Text style={styles.habit}>{HABIT_PROMPT}</Text>
        <Text style={styles.habitBody}>
          A piece is hanging when the other side can take it and you come out behind. Ask that
          once for the pieces already on the board, and once for the move you are about to play.
        </Text>
        <ColorLegend />
        {hydrated && streak > 0 ? (
          <StreakBadge streak={streak} celebrate={streak > 0} />
        ) : (
          <Text style={styles.zero}>No streak yet. Solve a drill today to start one.</Text>
        )}
        <Text style={styles.tip}>{tipsOfTheDay()}</Text>
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={() => router.push('/learn')}
        style={({ pressed }) => [styles.primary, pressed && styles.primaryOn]}>
        <Text style={styles.primaryText}>Start learning</Text>
        <Text style={styles.primarySub}>Save the piece that is under fire</Text>
      </Pressable>

      <View style={[styles.row, stacked && styles.rowStacked]}>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/practice')}
          style={({ pressed }) => [styles.card, pressed && styles.cardOn]}>
          <Text style={styles.cardTitle}>Practice</Text>
          <Text style={styles.cardSub}>Play White. Black takes whatever you hang.</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/progress')}
          style={({ pressed }) => [styles.card, pressed && styles.cardOn]}>
          <Text style={styles.cardTitle}>Your progress</Text>
          <Text style={styles.cardSub}>
            {fresh || !hydrated
              ? 'Nothing saved yet'
              : `${drillsDoneCount(drillsCorrect)} drills · ${blundersAvoided} saves`}
          </Text>
        </Pressable>
      </View>

      {hydrated && missCount > 0 ? (
        <Button
          label={`Review today's misses (${missCount})`}
          onPress={() => router.push('/learn?review=1')}
        />
      ) : null}

      <Dialog visible={hydrated && !habitTutorialDone}>
        <Text style={styles.dialogTitle}>What “hanging” means</Text>
        <Text style={styles.dialogBody}>
          A piece is hanging when your opponent can take it and you lose material — it has no
          defender, or a cheaper piece attacks it. Before every move, ask: is anything of mine
          hanging? Will this move leave something hanging?
        </Text>
        <Button label="I'll watch my pieces" onPress={completeHabitTutorial} />
      </Dialog>
    </Screen>
  );
}

const styles = StyleSheet.create({
  eyebrow: {
    fontFamily: fonts.bodyBold,
    color: colors.accent,
    fontSize: 14,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  brand: {
    fontFamily: fonts.display,
    fontSize: 40,
    lineHeight: 46,
    color: colors.text,
    letterSpacing: -0.8,
  },
  tagline: {
    fontFamily: fonts.body,
    fontSize: 18,
    lineHeight: 28,
    color: colors.text,
    maxWidth: 640,
    marginBottom: spacing.xs,
  },
  hero: {
    backgroundColor: colors.bgElevated,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    padding: spacing.lg,
    gap: spacing.md,
    alignItems: 'flex-start',
  },
  habit: {
    fontFamily: fonts.display,
    color: colors.warn,
    fontSize: 26,
    lineHeight: 32,
    letterSpacing: -0.3,
  },
  habitBody: {
    fontFamily: fonts.body,
    color: colors.text,
    fontSize: 16,
    lineHeight: 24,
  },
  zero: {
    fontFamily: fonts.bodyBold,
    color: colors.text,
    fontSize: 16,
    lineHeight: 22,
  },
  tip: {
    fontFamily: fonts.body,
    fontSize: 16,
    lineHeight: 24,
    color: colors.textMuted,
  },
  primary: {
    backgroundColor: colors.accent,
    borderRadius: radii.md,
    paddingVertical: 16,
    paddingHorizontal: spacing.lg,
    cursor: 'pointer',
  },
  primaryOn: {
    backgroundColor: colors.accentPressed,
  },
  primaryText: {
    fontFamily: fonts.bodyExtra,
    fontSize: 18,
    color: colors.accentText,
  },
  primarySub: {
    marginTop: 4,
    fontFamily: fonts.bodyBold,
    fontSize: 15,
    color: colors.accentText,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  rowStacked: {
    flexDirection: 'column',
  },
  card: {
    flex: 1,
    backgroundColor: colors.bgElevated,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    padding: spacing.md,
    minHeight: 108,
    justifyContent: 'center',
    cursor: 'pointer',
  },
  cardOn: {
    backgroundColor: colors.bgSoft,
  },
  cardTitle: {
    fontFamily: fonts.bodyBold,
    color: colors.text,
    fontSize: 18,
  },
  cardSub: {
    marginTop: 6,
    fontFamily: fonts.body,
    color: colors.text,
    fontSize: 15,
    lineHeight: 22,
  },
  dialogTitle: {
    fontFamily: fonts.display,
    fontSize: 26,
    color: colors.text,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  dialogBody: {
    fontFamily: fonts.body,
    fontSize: 16,
    lineHeight: 24,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
});
