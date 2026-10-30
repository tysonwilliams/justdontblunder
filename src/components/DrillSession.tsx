import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import type { Square } from 'chess.js';

import { BlunderOverlay } from '@/src/components/Board/BlunderOverlay';
import { ChessBoard, type BoardArrow, type BoardMoveEvent } from '@/src/components/Board/ChessBoard';
import { highlightsForRound } from '@/src/components/Board/highlight';
import { BoardLead } from '@/src/components/ui/BoardLead';
import { BoardStage, boardStageIsWide } from '@/src/components/ui/BoardStage';
import { Button } from '@/src/components/ui/Button';
import { ColorLegend } from '@/src/components/ui/ColorLegend';
import { Screen } from '@/src/components/ui/Screen';
import {
  createAllSession,
  createReviewSession,
  createThemeSession,
  HABIT_PROMPT,
  isCorrectDrillMove,
  themeInstruction,
  themeLabel,
  type DrillPosition,
  type DrillSession as DrillSessionData,
  type DrillTheme,
} from '@/src/logic/drills';
import { createGame, tryMove } from '@/src/logic/game';
import { feedbackForRound, missFeedback } from '@/src/logic/saveFeedback';
import { bestPunishment } from '@/src/logic/safety';
import { missesForDate, useProgressStore } from '@/src/store/progress';
import { colors, fonts, radii, spacing } from '@/src/theme';

type RoundState = 'playing' | 'correct' | 'retry' | 'revealed' | 'streakEnd';
type SessionMode = 'learn' | 'streak';
type SessionSet = 'daily' | DrillTheme;

const SETS: { id: SessionSet; label: string }[] = [
  { id: 'daily', label: 'All' },
  { id: 'hanging', label: 'Hanging' },
  { id: 'fork', label: 'Fork' },
  { id: 'pin', label: 'Pin' },
  { id: 'back_rank', label: 'Back rank' },
  { id: 'missed_mate', label: 'Mate' },
];

function sessionFor(set: SessionSet): DrillSessionData {
  if (set === 'daily') return createAllSession();
  return createThemeSession(set);
}

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

type Props = {
  mode: SessionMode;
  reviewing?: boolean;
};

function playedSan(fen: string, from: Square, to: Square): string | null {
  const moved = tryMove(createGame(fen), from, to);
  return moved?.san ?? null;
}

