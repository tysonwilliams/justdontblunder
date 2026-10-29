import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { StreakBadge } from '@/src/components/StreakBadge';
import { Screen } from '@/src/components/ui/Screen';
import { tipsOfTheDay } from '@/src/logic/drills';
import { useProgressStore } from '@/src/store/progress';
import { colors, fonts, radii, spacing } from '@/src/theme';

export default function HomeScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const stacked = width < 640;
  const streak = useProgressStore((s) => s.dailyStreak);
  const drillsCompleted = useProgressStore((s) => s.drillsCompleted);
  const blundersAvoided = useProgressStore((s) => s.blundersAvoided);

  return (
    <Screen maxWidth={760}>
      <Text style={styles.eyebrow}>Daily trainer</Text>
      <Text style={styles.brand}>Just Don't Blunder</Text>
      <Text style={styles.tagline}>
        Train your eyes on your own pieces. Spot what is hanging and save it before the point is gone.
      </Text>

      <View style={styles.hero}>
        <StreakBadge streak={streak} celebrate={streak > 0} />
        <Text style={styles.tip}>{tipsOfTheDay()}</Text>
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={() => router.push('/train')}
        style={({ pressed }) => [styles.primary, pressed && styles.primaryOn]}>
        <Text style={styles.primaryText}>Start daily drills</Text>
        <Text style={styles.primarySub}>About 5 minutes · save the piece under fire</Text>
      </Pressable>

      <View style={[styles.row, stacked && styles.rowStacked]}>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/practice')}
          style={({ pressed }) => [styles.card, pressed && styles.cardOn]}>
          <Text style={styles.cardTitle}>Practice board</Text>
          <Text style={styles.cardSub}>
            Run the checklist, then move. Instant feedback if something hangs.
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/progress')}
          style={({ pressed }) => [styles.card, pressed && styles.cardOn]}>
          <Text style={styles.cardTitle}>Your progress</Text>
          <Text style={styles.cardSub}>
            {drillsCompleted} drills · {blundersAvoided} saves
          </Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  eyebrow: {
    fontFamily: fonts.bodyBold,
    color: colors.accent,
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  brand: {
    fontFamily: fonts.display,
    fontSize: 40,
    lineHeight: 44,
    color: colors.text,
    letterSpacing: -0.8,
  },
  tagline: {
    fontFamily: fonts.body,
    fontSize: 17,
    lineHeight: 26,
    color: colors.textMuted,
    maxWidth: 520,
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
  tip: {
    fontFamily: fonts.body,
    fontSize: 16,
    lineHeight: 24,
    color: colors.text,
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
    marginTop: 3,
    fontFamily: fonts.body,
    fontSize: 13,
    color: 'rgba(20, 33, 12, 0.72)',
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
    fontSize: 16,
  },
  cardSub: {
    marginTop: 6,
    fontFamily: fonts.body,
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
});
