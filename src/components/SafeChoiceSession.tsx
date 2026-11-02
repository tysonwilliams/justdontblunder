import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Square } from 'chess.js';

import { playMoveSound } from '@/src/audio/playMoveSound';
import { soundForSan } from '@/src/audio/moveSound';
import { BlunderOverlay } from '@/src/components/Board/BlunderOverlay';
import { ChessBoard, type BoardArrow } from '@/src/components/Board/ChessBoard';
import { highlightsForRound } from '@/src/components/Board/highlight';
import { DrillToolbar } from '@/src/components/DrillToolbar';
import { usePunishmentPlayback } from '@/src/components/usePunishmentPlayback';
import { BoardLead } from '@/src/components/ui/BoardLead';
import { StatusPill } from '@/src/components/ui/Chip';
import { Button } from '@/src/components/ui/Button';
import { ColorLegend } from '@/src/components/ui/ColorLegend';
import { PlayFrame, ScoreFrame } from '@/src/components/ui/PlayFrame';
import { play } from '@/src/components/ui/playStyles';
import { ProgressTrack } from '@/src/components/ui/ProgressTrack';
import { text } from '@/src/components/ui/text';
import { useLayout } from '@/src/components/ui/useLayout';
import { sessionForTheme, type DrillMode, type ThemeFilter } from '@/src/logic/drillLink';
import {
  HABIT_PROMPT,
  isCorrectDrillMove,
  themeLabel,
  type DrillPosition,
  type DrillSession as DrillSessionData,
} from '@/src/logic/drills';
import { createGame, tryMove } from '@/src/logic/game';
import { punishmentLine, type PunishmentStep } from '@/src/logic/punishment';
import { presentSafeChoice, safeChoiceFor, type PresentedSafeChoice } from '@/src/logic/safeChoice';
import { feedbackForRound, type DrillRound } from '@/src/logic/saveFeedback';
import { claimDrillResult } from '@/src/store/drillStats';
import { useProgressStore } from '@/src/store/progress';
import { colors, fonts, fontSizes, letterSpacing, lineHeights, radii, spacing } from '@/src/theme';

type RoundState = 'playing' | 'correct' | 'retry';

function resultCard(round: RoundState): { title: string; tone: 'success' | 'danger' } | null {
  switch (round) {
    case 'playing':
      return null;
    case 'correct':
      return { title: 'Safe move', tone: 'success' };
    case 'retry':
      return { title: 'Blunder', tone: 'danger' };
    default: {
      const _exhaustive: never = round;
      return _exhaustive;
    }
  }
}

function roundKind(round: RoundState): DrillRound {
  switch (round) {
    case 'playing':
      return 'playing';
    case 'correct':
      return 'correct';
    case 'retry':
      return 'retry';
    default: {
      const _exhaustive: never = round;
      return _exhaustive;
    }
  }
}

type Props = {
  theme: ThemeFilter;
  onMode: (mode: DrillMode) => void;
  onTheme: (theme: ThemeFilter) => void;
};

