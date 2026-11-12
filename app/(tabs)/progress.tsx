import { useRouter, type Href } from 'expo-router';
import { Children, type ReactNode, useState } from 'react';
import { Text, View, useWindowDimensions } from 'react-native';

import { PIECE_CREDIT } from '@/src/components/Board/pieceCredit';
import { GameImport } from '@/src/components/progress/GameImport';
import { StreakBadge } from '@/src/components/StreakBadge';
import { Button } from '@/src/components/ui/Button';
import { Chip, FilterChips } from '@/src/components/ui/Chip';
import { Dialog } from '@/src/components/ui/Dialog';
import { Screen } from '@/src/components/ui/Screen';
import { SettingSwitch } from '@/src/components/ui/SettingSwitch';
import { Bone } from '@/src/components/ui/Skeleton';
import { forceSkeleton } from '@/src/components/ui/skeletonMode';
import { text } from '@/src/components/ui/text';
import { drillHref } from '@/src/logic/drillLink';
import { themeLabel, type DrillTheme } from '@/src/logic/drills';
import { LESSONS } from '@/src/logic/lessons';
import { playFeedback } from '@/src/feedback/playFeedback';
import { drillsDoneCount } from '@/src/store/drillStats';
import { useFeedbackSettings } from '@/src/store/feedbackSettings';
import { missesForDate, useProgressStore, type Experience } from '@/src/store/progress';
import { useThemePreference } from '@/src/store/themePreference';
import { useHydrated } from '@/src/store/useHydrated';
import { useTheme } from '@/src/theme/useTheme';
import { themedStyleSheet } from '@/src/theme/themed';
import type { ThemePreference } from '@/src/theme/preference';
import { fonts, fontSizes, letterSpacing, lineHeights, radii, spacing } from '@/src/theme';

const THEMES = ['hanging', 'fork', 'pin', 'back_rank', 'missed_mate'] as const;

const START: readonly { id: Experience; label: string; testID: string }[] = [
  { id: 'new', label: 'Brand new', testID: 'experience-new' },
  { id: 'basics', label: 'Know the basics', testID: 'experience-basics' },
];

const APPEARANCE: readonly { id: ThemePreference; label: string; testID: string }[] = [
  { id: 'system', label: 'System', testID: 'theme-system' },
  { id: 'light', label: 'Light', testID: 'theme-light' },
  { id: 'dark', label: 'Dark', testID: 'theme-dark' },
];

