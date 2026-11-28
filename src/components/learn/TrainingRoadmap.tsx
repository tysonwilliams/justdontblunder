import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router, type Href } from 'expo-router';

import { controlA11y } from '@/src/components/ui/a11y';
import { Button } from '@/src/components/ui/Button';
import { text } from '@/src/components/ui/text';
import { TRAINING_WEEKS } from '@/src/logic/antiBlunderGuide';
import type { LessonId } from '@/src/logic/lessons';
import { fonts, fontSizes, lineHeights, radii, spacing } from '@/src/theme';
import { themedStyleSheet } from '@/src/theme/themed';
import { useTheme } from '@/src/theme/useTheme';

type Props = {
  onOpenLesson: (id: LessonId) => void;
};

/**
 * Collapsible 4-week anti-blunder study plan connecting lessons, Drills modes,
 * Review, and personal game import into a repeatable daily routine.
 */
export function TrainingRoadmap({ onOpenLesson }: Props) {
  useTheme();
  const [open, setOpen] = useState(false);

  return (
    <View style={styles.card} testID="training-roadmap">
      <Pressable
        {...controlA11y('button', open ? 'Hide 4-week anti-blunder plan' : 'Show 4-week anti-blunder plan', open)}
        testID="training-roadmap-toggle"
        onPress={() => setOpen((prev) => !prev)}
        style={(state) => {
          const hovered = 'hovered' in state && Boolean(state.hovered);
          return [styles.header, (hovered || state.pressed) && styles.headerHover];
        }}>
        <View style={styles.headerCopy}>
          <Text style={text.eyebrow}>30-day routine</Text>
          <Text style={styles.title}>4-week anti-blunder plan</Text>
          <Text style={text.muted}>
            Turn the 4-step check into a game-day habit in 10 minutes a day.
          </Text>
        </View>
        <View style={styles.pill}>
          <Text style={styles.pillText}>{open ? 'Hide' : 'View plan'}</Text>
        </View>
      </Pressable>

      {open ? (
        <View style={styles.weeks} testID="training-roadmap-weeks">
          {TRAINING_WEEKS.map((stage) => (
            <View key={stage.week} style={styles.weekCard}>
              <View style={styles.weekHead}>
                <View style={styles.weekBadge}>
                  <Text style={styles.weekBadgeText}>Week {stage.week}</Text>
                </View>
                <Text style={styles.weekTitle}>{stage.title}</Text>
              </View>
              <Text style={styles.weekFocus}>{stage.focus}</Text>
              <Text style={styles.weekHabit}>{stage.dailyHabit}</Text>
              <View style={styles.weekActions}>
                <Button
                  compact
                  variant="secondary"
                  fullWidth={false}
                  label={stage.lessonLabel}
                  testID={`roadmap-lesson-${stage.week}`}
                  onPress={() => onOpenLesson(stage.lessonId)}
                />
                <Button
                  compact
                  variant="ghost"
                  fullWidth={false}
                  label={stage.actionLabel}
                  testID={`roadmap-action-${stage.week}`}
                  onPress={() => router.push(stage.actionHref as Href)}
                />
              </View>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = themedStyleSheet((colors) => ({
  card: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[12],
    paddingVertical: spacing[12],
    paddingHorizontal: spacing[14],
    cursor: 'pointer',
  },
  headerHover: {
    backgroundColor: colors.surfaceRaised,
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
    gap: spacing[2],
  },
  title: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes[16],
    lineHeight: lineHeights[22],
    color: colors.text,
  },
  pill: {
    paddingHorizontal: spacing[10],
    paddingVertical: spacing[4],
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.background,
    flexShrink: 0,
  },
  pillText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes[12],
    lineHeight: lineHeights[16],
    color: colors.textMuted,
  },
  weeks: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    padding: spacing[12],
    gap: spacing[10],
  },
  weekCard: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    padding: spacing[12],
    gap: spacing[6],
  },
  weekHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[8],
    flexWrap: 'wrap',
  },
  weekBadge: {
    paddingHorizontal: spacing[8],
    paddingVertical: spacing[2],
    borderRadius: radii.pill,
    backgroundColor: colors.accentSoft,
  },
  weekBadgeText: {
    fontFamily: fonts.bodyExtra,
    fontSize: fontSizes[11],
    lineHeight: lineHeights[14],
    color: colors.accent,
  },
  weekTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes[15],
    lineHeight: lineHeights[20],
    color: colors.text,
  },
  weekFocus: {
    fontFamily: fonts.body,
    fontSize: fontSizes[13],
    lineHeight: lineHeights[18],
    color: colors.textMuted,
  },
  weekHabit: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes[12],
    lineHeight: lineHeights[16],
    color: colors.textDim,
  },
  weekActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing[6],
    marginTop: spacing[2],
  },
}));
