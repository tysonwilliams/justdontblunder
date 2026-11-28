import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View, useWindowDimensions } from 'react-native';

import { AccountPrompt } from '@/src/components/auth/AccountPrompt';
import { AboutFooter } from '@/src/components/legal/AboutFooter';
import { GameImport } from '@/src/components/progress/GameImport';
import { StreakLeaderboard } from '@/src/components/progress/StreakLeaderboard';
import { MenuButton } from '@/src/components/SettingsMenu';
import { controlA11y } from '@/src/components/ui/a11y';
import { Button } from '@/src/components/ui/Button';
import { IconCheck, IconChevronDown } from '@/src/components/ui/icons';
import { ProgressTrack } from '@/src/components/ui/ProgressTrack';
import { Screen } from '@/src/components/ui/Screen';
import { Bone } from '@/src/components/ui/Skeleton';
import { forceSkeleton } from '@/src/components/ui/skeletonMode';
import { text } from '@/src/components/ui/text';
import { useLayout } from '@/src/components/ui/useLayout';
import { drillHref } from '@/src/logic/drillLink';
import { themeLabel, weakestTheme, type DrillTheme } from '@/src/logic/drills';
import { addLocalDays, localDateKey } from '@/src/logic/localDate';
import { dueTodayCount, dueTodayLabel, isDue } from '@/src/logic/reviewSchedule';
import { ALL_LESSONS } from '@/src/logic/lessons';
import { drillsDoneCount } from '@/src/store/drillStats';
import { activeDailyStreak } from '@/src/store/slices/training';
import { useProgressStore } from '@/src/store/progress';
import { useHydrated } from '@/src/store/useHydrated';
import { useTheme } from '@/src/theme/useTheme';
import { themedStyleSheet } from '@/src/theme/themed';
import { metadataFor } from '@/src/seo/site';
import { fonts, fontSizes, lineHeights, radii, spacing } from '@/src/theme';

export function generateMetadata() {
  return metadataFor('/progress');
}

const THEMES = ['hanging', 'fork', 'pin', 'back_rank', 'missed_mate'] as const;
const DAY_INITIALS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const;

