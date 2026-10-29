import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Square } from 'chess.js';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BlunderOverlay } from '@/src/components/Board/BlunderOverlay';
import { ChessBoard, type BoardMoveEvent } from '@/src/components/Board/ChessBoard';
import {
  EMPTY_HABITS,
  HabitChecklist,
  habitsComplete,
  type HabitState,
} from '@/src/components/HabitChecklist';
import { quickPatternFeedback, type MoveFeedback } from '@/src/engine/evaluate';
import { createGame } from '@/src/logic/game';
import { useProgressStore } from '@/src/store/progress';
import { colors, fonts, radii, spacing } from '@/src/theme';

export default function PracticeScreen() {
  const insets = useSafeAreaInsets();
  const habitTutorialDone = useProgressStore((s) => s.habitTutorialDone);
  const completeHabitTutorial = useProgressStore((s) => s.completeHabitTutorial);
  const markPracticeMove = useProgressStore((s) => s.markPracticeMove);

  const [fen, setFen] = useState(() => createGame().fen());
  const [boardKey, setBoardKey] = useState(0);
  const [habits, setHabits] = useState<HabitState>(EMPTY_HABITS);
  const [pending, setPending] = useState<BoardMoveEvent | null>(null);
  const [feedback, setFeedback] = useState<MoveFeedback | null>(null);
  const [highlights, setHighlights] = useState<Square[]>([]);
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(null);
  const [gateMessage, setGateMessage] = useState<string | null>(null);

  const requireHabits = !habitTutorialDone;

  const resetBoard = () => {
    setFen(createGame().fen());
    setBoardKey((k) => k + 1);
    setHabits(EMPTY_HABITS);
    setPending(null);
    setFeedback(null);
    setHighlights([]);
    setLastMove(null);
    setGateMessage(null);
  };

  const onMove = (event: BoardMoveEvent) => {
    if (requireHabits && !habitsComplete(habits)) {
      setGateMessage('Tap the Checks / Captures / Threats / Hanging checklist first.');
      setPending(event);
      return false;
    }
    applyMove(event);
    return true;
  };

  const applyMove = (event: BoardMoveEvent) => {
    setGateMessage(null);
    setFen(event.afterFen);
    setLastMove({ from: event.from, to: event.to });
    const mover = event.beforeFen.includes(' w ') ? 'w' : 'b';
    const result = quickPatternFeedback(event.afterFen, mover);
    setFeedback(result);
    setHighlights(result.squares);
    markPracticeMove(result.ok, !result.ok);
    if (!habitTutorialDone) {
      completeHabitTutorial();
    }
    setHabits(EMPTY_HABITS);
    setPending(null);
  };

  const confirmPending = () => {
    if (!pending) return;
    if (requireHabits && !habitsComplete(habits)) {
      setGateMessage('Still missing a checklist item — take ten seconds.');
      return;
    }
    applyMove(pending);
    setBoardKey((k) => k + 1);
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.xl },
      ]}>
      <Text style={styles.heading}>Practice sandbox</Text>
      <Text style={styles.sub}>
        Move both sides. Run the habit checklist, then see if anything is hanging.
      </Text>

      <ChessBoard
        key={boardKey}
        fen={fen}
        highlightSquares={highlights}
        lastMove={lastMove}
        onMove={onMove}
      />

      <HabitChecklist value={habits} onChange={setHabits} required={requireHabits} />

      {gateMessage ? <Text style={styles.gate}>{gateMessage}</Text> : null}

      {pending ? (
        <Pressable style={styles.primary} onPress={confirmPending}>
          <Text style={styles.primaryText}>Confirm move {pending.san}</Text>
        </Pressable>
      ) : null}

      <BlunderOverlay
        visible={Boolean(feedback)}
        tone={feedback?.ok ? 'success' : 'danger'}
        title={feedback?.title ?? ''}
        message={feedback?.message ?? ''}
        hint={feedback?.bestMoveHint}
        onDismiss={() => {
          setFeedback(null);
          setHighlights([]);
        }}
      />

      <View style={styles.actions}>
        <Pressable style={styles.ghost} onPress={resetBoard}>
          <Text style={styles.ghostText}>Reset board</Text>
        </Pressable>
        {!habitTutorialDone ? (
          <Pressable
            style={styles.ghost}
            onPress={() => {
              completeHabitTutorial();
              setGateMessage(null);
            }}>
            <Text style={styles.ghostText}>Skip checklist gate</Text>
          </Pressable>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: {
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },
  heading: {
    fontFamily: fonts.display,
    color: colors.text,
    fontSize: 24,
  },
  sub: {
    fontFamily: fonts.body,
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
  },
  gate: {
    fontFamily: fonts.bodyBold,
    color: colors.warn,
    fontSize: 13,
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
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  ghost: {
    paddingVertical: 10,
  },
  ghostText: {
    fontFamily: fonts.bodyBold,
    color: colors.textMuted,
  },
});
