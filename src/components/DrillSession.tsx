import { useEffect, useMemo, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import type { Square } from 'chess.js';

import { BlunderOverlay } from '@/src/components/Board/BlunderOverlay';
import { ChessBoard, type BoardArrow, type BoardMoveEvent } from '@/src/components/Board/ChessBoard';
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
import {
  reviewForTheme,
  sessionForTheme,
  themeFilterLabel,
  type DrillMode,
  type ThemeFilter,
} from '@/src/logic/drillLink';
import {
  HABIT_PROMPT,
  isCorrectDrillMove,
  themeInstruction,
  themeLabel,
  turnPrompt,
  type DrillPosition,
  type DrillSession as DrillSessionData,
} from '@/src/logic/drills';
import { createGame, tryMove } from '@/src/logic/game';
import { punishmentLine, type PunishmentStep } from '@/src/logic/punishment';
import { feedbackForRound, missFeedback } from '@/src/logic/saveFeedback';
import { claimDrillResult } from '@/src/store/drillStats';
import { missesForDate, useProgressStore } from '@/src/store/progress';
import { colors } from '@/src/theme';

type RoundState = 'playing' | 'correct' | 'retry' | 'revealed' | 'streakEnd';
type PlayMode = 'streak' | 'play' | 'review';

type RunSummary = {
  saved: number;
  best: number;
  playedSan: string | null;
  missText: string;
  fen: string;
  lastMove: { from: Square; to: Square } | null;
  orientation: 'white' | 'black';
  atRisk: Square;
};

type MissedPlay = {
  san: string | null;
  text: string;
  fen: string;
  lastMove: { from: Square; to: Square };
};

type Props = {
  mode: PlayMode;
  theme: ThemeFilter;
  onMode: (mode: DrillMode) => void;
  onTheme: (theme: ThemeFilter) => void;
};

function playedSan(fen: string, from: Square, to: Square): string | null {
  const moved = tryMove(createGame(fen), from, to);
  return moved?.san ?? null;
}

export function DrillSession({ mode, theme, onMode, onTheme }: Props) {
  const { split, phone } = useLayout();
  const guided = mode === 'play' || mode === 'review';
  const reviewing = mode === 'review';

  const markDrillResult = useProgressStore((s) => s.markDrillResult);
  const recordMiss = useProgressStore((s) => s.recordMiss);
  const clearMiss = useProgressStore((s) => s.clearMiss);
  const recordPuzzleRun = useProgressStore((s) => s.recordPuzzleRun);
  const bestPuzzleStreak = useProgressStore((s) => s.bestPuzzleStreak);
  const missedDate = useProgressStore((s) => s.missedDate);
  const missedIds = useProgressStore((s) => s.missedIds);

  const [session, setSession] = useState<DrillSessionData>(() =>
    reviewing
      ? reviewForTheme(
          missesForDate(useProgressStore.getState().missedDate, useProgressStore.getState().missedIds),
          theme,
        )
      : sessionForTheme(theme),
  );
  const [index, setIndex] = useState(0);
  const [round, setRound] = useState<RoundState>('playing');
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(null);
  const [runSummary, setRunSummary] = useState<RunSummary | null>(null);
  const [displayFen, setDisplayFen] = useState<string | null>(null);
  const [boardKey, setBoardKey] = useState(0);
  const [shownIdea, setShownIdea] = useState(false);
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [replayLine, setReplayLine] = useState<PunishmentStep[]>([]);
  const [runOver, setRunOver] = useState(false);
  const [missedPlay, setMissedPlay] = useState<MissedPlay | null>(null);
  const reviewStarted = useRef(false);
  const runRecorded = useRef(false);
  const resultCounted = useRef(false);
  const [hydrated, setHydrated] = useState(() => useProgressStore.persist.hasHydrated());

  const drill: DrillPosition | undefined = session.positions[index];
  const done = index >= session.positions.length;
  const replayActive = runSummary == null && (round === 'retry' || round === 'streakEnd');
  const playback = usePunishmentPlayback(replayActive, replayLine);
  const replyReady = !replayActive || playback.done;

  const orientation = useMemo(
    () => (drill?.sideToMove === 'b' ? 'black' : 'white') as 'white' | 'black',
    [drill?.sideToMove],
  );

  const resetBoard = () => {
    setRound('playing');
    setLastMove(null);
    setDisplayFen(null);
    setShownIdea(false);
    setReplayLine([]);
    setBoardKey((k) => k + 1);
  };

  const begin = (nextSession: DrillSessionData) => {
    runRecorded.current = false;
    resultCounted.current = false;
    setRunOver(false);
    setMissedPlay(null);
    setRunSummary(null);
    setSession(nextSession);
    setIndex(0);
    setScore({ correct: 0, total: 0 });
    resetBoard();
  };

  useEffect(() => {
    const unsub = useProgressStore.persist.onFinishHydration(() => setHydrated(true));
    if (useProgressStore.persist.hasHydrated()) setHydrated(true);
    return () => {
      unsub();
    };
  }, []);

  useEffect(() => {
    if (!reviewing) {
      reviewStarted.current = false;
      return;
    }
    if (!hydrated || reviewStarted.current) return;
    reviewStarted.current = true;
    begin(reviewForTheme(missesForDate(missedDate, missedIds), theme));
  }, [reviewing, hydrated, missedDate, missedIds, theme]);

  useEffect(() => {
    if (!drill) return;
    resultCounted.current = false;
    setDisplayFen(drill.fen);
    setRound('playing');
    setLastMove(null);
    setReplayLine([]);
  }, [drill?.id, drill?.fen]);

  useEffect(() => {
    if (mode !== 'streak' || !done || runRecorded.current) return;
    runRecorded.current = true;
    recordPuzzleRun(score.correct);
  }, [done, mode, recordPuzzleRun, score.correct]);

  const restart = () => {
    begin(reviewing ? reviewForTheme(missesForDate(missedDate, missedIds), theme) : sessionForTheme(theme));
  };

  const next = () => {
    setIndex((i) => i + 1);
    setBoardKey((k) => k + 1);
  };

  const tryAgain = () => {
    if (!drill) return;
    setReplayLine([]);
    setDisplayFen(drill.fen);
    setLastMove(null);
    setRound('playing');
    setBoardKey((k) => k + 1);
  };

  /** Persist and score each puzzle once, on its first outcome. */
  const recordFirstResult = (correct: boolean) => {
    if (!drill) return;
    const claim = claimDrillResult(resultCounted.current);
    resultCounted.current = claim.claimed;
    if (!claim.recorded) return;
    setScore((s) => ({
      correct: s.correct + (correct ? 1 : 0),
      total: s.total + 1,
    }));
    markDrillResult(correct, drill.theme);
    if (correct) {
      if (reviewing) clearMiss(drill.id);
    } else {
      recordMiss(drill.id);
    }
  };

  const revealIdea = () => {
    if (!drill) return;
    setShownIdea(true);
    recordFirstResult(false);
    const uci = drill.solution[0];
    if (uci && uci.length >= 4) {
      const from = uci.slice(0, 2) as Square;
      const to = uci.slice(2, 4) as Square;
      const game = createGame(drill.fen);
      const moved = tryMove(game, from, to);
      if (moved) {
        setDisplayFen(game.fen());
        setLastMove({ from: moved.from, to: moved.to });
      }
    }
    if (mode === 'streak') {
      if (!runRecorded.current) {
        runRecorded.current = true;
        recordPuzzleRun(score.correct);
      }
      setRound('streakEnd');
      return;
    }
    setRound('revealed');
  };

  const onMove = (event: BoardMoveEvent) => {
    if (!drill || round !== 'playing') return false;

    setDisplayFen(event.afterFen);
    setLastMove({ from: event.from, to: event.to });

    const ok = isCorrectDrillMove(drill, event.from, event.to);
    if (ok) {
      if (!runOver) recordFirstResult(true);
      setReplayLine([]);
      setRound('correct');
      return true;
    }
    setReplayLine(punishmentLine(drill, event.from, event.to));
    if (mode === 'streak') {
      if (!runOver) {
        recordFirstResult(false);
        setMissedPlay({
          san: event.san,
          text: missFeedback(drill, event.from, event.to),
          fen: event.afterFen,
          lastMove: { from: event.from, to: event.to },
        });
        if (!runRecorded.current) {
          runRecorded.current = true;
          recordPuzzleRun(score.correct);
        }
        setRunOver(true);
      }
      setRound('streakEnd');
    } else {
      recordFirstResult(false);
      setRound('retry');
    }
    // false → ChessBoard plays fail (illegal / Not quite / streak miss)
    return false;
  };

  const showRunSummary = () => {
    if (!drill) return;
    const stillOnMiss = round === 'streakEnd';
    setRunSummary({
      saved: score.correct,
      best: Math.max(bestPuzzleStreak, score.correct),
      playedSan:
        missedPlay?.san ?? (lastMove ? playedSan(drill.fen, lastMove.from, lastMove.to) : null),
      missText: missedPlay?.text ?? (!shownIdea && lastMove ? missFeedback(drill, lastMove.from, lastMove.to) : drill.note),
      fen: stillOnMiss ? (playback.fen ?? displayFen ?? drill.fen) : (missedPlay?.fen ?? drill.fen),
      lastMove: stillOnMiss ? (playback.move ?? lastMove) : (missedPlay?.lastMove ?? null),
      orientation: drill.sideToMove === 'b' ? 'black' : 'white',
      atRisk: drill.atRiskSquare,
    });
  };

  if (runSummary) {
    const marks = highlightsForRound('streakEnd', runSummary.lastMove, runSummary.atRisk);
    return (
      <ScoreFrame
        toolbar={<DrillToolbar mode={mode} theme={theme} onMode={onMode} onTheme={onTheme} />}
        board={
          <ChessBoard
            fen={runSummary.fen}
            orientation={runSummary.orientation}
            flipCue={runSummary.orientation === 'black'}
            interactive={false}
            lastMove={runSummary.lastMove}
            highlightSquares={marks.squares}
            highlightTone={marks.tone}
          />
        }>
        <View style={play.done}>
          <Text style={text.eyebrow}>Drills</Text>
          <Text style={text.title}>Streak over</Text>
          <Text style={text.hero}>{runSummary.saved}</Text>
          <Text style={text.muted}>saved this run · best {runSummary.best}</Text>
          <View style={play.miss}>
            <Text style={text.section}>The miss</Text>
            {runSummary.playedSan ? <Text style={text.body}>You played {runSummary.playedSan}.</Text> : null}
            <Text style={text.body}>{runSummary.missText}</Text>
          </View>
          <Button label="Start again" onPress={() => begin(sessionForTheme(theme))} />
        </View>
      </ScoreFrame>
    );
  }

  if (reviewing && !hydrated) {
    return (
      <PlayFrame
        intro={
          <BoardLead>
            <DrillToolbar mode={mode} theme={theme} onMode={onMode} onTheme={onTheme} />
          </BoardLead>
        }
        board={<ChessBoard interactive={false} hideTurn />}
      />
    );
  }

  if (done) {
    const pct = score.total ? Math.round((score.correct / score.total) * 100) : 0;
    const emptyReview = reviewing && session.positions.length === 0;
    return (
      <ScoreFrame
        toolbar={<DrillToolbar mode={mode} theme={theme} onMode={onMode} onTheme={onTheme} />}>
        <View style={play.done}>
          <Text style={text.eyebrow}>Drills</Text>
          <Text style={text.title}>
            {emptyReview ? 'Nothing to review' : mode === 'streak' ? 'Clean run' : "That's the set"}
          </Text>
          {emptyReview ? (
            <Text style={text.muted}>
              {theme === 'all'
                ? 'You have no misses saved for today.'
                : `No missed ${themeFilterLabel(theme).toLowerCase()} puzzles today.`}
            </Text>
          ) : (
            <>
              <Text style={text.hero}>
                {mode === 'streak' ? score.correct : `${score.correct}/${score.total}`}
              </Text>
              <Text style={text.muted}>
                {mode === 'streak'
                  ? `in a row · best ${Math.max(bestPuzzleStreak, score.correct)}`
                  : `${pct}% saved on the first try`}
              </Text>
            </>
          )}
          <Button
            label={mode === 'streak' ? 'Run again' : reviewing ? 'Review again' : 'Practice again'}
            onPress={restart}
          />
        </View>
      </ScoreFrame>
    );
  }

  if (!drill) return null;

  const boardFen = playback.fen ?? displayFen ?? drill.fen;
  const boardLastMove = playback.move ?? lastMove;
  const progress = (index + (round === 'playing' ? 0 : 1)) / session.positions.length;
  const marks = highlightsForRound(round, lastMove, drill.atRiskSquare);
  const roundCopy = feedbackForRound(round, drill, shownIdea ? null : lastMove) ?? '';
  const threatArrow: BoardArrow[] =
    !shownIdea && playback.arrow
      ? [{ from: playback.arrow.from, to: playback.arrow.to, color: colors.danger }]
      : [];
  const watchingReply = replayActive && !playback.done;

  return (
    <PlayFrame
      asideFirst={!split && round !== 'playing' && !watchingReply}
      intro={
        phone ? (
          <BoardLead>
            <DrillToolbar mode={mode} theme={theme} onMode={onMode} onTheme={onTheme} />
            {round === 'playing' ? (
              <>
                <Text style={play.phoneTitle} numberOfLines={2}>
                  {guided ? drill.prompt : turnPrompt(drill.sideToMove)}
                </Text>
                <View style={play.metaRow}>
                  <View style={play.progressGrow}>
                    <ProgressTrack progress={progress} />
                  </View>
                  <Text style={text.meta}>
                    {index + 1}/{session.positions.length}
                    {mode === 'streak' ? ` · ${score.correct}` : ''}
                  </Text>
                </View>
              </>
            ) : null}
          </BoardLead>
        ) : (
          <BoardLead>
            <DrillToolbar mode={mode} theme={theme} onMode={onMode} onTheme={onTheme} />
            <View style={play.metaRow}>
              <StatusPill>
                {reviewing ? 'Review' : mode === 'streak' ? 'Streak' : themeLabel(drill.theme)}
              </StatusPill>
              <Text style={text.meta}>
                {index + 1} / {session.positions.length}
                {mode === 'streak' ? ` · ${score.correct} in a row` : ''}
              </Text>
            </View>
            <ProgressTrack progress={progress} />
            {guided && round === 'playing' ? <Text style={text.habit}>{HABIT_PROMPT}</Text> : null}
            {guided ? (
              <Text style={text.title}>{drill.prompt}</Text>
            ) : round === 'playing' ? (
              <Text style={text.title}>{turnPrompt(drill.sideToMove)}</Text>
            ) : null}
            {guided && round === 'playing' ? <ColorLegend /> : null}
          </BoardLead>
        )
      }
      board={
          <ChessBoard
            key={boardKey}
            fen={boardFen}
            orientation={orientation}
            flipCue={!phone && orientation === 'black'}
            hideTurn={phone || (!guided && round === 'playing')}
            interactive={round === 'playing'}
            lastMove={boardLastMove}
            arrows={threatArrow}
            attentionSquares={
              guided && round === 'playing' && drill.atRiskSquare ? [drill.atRiskSquare] : []
            }
            highlightSquares={marks.squares}
            highlightTone={marks.tone}
            onMove={onMove}
          />
        }
        aside={
          round === 'playing' ? (
            guided ? (
              phone ? (
                <Button label="Show the idea" variant="secondary" onPress={revealIdea} />
              ) : (
                <View style={play.guide}>
                  <Text style={text.body}>{themeInstruction(drill.theme)}</Text>
                  <Text style={text.muted}>The amber square is the piece under fire.</Text>
                  <Button label="Show the idea" variant="secondary" onPress={revealIdea} />
                </View>
              )
            ) : phone ? (
              <View style={play.stack}>
                <Text style={text.muted}>No hints. One miss ends the run.</Text>
                <Button
                  label="Show the answer"
                  variant="secondary"
                  testID="show-answer"
                  onPress={revealIdea}
                />
              </View>
            ) : (
              <View style={play.guide}>
                <Text style={text.muted}>No hints. One miss ends the run.</Text>
                <Button
                  label="Show the answer"
                  variant="secondary"
                  testID="show-answer"
                  onPress={revealIdea}
                />
              </View>
            )
          ) : (
            <>
              <BlunderOverlay
                visible={round === 'correct'}
                tone="success"
                title="Nice save"
                message={roundCopy}
                actionLabel={runOver ? 'Done' : 'Next puzzle'}
                onDismiss={runOver ? showRunSummary : next}
              />
              <BlunderOverlay
                visible={round === 'retry'}
                tone="danger"
                title="Not quite"
                message={roundCopy}
                waiting={replyReady ? undefined : 'Watch the reply.'}
                actionLabel={replyReady ? 'Try again' : undefined}
                onDismiss={replyReady ? tryAgain : undefined}
                actionTestID="try-again"
              />
              <BlunderOverlay
                visible={round === 'revealed'}
                tone="warn"
                title="Here's the idea"
                message={roundCopy}
                actionLabel="Next puzzle"
                onDismiss={next}
              />
              <BlunderOverlay
                visible={round === 'streakEnd'}
                tone="danger"
                title="Streak over"
                message={`${score.correct} in a row. ${roundCopy}`}
                waiting={!shownIdea && !replyReady ? 'Watch the reply.' : undefined}
                actionLabel={!replyReady ? undefined : shownIdea ? 'Done' : 'Try again'}
                onDismiss={!replyReady ? undefined : shownIdea ? showRunSummary : tryAgain}
                actionTestID={shownIdea ? undefined : 'try-again'}
                secondaryLabel={replyReady && !shownIdea ? 'Done' : undefined}
                onSecondary={replyReady && !shownIdea ? showRunSummary : undefined}
              />
            </>
          )
        }
    />
  );
}
