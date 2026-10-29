import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { Square } from 'chess.js';

import { BlunderOverlay } from '@/src/components/Board/BlunderOverlay';
import { ChessBoard, type BoardMoveEvent } from '@/src/components/Board/ChessBoard';
import {
  EMPTY_HABITS,
  HabitChecklist,
  habitsComplete,
  type HabitState,
} from '@/src/components/HabitChecklist';
import { Button } from '@/src/components/ui/Button';
import { Screen } from '@/src/components/ui/Screen';
import { quickPatternFeedback, type MoveFeedback } from '@/src/engine/evaluate';
import { createGame } from '@/src/logic/game';
import { useProgressStore } from '@/src/store/progress';
import { colors, fonts, radii, spacing } from '@/src/theme';

export default function PracticeScreen() {
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
      setGateMessage('Tap Checks, Captures, Threats, and Hanging before the move counts.');
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
    <Screen maxWidth={560}>
      <Text style={styles.eyebrow}>Sandbox</Text>
      <Text style={styles.heading}>Practice board</Text>
      <Text style={styles.sub}>
        Move both sides. Run the habit checklist, then see if anything you own is hanging.
      </Text>

      <ChessBoard
        key={boardKey}
        fen={fen}
        highlightSquares={highlights}
        lastMove={lastMove}
        onMove={onMove}
      />

      <HabitChecklist value={habits} onChange={setHabits} required={requireHabits} />

      {gateMessage ? (
        <View style={styles.gate}>
          <Text style={styles.gateText}>{gateMessage}</Text>
        </View>
      ) : null}

      {pending ? <Button label={`Confirm ${pending.san}`} onPress={confirmPending} /> : null}

      <BlunderOverlay
        visible={Boolean(feedback)}
        tone={feedback?.ok ? 'success' : 'danger'}
        title={feedback?.title ?? ''}
        message={feedback?.message ?? ''}
        hint={feedback?.bestMoveHint}
        actionLabel="Continue"
        onDismiss={() => {
          setFeedback(null);
          setHighlights([]);
        }}
      />

      <View style={styles.actions}>
        <Button label="Reset board" variant="secondary" onPress={resetBoard} />
        {!habitTutorialDone ? (
          <Button
            label="Skip checklist gate"
            variant="ghost"
            onPress={() => {
              completeHabitTutorial();
              setGateMessage(null);
            }}
          />
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  eyebrow: {
    fontFamily: fonts.bodyBold,
    color: colors.accent,
    fontSize: 12,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  heading: {
    fontFamily: fonts.display,
    color: colors.text,
    fontSize: 28,
    letterSpacing: -0.4,
  },
  sub: {
    fontFamily: fonts.body,
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
  },
  gate: {
    backgroundColor: colors.warnSoft,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
  },
  gateText: {
    fontFamily: fonts.bodyBold,
    color: colors.warn,
    fontSize: 14,
    lineHeight: 20,
  },
  actions: {
    gap: spacing.xs,
  },
});
