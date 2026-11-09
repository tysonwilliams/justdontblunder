import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { ChessBoard, type BoardArrow } from '@/src/components/Board/ChessBoard';
import { LessonLead } from '@/src/components/learn/LessonLead';
import { squaresForBeat } from '@/src/components/learn/lessonPhase';
import { lessonStyles } from '@/src/components/learn/lessonStyles';
import { cueForLessonTone } from '@/src/feedback/cues';
import { playFeedback } from '@/src/feedback/playFeedback';
import { PUNISHMENT_STEP_MS } from '@/src/components/usePunishmentPlayback';
import { Button } from '@/src/components/ui/Button';
import { LineBox } from '@/src/components/ui/LineBox';
import { PlayFrame } from '@/src/components/ui/PlayFrame';
import { play } from '@/src/components/ui/playStyles';
import { text } from '@/src/components/ui/text';
import { useLayout } from '@/src/components/ui/useLayout';
import type { Lesson, ResolvedBeat } from '@/src/logic/lessons';
import { markColor } from '@/src/theme';
import { useTheme } from '@/src/theme/useTheme';

function useBeatIndex(cardId: string, count: number): number {
  const [state, setState] = useState({ cardId, index: 0 });
  if (state.cardId !== cardId) setState({ cardId, index: 0 });
  const index = state.cardId === cardId ? state.index : 0;

  useEffect(() => {
    if (count <= 1) return;
    let current = 0;
    const timer = setInterval(() => {
      current += 1;
      setState({ cardId, index: current });
      if (current >= count - 1) clearInterval(timer);
    }, PUNISHMENT_STEP_MS);
    return () => clearInterval(timer);
  }, [cardId, count]);

  return Math.min(index, Math.max(count - 1, 0));
}

function lessonCopyLines(foot: number): number {
  const room = foot - 56;
  if (room >= 17 * 4) return 4;
  if (room >= 17 * 3) return 3;
  return 2;
}

function lessonCopyHeight(foot: number): number {
  return lessonCopyLines(foot) * 17;
}

export function LessonCardView({
  lesson,
  cardIndex,
  beats,
  progress,
  onBack,
  onNext,
}: {
  lesson: Lesson;
  cardIndex: number;
  beats: ResolvedBeat[];
  progress: number;
  onBack: () => void;
  onNext: () => void;
}) {
  const card = lesson.cards[cardIndex];
  const index = useBeatIndex(card?.id ?? 'card', beats.length);
  const beat = beats[index] ?? beats[0];

  useEffect(() => {
    if (!beat?.san) return;
    playFeedback(cueForLessonTone(beat.tone, beat.san));
  }, [beat?.san, beat?.tone, card?.id, index]);

  const { colors, scheme } = useTheme();
  const { phone, slots } = useLayout();
  if (!card || !beat) return null;
  const orientation = card.sideToMove === 'b' ? 'black' : 'white';
  const marks = squaresForBeat(beat);
  const arrows: BoardArrow[] =
    beat.tone === 'setup'
      ? (card.arrows ?? []).map((arrow) => ({ from: arrow.from, to: arrow.to, color: markColor('warning', scheme, colors) }))
      : [];
  const lastCard = cardIndex + 1 >= lesson.cards.length;

  return (
    <PlayFrame
      intro={
        <LessonLead
          lesson={lesson}
          kicker={`Card ${cardIndex + 1} of ${lesson.cards.length}`}
          detail={card.title}
          progress={progress}
          onBack={onBack}
        />
      }
      board={
        <ChessBoard
          fen={beat.fen}
          orientation={orientation}
          flipCue={!phone && orientation === 'black'}
          interactive={false}
          hideTurn
          lastMove={beat.lastMove}
          arrows={arrows}
          highlightSquares={marks.squares}
          highlightTone={marks.tone}
        />
      }
      aside={
        <View style={[play.guide, phone && lessonStyles.cardAside]}>
          {phone ? (
            <LineBox height={lessonCopyHeight(slots?.foot ?? 0)}>
              <Text style={[text.body, text.bodyPhone]} numberOfLines={lessonCopyLines(slots?.foot ?? 0)}>
                {beat.text}
              </Text>
            </LineBox>
          ) : (
            <Text style={text.body} numberOfLines={4}>
              {beat.text}
            </Text>
          )}
          <Button label={lastCard ? 'Play' : 'Next'} testID="lesson-next" onPress={onNext} />
        </View>
      }
    />
  );
}
