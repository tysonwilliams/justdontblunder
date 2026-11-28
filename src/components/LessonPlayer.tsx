import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { ChessBoard } from '@/src/components/Board/ChessBoard';
import { LessonCardView } from '@/src/components/learn/LessonCard';
import { LessonLead } from '@/src/components/learn/LessonLead';
import { LessonTry } from '@/src/components/learn/LessonTry';
import { doneCopy, nextPhase, type LessonPhase } from '@/src/components/learn/lessonPhase';
import { lessonStyles } from '@/src/components/learn/lessonStyles';
import { Button } from '@/src/components/ui/Button';
import { PlayFrame } from '@/src/components/ui/PlayFrame';
import { play } from '@/src/components/ui/playStyles';
import { text } from '@/src/components/ui/text';
import { useLayout } from '@/src/components/ui/useLayout';
import { ALL_LESSONS, lessonById, practiceHref, resolveBeats, type LessonId } from '@/src/logic/lessons';
import { useProgressStore } from '@/src/store/progress';

type Props = {
  lessonId: LessonId;
  onBack: () => void;
  onPractice: (href: string) => void;
  onOpenLesson?: (id: LessonId) => void;
};

export function LessonPlayer({ lessonId, onBack, onPractice, onOpenLesson }: Props) {
  const { phone } = useLayout();
  const lesson = lessonById(lessonId);
  const currentIdx = ALL_LESSONS.findIndex((item) => item.id === lessonId);
  const nextLesson = currentIdx >= 0 ? (ALL_LESSONS[currentIdx + 1] ?? null) : null;
  const completeLesson = useProgressStore((s) => s.completeLesson);
  const [phase, setPhase] = useState<LessonPhase>({ kind: 'card', index: 0 });
  const phaseKey = phase.kind === 'done' ? 'done' : `${phase.kind}:${phase.index}`;

  useEffect(() => {
    if (phaseKey === 'done') completeLesson(lesson.id);
  }, [completeLesson, lesson.id, phaseKey]);

  const total = lesson.cards.length + lesson.tries.length;
  const seen =
    phase.kind === 'done'
      ? total
      : phase.kind === 'card'
        ? phase.index + 1
        : lesson.cards.length + phase.index + 1;

  const advance = () => {
    setPhase((current) => nextPhase(lesson, current));
  };

  if (phase.kind === 'done') {
    return (
      <PlayFrame
        intro={
          <LessonLead
            lesson={lesson}
            kicker="Lesson complete"
            detail={`${lesson.cards.length} examples · ${lesson.tries.length} tries`}
            progress={1}
            onBack={onBack}
          />
        }
        board={
          <ChessBoard
            fen={lesson.cards[0]?.fen}
            orientation={lesson.cards[0]?.sideToMove === 'b' ? 'black' : 'white'}
            flipCue={!phone && lesson.cards[0]?.sideToMove === 'b'}
            interactive={false}
            hideTurn
          />
        }
        aside={
          <View style={[play.guide, phone && lessonStyles.cardAside]}>
            <Text style={[text.body, phone && text.bodyPhone]} numberOfLines={phone ? 3 : 4}>
              {doneCopy(lesson.id)}
            </Text>
            <View style={phone ? lessonStyles.doneActionsPhone : lessonStyles.doneActions}>
              <Button
                compact={phone}
                label={phone ? 'Drill this' : 'Practice this in Drills'}
                testID="lesson-practice"
                onPress={() => onPractice(practiceHref(lesson))}
                style={phone ? lessonStyles.doneActionPhone : undefined}
              />
              {nextLesson && onOpenLesson ? (
                <Button
                  compact={phone}
                  label={phone ? 'Next lesson' : `Next: ${nextLesson.title}`}
                  variant="secondary"
                  testID="lesson-next-course"
                  onPress={() => onOpenLesson(nextLesson.id)}
                  style={phone ? lessonStyles.doneActionPhone : undefined}
                />
              ) : (
                <Button
                  compact={phone}
                  label="All lessons"
                  variant="secondary"
                  testID="lesson-back"
                  onPress={onBack}
                  style={phone ? lessonStyles.doneActionPhone : undefined}
                />
              )}
              {!phone && nextLesson && onOpenLesson ? (
                <Button
                  label="All lessons"
                  variant="ghost"
                  testID="lesson-back"
                  onPress={onBack}
                />
              ) : null}
            </View>
          </View>
        }
      />
    );
  }

  if (phase.kind === 'try') {
    const task = lesson.tries[phase.index];
    if (!task) return null;
    return (
      <LessonTry
        key={task.drill.id}
        lesson={lesson}
        index={phase.index}
        progress={seen / total}
        onBack={onBack}
        onNext={advance}
      />
    );
  }

  const card = lesson.cards[phase.index];
  if (!card) return null;

  return (
    <LessonCardView
      key={card.id}
      lesson={lesson}
      cardIndex={phase.index}
      beats={resolveBeats(card.fen, card.beats)}
      progress={seen / total}
      onBack={onBack}
      onNext={advance}
    />
  );
}