export default function ProgressScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const wideActions = width >= 720;
  const themeCols = width < 560 ? 2 : width < 980 ? 3 : 5;
  const badgeCols = width < 720 ? 2 : 5;
  const statCols = width < 560 ? 2 : width < 980 ? 3 : 4;
  useTheme();
  const preference = useThemePreference((state) => state.preference);
  const setPreference = useThemePreference((state) => state.setPreference);
  const sound = useFeedbackSettings((state) => state.sound);
  const setSound = useFeedbackSettings((state) => state.setSound);
  const haptics = useFeedbackSettings((state) => state.haptics);
  const setHaptics = useFeedbackSettings((state) => state.setHaptics);
  const progressReady = useHydrated(useProgressStore.persist) && !forceSkeleton();
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
    completedLessons,
    xp,
    experience,
    resetProgress,
    setExperience,
  } = useProgressStore();

  const accuracy = drillsCompleted > 0 ? Math.round((drillsCorrect / drillsCompleted) * 100) : 0;
  const missCount = missesForDate(missedDate, missedIds).length;
  const badges = badgeList(dailyStreak, recordStreak, bestPuzzleStreak, blundersAvoided);

  return (
    <Screen>
      <View style={styles.page}>
        <View style={styles.header}>
          <Text style={text.eyebrow}>This device</Text>
          <Text style={text.display}>Progress</Text>
          <Text style={text.muted}>Stored locally. No account.</Text>
        </View>

        <View style={styles.group}>
          <Text style={text.section}>Appearance</Text>
          <FilterChips options={APPEARANCE} value={preference} onChange={setPreference} />
          <View style={styles.toggles}>
            <SettingSwitch
              label="Sound"
              value={sound}
              testID="setting-sound"
              onChange={(next) => {
                setSound(next);
                if (next) playFeedback('save');
              }}
            />
            <SettingSwitch
              label="Haptics"
              value={haptics}
              testID="setting-haptics"
              onChange={(next) => {
                setHaptics(next);
                if (next) playFeedback('pickup');
              }}
            />
          </View>
        </View>

        <View style={styles.banner}>
          {progressReady ? (
            dailyStreak > 0 ? (
              <StreakBadge streak={dailyStreak} celebrate={dailyStreak > 1} />
            ) : (
              <Text style={text.bodyStrong}>No streak yet. Finish a drill to start one.</Text>
            )
          ) : (
            <Bone width={220} height={22} radius={radii.pill} />
          )}
        </View>

        <View style={styles.group}>
          <Text style={text.section}>Where you started</Text>
          <Text style={text.muted}>Brand new opens Learn. Know the basics opens Drills.</Text>
          <View style={[styles.toggles, styles.togglesWrap]}>
            {START.map((item) => (
              <Chip
                key={item.id}
                label={item.label}
                testID={item.testID}
                selected={experience === item.id}
                onPress={() => setExperience(item.id)}
              />
            ))}
            <Button
              label="Show the welcome again"
              variant="ghost"
              fullWidth={false}
              testID="show-welcome"
              onPress={() => {
                setExperience(null);
                router.push('/' as Href);
              }}
            />
          </View>
        </View>

        <View style={styles.group}>
          <Text style={text.section}>Themes</Text>
          <Grid columns={themeCols}>
            {progressReady
              ? THEMES.map((theme) => <CategoryStat key={theme} theme={theme} tally={themeStats[theme]} />)
              : THEMES.map((theme) => <TileBone key={theme} />)}
          </Grid>
        </View>

        <View style={styles.group}>
          <Text style={text.section}>Badges</Text>
          <Grid columns={badgeCols}>
            {progressReady
              ? badges.map((badge) => (
              <View
                key={badge.title}
                style={[styles.tile, styles.badge, badge.earned ? styles.badgeOn : styles.badgeOff]}>
                <Text style={[styles.badgeState, badge.earned ? styles.badgeStateOn : styles.badgeStateOff]}>
                  {badge.earned ? 'Earned' : 'Locked'}
                </Text>
                <Text style={styles.badgeTitle}>{badge.title}</Text>
                <Text style={[styles.badgeDetail, badge.earned && styles.badgeDetailOn]}>{badge.detail}</Text>
              </View>
            ))
              : badges.map((badge) => <TileBone key={badge.title} tall />)}
          </Grid>
        </View>

        <View style={styles.group}>
          <Text style={text.section}>Totals</Text>
          <Grid columns={statCols}>
            {progressReady
              ? [
                  <Stat key="xp" label="XP" value={String(xp)} />,
                  <Stat key="lessons" label="Lessons" value={`${completedLessons.length}/${LESSONS.length}`} />,
                  <Stat key="drills" label="Drills done" value={String(drillsDoneCount(drillsCompleted))} />,
                  <Stat key="accuracy" label="Accuracy" value={`${accuracy}%`} />,
                  <Stat key="saves" label="Saves" value={String(blundersAvoided)} />,
                  <Stat key="blunders" label="Blunders" value={String(blundersMade)} />,
                  <Stat key="practice" label="Practice moves" value={String(practiceMoves)} />,
                  <Stat key="day" label="Best day streak" value={String(recordStreak)} />,
                  <Stat key="run" label="Best run" value={String(bestPuzzleStreak)} />,
                ]
              : Array.from({ length: 9 }, (_, index) => <TileBone key={index} />)}
          </Grid>
        </View>

        {progressReady ? (
          <GameImport />
        ) : (
          <View style={styles.group}>
            <Bone width={140} height={16} />
            <Bone height={44} radius={radii.md} />
            <Bone height={88} radius={radii.md} />
          </View>
        )}

        <View style={[styles.actions, wideActions && styles.actionsRow]}>
          {progressReady ? (
            <>
              <Button
                style={wideActions ? styles.action : undefined}
                label={missCount > 0 ? `Review misses (${missCount})` : 'No misses to review'}
                variant={missCount > 0 ? 'primary' : 'secondary'}
                onPress={() => {
                  if (missCount === 0) return;
                  router.push(drillHref('review') as Href);
                }}
              />
              <Button
                style={wideActions ? styles.action : undefined}
                label="Reset local progress"
                variant="secondary"
                onPress={() => setConfirmReset(true)}
              />
            </>
          ) : (
            <>
              <View style={wideActions ? styles.action : undefined}>
                <Bone height={44} radius={radii.lg} />
              </View>
              <View style={wideActions ? styles.action : undefined}>
                <Bone height={44} radius={radii.lg} />
              </View>
            </>
          )}
        </View>
        <Text style={text.muted}>{PIECE_CREDIT}</Text>
      </View>

      <Dialog visible={confirmReset}>
        <Text style={styles.dialogTitle}>Reset progress?</Text>
        <Text style={styles.dialogBody}>
          Streaks, XP, lessons, drill results, and saved positions on this device will go back to zero.
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

function Grid({ columns, children }: { columns: number; children: ReactNode }) {
  return (
    <View style={styles.grid}>
      {Children.map(children, (child, index) => (
        <View key={index} style={{ width: `${100 / columns}%`, padding: spacing[6] }}>
          {child}
        </View>
      ))}
    </View>
  );
}

function TileBone({ tall = false }: { tall?: boolean }) {
  return (
    <View style={[styles.tile, tall && styles.badge]}>
      <Bone width={tall ? '40%' : '48%'} height={tall ? 14 : 28} />
      <Bone width="72%" height={16} />
      {tall ? <Bone width="56%" height={14} /> : null}
    </View>
  );
}

function CategoryStat({
  theme,
  tally,
}: {
  theme: DrillTheme;
  tally: { attempts: number; correct: number } | undefined;
}) {
  const attempts = tally?.attempts ?? 0;
  const correct = tally?.correct ?? 0;
  const accuracy = attempts > 0 ? Math.round((correct / attempts) * 100) : 0;
  return (
    <View style={styles.tile}>
      <Text style={[text.stat, attempts === 0 && styles.dim]}>{attempts === 0 ? '—' : `${accuracy}%`}</Text>
      <View style={styles.tileCopy}>
        <Text style={styles.tileLabel}>{themeLabel(theme)}</Text>
        <Text style={text.muted}>{attempts === 0 ? 'Not started' : `${correct}/${attempts}`}</Text>
      </View>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.tile}>
      <Text style={text.stat}>{value}</Text>
      <Text style={styles.tileLabel}>{label}</Text>
    </View>
  );
}

