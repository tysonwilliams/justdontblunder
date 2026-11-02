import { Pressable, Text, View } from 'react-native';

import { LESSON_INDEX } from '@/src/components/learn/lessonPhase';
import { lessonStyles } from '@/src/components/learn/lessonStyles';
import { controlA11y } from '@/src/components/ui/a11y';
import { BoardLead } from '@/src/components/ui/BoardLead';
import { play } from '@/src/components/ui/playStyles';
import { ProgressTrack } from '@/src/components/ui/ProgressTrack';
import { text } from '@/src/components/ui/text';
import { useLayout } from '@/src/components/ui/useLayout';
import type { Lesson } from '@/src/logic/lessons';
import { spacing } from '@/src/theme';

export function LessonLead({
  lesson,
  kicker,
  detail,
  progress,
  onBack,
}: {
  lesson: Lesson;
  kicker: string;
  detail: string;
  progress: number;
  onBack: () => void;
}) {
  const { phone } = useLayout();
  const place = LESSON_INDEX[lesson.id];
  return (
    <BoardLead>
      <View style={play.metaRow}>
        <Text style={[text.eyebrow, phone && lessonStyles.eyebrowPhone]} numberOfLines={1}>
          Lesson {place} of 6 · {kicker}
        </Text>
        <Pressable
          {...controlA11y('button', 'All lessons', false)}
          testID="lesson-all"
          onPress={onBack}
          hitSlop={spacing.sm}>
          <Text style={[text.meta, phone && text.metaPhone]}>All lessons</Text>
        </Pressable>
      </View>
      <Text style={[text.title, phone && text.titlePhone]} numberOfLines={1}>
        {lesson.title}
      </Text>
      <Text style={[text.muted, phone && text.mutedPhone]} numberOfLines={1}>
        {detail}
      </Text>
      <ProgressTrack progress={progress} />
    </BoardLead>
  );
}
