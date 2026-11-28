import { useCallback, useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';

import { ChessBoard } from '@/src/components/Board/ChessBoard';
import { LessonCardView } from '@/src/components/learn/LessonCard';
import { LessonLead } from '@/src/components/learn/LessonLead';
import { LessonTry } from '@/src/components/learn/LessonTry';
import {
  doneCopy,
  nextPhase,
  phaseSlotIndex,
  prevPhase,
  type LessonPhase,
} from '@/src/components/learn/lessonPhase';
import { lessonStyles } from '@/src/components/learn/lessonStyles';
import { Button } from '@/src/components/ui/Button';
import { PlayFrame } from '@/src/components/ui/PlayFrame';
import { play } from '@/src/components/ui/playStyles';
import { text } from '@/src/components/ui/text';
import { useKeyboardShortcuts } from '@/src/components/ui/useKeyboardShortcuts';
import { useLayout } from '@/src/components/ui/useLayout';
import { ALL_LESSONS, lessonById, practiceHref, resolveBeats, type LessonId } from '@/src/logic/lessons';
import { useProgressStore } from '@/src/store/progress';
import { fonts, fontSizes, letterSpacing, lineHeights, radii, spacing } from '@/src/theme';
import { themedStyleSheet } from '@/src/theme/themed';
import { useTheme } from '@/src/theme/useTheme';

const LESSON_XP = 25;

export function LessonPlayer({
  lessonId,
  onBack,
  onPractice,
  onOpenLesson,
}: {
  lessonId: LessonId;
  onBack: () => void;
  onPractice: (href: string) => void;
  onOpenLesson?: (id: LessonId) => void;
}) {
  useTheme();
  const { phone } = useLayout();
  const lesson = lessonById(lessonId);
  const currentIdx = ALL_LESSONS.findIndex((item) => item.id === lessonId);
  const nextLesson = currentIdx >= 0 ? (ALL_LESSONS[currentIdx + 1] ?? null) : null;
  const completeLesson = useProgressStore((s) => s.completeLesson);
  const [phase, setPhase] = useState<LessonPhase>({ kind: 'card', index: 0 });
  const [initialBeat, setInitialBeat] = useState(0);
  const [maxSlot, setMaxSlot] = useState(0);
  const [tryOutcomes, setTryOutcomes] = useState<Record<number, boolean>>({});
  const alreadyDoneRef = useRef(useProgressStore.getState().completedLessons.includes(lessonId));
  const phaseKey = phase.kind === 'done' ? 'done' : `${phase.kind}:${phase.index}`;

  useEffect(() => {
    if (phaseKey === 'done') completeLesson(lesson.id);
  }, [completeLesson, lesson.id, phaseKey]);

  const goTo = useCallback(
    (target: LessonPhase, beatStart = 0) => {
      setInitialBeat(beatStart);
      setPhase(target);
      const slot = phaseSlotIndex(lesson, target);
      setMaxSlot((prev) => Math.max(prev, slot));
    },
    [lesson],
  );

  const advance = useCallback(() => {
    const next = nextPhase(lesson, phase);
    goTo(next, 0);
  }, [goTo, lesson, phase]);

  const goPrev = useCallback(() => {
    const prev = prevPhase(lesson, phase);
    if (!prev) return;
    if (prev.kind === 'card') {
      const prevCard = lesson.cards[prev.index];
      goTo(prev, Math.max(0, (prevCard?.beats.length ?? 1) - 1));
      return;
    }
    goTo(prev, 0);
  }, [goTo, lesson, phase]);

  const recordOutcome = useCallback((tryIndex: number, firstTrySaved: boolean) => {
    setTryOutcomes((prev) => (tryIndex in prev ? prev : { ...prev, [tryIndex]: firstTrySaved }));
  }, []);

  useKeyboardShortcuts(
    {
      Enter: () => {
        onPractice(practiceHref(lesson));
        return true;
      },
      ' ': () => {
        onPractice(practiceHref(lesson));
        return true;
      },
    },
    phase.kind === 'done',
  );

  if (phase.kind === 'done') {
    const firstTryCount = Object.values(tryOutcomes).filter(Boolean).length;
    const triedCount = Object.keys(tryOutcomes).length;
    const earnedXp = !alreadyDoneRef.current;
    const finalCard = lesson.cards[lesson.cards.length - 1] ?? lesson.cards[0];
    const finalBeats = finalCard ? resolveBeats(finalCard.fen, finalCard.beats) : [];
    const finalFen = finalBeats[finalBeats.length - 1]?.fen ?? finalCard?.fen;

    return (
      <PlayFrame
        intro={
          <LessonLead
            lesson={lesson}
            kicker="Complete"
            detail={
              triedCount > 0
                ? `${firstTryCount}/${lesson.tries.length} saved on the first try`
                : `${lesson.cards.length} examples · ${lesson.tries.length} tries`
            }
            progress={1}
            phase={phase}
            maxSlot={lesson.cards.length + lesson.tries.length}
            onSelectPhase={(target) => goTo(target, 0)}
            onBack={onBack}
          />
        }
        board={
          <ChessBoard
            fen={finalFen}
            orientation={finalCard?.sideToMove === 'b' ? 'black' : 'white'}
            flipCue={!phone && finalCard?.sideToMove === 'b'}
            interactive={false}
            hideTurn
            statusText="Lesson complete"
          />
        }
        aside={
          <View style={[play.guide, phone && lessonStyles.cardAside]} testID="lesson-complete-card">
            <View style={styles.doneMeta}>
              <Text style={styles.takeawayLabel}>Rule to remember</Text>
              {earnedXp ? (
                <View style={styles.xpPill} testID="lesson-xp-earned">
                  <Text style={styles.xpText}>+{LESSON_XP} XP</Text>
                </View>
              ) : null}
            </View>
            <Text style={[text.body, phone && styles.doneCopyPhone]} numberOfLines={phone ? 3 : 5}>
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
        maxSlot={maxSlot}
        onSelectPhase={(target) => goTo(target, 0)}
        onOutcome={(firstTrySaved) => recordOutcome(phase.index, firstTrySaved)}
        onPrev={goPrev}
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
      initialBeat={initialBeat}
      maxSlot={maxSlot}
      onSelectPhase={(target) => goTo(target, 0)}
      onPrevCard={phase.index > 0 ? goPrev : undefined}
      onBack={onBack}
      onNext={advance}
    />
  );
}

const styles = themedStyleSheet((colors) => ({
  doneMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  takeawayLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes[11],
    lineHeight: lineHeights[14],
    letterSpacing: letterSpacing.pill,
    textTransform: 'uppercase',
    color: colors.accent,
  },
  xpPill: {
    paddingHorizontal: spacing[8],
    paddingVertical: spacing[2],
    borderRadius: radii.pill,
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  xpText: {
    fontFamily: fonts.bodyExtra,
    fontSize: fontSizes[11],
    lineHeight: lineHeights[14],
    color: colors.accent,
  },
  doneCopyPhone: {
    fontSize: fontSizes[14],
    lineHeight: lineHeights[20],
  },
}));
