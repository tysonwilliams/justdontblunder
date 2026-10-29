import { Link } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { StreakBadge } from '@/src/components/StreakBadge';
import { tipsOfTheDay } from '@/src/logic/drills';
import { useProgressStore } from '@/src/store/progress';
import { colors, fonts, radii, spacing } from '@/src/theme';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const streak = useProgressStore((s) => s.dailyStreak);
  const drillsCompleted = useProgressStore((s) => s.drillsCompleted);
  const blundersAvoided = useProgressStore((s) => s.blundersAvoided);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.xl },
      ]}>
      <Text style={styles.brand}>Just Don't Blunder</Text>
      <Text style={styles.tagline}>
        Train your eyes on YOUR pieces — spot what is hanging and save it before you blunder.
      </Text>

      <View style={styles.heroBlock}>
        <StreakBadge streak={streak} celebrate={streak > 0} />
        <Text style={styles.tip}>{tipsOfTheDay()}</Text>
      </View>

      <Link href="/train" asChild>
        <Pressable style={styles.primaryCta}>
          <Text style={styles.primaryCtaText}>Start daily drills</Text>
          <Text style={styles.primaryCtaSub}>5–10 minutes · save your hanging pieces</Text>
        </Pressable>
      </Link>

      <View style={styles.row}>
        <Link href="/practice" asChild>
          <Pressable style={styles.secondaryCta}>
            <Text style={styles.secondaryTitle}>Practice board</Text>
            <Text style={styles.secondarySub}>Checklist + instant feedback</Text>
          </Pressable>
        </Link>
        <Link href="/progress" asChild>
          <Pressable style={styles.secondaryCta}>
            <Text style={styles.secondaryTitle}>Your progress</Text>
            <Text style={styles.secondarySub}>
              {drillsCompleted} drills · {blundersAvoided} saves
            </Text>
          </Pressable>
        </Link>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  brand: {
    fontFamily: fonts.display,
    fontSize: 36,
    color: colors.text,
    letterSpacing: -0.5,
  },
  tagline: {
    fontFamily: fonts.body,
    fontSize: 16,
    lineHeight: 24,
    color: colors.textMuted,
    maxWidth: 420,
  },
  heroBlock: {
    marginTop: spacing.sm,
    backgroundColor: colors.bgElevated,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
    alignItems: 'flex-start',
  },
  tip: {
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22,
    color: colors.text,
  },
  primaryCta: {
    backgroundColor: colors.accent,
    borderRadius: radii.md,
    paddingVertical: 18,
    paddingHorizontal: spacing.lg,
  },
  primaryCtaText: {
    fontFamily: fonts.bodyExtra,
    fontSize: 18,
    color: '#042016',
  },
  primaryCtaSub: {
    marginTop: 4,
    fontFamily: fonts.body,
    fontSize: 13,
    color: 'rgba(4,32,22,0.75)',
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  secondaryCta: {
    flex: 1,
    backgroundColor: colors.bgSoft,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    minHeight: 96,
    justifyContent: 'center',
  },
  secondaryTitle: {
    fontFamily: fonts.bodyBold,
    color: colors.text,
    fontSize: 15,
  },
  secondarySub: {
    marginTop: 4,
    fontFamily: fonts.body,
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
});
