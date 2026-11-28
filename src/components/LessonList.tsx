import { Pressable, Text, View } from 'react-native';

import { AboutFooter } from '@/src/components/legal/AboutFooter';
import { MenuButton } from '@/src/components/SettingsMenu';
import { controlA11y } from '@/src/components/ui/a11y';
import { Button } from '@/src/components/ui/Button';
import { IconCheck } from '@/src/components/ui/icons';
import { ProgressTrack } from '@/src/components/ui/ProgressTrack';
import { Bone } from '@/src/components/ui/Skeleton';
import { forceSkeleton } from '@/src/components/ui/skeletonMode';
import { Screen } from '@/src/components/ui/Screen';
import { text } from '@/src/components/ui/text';
import { useLayout } from '@/src/components/ui/useLayout';
import {
  ALL_LESSONS,
  CLUB_LESSONS,
  LESSONS,
  lessonById,
  nextCourseLessonId,
  type Lesson,
  type LessonId,
} from '@/src/logic/lessons';
import { useProgressStore } from '@/src/store/progress';
import { useHydrated } from '@/src/store/useHydrated';
import { useTheme } from '@/src/theme/useTheme';
import { themedStyleSheet } from '@/src/theme/themed';
import { fonts, fontSizes, lineHeights, radii, spacing } from '@/src/theme';

type Props = {
  onOpen: (id: LessonId) => void;
};