export function SafeChoiceSession({ theme, onMode, onTheme }: Props) {
  const { split, phone } = useLayout();
  const markDrillResult = useProgressStore((s) => s.markDrillResult);
  const recordMiss = useProgressStore((s) => s.recordMiss);

  const [session, setSession] = useState<DrillSessionData>(() => sessionForTheme(theme));
  const [index, setIndex] = useState(0);
  const [round, setRound] = useState<RoundState>('playing');
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(null);
  const [displayFen, setDisplayFen] = useState<string | null>(null);
  const [boardKey, setBoardKey] = useState(0);
  const [replayLine, setReplayLine] = useState<PunishmentStep[]>([]);
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const resultCounted = useRef(false);
  const lock = useRef(false);

  const drill: DrillPosition | undefined = session.positions[index];
  const done = index >= session.positions.length;
  const choice = useMemo(() => (drill ? safeChoiceFor(drill) : null), [drill]);
  const presented = useMemo(() => (choice ? presentSafeChoice(choice) : null), [choice]);
  const replayActive = round === 'retry';
  const playback = usePunishmentPlayback(replayActive, replayLine);
  const replyReady = !replayActive || playback.done;

  const orientation = useMemo(
    () => (drill?.sideToMove === 'b' ? 'black' : 'white') as 'white' | 'black',
    [drill?.sideToMove],
  );

  const resetBoard = () => {
    lock.current = false;
    setRound('playing');
    setLastMove(null);
    setDisplayFen(null);
    setReplayLine([]);
    setBoardKey((k) => k + 1);
  };

  const begin = (nextSession: DrillSessionData) => {
    resultCounted.current = false;
    setSession(nextSession);
    setIndex(0);
    setScore({ correct: 0, total: 0 });
    resetBoard();
  };

  useEffect(() => {
    if (!drill || presented) return;
    setIndex((i) => i + 1);
  }, [drill, presented]);

  useEffect(() => {
    if (!drill) return;
    resultCounted.current = false;
    lock.current = false;
    setDisplayFen(drill.fen);
    setRound('playing');
    setLastMove(null);
    setReplayLine([]);
  }, [drill?.id, drill?.fen]);

  const next = () => {
    resultCounted.current = false;
    lock.current = false;
    setIndex((i) => i + 1);
    resetBoard();
  };

  const tryAgain = () => {
    if (!drill) return;
    lock.current = false;
    setReplayLine([]);
    setDisplayFen(drill.fen);
    setLastMove(null);
    setRound('playing');
    setBoardKey((k) => k + 1);
  };

  const recordFirst = (correct: boolean) => {
    if (!drill) return;
    const claim = claimDrillResult(resultCounted.current);
    resultCounted.current = claim.claimed;
    if (!claim.recorded) return;
    setScore((s) => ({
      correct: s.correct + (correct ? 1 : 0),
      total: s.total + 1,
    }));
    markDrillResult(correct, drill.theme);
    if (!correct) recordMiss(drill.id);
  };

  const choose = (key: 'A' | 'B') => {
    if (!drill || !presented || round !== 'playing' || lock.current) return;
    const option = presented.options.find((item) => item.key === key);
    if (!option) return;
    const passed = isCorrectDrillMove(drill, option.from, option.to);
    if (passed !== (key === presented.safeKey)) return;
    const game = createGame(drill.fen);
    const played = tryMove(game, option.from, option.to);
    if (!played) return;
    lock.current = true;
    setDisplayFen(game.fen());
    setLastMove({ from: played.from, to: played.to });
    if (passed) {
      recordFirst(true);
      setReplayLine([]);
      setRound('correct');
      playMoveSound(soundForSan(played.san));
      return;
    }
    recordFirst(false);
    setReplayLine(punishmentLine(drill, option.from, option.to));
    setRound('retry');
    playMoveSound('fail');
  };

  if (done) {
    const pct = score.total ? Math.round((score.correct / score.total) * 100) : 0;
    return (
      <ScoreFrame toolbar={<DrillToolbar mode="pick" theme={theme} onMode={onMode} onTheme={onTheme} />}>
        <View style={play.done}>
          <Text style={text.eyebrow}>Drills</Text>
          <Text style={text.title}>That's the set</Text>
          <Text style={text.hero}>
            {score.correct}/{score.total}
          </Text>
          <Text style={text.muted}>{pct}% safe on the first try</Text>
          <Button label="Play again" onPress={() => begin(sessionForTheme(theme))} />
        </View>
      </ScoreFrame>
    );
  }

  if (!drill || !presented) return null;

  const boardFen = playback.fen ?? displayFen ?? drill.fen;
  const boardLastMove = playback.move ?? lastMove;
  const progress = (index + (round === 'playing' ? 0 : 1)) / session.positions.length;
  const marks = highlightsForRound(roundKind(round), lastMove, drill.atRiskSquare);
  const card = resultCard(round);
  const roundCopy = feedbackForRound(roundKind(round), drill, lastMove) ?? '';
  const arrows: BoardArrow[] =
    round === 'playing'
      ? presented.options.map((option) => ({
          from: option.from,
          to: option.to,
          color: colors.info,
          label: option.key,
        }))
      : playback.arrow
        ? [{ from: playback.arrow.from, to: playback.arrow.to, color: colors.danger }]
        : [];
  const watchingReply = replayActive && !playback.done;

  return (
    <PlayFrame
      asideFirst={!split && round !== 'playing' && !watchingReply}
      intro={
        phone ? (
          <BoardLead>
            <DrillToolbar mode="pick" theme={theme} onMode={onMode} onTheme={onTheme} />
            {round === 'playing' ? (
              <>
                <Text style={play.phoneTitle} numberOfLines={2}>
                  {drill.prompt}
                </Text>
                <View style={play.metaRow}>
                  <View style={play.progressGrow}>
                    <ProgressTrack progress={progress} />
                  </View>
                  <Text style={text.meta}>
                    {index + 1}/{session.positions.length}
                  </Text>
                </View>
              </>
            ) : null}
          </BoardLead>
        ) : (
          <BoardLead>
            <DrillToolbar mode="pick" theme={theme} onMode={onMode} onTheme={onTheme} />
            <View style={play.metaRow}>
              <StatusPill>{themeLabel(drill.theme)}</StatusPill>
              <Text style={text.meta}>
                {index + 1} / {session.positions.length}
              </Text>
            </View>
            <ProgressTrack progress={progress} />
            {round === 'playing' ? <Text style={text.habit}>{HABIT_PROMPT}</Text> : null}
            <Text style={text.title}>Which move is safe?</Text>
            {round === 'playing' ? <Text style={text.body}>{drill.prompt}</Text> : null}
            {round === 'playing' ? <ColorLegend /> : null}
          </BoardLead>
        )
      }
      board={
          <ChessBoard
            key={`${drill.id}-${boardKey}`}
            fen={boardFen}
            orientation={orientation}
            flipCue={!phone && orientation === 'black'}
            hideTurn={phone}
            interactive={false}
            lastMove={boardLastMove}
            arrows={arrows}
            attentionSquares={round === 'playing' ? [drill.atRiskSquare] : []}
            highlightSquares={marks.squares}
            highlightTone={marks.tone}
          />
        }
        aside={
          card ? (
            <BlunderOverlay
              visible
              tone={card.tone}
              title={card.title}
              message={roundCopy}
              waiting={card.tone === 'danger' && !replyReady ? 'Watch the reply.' : undefined}
              actionLabel={card.tone === 'danger' ? (replyReady ? 'Try again' : undefined) : 'Next'}
              onDismiss={
                card.tone === 'danger' ? (replyReady ? tryAgain : undefined) : next
              }
              actionTestID={card.tone === 'danger' ? 'try-again' : 'next-puzzle'}
              secondaryLabel={card.tone === 'danger' && replyReady ? 'Next' : undefined}
              onSecondary={card.tone === 'danger' && replyReady ? next : undefined}
            />
          ) : phone ? (
            <ChoiceButtons presented={presented} onChoose={choose} compact />
          ) : (
            <View style={play.guide}>
              <Text style={text.body}>Blue arrows mark the two moves. One of them blunders.</Text>
              <ChoiceButtons presented={presented} onChoose={choose} compact={false} />
            </View>
          )
        }
    />
  );
}

