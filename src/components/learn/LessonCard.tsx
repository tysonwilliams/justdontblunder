import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { ChessBoard, type BoardArrow } from '@/src/components/Board/ChessBoard';
import { LessonLead } from '@/src/components/learn/LessonLead';
import { squaresForBeat } from '@/src/components/learn/lessonPhase';
import { lessonStyles } from '@/src/components/learn/lessonStyles';
import { playMoveSound } from '@/src/audio/playMoveSound';
import { soundForSan } from '@/src/audio/moveSound';
import { PUNISHMENT_STEP_MS } from '@/src/components/usePunishmentPlayback';
import { Button } from '@/src/components/ui/Button';
import { PlayFrame } from '@/src/components/ui/PlayFrame';
import { play } from '@/src/components/ui/playStyles';
import { text } from '@/src/components/ui/text';
import { useLayout } from '@/src/components/ui/useLayout';
import type { Lesson, ResolvedBeat } from '@/src/logic/lessons';
import { colors } from '@/src/theme';

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
    playMoveSound(beat.tone === 'blunder' ? 'fail' : soundForSan(beat.san));
  }, [beat?.san, beat?.tone, card?.id, index]);

  const { phone } = useLayout();
  if (!card || !beat) return null;
  const orientation = card.sideToMove === 'b' ? 'black' : 'white';
  const marks = squaresForBeat(beat);
  const arrows: BoardArrow[] =
    beat.tone === 'setup'
      ? (card.arrows ?? []).map((arrow) => ({ from: arrow.from, to: arrow.to, color: colors.warning }))
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
        <View style={[play.guide, phone && lessonStyles.guidePhone]}>
          <Text style={[text.body, phone && text.bodyPhone]} numberOfLines={phone ? 3 : 4}>
            {beat.text}
          </Text>
          <Button label={lastCard ? 'Try it' : 'Next'} testID="lesson-next" onPress={onNext} />
        </View>
      }
    />
  );
}
