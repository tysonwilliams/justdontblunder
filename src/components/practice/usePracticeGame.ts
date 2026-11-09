import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Square } from 'chess.js';

import { soundForSan } from '@/src/audio/moveSound';
import { playFeedback } from '@/src/feedback/playFeedback';
import type { BoardArrow, BoardMoveEvent } from '@/src/components/Board/boardTypes';
import { judgePracticeMove, type MoveFeedback } from '@/src/engine/evaluate';
import { findHangingPieces } from '@/src/engine/patterns';
import { createGame, snapshot } from '@/src/logic/game';
import { coachSpeech } from '@/src/logic/coach';
import { chooseBlackReply } from '@/src/logic/reply';
import { countRetriedMove } from '@/src/store/drillStats';
import { useProgressStore } from '@/src/store/progress';
import { markColor } from '@/src/theme';
import { useTheme } from '@/src/theme/useTheme';

const REPLY_DELAY_MS = 700;

export function sentence(value: string): string {
  const trimmed = value.trim();
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

export function usePracticeGame() {
  const { colors, scheme } = useTheme();
  const markPracticeMove = useProgressStore((s) => s.markPracticeMove);
  const awardXp = useProgressStore((s) => s.awardXp);
  const [fen, setFen] = useState(() => createGame().fen());
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
  const checkpoint = useRef<{ fen: string; lastMove: { from: Square; to: Square } | null } | null>(null);
  lastMoveRef.current = lastMove;
  const gate = useRef({ thinking, gameOver: false });

  const resultLine = useMemo(() => gameResultLine(fen), [fen]);
  const gameOver = resultLine != null;
  gate.current = { thinking, gameOver };
  const hangingNow = useMemo(() => (fen.includes(' w ') ? findHangingPieces(fen, 'w') : []), [fen]);

  useEffect(() => {
    return () => {
      if (replyTimer.current) clearTimeout(replyTimer.current);
    };
  }, []);

  const resetBoard = () => {
    if (replyTimer.current) clearTimeout(replyTimer.current);
    setFen(createGame().fen());
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
  };

  const onMove = useCallback(
    (event: BoardMoveEvent) => {
      if (gate.current.thinking || gate.current.gameOver) return false;
      const result = judgePracticeMove(event.beforeFen, event.from, event.to, 'w');
      const hadHanging = findHangingPieces(event.beforeFen, 'w').length > 0;
      const retried = retryUncounted.current;
      retryUncounted.current = false;
      if (countRetriedMove(retried)) {
        markPracticeMove(result.ok && hadHanging, !result.ok);
      }
      if (result.ok) checkpoint.current = null;
      else checkpoint.current = { fen: event.beforeFen, lastMove: lastMoveRef.current };
      const line = coachSpeech({
        kind: result.ok ? 'save' : 'blunder',
        fen: event.beforeFen,
        from: event.from,
        to: event.to,
      });
      awardXp(result.ok);
      setFen(event.afterFen);
      setLastMove({ from: event.from, to: event.to });
      setReplySan(null);
      if (result.ok) {
        setFeedback({ ...result, message: line });
        setStatus(null);
        setTone('success');
        setHighlights([]);
      } else {
        setStatus(null);
        setFeedback({ ...result, message: line });
        setTone('danger');
        setHighlights(result.squares);
      }

      const afterSnap = snapshot(createGame(event.afterFen));
      if (afterSnap.isGameOver) {
        setThinking(false);
        return result.ok;
      }

      setThinking(true);
      if (replyTimer.current) clearTimeout(replyTimer.current);
      replyTimer.current = setTimeout(() => {
        const reply = chooseBlackReply(event.afterFen);
        if (reply) {
          setFen(reply.fen);
          setLastMove({ from: reply.from, to: reply.to });
          setReplySan(reply.san);
          playFeedback(soundForSan(reply.san));
          const created = findHangingPieces(reply.fen, 'w');
          if (result.ok && !created[0]) setFeedback(null);
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
      return result.ok;
    },
    [awardXp, markPracticeMove],
  );

  const arrow = useMemo(() => {
    const drawn: BoardArrow[] = [];
    const preMoveHang = !feedback && !status ? hangingNow[0] : undefined;
    const marked = feedback?.squares?.length ? feedback.squares : preMoveHang?.squares;
    const arrowIsWarn = tone === 'warn' || Boolean(preMoveHang);
    if (marked?.[0] && marked[1]) {
      drawn.push({
        from: marked[1],
        to: marked[0],
        color: markColor(arrowIsWarn ? 'warning' : 'danger', scheme, colors),
      });
    }
    return drawn;
  }, [colors, feedback, hangingNow, scheme, status, tone]);

  const panelMessage = feedback
    ? replySan && tone !== 'warn'
      ? `${sentence(feedback.message)} Black played ${replySan}.`
      : thinking
        ? `${sentence(feedback.message)} Black is moving.`
        : sentence(feedback.message)
    : '';

  return {
    fen,
    feedback,
    status,
    tone,
    thinking,
    highlights,
    lastMove,
    resultLine,
    gameOver,
    hangingNow,
    arrow,
    panelMessage,
    resetBoard,
    dismissFeedback,
    tryAgain,
    onMove,
  };
}