function ChoiceButtons({
  presented,
  onChoose,
  compact,
}: {
  presented: PresentedSafeChoice;
  onChoose: (key: 'A' | 'B') => void;
  compact: boolean;
}) {
  return (
    <View style={styles.choices}>
      {presented.options.map((option) => (
        <Pressable
          key={option.key}
          accessibilityRole="button"
          accessibilityLabel={`Move ${option.key}, ${option.san}`}
          testID={`choice-${option.key}`}
          onPress={() => onChoose(option.key)}
          style={({ pressed }) => [
            styles.choice,
            compact && styles.choiceCompact,
            pressed && styles.choiceOn,
          ]}>
          <View style={styles.choiceKey}>
            <Text style={styles.choiceKeyText}>{option.key}</Text>
          </View>
          <Text style={styles.choiceSan}>{option.san}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  choices: {
    flexDirection: 'row',
    gap: spacing[10],
  },
  choice: {
    flex: 1,
    minWidth: 0,
    minHeight: 72,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.background,
    paddingHorizontal: spacing[14],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[12],
    cursor: 'pointer',
  },
  choiceCompact: {
    minHeight: 48,
    paddingHorizontal: spacing[10],
    gap: spacing.sm,
  },
  choiceOn: {
    backgroundColor: colors.surfaceRaised,
  },
  choiceKey: {
    width: 36,
    height: 36,
    borderRadius: radii.circleMd,
    backgroundColor: colors.info,
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceKeyText: {
    fontFamily: fonts.bodyExtra,
    color: colors.onInfo,
    fontSize: fontSizes[18],
  },
  choiceSan: {
    fontFamily: fonts.display,
    color: colors.text,
    fontSize: fontSizes[22],
    lineHeight: lineHeights[28],
    letterSpacing: letterSpacing.tight,
  },
});
