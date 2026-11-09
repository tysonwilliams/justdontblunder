import { Pressable, Text, View } from 'react-native';

import { LESSON_INDEX } from '@/src/components/learn/lessonPhase';
import { lessonStyles } from '@/src/components/learn/lessonStyles';
import { controlA11y } from '@/src/components/ui/a11y';
import { BoardLead } from '@/src/components/ui/BoardLead';
import { LineBox } from '@/src/components/ui/LineBox';
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
      <View style={[play.metaRow, phone && lessonStyles.metaPhone]}>
        <Text style={[text.eyebrow, phone && lessonStyles.eyebrowPhone, lessonStyles.kicker]} numberOfLines={1}>
          Lesson {place} of 6 · {kicker}
        </Text>
        <Pressable
          {...controlA11y('button', 'All lessons', false)}
          testID="lesson-all"
          onPress={onBack}
          hitSlop={spacing.sm}
          style={({ pressed }) => [lessonStyles.back, pressed && lessonStyles.backPressed]}>
          <Text style={[text.meta, phone && text.metaPhone]} numberOfLines={1}>
            All lessons
          </Text>
        </Pressable>
      </View>
      <LineBox height={phone ? 22 : 32}>
        <Text style={[text.title, phone && text.titlePhone]} numberOfLines={1}>
          {lesson.title}
        </Text>
      </LineBox>
      <LineBox height={phone ? 16 : 22}>
        <Text style={[text.muted, phone && text.mutedPhone]} numberOfLines={1}>
          {detail}
        </Text>
      </LineBox>
      <LineBox height={phone ? 6 : 8}>
        <ProgressTrack progress={progress} />
      </LineBox>
    </BoardLead>
  );
}
