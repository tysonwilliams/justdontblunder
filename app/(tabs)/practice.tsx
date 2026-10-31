import { useEffect, useMemo, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import type { Square } from 'chess.js';

import { playMoveSound } from '@/src/audio/playMoveSound';
import { soundForSan } from '@/src/audio/moveSound';
import { BlunderOverlay } from '@/src/components/Board/BlunderOverlay';
import { ChessBoard, type BoardArrow, type BoardMoveEvent } from '@/src/components/Board/ChessBoard';
import { BoardLead } from '@/src/components/ui/BoardLead';
import { Button } from '@/src/components/ui/Button';
import { ColorLegend } from '@/src/components/ui/ColorLegend';
import { PlayFrame } from '@/src/components/ui/PlayFrame';
import { play } from '@/src/components/ui/playStyles';
import { text } from '@/src/components/ui/text';
import { useLayout } from '@/src/components/ui/useLayout';
import { judgePracticeMove, type MoveFeedback } from '@/src/engine/evaluate';
import { findHangingPieces } from '@/src/engine/patterns';
import { HABIT_PROMPT } from '@/src/logic/drills';
import { createGame, snapshot } from '@/src/logic/game';
import { chooseBlackReply } from '@/src/logic/reply';
import { countRetriedMove } from '@/src/store/drillStats';
import { useProgressStore } from '@/src/store/progress';
import { colors } from '@/src/theme';

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
  const { split } = useLayout();
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
  const retryUncounted = useRef(false);
  const lastMoveRef = useRef(lastMove);
  const checkpoint = useRef<{ fen: string; lastMove: { from: Square; to: Square } | null } | null>(
    null,
  );
  lastMoveRef.current = lastMove;

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
    checkpoint.current = null;
    retryUncounted.current = false;
  };

  const dismissFeedback = () => {
    setFeedback(null);
    setHighlights([]);
    setReplySan(null);
  };

  const tryAgain = () => {
    const saved = checkpoint.current;
    if (!saved) return;
    if (replyTimer.current) clearTimeout(replyTimer.current);
    retryUncounted.current = true;
    setThinking(false);
    setFen(saved.fen);
    setLastMove(saved.lastMove);
    setFeedback(null);
    setStatus(null);
    setReplySan(null);
    setHighlights([]);
    setBoardKey((k) => k + 1);
  };

  const onMove = (event: BoardMoveEvent) => {
    if (thinking || gameOver) return false;
    const result = judgePracticeMove(event.beforeFen, event.from, event.to, 'w');
    const hadHanging = findHangingPieces(event.beforeFen, 'w').length > 0;
    const retried = retryUncounted.current;
    retryUncounted.current = false;
    if (countRetriedMove(retried)) {
      markPracticeMove(result.ok && hadHanging, !result.ok);
    }
    if (result.ok) checkpoint.current = null;
    else checkpoint.current = { fen: event.beforeFen, lastMove: lastMoveRef.current };
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
    <PlayFrame
      asideFirst={!split && feedback != null && tone !== 'danger'}
      intro={
        <BoardLead>
          <Text style={text.eyebrow}>Practice</Text>
          <Text style={text.title}>Your game</Text>
          <Text style={text.habit}>{HABIT_PROMPT}</Text>
          <Text style={text.body}>
            You play White. Black answers. If you leave a piece hanging, they take it.
          </Text>
          <ColorLegend />
        </BoardLead>
      }
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
          <View style={play.stack}>
            {feedback && (tone === 'danger' || !gameOver) ? (
              <BlunderOverlay
                visible
                tone={tone}
                title={feedback.title}
                message={gameOver && resultLine ? `${panelMessage} ${resultLine}` : panelMessage}
                hint={feedback.bestMoveHint}
                actionLabel={tone === 'danger' ? 'Try again' : 'Continue'}
                onDismiss={tone === 'danger' ? tryAgain : dismissFeedback}
                actionTestID={tone === 'danger' ? 'try-again' : undefined}
                secondaryLabel={tone === 'danger' ? 'Continue' : undefined}
                onSecondary={tone === 'danger' ? dismissFeedback : undefined}
              />
            ) : gameOver ? (
              <View style={play.guide}>
                <Text style={text.bodyStrong}>{resultLine}</Text>
                <Button label="New game" onPress={resetBoard} />
              </View>
            ) : status ? (
              <View style={play.guide}>
                <Text style={text.bodyStrong}>{status}</Text>
              </View>
            ) : hangingNow[0] ? (
              <BlunderOverlay
                visible
                tone="warn"
                title="Hanging piece"
                message={sentence(
                  `Before you move: your ${hangingNow[0].message.replace('You left the ', '').replace(' hanging', '')} on ${hangingNow[0].squares[0]} is hanging`,
                )}
              />
            ) : null}
            {!gameOver ? (
              <Button label="New game" variant="secondary" onPress={resetBoard} />
            ) : null}
          </View>
        }
    />
  );
}