export default function ProgressScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { phone, topNav } = useLayout();
  const wideGrid = width >= 820;
  const { colors } = useTheme();
  const progressReady = useHydrated(useProgressStore.persist) && !forceSkeleton();
  const [showAllStats, setShowAllStats] = useState(false);

  const dailyStreak = useProgressStore((s) => s.dailyStreak);
  const lastDrillDate = useProgressStore((s) => s.lastDrillDate);
  const dailyHistory = useProgressStore((s) => s.dailyHistory);
  const recordStreak = useProgressStore((s) => s.recordStreak);
  const bestPuzzleStreak = useProgressStore((s) => s.bestPuzzleStreak);
  const review = useProgressStore((s) => s.review);
  const drillsCompleted = useProgressStore((s) => s.drillsCompleted);
  const drillsCorrect = useProgressStore((s) => s.drillsCorrect);
  const blundersAvoided = useProgressStore((s) => s.blundersAvoided);
  const blundersMade = useProgressStore((s) => s.blundersMade);
  const practiceMoves = useProgressStore((s) => s.practiceMoves);
  const themeStats = useProgressStore((s) => s.themeStats);
  const completedLessons = useProgressStore((s) => s.completedLessons);
  const xp = useProgressStore((s) => s.xp);
  const gameProfile = useProgressStore((s) => s.gameProfile);
  const ownDrillsCount = useProgressStore((s) => s.ownDrills.length);

  const today = localDateKey();
  const liveStreak = activeDailyStreak(dailyStreak, lastDrillDate);
  const accuracy = drillsCompleted > 0 ? Math.round((drillsCorrect / drillsCompleted) * 100) : 0;
  const dueCount = dueTodayCount(review, today);
  const reviewWaiting = review.length > 0;
  const weak = weakestTheme(themeStats);
  const badges = badgeList(liveStreak, recordStreak, bestPuzzleStreak, blundersAvoided);
  const earnedCount = badges.filter((badge) => badge.earned).length;
  const hoistImportOnPhone = phone && progressReady && !gameProfile && ownDrillsCount === 0;

  const last7 = summarizeLast7Days(dailyHistory, today);
  const srs = summarizeReviewMastery(review, today);

  return (
    <Screen>
      <View style={styles.page}>
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={text.eyebrow}>Progress</Text>
            <Text style={phone ? text.title : text.display}>Your training</Text>
          </View>
          <View style={styles.headerActions}>
            {progressReady && reviewWaiting ? (
              <Button
                compact
                fullWidth={false}
                label={dueCount > 0 ? dueTodayLabel(dueCount) : 'Review ahead'}
                variant={dueCount > 0 ? 'primary' : 'secondary'}
                onPress={() => router.push(drillHref('review') as Href)}
              />
            ) : null}
            {!topNav ? <MenuButton compact={phone} /> : null}
          </View>
        </View>

        <AccountPrompt />

        <View style={styles.heroCard}>
          {progressReady ? (
            <>
              <View style={styles.heroRow}>
                <HeroStat label="Day streak" value={String(liveStreak)} highlight={liveStreak > 0} />
                <HeroStat label="XP" value={String(xp)} />
                <HeroStat label="Accuracy" value={drillsCompleted > 0 ? `${accuracy}%` : '—'} />
                <HeroStat label="Best run" value={String(bestPuzzleStreak)} />
              </View>
              <View style={styles.weekWrap} testID="progress-week-activity">
                <View style={styles.weekHead}>
                  <Text style={styles.weekLabel}>Last 7 days</Text>
                  <Text style={styles.weekMeta}>
                    {last7.weekDone > 0
                      ? `${last7.weekDone} drills · ${last7.weekPct}% safe`
                      : 'No drills yet this week'}
                  </Text>
                </View>
                <View style={styles.weekBars}>
                  {last7.days.map((day) => {
                    const heightPct = day.done > 0 ? Math.max(24, Math.round((day.done / last7.maxDone) * 100)) : 12;
                    return (
                      <View key={day.key} style={styles.dayCol}>
                        <View style={styles.dayBarTrack}>
                          <View
                            style={[
                              styles.dayBarFill,
                              day.done > 0 ? styles.dayBarActive : styles.dayBarIdle,
                              { height: `${heightPct}%` },
                            ]}
                          />
                        </View>
                        <Text style={[styles.dayLabel, day.isToday && styles.dayLabelToday]}>{day.label}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>
              {showAllStats ? (
                <View style={styles.extraStats}>
                  <ExtraStat label="Lessons" value={`${completedLessons.length}/${ALL_LESSONS.length}`} />
                  <ExtraStat label="Drills done" value={String(drillsDoneCount(drillsCompleted))} />
                  <ExtraStat label="Saves" value={String(blundersAvoided)} />
                  <ExtraStat label="Blunders" value={String(blundersMade)} />
                  <ExtraStat label="Practice moves" value={String(practiceMoves)} />
                  <ExtraStat label="Best day streak" value={String(recordStreak)} />
                </View>
              ) : null}
              <Pressable
                {...controlA11y('button', showAllStats ? 'Hide breakdown' : 'More stats', showAllStats)}
                testID="progress-more-stats"
                onPress={() => setShowAllStats((current) => !current)}
                style={(state) => {
                  const hovered = 'hovered' in state && Boolean(state.hovered);
                  return [styles.expandRow, (hovered || state.pressed) && styles.expandRowHover];
                }}>
                <Text style={styles.expandLabel}>{showAllStats ? 'Hide breakdown' : 'More stats'}</Text>
                <View style={showAllStats ? styles.chevronUp : undefined}>
                  <IconChevronDown color={colors.textMuted} size={14} />
                </View>
              </Pressable>
            </>
          ) : (
            <View style={styles.heroRow}>
              <Bone width="22%" height={48} radius={radii.md} />
              <Bone width="22%" height={48} radius={radii.md} />
              <Bone width="22%" height={48} radius={radii.md} />
              <Bone width="22%" height={48} radius={radii.md} />
            </View>
          )}
        </View>

        {hoistImportOnPhone ? <GameImport /> : null}

        <View style={[styles.columns, wideGrid && styles.columnsWide]}>
          <View style={styles.col}>
            {progressReady && srs.total > 0 ? (
              <View style={styles.card} testID="progress-srs-mastery">
                <View style={styles.cardHead}>
                  <Text style={text.section}>Spaced review</Text>
                  <Text style={text.muted}>{srs.total} tracked</Text>
                </View>
                <View style={styles.srsRow}>
                  <View style={styles.srsCell}>
                    <Text style={[styles.srsValue, srs.due > 0 && styles.srsDue]}>{srs.due}</Text>
                    <Text style={styles.srsLabel}>Due now</Text>
                  </View>
                  <View style={styles.srsCell}>
                    <Text style={styles.srsValue}>{srs.learning}</Text>
                    <Text style={styles.srsLabel}>Learning</Text>
                  </View>
                  <View style={styles.srsCell}>
                    <Text style={[styles.srsValue, srs.mastered > 0 && styles.srsMastered]}>{srs.mastered}</Text>
                    <Text style={styles.srsLabel}>Mastered</Text>
                  </View>
                </View>
              </View>
            ) : null}

            <View style={styles.card}>
              <View style={styles.cardHead}>
                <Text style={text.section}>Themes</Text>
                <Text style={text.muted}>Tap to drill</Text>
              </View>
              {progressReady ? (
                <View style={styles.themeList}>
                  {THEMES.map((theme) => (
                    <ThemeRow
                      key={theme}
                      theme={theme}
                      tally={themeStats[theme]}
                      focus={weak === theme}
                      onPress={() => router.push(drillHref('play', theme) as Href)}
                    />
                  ))}
                </View>
              ) : (
                <View style={styles.themeList}>
                  {THEMES.map((theme) => (
                    <Bone key={theme} height={28} radius={radii.sm} />
                  ))}
                </View>
              )}
            </View>

            <View style={styles.card}>
              <View style={styles.cardHead}>
                <Text style={text.section}>Badges</Text>
                <Text style={text.muted}>
                  {earnedCount}/{badges.length}
                </Text>
              </View>
              <View style={styles.badgeWrap}>
                {progressReady
                  ? badges.map((badge) => (
                      <View
                        key={badge.title}
                        style={[styles.badgePill, badge.earned ? styles.badgeOn : styles.badgeOff]}>
                        {badge.earned ? <IconCheck color={colors.accent} size={14} /> : null}
                        <Text style={[styles.badgeTitle, badge.earned && styles.badgeTitleOn]}>{badge.title}</Text>
                        <Text style={styles.badgeDetail}>{badge.detail}</Text>
                      </View>
                    ))
                  : badges.map((badge) => <Bone key={badge.title} width={110} height={34} radius={radii.pill} />)}
              </View>
            </View>
          </View>

          <View style={styles.col}>
            {hoistImportOnPhone ? null : progressReady ? (
              <GameImport />
            ) : (
              <View style={styles.card}>
                <Bone width={140} height={16} />
                <Bone height={44} radius={radii.md} />
              </View>
            )}
            <StreakLeaderboard />
          </View>
        </View>

        <AboutFooter />
      </View>
    </Screen>
  );
}

function summarizeLast7Days(
  dailyHistory: Record<string, { done: number; correct: number }>,
  today: string,
) {
  const days = Array.from({ length: 7 }, (_, i) => {
    const dateKey = addLocalDays(today, i - 6);
    const [y, m, d] = dateKey.split('-').map(Number);
    const dow = new Date(y ?? 2026, (m ?? 1) - 1, d ?? 1).getDay();
    const tally = dailyHistory[dateKey];
    return {
      key: dateKey,
      label: DAY_INITIALS[dow] ?? '',
      done: tally?.done ?? 0,
      correct: tally?.correct ?? 0,
      isToday: i === 6,
    };
  });
  const maxDone = Math.max(1, ...days.map((d) => d.done));
  const weekDone = days.reduce((sum, d) => sum + d.done, 0);
  const weekCorrect = days.reduce((sum, d) => sum + d.correct, 0);
  const weekPct = weekDone > 0 ? Math.round((weekCorrect / weekDone) * 100) : null;
  return { days, maxDone, weekDone, weekPct };
}

function summarizeReviewMastery(
  review: readonly { intervalDays: number; dueOn: string }[],
  today: string,
) {
  let due = 0;
  let learning = 0;
  let mastered = 0;
  for (const entry of review) {
    if (isDue(entry, today)) due += 1;
    else if (entry.intervalDays >= 16) mastered += 1;
    else learning += 1;
  }
  return { due, learning, mastered, total: review.length };
}

function badgeList(
  dailyStreak: number,
  recordStreak: number,
  bestPuzzleStreak: number,
  saves: number,
): { title: string; detail: string; earned: boolean }[] {
  const days = Math.max(dailyStreak, recordStreak);
  return [
    { title: 'First save', detail: '1 save', earned: saves >= 1 },
    { title: 'On a roll', detail: '3 days', earned: days >= 3 },
    { title: 'Week', detail: '7 days', earned: days >= 7 },
    { title: 'Hot run', detail: '5 in a row', earned: bestPuzzleStreak >= 5 },
    { title: 'Flawless', detail: '10 in a row', earned: bestPuzzleStreak >= 10 },
  ];
}

function HeroStat({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={styles.heroStat}>
      <Text style={[text.stat, highlight && styles.heroHighlight]}>{value}</Text>
      <Text style={styles.heroLabel} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function ExtraStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.extraCell}>
      <Text style={styles.extraValue}>{value}</Text>
      <Text style={styles.extraLabel} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function ThemeRow({
  theme,
  tally,
  focus = false,
  onPress,
}: {
  theme: DrillTheme;
  tally: { attempts: number; correct: number } | undefined;
  focus?: boolean;
  onPress: () => void;
}) {
  const attempts = tally?.attempts ?? 0;
  const correct = tally?.correct ?? 0;
  const ratio = attempts > 0 ? correct / attempts : 0;
  const pct = attempts > 0 ? `${Math.round(ratio * 100)}%` : '—';
  const name = themeLabel(theme);
  return (
    <Pressable
      {...controlA11y('button', `Drill ${name}`)}
      testID={`progress-theme-${theme}`}
      onPress={onPress}
      style={(state) => {
        const hovered = 'hovered' in state && Boolean(state.hovered);
        return [styles.themeRow, (hovered || state.pressed) && styles.themeRowHover];
      }}>
      <View style={styles.themeTop}>
        <View style={styles.themeTitleRow}>
          <Text style={styles.themeName}>{name}</Text>
          {focus ? <Text style={styles.themeFocus}>Focus</Text> : null}
        </View>
        <Text style={styles.themeMeta}>
          {attempts === 0 ? 'Not started' : `${pct} · ${correct}/${attempts}`}
        </Text>
      </View>
      <ProgressTrack progress={ratio} />
    </Pressable>
  );
}

const styles = themedStyleSheet((colors) => ({
  page: {
    width: '100%',
    gap: spacing.md,
    paddingBottom: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
    gap: spacing[2],
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexShrink: 0,
  },
  heroCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing[12],
  },
  heroRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  heroStat: {
    flex: 1,
    minWidth: 72,
    gap: spacing[2],
  },
  heroHighlight: {
    color: colors.accent,
  },
  heroLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes[13],
    lineHeight: lineHeights[18],
    color: colors.textMuted,
  },
  weekWrap: {
    gap: spacing[8],
    paddingTop: spacing[12],
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  weekHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  weekLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes[13],
    lineHeight: lineHeights[18],
    color: colors.text,
  },
  weekMeta: {
    fontFamily: fonts.body,
    fontSize: fontSizes[12],
    lineHeight: lineHeights[16],
    color: colors.textMuted,
  },
  weekBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing[8],
  },
  dayCol: {
    flex: 1,
    alignItems: 'center',
    gap: spacing[4],
  },
  dayBarTrack: {
    width: '100%',
    maxWidth: 28,
    height: 36,
    justifyContent: 'flex-end',
    borderRadius: radii.sm,
    backgroundColor: colors.background,
    overflow: 'hidden',
  },
  dayBarFill: {
    width: '100%',
    borderRadius: radii.sm,
  },
  dayBarActive: {
    backgroundColor: colors.accent,
  },
  dayBarIdle: {
    backgroundColor: colors.border,
  },
  dayLabel: {
    fontFamily: fonts.body,
    fontSize: fontSizes[11],
    lineHeight: lineHeights[14],
    color: colors.textDim,
  },
  dayLabelToday: {
    fontFamily: fonts.bodyBold,
    color: colors.text,
  },
  srsRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: spacing.sm,
  },
  srsCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing[10],
    paddingHorizontal: spacing[8],
    borderRadius: radii.md,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing[2],
  },
  srsValue: {
    fontFamily: fonts.display,
    fontSize: fontSizes[20],
    lineHeight: lineHeights[24],
    color: colors.text,
  },
  srsDue: {
    color: colors.accent,
  },
  srsMastered: {
    color: colors.success,
  },
  srsLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes[12],
    lineHeight: lineHeights[16],
    color: colors.textMuted,
  },
  extraStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[12],
    paddingTop: spacing[12],
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  extraCell: {
    width: '30%',
    minWidth: 96,
    flexGrow: 1,
    gap: spacing[2],
  },
  extraValue: {
    fontFamily: fonts.display,
    fontSize: fontSizes[18],
    lineHeight: lineHeights[22],
    color: colors.text,
  },
  extraLabel: {
    fontFamily: fonts.body,
    fontSize: fontSizes[13],
    lineHeight: lineHeights[18],
    color: colors.textMuted,
  },
  expandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[6],
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    cursor: 'pointer',
  },
  expandRowHover: {
    opacity: 0.8,
  },
  expandLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes[13],
    lineHeight: lineHeights[18],
    color: colors.textMuted,
  },
  chevronUp: {
    transform: [{ rotate: '180deg' }],
  },
  columns: {
    gap: spacing.md,
  },
  columnsWide: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  col: {
    flex: 1,
    minWidth: 0,
    gap: spacing.md,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing[12],
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  themeList: {
    gap: spacing[6],
  },
  themeRow: {
    gap: spacing[6],
    paddingVertical: spacing[6],
    paddingHorizontal: spacing.sm,
    marginHorizontal: -spacing.sm,
    borderRadius: radii.md,
    cursor: 'pointer',
  },
  themeRowHover: {
    backgroundColor: colors.hover,
  },
  themeTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  themeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[6],
    flexShrink: 1,
  },
  themeFocus: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes[11],
    lineHeight: lineHeights[14],
    color: colors.accent,
    backgroundColor: colors.accentSoft,
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[1],
    borderRadius: radii.pill,
    overflow: 'hidden',
  },
  themeName: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes[14],
    lineHeight: lineHeights[20],
    color: colors.text,
  },
  themeMeta: {
    fontFamily: fonts.body,
    fontSize: fontSizes[13],
    lineHeight: lineHeights[18],
    color: colors.textMuted,
  },
  badgeWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[6],
    paddingHorizontal: spacing[12],
    paddingVertical: spacing[6],
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  badgeOn: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  badgeOff: {
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  badgeTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes[13],
    lineHeight: lineHeights[18],
    color: colors.textMuted,
  },
  badgeTitleOn: {
    color: colors.text,
  },
  badgeDetail: {
    fontFamily: fonts.body,
    fontSize: fontSizes[12],
    lineHeight: lineHeights[16],
    color: colors.textDim,
  },
}));
