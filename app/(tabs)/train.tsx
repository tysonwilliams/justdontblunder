import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Square } from 'chess.js';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BlunderOverlay } from '@/src/components/Board/BlunderOverlay';
import { ChessBoard, type BoardMoveEvent } from '@/src/components/Board/ChessBoard';
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
  const insets = useSafeAreaInsets();
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

    // Always show the piece on its destination.
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
      <ScrollView
        style={styles.screen}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.md }]}>
        <Text style={styles.heading}>Session complete</Text>
        <Text style={styles.sub}>
          {score.correct}/{score.total} correct · {pct}%
        </Text>
        <Pressable style={styles.primary} onPress={restart}>
          <Text style={styles.primaryText}>Train again</Text>
        </Pressable>
      </ScrollView>
    );
  }

  if (!drill) return null;

  const boardFen = displayFen ?? drill.fen;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.xl },
      ]}>
      <View style={styles.top}>
        <Text style={styles.kicker}>
          Drill {index + 1}/{session.positions.length} · {themeLabel(drill.theme)}
        </Text>
        <Text style={styles.heading}>{drill.prompt}</Text>
      </View>

      <ChessBoard
        key={boardKey}
        fen={boardFen}
        orientation={orientation}
        interactive={round === 'playing'}
        lastMove={lastMove}
        attentionSquares={
          round === 'playing' && drill.atRiskSquare ? [drill.atRiskSquare] : []
        }
        highlightSquares={round === 'playing' ? [] : highlights}
        onMove={onMove}
      />

      {round === 'playing' ? (
        <Text style={styles.hint}>Soft highlight = your piece under fire. Save it.</Text>
      ) : null}

      <BlunderOverlay
        visible={round === 'correct'}
        tone="success"
        title="Nice save!"
        message={drill.note}
        actionLabel="Got it"
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
        actionLabel="Got it"
        onDismiss={next}
      />

      {round === 'playing' ? (
        <Pressable
          style={styles.ghost}
          onPress={() => {
            setRound('revealed');
            setHighlights([drill.atRiskSquare]);
            markDrillResult(false);
            setScore((s) => ({ ...s, total: s.total + 1 }));
          }}>
          <Text style={styles.ghostText}>Show idea</Text>
        </Pressable>
      ) : null}

      {round === 'correct' || round === 'revealed' ? (
        <Pressable style={styles.primary} onPress={next}>
          <Text style={styles.primaryText}>Next position</Text>
        </Pressable>
      ) : null}

      {round === 'retry' ? (
        <Pressable style={styles.primary} onPress={tryAgain}>
          <Text style={styles.primaryText}>Try again</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: {
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },
  top: { gap: 6 },
  kicker: {
    fontFamily: fonts.bodyBold,
    color: colors.accent,
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  heading: {
    fontFamily: fonts.display,
    color: colors.text,
    fontSize: 24,
  },
  hint: {
    fontFamily: fonts.body,
    color: colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
  },
  sub: {
    fontFamily: fonts.body,
    color: colors.textMuted,
    fontSize: 16,
  },
  primary: {
    backgroundColor: colors.accent,
    borderRadius: radii.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryText: {
    fontFamily: fonts.bodyExtra,
    color: '#042016',
    fontSize: 16,
  },
  ghost: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  ghostText: {
    fontFamily: fonts.bodyBold,
    color: colors.textMuted,
  },
});
