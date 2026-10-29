import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import type { Square } from 'chess.js';

import { BlunderOverlay } from '@/src/components/Board/BlunderOverlay';
import { ChessBoard, type BoardMoveEvent } from '@/src/components/Board/ChessBoard';
import { BoardStage, boardStageIsWide } from '@/src/components/ui/BoardStage';
import { Button } from '@/src/components/ui/Button';
import { Screen } from '@/src/components/ui/Screen';
import {
  createDailySession,
  isCorrectDrillMove,
  themeLabel,
  type DrillPosition,
  type DrillSession,
} from '@/src/logic/drills';
import { useProgressStore } from '@/src/store/progress';
import { colors, fonts, radii, spacing } from '@/src/theme';

type RoundState = 'playing' | 'correct' | 'retry' | 'revealed';

export default function TrainScreen() {
  const { width } = useWindowDimensions();
  const wide = boardStageIsWide(width);
  const markDrillResult = useProgressStore((s) => s.markDrillResult);

  const [session, setSession] = useState<DrillSession>(() => createDailySession());
  const [index, setIndex] = useState(0);
  const [round, setRound] = useState<RoundState>('playing');
  const [highlights, setHighlights] = useState<Square[]>([]);
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(null);
  const [displayFen, setDisplayFen] = useState<string | null>(null);
  const [boardKey, setBoardKey] = useState(0);
  const [score, setScore] = useState({ correct: 0, total: 0 });

  const drill: DrillPosition | undefined = session.positions[index];
  const done = index >= session.positions.length;

  const orientation = useMemo(
    () => (drill?.sideToMove === 'b' ? 'black' : 'white') as 'white' | 'black',
    [drill?.sideToMove],
  );

  useEffect(() => {
    if (!drill) return;
    setDisplayFen(drill.fen);
    setRound('playing');
    setHighlights([]);
    setLastMove(null);
  }, [drill?.id, drill?.fen]);

  const restart = () => {
    setSession(createDailySession());
    setIndex(0);
    setRound('playing');
    setHighlights([]);
    setLastMove(null);
    setDisplayFen(null);
    setScore({ correct: 0, total: 0 });
    setBoardKey((k) => k + 1);
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

  const onMove = (event: BoardMoveEvent) => {
    if (!drill || round !== 'playing') return false;

    setDisplayFen(event.afterFen);
    setLastMove({ from: event.from, to: event.to });

    const ok = isCorrectDrillMove(drill, event.from, event.to);
    if (ok) {
      setScore((s) => ({ correct: s.correct + 1, total: s.total + 1 }));
      markDrillResult(true);
      setRound('correct');
      setHighlights([event.to]);
    } else {
      setRound('retry');
      setHighlights([event.from, event.to, drill.atRiskSquare]);
    }
    return true;
  };

  if (done) {
    const pct = score.total ? Math.round((score.correct / score.total) * 100) : 0;
    return (
      <Screen>
        <View style={styles.doneCard}>
          <Text style={styles.eyebrow}>Session</Text>
          <Text style={styles.heading}>That's the set</Text>
          <Text style={styles.score}>
            {score.correct}/{score.total}
          </Text>
          <Text style={styles.sub}>{pct}% saved on the first try</Text>
          <Button label="Train again" onPress={restart} />
        </View>
      </Screen>
    );
  }

  if (!drill) return null;

  const boardFen = displayFen ?? drill.fen;
  const progress = (index + (round === 'playing' ? 0 : 1)) / session.positions.length;

  return (
    <Screen maxWidth={wide ? 980 : 560}>
      <View style={styles.metaRow}>
        <Text style={styles.chip}>{themeLabel(drill.theme)}</Text>
        <Text style={styles.count}>
          {index + 1} / {session.positions.length}
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
            attentionSquares={round === 'playing' && drill.atRiskSquare ? [drill.atRiskSquare] : []}
            highlightSquares={round === 'playing' ? [] : highlights}
            onMove={onMove}
          />
        }
        aside={
          round === 'playing' ? (
            <View style={styles.guide}>
              <Text style={styles.hint}>The marked square is yours and under fire. Save it.</Text>
              <Button
                label="Show the idea"
                variant="secondary"
                onPress={() => {
                  setRound('revealed');
                  setHighlights([drill.atRiskSquare]);
                  markDrillResult(false);
                  setScore((s) => ({ ...s, total: s.total + 1 }));
                }}
              />
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
            </>
          )
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
