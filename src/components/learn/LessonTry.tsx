import { useCallback, useMemo, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import type { Square } from 'chess.js';

import { BlunderOverlay } from '@/src/components/Board/BlunderOverlay';
import { ChessBoard, type BoardArrow, type BoardMoveEvent } from '@/src/components/Board/ChessBoard';
import { highlightsForRound } from '@/src/components/Board/highlight';
import { LessonLead } from '@/src/components/learn/LessonLead';
import { roundKind } from '@/src/components/learn/lessonPhase';
import { lessonStyles } from '@/src/components/learn/lessonStyles';
import { usePunishmentPlayback } from '@/src/components/usePunishmentPlayback';
import { Button } from '@/src/components/ui/Button';
import { PlayFrame } from '@/src/components/ui/PlayFrame';
import { play } from '@/src/components/ui/playStyles';
import { text } from '@/src/components/ui/text';
import { useLayout } from '@/src/components/ui/useLayout';
import { isCorrectDrillMove } from '@/src/logic/drills';
import { createGame, tryMove } from '@/src/logic/game';
import type { Lesson } from '@/src/logic/lessons';
import { punishmentLine, type PunishmentStep } from '@/src/logic/punishment';
import { feedbackForRound } from '@/src/logic/saveFeedback';
import { markColor } from '@/src/theme';
import { useTheme } from '@/src/theme/useTheme';

type TryRound = 'playing' | 'correct' | 'retry' | 'revealed';

export function LessonTry({
  lesson,
  index,
  progress,
  onBack,
  onNext,
}: {
  lesson: Lesson;
  index: number;
  progress: number;
  onBack: () => void;
  onNext: () => void;
}) {
  const task = lesson.tries[index];
  const drill = task?.drill;
  const [round, setRound] = useState<TryRound>('playing');
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(null);
  const [displayFen, setDisplayFen] = useState<string | null>(drill?.fen ?? null);
  const [replayLine, setReplayLine] = useState<PunishmentStep[]>([]);
  const replayActive = round === 'retry';
  const playback = usePunishmentPlayback(replayActive, replayLine);
  const replyReady = !replayActive || playback.done;
  const orientation = useMemo(
    () => (drill?.sideToMove === 'b' ? 'black' : 'white') as 'white' | 'black',
    [drill?.sideToMove],
  );
  const { colors, scheme } = useTheme();
  const { phone } = useLayout();
  const latest = useRef({ drill, round });
  latest.current = { drill, round };

  const onMove = useCallback((event: BoardMoveEvent) => {
    const current = latest.current.drill;
    if (!current || latest.current.round !== 'playing') return false;
    setDisplayFen(event.afterFen);
    setLastMove({ from: event.from, to: event.to });
    const ok = isCorrectDrillMove(current, event.from, event.to);
    if (ok) {
      setReplayLine([]);
      setRound('correct');
      return true;
    }
    setReplayLine(punishmentLine(current, event.from, event.to));
    setRound('retry');
    return false;
  }, []);

  if (!task || !drill) return null;

  const tryAgain = () => {
    setReplayLine([]);
    setDisplayFen(drill.fen);
    setLastMove(null);
    setRound('playing');
  };

  const reveal = () => {
    const uci = drill.solution[0];
    if (!uci || uci.length < 4) return;
    const from = uci.slice(0, 2) as Square;
    const to = uci.slice(2, 4) as Square;
    const game = createGame(drill.fen);
    const moved = tryMove(game, from, to);
    if (!moved) return;
    setDisplayFen(game.fen());
    setLastMove({ from: moved.from, to: moved.to });
    setReplayLine([]);
    setRound('revealed');
  };

  const boardFen = playback.fen ?? displayFen ?? drill.fen;
  const boardLastMove = playback.move ?? lastMove;
  const marks = highlightsForRound(roundKind(round), lastMove, drill.atRiskSquare);
  const threatFrom = playback.arrow?.from;
  const threatTo = playback.arrow?.to;
  const threatArrow: BoardArrow[] =
    threatFrom && threatTo ? [{ from: threatFrom, to: threatTo, color: markColor('danger', scheme, colors) }] : [];
  const copy = feedbackForRound(roundKind(round), drill, lastMove) ?? '';
  const watching = replayActive && !playback.done;

  return (
    <PlayFrame
      asideFirst={round !== 'playing' && !watching}
      intro={
        <LessonLead
          lesson={lesson}
          kicker={`Try ${index + 1} of ${lesson.tries.length}`}
          detail={drill.prompt}
          progress={progress}
          onBack={onBack}
        />
      }
      board={
        <ChessBoard
          fen={boardFen}
          orientation={orientation}
          flipCue={!phone && orientation === 'black'}
          interactive={round === 'playing'}
          hideTurn
          lastMove={boardLastMove}
          arrows={threatArrow}
          attentionSquares={round === 'playing' ? [drill.atRiskSquare] : []}
          highlightSquares={marks.squares}
          highlightTone={marks.tone}
          onMove={onMove}
        />
      }
      aside={
        round === 'playing' ? (
          <View style={[play.guide, phone && lessonStyles.guidePhone]}>
            <Text style={[text.body, phone && text.bodyPhone]} numberOfLines={phone ? 2 : 3}>
              {task.coach}
            </Text>
            {phone ? null : <Text style={text.muted}>The amber square is the piece to watch.</Text>}
            <Button label="Show the idea" variant="secondary" testID="lesson-idea" onPress={reveal} />
          </View>
        ) : (
          <TryResult round={round} message={copy} ready={replyReady} onAgain={tryAgain} onNext={onNext} />
        )
      }
    />
  );
}

function TryResult({
  round,
  message,
  ready,
  onAgain,
  onNext,
}: {
  round: Exclude<TryRound, 'playing'>;
  message: string;
  ready: boolean;
  onAgain: () => void;
  onNext: () => void;
}) {
  switch (round) {
    case 'correct':
      return (
        <BlunderOverlay
          visible
          tone="success"
          title="Nice save"
          message={message}
          actionLabel="Next"
          onDismiss={onNext}
          actionTestID="lesson-next"
        />
      );
    case 'revealed':
      return (
        <BlunderOverlay
          visible
          tone="warn"
          title="Here's the idea"
          message={message}
          actionLabel="Next"
          onDismiss={onNext}
          actionTestID="lesson-next"
        />
      );
    case 'retry':
      return (
        <BlunderOverlay
          visible
          tone="danger"
          title="Not quite"
          message={message}
          waiting={ready ? undefined : 'Watch the reply.'}
          actionLabel={ready ? 'Try again' : undefined}
          onDismiss={ready ? onAgain : undefined}
          actionTestID="try-again"
        />
      );
    default: {
      const _exhaustive: never = round;
      return _exhaustive;
    }
  }
}
