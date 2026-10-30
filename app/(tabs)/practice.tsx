import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import type { Square } from 'chess.js';

import { playMoveSound } from '@/src/audio/playMoveSound';
import { soundForSan } from '@/src/audio/moveSound';
import { BlunderOverlay } from '@/src/components/Board/BlunderOverlay';
import { ChessBoard, type BoardArrow, type BoardMoveEvent } from '@/src/components/Board/ChessBoard';
import { BoardLead } from '@/src/components/ui/BoardLead';
import { BoardStage, boardStageIsWide } from '@/src/components/ui/BoardStage';
import { Button } from '@/src/components/ui/Button';
import { ColorLegend } from '@/src/components/ui/ColorLegend';
import { Screen } from '@/src/components/ui/Screen';
import { judgePracticeMove, type MoveFeedback } from '@/src/engine/evaluate';
import { findHangingPieces } from '@/src/engine/patterns';
import { HABIT_PROMPT } from '@/src/logic/drills';
import { createGame, snapshot } from '@/src/logic/game';
import { chooseBlackReply } from '@/src/logic/reply';
import { useProgressStore } from '@/src/store/progress';
import { colors, fonts, spacing } from '@/src/theme';

const REPLY_DELAY_MS = 700;

function sentence(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return '';
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function gameResultLine(fen: string): string | null {
  const snap = snapshot(createGame(fen));
  if (!snap.isGameOver) return null;
  if (snap.isCheckmate) {
    return snap.turn === 'w' ? 'Checkmate — Black wins.' : 'Checkmate — White wins.';
  }
  if (snap.isStalemate) return 'Stalemate — draw.';
  return 'Draw.';
}

export default function PracticeScreen() {
  const { width } = useWindowDimensions();
  const wide = boardStageIsWide(width);
  const markPracticeMove = useProgressStore((s) => s.markPracticeMove);

  const [fen, setFen] = useState(() => createGame().fen());
  const [boardKey, setBoardKey] = useState(0);
  const [feedback, setFeedback] = useState<MoveFeedback | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [tone, setTone] = useState<'danger' | 'success' | 'warn'>('danger');
  const [replySan, setReplySan] = useState<string | null>(null);
  const [thinking, setThinking] = useState(false);
  const [highlights, setHighlights] = useState<Square[]>([]);
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(null);
  const replyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resultLine = useMemo(() => gameResultLine(fen), [fen]);
  const gameOver = resultLine != null;
  const hangingNow = useMemo(
    () => (fen.includes(' w ') ? findHangingPieces(fen, 'w') : []),
    [fen],
  );

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
    setStatus(null);
    setReplySan(null);
    setThinking(false);
    setHighlights([]);
    setLastMove(null);
  };

  const onMove = (event: BoardMoveEvent) => {
    if (thinking || gameOver) return false;
    const result = judgePracticeMove(event.beforeFen, event.from, event.to, 'w');
    const hadHanging = findHangingPieces(event.beforeFen, 'w').length > 0;
    markPracticeMove(result.ok && hadHanging, !result.ok);
    setFen(event.afterFen);
    setLastMove({ from: event.from, to: event.to });
    setReplySan(null);
    if (result.ok) {
      setFeedback(null);
      setStatus(`${result.title}. ${result.message}`);
      setTone('success');
      setHighlights([]);
    } else {
      setStatus(null);
      setFeedback(result);
      setTone('danger');
      setHighlights(result.squares);
    }

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
        const created = findHangingPieces(reply.fen, 'w');
        if (result.ok) setStatus(null);
        if (result.ok && created[0]) {
          const name = created[0].message.replace(/^You left the /, '').replace(/ hanging$/, '');
          setFeedback({
            ok: false,
            title: 'Hanging piece',
            message: `Black played ${reply.san}. Before you move: your ${name} on ${created[0].squares[0]} is hanging`,
            squares: created[0].squares,
            severity: 'mistake',
            pattern: created[0],
          });
          setTone('warn');
          setHighlights(created[0].squares);
        }
      }
      setThinking(false);
    }, REPLY_DELAY_MS);
    return true;
  };

  const arrow: BoardArrow[] = [];
  const preMoveHang = !feedback && !status ? hangingNow[0] : undefined;
  const marked = feedback?.squares?.length ? feedback.squares : preMoveHang?.squares;
  const arrowIsWarn = tone === 'warn' || Boolean(preMoveHang);
  if (marked?.[0] && marked[1]) {
    arrow.push({
      from: marked[1],
      to: marked[0],
      color: arrowIsWarn ? colors.warn : colors.danger,
    });
  }

  const panelMessage = feedback
    ? replySan && tone !== 'warn'
      ? `${sentence(feedback.message)} Black played ${replySan}.`
      : thinking
        ? `${sentence(feedback.message)} Black is moving.`
        : sentence(feedback.message)
    : '';

  return (
    <Screen maxWidth={wide ? 1120 : 560}>
      <BoardLead>
        <Text style={styles.eyebrow}>Practice</Text>
        <Text style={styles.heading}>Your game</Text>
        <Text style={styles.habit}>{HABIT_PROMPT}</Text>
        <Text style={styles.sub}>
          You play White. Black answers. If you leave a piece hanging, they take it.
        </Text>
        <ColorLegend />
      </BoardLead>

      <BoardStage
        asideFirst={!wide && feedback != null}
        board={
          <ChessBoard
            key={boardKey}
            fen={fen}
            orientation="white"
            interactive={!thinking && !gameOver && fen.includes(' w ')}
            highlightSquares={feedback && tone === 'danger' ? highlights : []}
            attentionSquares={
              tone === 'warn' ? highlights : preMoveHang ? preMoveHang.squares : []
            }
            highlightTone="danger"
            arrows={feedback && tone === 'success' ? [] : arrow}
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
                tone={tone}
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
            ) : status ? (
              <Text style={styles.reminder}>{status}</Text>
            ) : hangingNow[0] ? (
              <BlunderOverlay
                visible
                tone="warn"
                title="Hanging piece"
                message={sentence(
                  `Before you move: your ${hangingNow[0].message.replace('You left the ', '').replace(' hanging', '')} on ${hangingNow[0].squares[0]} is hanging`,
                )}
              />
            ) : (
              <Text style={styles.reminder}>{HABIT_PROMPT}</Text>
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
    fontSize: 14,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  heading: {
    fontFamily: fonts.display,
    color: colors.text,
    fontSize: 28,
    letterSpacing: -0.4,
  },
  habit: {
    fontFamily: fonts.bodyBold,
    color: colors.warn,
    fontSize: 16,
    lineHeight: 22,
  },
  sub: {
    fontFamily: fonts.body,
    color: colors.text,
    fontSize: 16,
    lineHeight: 24,
  },
  guide: {
    gap: spacing.sm,
  },
  reminder: {
    fontFamily: fonts.bodyBold,
    color: colors.text,
    fontSize: 16,
    lineHeight: 24,
  },
  result: {
    fontFamily: fonts.bodyBold,
    color: colors.text,
    fontSize: 17,
    lineHeight: 24,
  },
});
