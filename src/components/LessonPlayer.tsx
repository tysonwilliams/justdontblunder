import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Square } from 'chess.js';

import { playMoveSound } from '@/src/audio/playMoveSound';
import { soundForSan } from '@/src/audio/moveSound';
import { BlunderOverlay } from '@/src/components/Board/BlunderOverlay';
import { ChessBoard, type BoardArrow, type BoardMoveEvent } from '@/src/components/Board/ChessBoard';
import { highlightsForRound } from '@/src/components/Board/highlight';
import { PUNISHMENT_STEP_MS, usePunishmentPlayback } from '@/src/components/usePunishmentPlayback';
import { BoardLead } from '@/src/components/ui/BoardLead';
import { Button } from '@/src/components/ui/Button';
import { PlayFrame } from '@/src/components/ui/PlayFrame';
import { play } from '@/src/components/ui/playStyles';
import { ProgressTrack } from '@/src/components/ui/ProgressTrack';
import { text } from '@/src/components/ui/text';
import { useLayout } from '@/src/components/ui/useLayout';
import { createGame, tryMove } from '@/src/logic/game';
import {
  lessonById,
  practiceHref,
  resolveBeats,
  type Lesson,
  type LessonId,
  type ResolvedBeat,
} from '@/src/logic/lessons';
import { isCorrectDrillMove } from '@/src/logic/drills';
import { punishmentLine, type PunishmentStep } from '@/src/logic/punishment';
import { feedbackForRound, type DrillRound } from '@/src/logic/saveFeedback';
import { useProgressStore } from '@/src/store/progress';
import { colors } from '@/src/theme';

type Phase = { kind: 'card'; index: number } | { kind: 'try'; index: number } | { kind: 'done' };

type Props = {
  lessonId: LessonId;
  onBack: () => void;
  onPractice: (href: string) => void;
};

export function LessonPlayer({ lessonId, onBack, onPractice }: Props) {
  const { phone } = useLayout();
  const lesson = lessonById(lessonId);
  const completeLesson = useProgressStore((s) => s.completeLesson);
  const [phase, setPhase] = useState<Phase>({ kind: 'card', index: 0 });
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
          <Lead
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
          <View style={[play.guide, phone && styles.guidePhone]}>
            <Text style={[text.body, phone && text.bodyPhone]} numberOfLines={phone ? 2 : 3}>
              {doneCopy(lesson.id)}
            </Text>
            <Button
              label="Practice this in Drills"
              testID="lesson-practice"
              onPress={() => onPractice(practiceHref(lesson))}
            />
            <Button label="All lessons" variant="secondary" testID="lesson-back" onPress={onBack} />
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
  const beats = resolveBeats(card.fen, card.beats);

  return (
    <LessonCardView
      key={card.id}
      lesson={lesson}
      cardIndex={phase.index}
      beats={beats}
      progress={seen / total}
      onBack={onBack}
      onNext={advance}
    />
  );
}

function nextPhase(lesson: Lesson, phase: Phase): Phase {
  switch (phase.kind) {
    case 'card':
      if (phase.index + 1 < lesson.cards.length) return { kind: 'card', index: phase.index + 1 };
      return { kind: 'try', index: 0 };
    case 'try':
      if (phase.index + 1 < lesson.tries.length) return { kind: 'try', index: phase.index + 1 };
      return { kind: 'done' };
    case 'done':
      return phase;
    default: {
      const _exhaustive: never = phase;
      return _exhaustive;
    }
  }
}

function doneCopy(id: LessonId): string {
  switch (id) {
    case 'blunder':
      return 'A blunder loses a piece for nothing, or lets mate in one happen. An even trade is fine.';
    case 'hanging':
      return 'Before you move, ask: is anything of mine hanging?';
    case 'fork':
      return 'One piece attacking two of yours is a fork. Check the knights first.';
    case 'pin':
      return 'A pinned piece is stuck in front of something more valuable. Do not leave it loose.';
    case 'back_rank':
      return 'A king behind its own pawns needs a square, or a piece covering the first rank.';
    case 'mate':
      return 'Look for every check they have. Stop mate in one before you do anything else.';
    default: {
      const _exhaustive: never = id;
      return _exhaustive;
    }
  }
}

