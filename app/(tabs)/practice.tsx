import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import type { Square } from 'chess.js';

import { playMoveSound } from '@/src/audio/playMoveSound';
import { soundForSan } from '@/src/audio/moveSound';
import { BlunderOverlay } from '@/src/components/Board/BlunderOverlay';
import { ChessBoard, type BoardMoveEvent } from '@/src/components/Board/ChessBoard';
import { BoardStage, boardStageIsWide } from '@/src/components/ui/BoardStage';
import { Button } from '@/src/components/ui/Button';
import { Screen } from '@/src/components/ui/Screen';
import { quickPatternFeedback, type MoveFeedback } from '@/src/engine/evaluate';
import { findHangingPieces } from '@/src/engine/patterns';
import { createGame, snapshot } from '@/src/logic/game';
import { chooseBlackReply } from '@/src/logic/reply';
import { useProgressStore } from '@/src/store/progress';
import { colors, fonts, spacing } from '@/src/theme';

const REPLY_DELAY_MS = 420;

function gameResultLine(fen: string): string | null {
  const snap = snapshot(createGame(fen));
  if (!snap.isGameOver) return null;
  if (snap.isCheckmate) {
    return snap.turn === 'w' ? 'Checkmate — Black wins' : 'Checkmate — White wins';
  }
  if (snap.isStalemate) return 'Stalemate — draw';
  return 'Draw';
}

export default function PracticeScreen() {
  const { width } = useWindowDimensions();
  const wide = boardStageIsWide(width);
  const markPracticeMove = useProgressStore((s) => s.markPracticeMove);

  const [fen, setFen] = useState(() => createGame().fen());
  const [boardKey, setBoardKey] = useState(0);
  const [feedback, setFeedback] = useState<MoveFeedback | null>(null);
  const [replySan, setReplySan] = useState<string | null>(null);
  const [thinking, setThinking] = useState(false);
  const [highlights, setHighlights] = useState<Square[]>([]);
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(null);
  const replyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resultLine = useMemo(() => gameResultLine(fen), [fen]);
  const gameOver = resultLine != null;

  useEffect(() => {
    return () => {
      if (replyTimer.current) clearTimeout(replyTimer.current);
    };
  }, []);

  const resetBoard = () => {
    if (replyTimer.current) clearTimeout(replyTimer.current);
    setFen(createGame().fen());
    setBoardKey((k) => k + 1);
    setFeedback(null);
    setReplySan(null);
    setThinking(false);
    setHighlights([]);
    setLastMove(null);
  };

  const onMove = (event: BoardMoveEvent) => {
    if (thinking || gameOver) return false;
    const result = quickPatternFeedback(event.afterFen, 'w');
    const hadHanging = findHangingPieces(event.beforeFen, 'w').length > 0;
    // Save only when something was already hanging and this move cleaned it up.
    markPracticeMove(result.ok && hadHanging, !result.ok);
    setFen(event.afterFen);
    setLastMove({ from: event.from, to: event.to });
    setFeedback(result);
    setReplySan(null);
    setHighlights(result.squares);

    const afterSnap = snapshot(createGame(event.afterFen));
    if (afterSnap.isGameOver) {
      setThinking(false);
      return true;
    }

    setThinking(true);
    if (replyTimer.current) clearTimeout(replyTimer.current);
    replyTimer.current = setTimeout(() => {
      const reply = chooseBlackReply(event.afterFen);
      if (reply) {
        setFen(reply.fen);
        setLastMove({ from: reply.from, to: reply.to });
        setReplySan(reply.san);
        playMoveSound(soundForSan(reply.san));
      }
      setThinking(false);
    }, REPLY_DELAY_MS);
    return true;
  };

  const panelMessage = feedback
    ? replySan
      ? `${feedback.message} Black played ${replySan}.`
      : thinking
        ? `${feedback.message} Black is moving.`
        : feedback.message
    : '';

  return (
    <Screen maxWidth={wide ? 980 : 560}>
      <Text style={styles.eyebrow}>Practice</Text>
      <Text style={styles.heading}>Your game</Text>
      <Text style={styles.sub}>
        You play White. Black answers. If you leave a piece loose, they take it.
      </Text>

      <BoardStage
        board={
          <ChessBoard
            key={boardKey}
            fen={fen}
            orientation="white"
            interactive={!thinking && !gameOver && fen.includes(' w ')}
            highlightSquares={highlights}
            lastMove={lastMove}
            onMove={onMove}
          />
        }
        aside={
          <View style={styles.guide}>
            {gameOver ? (
              <>
                <Text style={styles.result}>{resultLine}</Text>
                <Button label="New game" onPress={resetBoard} />
              </>
            ) : feedback ? (
              <BlunderOverlay
                visible
                tone={feedback.ok ? 'success' : 'danger'}
                title={feedback.title}
                message={panelMessage}
                hint={feedback.bestMoveHint}
                actionLabel="Continue"
                onDismiss={() => {
                  setFeedback(null);
                  setHighlights([]);
                  setReplySan(null);
                }}
              />
            ) : (
              <Text style={styles.reminder}>
                Glance for checks, captures, threats, and loose pieces.
              </Text>
            )}
            {!gameOver ? (
              <Button label="New game" variant="secondary" onPress={resetBoard} />
            ) : null}
          </View>
        }
      />
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
  guide: {
    gap: spacing.sm,
  },
  reminder: {
    fontFamily: fonts.body,
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
  },
  result: {
    fontFamily: fonts.bodyBold,
    color: colors.text,
    fontSize: 17,
    lineHeight: 24,
  },
});
