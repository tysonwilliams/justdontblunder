import { useMemo, useState } from 'react';
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

type RoundState = 'playing' | 'correct' | 'miss';

export default function TrainScreen() {
  const insets = useSafeAreaInsets();
  const markDrillResult = useProgressStore((s) => s.markDrillResult);

  const [session, setSession] = useState<DrillSession>(() => createDailySession());
  const [index, setIndex] = useState(0);
  const [round, setRound] = useState<RoundState>('playing');
  const [highlights, setHighlights] = useState<Square[]>([]);
  const [boardKey, setBoardKey] = useState(0);
  const [score, setScore] = useState({ correct: 0, total: 0 });

  const drill: DrillPosition | undefined = session.positions[index];
  const done = index >= session.positions.length;

  const orientation = useMemo(
    () => (drill?.sideToMove === 'b' ? 'black' : 'white') as 'white' | 'black',
    [drill?.sideToMove],
  );

  const restart = () => {
    setSession(createDailySession());
    setIndex(0);
    setRound('playing');
    setHighlights([]);
    setScore({ correct: 0, total: 0 });
    setBoardKey((k) => k + 1);
  };

  const next = () => {
    setRound('playing');
    setHighlights([]);
    setIndex((i) => i + 1);
    setBoardKey((k) => k + 1);
  };

  const onMove = (event: BoardMoveEvent) => {
    if (!drill || round !== 'playing') return false;
    const ok = isCorrectDrillMove(drill, event.from, event.to);
    setScore((s) => ({ correct: s.correct + (ok ? 1 : 0), total: s.total + 1 }));
    markDrillResult(ok);
    setRound(ok ? 'correct' : 'miss');
    setHighlights(ok ? [event.to] : [event.from, event.to]);
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
        fen={drill.fen}
        orientation={orientation}
        interactive={round === 'playing'}
        highlightSquares={highlights}
        onMove={onMove}
      />

      <BlunderOverlay
        visible={round !== 'playing'}
        tone={round === 'correct' ? 'success' : 'danger'}
        title={round === 'correct' ? 'Nice save!' : 'Not that one'}
        message={drill.note}
        onDismiss={next}
      />

      {round === 'playing' ? (
        <Pressable
          style={styles.ghost}
          onPress={() => {
            setRound('miss');
            markDrillResult(false);
            setScore((s) => ({ ...s, total: s.total + 1 }));
          }}>
          <Text style={styles.ghostText}>Show idea</Text>
        </Pressable>
      ) : (
        <Pressable style={styles.primary} onPress={next}>
          <Text style={styles.primaryText}>Next position</Text>
        </Pressable>
      )}
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
