import { Pressable, StyleSheet, Text, View } from 'react-native';

import { controlA11y } from '@/src/components/ui/a11y';
import { IconCheck } from '@/src/components/ui/icons';
import { Screen } from '@/src/components/ui/Screen';
import { text } from '@/src/components/ui/text';
import { useLayout } from '@/src/components/ui/useLayout';
import { LESSONS, type LessonId } from '@/src/logic/lessons';
import { useProgressStore } from '@/src/store/progress';
import { colors, fonts, fontSizes, lineHeights, radii, spacing } from '@/src/theme';

type Props = {
  onOpen: (id: LessonId) => void;
};

export function LessonList({ onOpen }: Props) {
  const completed = useProgressStore((s) => s.completedLessons);
  const { split } = useLayout();
  const done = new Set(completed);

  return (
    <Screen variant="page">
      <View style={[styles.page, split && styles.pageSplit]}>
        <View style={[styles.intro, split && styles.introSide]}>
          <Text style={text.eyebrow}>Course</Text>
          <Text style={split ? text.display : text.title}>Learn</Text>
          <Text style={text.muted}>
            Six short lessons on blunders. About two minutes each. Any lesson is open.
          </Text>
        </View>
        <View style={styles.list}>
          {LESSONS.map((lesson, index) => {
            const complete = done.has(lesson.id);
            const label = `${lesson.title}${complete ? ', done' : ''}`;
            return (
              <Pressable
                key={lesson.id}
                {...controlA11y('button', label, complete)}
                accessibilityState={{ selected: complete, checked: complete }}
                aria-checked={complete}
                testID={`lesson-open-${lesson.id}`}
                onPress={() => onOpen(lesson.id)}
                style={({ pressed }) => [styles.row, pressed && styles.rowOn]}>
                <View style={styles.index}>
                  <Text style={styles.indexText}>{index + 1}</Text>
                </View>
                <View style={styles.copy}>
                  <Text style={styles.title} numberOfLines={1}>
                    {lesson.title}
                  </Text>
                  <Text style={text.muted} numberOfLines={1}>
                    {lesson.summary}
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
          })}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
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
    gap: spacing[6],
  },
  introSide: {
    width: 280,
    flexShrink: 0,
    paddingTop: spacing.xs,
  },
  list: {
    flex: 1,
    minWidth: 0,
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[12],
    minHeight: 58,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing[12],
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    cursor: 'pointer',
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
  indexText: {
    fontFamily: fonts.bodyExtra,
    color: colors.text,
    fontSize: fontSizes[14],
    lineHeight: lineHeights[18],
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: spacing.hairline,
  },
  title: {
    fontFamily: fonts.bodyBold,
    color: colors.text,
    fontSize: fontSizes[16],
    lineHeight: lineHeights[22],
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
});