export function DrillSession({ mode, reviewing = false }: Props) {
  const { width, height } = useWindowDimensions();
  const wide = boardStageIsWide(width);
  const router = useRouter();
  const learn = mode === 'learn';

  const markDrillResult = useProgressStore((s) => s.markDrillResult);
  const recordMiss = useProgressStore((s) => s.recordMiss);
  const clearMiss = useProgressStore((s) => s.clearMiss);
  const recordPuzzleRun = useProgressStore((s) => s.recordPuzzleRun);
  const bestPuzzleStreak = useProgressStore((s) => s.bestPuzzleStreak);
  const missedDate = useProgressStore((s) => s.missedDate);
  const missedIds = useProgressStore((s) => s.missedIds);

  const [setId, setSetId] = useState<SessionSet>('daily');
  const [session, setSession] = useState<DrillSessionData>(() => createAllSession());
  const [index, setIndex] = useState(0);
  const [round, setRound] = useState<RoundState>('playing');
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(null);
  const [runSummary, setRunSummary] = useState<RunSummary | null>(null);
  const [displayFen, setDisplayFen] = useState<string | null>(null);
  const [boardKey, setBoardKey] = useState(0);
  const [shownIdea, setShownIdea] = useState(false);
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const reviewStarted = useRef(false);
  const runRecorded = useRef(false);
  const resultCounted = useRef(false);
  const [hydrated, setHydrated] = useState(() => useProgressStore.persist.hasHydrated());

  const drill: DrillPosition | undefined = session.positions[index];
  const done = index >= session.positions.length;

  const orientation = useMemo(
    () => (drill?.sideToMove === 'b' ? 'black' : 'white') as 'white' | 'black',
    [drill?.sideToMove],
  );

  const resetBoard = () => {
    setRound('playing');
    setLastMove(null);
    setDisplayFen(null);
    setShownIdea(false);
    setBoardKey((k) => k + 1);
  };

  const begin = (nextSession: DrillSessionData) => {
    runRecorded.current = false;
    resultCounted.current = false;
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
    begin(createReviewSession(missesForDate(missedDate, missedIds)));
  }, [reviewing, hydrated, missedDate, missedIds]);

  useEffect(() => {
    if (!drill) return;
    resultCounted.current = false;
    setDisplayFen(drill.fen);
    setRound('playing');
    setLastMove(null);
  }, [drill?.id, drill?.fen]);

  useEffect(() => {
    if (mode !== 'streak' || !done || runRecorded.current) return;
    runRecorded.current = true;
    recordPuzzleRun(score.correct);
  }, [done, mode, recordPuzzleRun, score.correct]);

  const chooseSet = (next: SessionSet) => {
    if (reviewing) {
      router.setParams({ review: '' });
    }
    setSetId(next);
    begin(sessionFor(next));
  };

  const restart = () => {
    begin(reviewing ? createReviewSession(missesForDate(missedDate, missedIds)) : sessionFor(setId));
  };

  const next = () => {
    setIndex((i) => i + 1);
    setBoardKey((k) => k + 1);
  };

  const tryAgain = () => {
    if (!drill) return;
    setDisplayFen(drill.fen);
    setLastMove(null);
    setRound('playing');
    setBoardKey((k) => k + 1);
  };

  /** Persist and score each puzzle once, on its first outcome. */
  const recordFirstResult = (correct: boolean) => {
    if (!drill || resultCounted.current) return;
    resultCounted.current = true;
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
      recordFirstResult(true);
      setRound('correct');
      return true;
    }
    if (mode === 'streak') {
      recordFirstResult(false);
      if (!runRecorded.current) {
        runRecorded.current = true;
        recordPuzzleRun(score.correct);
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
    setRunSummary({
      saved: score.correct,
      best: Math.max(bestPuzzleStreak, score.correct),
      playedSan: lastMove ? playedSan(drill.fen, lastMove.from, lastMove.to) : null,
      missText:
        !shownIdea && lastMove ? missFeedback(drill, lastMove.from, lastMove.to) : drill.note,
      fen: displayFen ?? drill.fen,
      lastMove,
      orientation: drill.sideToMove === 'b' ? 'black' : 'white',
      atRisk: drill.atRiskSquare,
    });
  };

  if (runSummary) {
    const marks = highlightsForRound('streakEnd', runSummary.lastMove, runSummary.atRisk);
    return (
      <Screen maxWidth={wide ? 1120 : 560}>
        <SetBar setId={setId} reviewing={reviewing} onSet={chooseSet} />
        <View style={[styles.summary, { minHeight: Math.max(520, height - 160) }]}>
          <ChessBoard
            fen={runSummary.fen}
            orientation={runSummary.orientation}
            flipCue={runSummary.orientation === 'black'}
            interactive={false}
            lastMove={runSummary.lastMove}
            highlightSquares={marks.squares}
            highlightTone={marks.tone}
          />
          <View style={styles.doneCard}>
            <Text style={styles.eyebrow}>Drills</Text>
            <Text style={styles.heading}>Streak over</Text>
            <Text style={styles.score}>{runSummary.saved}</Text>
            <Text style={styles.sub}>saved this run · best {runSummary.best}</Text>
            <View style={styles.missBlock}>
              <Text style={styles.missLabel}>The miss</Text>
              {runSummary.playedSan ? (
                <Text style={styles.hint}>You played {runSummary.playedSan}.</Text>
              ) : null}
              <Text style={styles.hint}>{runSummary.missText}</Text>
            </View>
            <Button label="Start again" onPress={() => begin(sessionFor(setId))} />
          </View>
        </View>
      </Screen>
    );
  }

  if (done) {
    const pct = score.total ? Math.round((score.correct / score.total) * 100) : 0;
    const emptyReview = reviewing && session.positions.length === 0;
    return (
      <Screen maxWidth={wide ? 1120 : 560}>
        <SetBar setId={setId} reviewing={reviewing} onSet={chooseSet} />
        <View style={styles.doneCard}>
          <Text style={styles.eyebrow}>{mode === 'streak' ? 'Drills' : 'Learn'}</Text>
          <Text style={styles.heading}>
            {emptyReview ? 'Nothing to review' : mode === 'streak' ? 'Clean run' : "That's the set"}
          </Text>
          {emptyReview ? (
            <Text style={styles.sub}>You have no misses saved for today.</Text>
          ) : (
            <>
              <Text style={styles.score}>
                {mode === 'streak' ? score.correct : `${score.correct}/${score.total}`}
              </Text>
              <Text style={styles.sub}>
                {mode === 'streak'
                  ? `in a row · best ${Math.max(bestPuzzleStreak, score.correct)}`
                  : `${pct}% saved on the first try`}
              </Text>
            </>
          )}
          <Button label={mode === 'streak' ? 'Run again' : 'Learn again'} onPress={restart} />
        </View>
      </Screen>
    );
  }

  if (!drill) return null;

  const boardFen = displayFen ?? drill.fen;
  const progress = (index + (round === 'playing' ? 0 : 1)) / session.positions.length;
  const marks = highlightsForRound(round, lastMove, drill.atRiskSquare);
  const roundCopy = feedbackForRound(round, drill, shownIdea ? null : lastMove) ?? '';
  const threatArrow: BoardArrow[] = [];
  if (!shownIdea && lastMove && (round === 'retry' || round === 'streakEnd')) {
    const punished = createGame(boardFen);
    const hit = bestPunishment(punished.fen());
    if (hit && !hit.mate) {
      threatArrow.push({ from: hit.from, to: hit.to, color: colors.danger });
    } else if (hit?.mate) {
      threatArrow.push({ from: hit.from, to: hit.to, color: colors.danger });
    }
  }

  return (
    <Screen maxWidth={wide ? 1120 : 560}>
      <BoardLead>
        <SetBar setId={setId} reviewing={reviewing} onSet={chooseSet} />
        <View style={styles.metaRow}>
          <Text style={styles.chip}>
            {reviewing ? 'Review' : mode === 'streak' ? 'Streak' : themeLabel(drill.theme)}
          </Text>
          <Text style={styles.count}>
            {index + 1} / {session.positions.length}
            {mode === 'streak' ? ` · ${score.correct} in a row` : ''}
          </Text>
        </View>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${Math.round(progress * 100)}%` }]} />
        </View>
        <Text style={styles.habit}>{HABIT_PROMPT}</Text>
        <Text style={styles.heading}>{drill.prompt}</Text>
        <ColorLegend />
      </BoardLead>

      <BoardStage
        asideFirst={!wide && round !== 'playing'}
        board={
          <ChessBoard
            key={boardKey}
            fen={boardFen}
            orientation={orientation}
            flipCue={orientation === 'black'}
            interactive={round === 'playing'}
            lastMove={lastMove}
            arrows={threatArrow}
            attentionSquares={
              learn && round === 'playing' && drill.atRiskSquare ? [drill.atRiskSquare] : []
            }
            highlightSquares={marks.squares}
            highlightTone={marks.tone}
            onMove={onMove}
          />
        }
        aside={
          round === 'playing' ? (
            <View style={styles.guide}>
              <Text style={styles.hint}>{themeInstruction(drill.theme)}</Text>
              <Text style={styles.hintMuted}>
                {learn
                  ? 'The amber square is the piece under fire.'
                  : 'One miss ends the run. Showing the idea counts as a miss.'}
              </Text>
              <Button
                label={learn ? 'Show the idea' : 'Show the idea — ends the streak'}
                variant="secondary"
                onPress={revealIdea}
              />
            </View>
          ) : (
            <>
              <BlunderOverlay
                visible={round === 'correct'}
                tone="success"
                title="Nice save"
                message={roundCopy}
                actionLabel="Next puzzle"
                onDismiss={next}
              />
              <BlunderOverlay
                visible={round === 'retry'}
                tone="danger"
                title="Not quite"
                message={roundCopy}
                actionLabel="Try again"
                onDismiss={tryAgain}
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
                actionLabel="Done"
                onDismiss={showRunSummary}
              />
            </>
          )
        }
      />
    </Screen>
  );
}

function SetBar({
  setId,
  reviewing,
  onSet,
}: {
  setId: SessionSet;
  reviewing: boolean;
  onSet: (set: SessionSet) => void;
}) {
  if (reviewing) {
    return <Text style={styles.reviewLabel}>Reviewing today's misses</Text>;
  }
  return (
    <View style={styles.chips}>
      {SETS.map((set) => {
        const on = set.id === setId;
        return (
          <Pressable
            key={set.id}
            accessibilityRole="button"
            onPress={() => onSet(set.id)}
            style={[styles.pick, on && styles.pickOn]}>
            <Text style={[styles.pickText, on && styles.pickTextOn]}>{set.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pick: {
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.bgElevated,
    paddingHorizontal: 12,
    paddingVertical: 7,
    cursor: 'pointer',
  },
  pickOn: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  pickText: {
    fontFamily: fonts.bodyBold,
    color: colors.text,
    fontSize: 15,
  },
  pickTextOn: {
    color: colors.accentText,
  },
  reviewLabel: {
    fontFamily: fonts.bodyBold,
    color: colors.accent,
    fontSize: 15,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  chip: {
    fontFamily: fonts.bodyBold,
    color: colors.accent,
    fontSize: 14,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    backgroundColor: colors.accentSoft,
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
  },
  count: {
    fontFamily: fonts.bodyBold,
    color: colors.text,
    fontSize: 15,
  },
  track: {
    height: 4,
    borderRadius: 99,
    backgroundColor: colors.bgSoft,
    overflow: 'hidden',
  },
  fill: {
    height: 4,
    backgroundColor: colors.accent,
  },
  heading: {
    fontFamily: fonts.display,
    color: colors.text,
    fontSize: 26,
    lineHeight: 32,
    letterSpacing: -0.4,
  },
  guide: {
    gap: spacing.sm,
  },
  habit: {
    fontFamily: fonts.bodyBold,
    color: colors.warn,
    fontSize: 16,
    lineHeight: 22,
  },
  hint: {
    fontFamily: fonts.body,
    color: colors.text,
    fontSize: 16,
    lineHeight: 24,
  },
  hintMuted: {
    fontFamily: fonts.body,
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
  },
  summary: {
    width: '100%',
    justifyContent: 'center',
    gap: spacing.md,
  },
  doneCard: {
    backgroundColor: colors.bgElevated,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
    alignItems: 'stretch',
  },
  eyebrow: {
    fontFamily: fonts.bodyBold,
    color: colors.accent,
    fontSize: 14,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  score: {
    fontFamily: fonts.display,
    color: colors.text,
    fontSize: 56,
    letterSpacing: -1,
  },
  sub: {
    fontFamily: fonts.body,
    color: colors.textMuted,
    fontSize: 16,
    marginBottom: spacing.sm,
  },
  missBlock: {
    gap: 4,
    marginBottom: spacing.sm,
  },
  missLabel: {
    fontFamily: fonts.bodyBold,
    color: colors.textMuted,
    fontSize: 14,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
});