const styles = themedStyleSheet((colors) => ({
  page: {
    width: '100%',
    gap: spacing[12],
    paddingBottom: spacing.xs,
  },
  header: {
    gap: spacing[6],
  },
  banner: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing[12],
    minHeight: 56,
    justifyContent: 'center',
  },
  group: {
    gap: spacing.sm,
  },
  toggles: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  togglesWrap: {
    flexWrap: 'wrap',
    width: '100%',
    maxWidth: '100%',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -spacing[6],
  },
  tile: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing[14],
    paddingVertical: spacing[14],
    minHeight: 90,
    justifyContent: 'space-between',
    gap: spacing[10],
  },
  tileCopy: {
    gap: spacing.xxs,
  },
  tileLabel: {
    fontFamily: fonts.bodyBold,
    color: colors.text,
    fontSize: fontSizes[15],
    lineHeight: lineHeights[20],
  },
  dim: {
    color: colors.textDim,
  },
  badge: {
    minHeight: 108,
    justifyContent: 'flex-start',
    gap: spacing.xs,
  },
  badgeOn: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  badgeOff: {
    backgroundColor: colors.surface,
  },
  badgeState: {
    fontFamily: fonts.bodyExtra,
    fontSize: fontSizes[11],
    lineHeight: lineHeights[14],
    letterSpacing: letterSpacing.badge,
    textTransform: 'uppercase',
  },
  badgeStateOn: {
    color: colors.accent,
  },
  badgeStateOff: {
    color: colors.textDim,
  },
  badgeTitle: {
    fontFamily: fonts.bodyExtra,
    color: colors.text,
    fontSize: fontSizes[16],
    lineHeight: lineHeights[22],
  },
  badgeDetail: {
    fontFamily: fonts.body,
    color: colors.textMuted,
    fontSize: fontSizes[14],
    lineHeight: lineHeights[20],
  },
  badgeDetailOn: {
    color: colors.text,
  },
  actions: {
    gap: spacing.sm,
  },
  actionsRow: {
    flexDirection: 'row',
  },
  action: {
    flex: 1,
  },
  dialogTitle: {
    fontFamily: fonts.display,
    fontSize: fontSizes[24],
    lineHeight: lineHeights[30],
    color: colors.text,
    textAlign: 'center',
    letterSpacing: letterSpacing.tight,
  },
  dialogBody: {
    fontFamily: fonts.body,
    fontSize: fontSizes[15],
    lineHeight: lineHeights[22],
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
}));
