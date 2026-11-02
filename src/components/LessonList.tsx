import { Pressable, StyleSheet, Text, View } from 'react-native';

import { IconCheck } from '@/src/components/ui/icons';
import { Screen } from '@/src/components/ui/Screen';
import { text } from '@/src/components/ui/text';
import { useLayout } from '@/src/components/ui/useLayout';
import { LESSONS, type LessonId } from '@/src/logic/lessons';
import { useProgressStore } from '@/src/store/progress';
import { colors, fonts, radii, spacing } from '@/src/theme';

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
            return (
              <Pressable
                key={lesson.id}
                accessibilityRole="button"
                accessibilityState={{ checked: complete }}
                accessibilityLabel={`${lesson.title}${complete ? ', done' : ''}`}
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
    gap: 6,
  },
  introSide: {
    width: 280,
    flexShrink: 0,
    paddingTop: 4,
  },
  list: {
    flex: 1,
    minWidth: 0,
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 58,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgElevated,
    cursor: 'pointer',
  },
  rowOn: {
    backgroundColor: colors.bgSoft,
  },
  index: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.bgSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  indexText: {
    fontFamily: fonts.bodyExtra,
    color: colors.text,
    fontSize: 14,
    lineHeight: 18,
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  title: {
    fontFamily: fonts.bodyBold,
    color: colors.text,
    fontSize: 16,
    lineHeight: 22,
  },
  check: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkSlot: {
    width: 28,
    height: 28,
  },
});