function Lead({
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
        <Text style={[text.eyebrow, phone && styles.eyebrowPhone]} numberOfLines={1}>
          Lesson {place} of 6 · {kicker}
        </Text>
        <Pressable accessibilityRole="button" testID="lesson-all" onPress={onBack} hitSlop={8}>
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

const LESSON_INDEX: Record<LessonId, number> = {
  blunder: 1,
  hanging: 2,
  fork: 3,
  pin: 4,
  back_rank: 5,
  mate: 6,
};

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

function LessonCardView({
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
      ? (card.arrows ?? []).map((arrow) => ({ from: arrow.from, to: arrow.to, color: colors.warn }))
      : [];
  const lastCard = cardIndex + 1 >= lesson.cards.length;

  return (
    <PlayFrame
      intro={
        <Lead
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
        <View style={[play.guide, phone && styles.guidePhone]}>
          <Text style={[text.body, phone && text.bodyPhone]} numberOfLines={phone ? 3 : 4}>
            {beat.text}
          </Text>
          <Button
            label={lastCard ? 'Try it' : 'Next'}
            testID="lesson-next"
            onPress={onNext}
          />
        </View>
      }
    />
  );
}

function squaresForBeat(beat: ResolvedBeat): { squares: Square[]; tone: 'danger' | 'success' } {
  if (!beat.lastMove) return { squares: [], tone: 'danger' };
  switch (beat.tone) {
    case 'setup':
      return { squares: [], tone: 'danger' };
    case 'blunder':
    case 'punishment':
      return { squares: [beat.lastMove.from, beat.lastMove.to], tone: 'danger' };
    case 'ok':
      return { squares: [beat.lastMove.from, beat.lastMove.to], tone: 'success' };
    default: {
      const _exhaustive: never = beat.tone;
      return _exhaustive;
    }
  }
}

type TryRound = 'playing' | 'correct' | 'retry' | 'revealed';

function LessonTry({
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
  const [boardKey, setBoardKey] = useState(0);
  const [replayLine, setReplayLine] = useState<PunishmentStep[]>([]);
  const replayActive = round === 'retry';
  const playback = usePunishmentPlayback(replayActive, replayLine);
  const replyReady = !replayActive || playback.done;

  const orientation = useMemo(
    () => (drill?.sideToMove === 'b' ? 'black' : 'white') as 'white' | 'black',
    [drill?.sideToMove],
  );

  const { phone } = useLayout();
  if (!task || !drill) return null;

  const tryAgain = () => {
    setReplayLine([]);
    setDisplayFen(drill.fen);
    setLastMove(null);
    setRound('playing');
    setBoardKey((k) => k + 1);
  };

  const onMove = (event: BoardMoveEvent) => {
    if (round !== 'playing') return false;
    setDisplayFen(event.afterFen);
    setLastMove({ from: event.from, to: event.to });
    const ok = isCorrectDrillMove(drill, event.from, event.to);
    if (ok) {
      setReplayLine([]);
      setRound('correct');
      return true;
    }
    setReplayLine(punishmentLine(drill, event.from, event.to));
    setRound('retry');
    return false;
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
  const threatArrow: BoardArrow[] = playback.arrow
    ? [{ from: playback.arrow.from, to: playback.arrow.to, color: colors.danger }]
    : [];
  const copy = feedbackForRound(roundKind(round), drill, lastMove) ?? '';
  const watching = replayActive && !playback.done;

  return (
    <PlayFrame
      asideFirst={round !== 'playing' && !watching}
      intro={
        <Lead
          lesson={lesson}
          kicker={`Try ${index + 1} of ${lesson.tries.length}`}
          detail={drill.prompt}
          progress={progress}
          onBack={onBack}
        />
      }
      board={
        <ChessBoard
          key={boardKey}
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
          <View style={[play.guide, phone && styles.guidePhone]}>
            <Text style={[text.body, phone && text.bodyPhone]} numberOfLines={phone ? 2 : 3}>
              {task.coach}
            </Text>
            {phone ? null : <Text style={text.muted}>The amber square is the piece to watch.</Text>}
            <Button label="Show the idea" variant="secondary" testID="lesson-idea" onPress={reveal} />
          </View>
        ) : (
          <TryResult
            round={round}
            message={copy}
            ready={replyReady}
            onAgain={tryAgain}
            onNext={onNext}
          />
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

const styles = StyleSheet.create({
  guidePhone: {
    padding: 8,
    gap: 4,
  },
  eyebrowPhone: {
    flex: 1,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.6,
  },
});

function roundKind(round: TryRound): DrillRound {
  switch (round) {
    case 'playing':
      return 'playing';
    case 'correct':
      return 'correct';
    case 'retry':
      return 'retry';
    case 'revealed':
      return 'revealed';
    default: {
      const _exhaustive: never = round;
      return _exhaustive;
    }
  }
}