export function LessonList({ onOpen }: Props) {
  const { colors } = useTheme();
  const completed = useProgressStore((s) => s.completedLessons);
  const ready = useHydrated(useProgressStore.persist) && !forceSkeleton();
  const { split, phone, topNav } = useLayout();
  const done = new Set(completed);
  const completedCount = ALL_LESSONS.filter((lesson) => done.has(lesson.id)).length;
  const nextId = nextCourseLessonId(completed);
  const nextLesson = nextId ? lessonById(nextId) : null;

  const renderSection = (lessons: readonly Lesson[], club = false) =>
    ready
      ? lessons.map((lesson, index) => {
          const complete = done.has(lesson.id);
          const upNext = lesson.id === nextId;
          const label = `${lesson.title}${complete ? ', done' : upNext ? ', up next' : ''}`;
          return (
            <Pressable
              key={lesson.id}
              {...controlA11y('button', label)}
              testID={`lesson-open-${lesson.id}`}
              onPress={() => onOpen(lesson.id)}
              style={(state) => {
                const hovered = 'hovered' in state && Boolean(state.hovered);
                return [
                  styles.row,
                  upNext && styles.rowUpNext,
                  (hovered || state.pressed) && styles.rowOn,
                ];
              }}>
              <View style={[styles.index, club && styles.indexClub, upNext && styles.indexUpNext]}>
                <Text
                  style={[
                    styles.indexText,
                    club && styles.indexClubText,
                    upNext && styles.indexUpNextText,
                  ]}>
                  {index + 1}
                </Text>
              </View>
              <View style={styles.copy}>
                <View style={styles.titleRow}>
                  <Text style={styles.title} numberOfLines={1}>
                    {lesson.title}
                  </Text>
                  {upNext ? (
                    <View style={styles.upNextPill} testID="lesson-up-next">
                      <Text style={styles.upNextText}>Up next</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={text.muted} numberOfLines={2}>
                  {lesson.summary}
                </Text>
                <Text style={styles.metaLine}>
                  {lesson.cards.length} examples · {lesson.tries.length} tries · Self-paced
                </Text>
              </View>
              {complete ? (
                <View style={styles.check}>
                  <IconCheck color={colors.accent} size={18} />
                </View>
              ) : (
                <View style={styles.checkSlot} />
              )}
            </Pressable>
          );
        })
      : lessons.map((lesson) => (
          <View key={lesson.id} style={styles.row}>
            <Bone width={28} height={28} radius={radii.badge} />
            <View style={styles.copy}>
              <Bone width="52%" height={16} />
              <Bone width="88%" height={14} />
            </View>
            <Bone width={18} height={18} />
          </View>
        ));

  return (
    <Screen variant="page">
      <View style={styles.stack}>
        <View style={[styles.page, split && styles.pageSplit]}>
          <View style={[styles.intro, split && styles.introSide]}>
            <View style={styles.introTop}>
              <Text style={text.eyebrow}>Course</Text>
              {!topNav ? <MenuButton compact={phone} /> : null}
            </View>
            <Text style={split ? text.display : text.title}>Learn</Text>
            <Text style={text.muted}>
              Six core lessons plus four club tactics. Step through each example at your own pace, then try it yourself.
            </Text>
            {ready ? (
              <View style={styles.courseProgress}>
                <View style={styles.progressHead}>
                  <Text style={styles.progressLabel}>
                    {completedCount}/{ALL_LESSONS.length} completed
                  </Text>
                </View>
                <ProgressTrack progress={completedCount / ALL_LESSONS.length} />
                {nextLesson ? (
                  <Button
                    compact
                    label={completedCount > 0 ? `Continue: ${nextLesson.title}` : `Start: ${nextLesson.title}`}
                    testID="lesson-continue"
                    onPress={() => onOpen(nextLesson.id)}
                  />
                ) : null}
              </View>
            ) : null}
          </View>
          <View style={styles.tracks}>
            <View style={styles.list}>
              <Text style={text.eyebrow}>Foundations</Text>
              {renderSection(LESSONS)}
            </View>
            <View style={styles.list}>
              <View style={styles.trackHeader}>
                <Text style={text.eyebrow}>Club tactics · 900–1600</Text>
                <Text style={text.muted}>Subtler blunders once one-move drops are rare.</Text>
              </View>
              {renderSection(CLUB_LESSONS, true)}
            </View>
          </View>
        </View>
        <AboutFooter />
      </View>
    </Screen>
  );
}

const styles = themedStyleSheet((colors) => ({
  stack: {
    width: '100%',
    gap: spacing.lg,
  },
  page: {
    width: '100%',
    gap: spacing.md,
  },
  pageSplit: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.lg,
  },
  intro: {
    gap: spacing[8],
  },
  courseProgress: {
    gap: spacing[8],
    marginTop: spacing[4],
  },
  progressHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progressLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes[13],
    lineHeight: lineHeights[18],
    color: colors.textMuted,
  },
  introTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  introSide: {
    width: 280,
    flexShrink: 0,
    paddingTop: spacing.xs,
  },
  tracks: {
    flex: 1,
    minWidth: 0,
    gap: spacing.lg,
  },
  trackHeader: {
    gap: spacing[2],
  },
  list: {
    width: '100%',
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[12],
    minHeight: 68,
    paddingVertical: spacing[10],
    paddingHorizontal: spacing[12],
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    cursor: 'pointer',
  },
  rowUpNext: {
    borderColor: colors.accent,
  },
  rowOn: {
    backgroundColor: colors.surfaceRaised,
  },
  index: {
    width: 28,
    height: 28,
    borderRadius: radii.badge,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  indexClub: {
    backgroundColor: colors.accentSoft,
  },
  indexUpNext: {
    backgroundColor: colors.accent,
  },
  indexText: {
    fontFamily: fonts.bodyExtra,
    color: colors.text,
    fontSize: fontSizes[14],
    lineHeight: lineHeights[18],
  },
  indexClubText: {
    color: colors.accent,
  },
  indexUpNextText: {
    color: colors.accentText,
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: spacing[2],
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[6],
  },
  title: {
    fontFamily: fonts.bodyBold,
    color: colors.text,
    fontSize: fontSizes[16],
    lineHeight: lineHeights[22],
    flexShrink: 1,
  },
  upNextPill: {
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[1],
    borderRadius: radii.pill,
    backgroundColor: colors.accentSoft,
    flexShrink: 0,
  },
  upNextText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes[11],
    lineHeight: lineHeights[14],
    color: colors.accent,
  },
  metaLine: {
    fontFamily: fonts.body,
    fontSize: fontSizes[12],
    lineHeight: lineHeights[16],
    color: colors.textDim,
  },
  check: {
    width: 28,
    height: 28,
    borderRadius: radii.badge,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkSlot: {
    width: 28,
    height: 28,
  },
}));
