import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import type { Square } from 'chess.js';

import { BlunderOverlay } from '@/src/components/Board/BlunderOverlay';
import { ChessBoard, type BoardMoveEvent } from '@/src/components/Board/ChessBoard';
import { BoardStage, boardStageIsWide } from '@/src/components/ui/BoardStage';
import { Button } from '@/src/components/ui/Button';
import { Screen } from '@/src/components/ui/Screen';
import {
  createAllSession,
  createReviewSession,
  createThemeSession,
  isCorrectDrillMove,
  themeLabel,
  type DrillPosition,
  type DrillSession as DrillSessionData,
  type DrillTheme,
} from '@/src/logic/drills';
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

type Props = {
  mode: SessionMode;
  reviewing?: boolean;
};

export function DrillSession({ mode, reviewing = false }: Props) {
  const { width } = useWindowDimensions();
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
  const [highlights, setHighlights] = useState<Square[]>([]);
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(null);
  const [displayFen, setDisplayFen] = useState<string | null>(null);
  const [boardKey, setBoardKey] = useState(0);
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const reviewStarted = useRef(false);
  const runRecorded = useRef(false);
  const [hydrated, setHydrated] = useState(() => useProgressStore.persist.hasHydrated());

  const drill: DrillPosition | undefined = session.positions[index];
  const done = index >= session.positions.length;

  const orientation = useMemo(
    () => (drill?.sideToMove === 'b' ? 'black' : 'white') as 'white' | 'black',
    [drill?.sideToMove],
  );

  const resetBoard = () => {
    setRound('playing');
    setHighlights([]);
    setLastMove(null);
    setDisplayFen(null);
    setBoardKey((k) => k + 1);
  };

  const begin = (nextSession: DrillSessionData) => {
    runRecorded.current = false;
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
    setDisplayFen(drill.fen);
    setRound('playing');
    setHighlights([]);
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
    setHighlights([]);
    setRound('playing');
    setBoardKey((k) => k + 1);
  };

  const noteMiss = () => {
    if (!drill) return;
    markDrillResult(false);
    recordMiss(drill.id);
  };

  const onMove = (event: BoardMoveEvent) => {
    if (!drill || round !== 'playing') return false;

    setDisplayFen(event.afterFen);
    setLastMove({ from: event.from, to: event.to });

    const ok = isCorrectDrillMove(drill, event.from, event.to);
    if (ok) {
      setScore((s) => ({ correct: s.correct + 1, total: s.total + 1 }));
      markDrillResult(true);
      if (reviewing) clearMiss(drill.id);
      setRound('correct');
      setHighlights([event.to]);
    } else if (mode === 'streak') {
      setScore((s) => ({ ...s, total: s.total + 1 }));
      noteMiss();
      if (!runRecorded.current) {
        runRecorded.current = true;
        recordPuzzleRun(score.correct);
      }
      setRound('streakEnd');
      setHighlights([event.from, event.to, drill.atRiskSquare]);
    } else {
      setScore((s) => ({ ...s, total: s.total + 1 }));
      noteMiss();
      setRound('retry');
      setHighlights([event.from, event.to, drill.atRiskSquare]);
    }
    return true;
  };

  if (done) {
    const pct = score.total ? Math.round((score.correct / score.total) * 100) : 0;
    const emptyReview = reviewing && session.positions.length === 0;
    return (
      <Screen maxWidth={wide ? 980 : 560}>
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

  return (
    <Screen maxWidth={wide ? 980 : 560}>
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
      <Text style={styles.heading}>{drill.prompt}</Text>

      <BoardStage
        board={
          <ChessBoard
            key={boardKey}
            fen={boardFen}
            orientation={orientation}
            interactive={round === 'playing'}
            lastMove={lastMove}
            attentionSquares={
              learn && round === 'playing' && drill.atRiskSquare ? [drill.atRiskSquare] : []
            }
            highlightSquares={round === 'playing' ? [] : highlights}
            onMove={onMove}
          />
        }
        aside={
          round === 'playing' ? (
            <View style={styles.guide}>
              <Text style={styles.hint}>
                {learn
                  ? 'The marked square is yours and under fire. Save it.'
                  : 'No hints. One miss ends the run.'}
              </Text>
              {learn ? (
                <Button
                  label="Show the idea"
                  variant="secondary"
                  onPress={() => {
                    noteMiss();
                    setRound('revealed');
                    setHighlights([drill.atRiskSquare]);
                    setScore((s) => ({ ...s, total: s.total + 1 }));
                  }}
                />
              ) : null}
            </View>
          ) : (
            <>
              <BlunderOverlay
                visible={round === 'correct'}
                tone="success"
                title="Nice save"
                message={drill.note}
                actionLabel="Next"
                onDismiss={next}
              />
              <BlunderOverlay
                visible={round === 'retry'}
                tone="danger"
                title="Not quite"
                message="That doesn't save your piece. Look again and try another move."
                actionLabel="Try again"
                onDismiss={tryAgain}
              />
              <BlunderOverlay
                visible={round === 'revealed'}
                tone="warn"
                title="Here's the idea"
                message={drill.note}
                actionLabel="Next"
                onDismiss={next}
              />
              <BlunderOverlay
                visible={round === 'streakEnd'}
                tone="danger"
                title="Streak over"
                message={`${score.correct} in a row. ${drill.note}`}
                actionLabel="Done"
                onDismiss={() => begin(sessionFor(setId))}
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
    fontSize: 13,
  },
  pickTextOn: {
    color: colors.accentText,
  },
  reviewLabel: {
    fontFamily: fonts.bodyBold,
    color: colors.accent,
    fontSize: 13,
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
    fontSize: 12,
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
    color: colors.textMuted,
    fontSize: 13,
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
  hint: {
    fontFamily: fonts.body,
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
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
    fontSize: 12,
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
});
