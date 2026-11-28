import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Color, Square } from 'chess.js';

import { soundForSan } from '@/src/audio/moveSound';
import { playFeedback } from '@/src/feedback/playFeedback';
import type { BoardArrow, BoardMoveEvent } from '@/src/components/Board/boardTypes';
import { judgePracticeMove, type MoveFeedback } from '@/src/engine/evaluate';
import { findHangingPieces } from '@/src/engine/patterns';
import { createGame, snapshot } from '@/src/logic/game';
import { coachSpeech } from '@/src/logic/coach';
import { drillFromBlunder } from '@/src/logic/personalDrill';
import {
  chooseBotReply,
  defaultPracticeElo,
  materialBalance,
  type PracticeElo,
} from '@/src/logic/reply';
import { bestPunishment } from '@/src/logic/safety';
import { countRetriedMove } from '@/src/store/drillStats';
import { useProgressStore } from '@/src/store/progress';
import { useHydrated } from '@/src/store/useHydrated';
import { markColor } from '@/src/theme';
import { useTheme } from '@/src/theme/useTheme';

const REPLY_DELAY_MS = 650;

export type PracticeBlunder = {
  fen: string;
  from: Square;
  to: Square;
  san: string;
};

type Snapshot = {
  fen: string;
  lastMove: { from: Square; to: Square } | null;
  countedMove: boolean;
  blunderFen?: string;
};

export function sentence(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function positionKey(fen: string): string {
  return fen.split(' ').slice(0, 4).join(' ');
}

function incomingMateThreat(fen: string, opp: Color): { san: string; from: Square; to: Square } | null {
  const game = createGame(fen);
  if (game.isGameOver() || game.isCheck()) return null;
  const parts = fen.split(' ');
  if (parts.length < 6) return null;
  parts[1] = opp;
  parts[3] = '-';
  try {
    const probe = createGame(parts.join(' '));
    const hit = bestPunishment(probe.fen());
    if (hit?.mate) return { san: hit.san, from: hit.from, to: hit.to };
  } catch {
    return null;
  }
  return null;
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

function turnOf(fen: string): Color {
  return fen.split(' ')[1] === 'b' ? 'b' : 'w';
}

function sideName(color: Color): string {
  return color === 'w' ? 'White' : 'Black';
}

export function usePracticeGame() {
  const { colors, scheme } = useTheme();
  const markPracticeMove = useProgressStore((s) => s.markPracticeMove);
  const awardXp = useProgressStore((s) => s.awardXp);
  const savePersonalDrill = useProgressStore((s) => s.savePersonalDrill);
  const experience = useProgressStore((s) => s.experience);
  const hydrated = useHydrated(useProgressStore.persist);

  const [playerColor, setPlayerColorState] = useState<Color>('w');
  const [flipped, setFlipped] = useState(false);
  const [botElo, setBotEloState] = useState<PracticeElo>(() => defaultPracticeElo(experience));
  const [fen, setFen] = useState(() => createGame().fen());
  const [feedback, setFeedback] = useState<MoveFeedback | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [tone, setTone] = useState<'danger' | 'success' | 'warn'>('danger');
  const [replySan, setReplySan] = useState<string | null>(null);
  const [thinking, setThinking] = useState(false);
  const [resigned, setResigned] = useState(false);
  const [highlights, setHighlights] = useState<Square[]>([]);
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(null);
  const [blunder, setBlunder] = useState<PracticeBlunder | null>(null);
  const [history, setHistory] = useState<Snapshot[]>([]);
  const [playerMoves, setPlayerMoves] = useState(0);
  const [sessionBlunders, setSessionBlunders] = useState<PracticeBlunder[]>([]);
  const [blundersAdded, setBlundersAdded] = useState(false);

  const replyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryUncounted = useRef(false);
  const manualElo = useRef(false);
  const lastMoveRef = useRef(lastMove);
  const historyRef = useRef(history);
  const checkpoint = useRef<Snapshot | null>(null);
  lastMoveRef.current = lastMove;
  historyRef.current = history;
  const gate = useRef({ thinking, gameOver: false, playerColor, botElo });

  useEffect(() => {
    if (!hydrated || manualElo.current) return;
    if (playerMoves > 0 || historyRef.current.length > 0) return;
    setBotEloState(defaultPracticeElo(experience));
  }, [experience, hydrated, playerMoves]);

  const setBotElo = useCallback((next: PracticeElo) => {
    manualElo.current = true;
    setBotEloState(next);
  }, []);

  const opponentColor: Color = playerColor === 'w' ? 'b' : 'w';
  const oppName = sideName(opponentColor);
  const boardResult = useMemo(() => gameResultLine(fen), [fen]);
  const resultLine = resigned ? `You resigned — ${oppName} wins.` : boardResult;
  const gameOver = resultLine != null;
  gate.current = { thinking, gameOver, playerColor, botElo };
  const isPlayerTurn = !resigned && turnOf(fen) === playerColor;
  const hangingNow = useMemo(
    () => (isPlayerTurn && !gameOver ? findHangingPieces(fen, playerColor) : []),
    [fen, gameOver, isPlayerTurn, playerColor],
  );
  const materialDelta = useMemo(() => materialBalance(fen, playerColor), [fen, playerColor]);
  const orientation: 'white' | 'black' =
    (playerColor === 'w') !== flipped ? 'white' : 'black';

  useEffect(() => {
    return () => {
      if (replyTimer.current) clearTimeout(replyTimer.current);
    };
  }, []);

  const scheduleOpeningBotMove = useCallback((startFen: string, elo: PracticeElo) => {
    setThinking(true);
    if (replyTimer.current) clearTimeout(replyTimer.current);
    replyTimer.current = setTimeout(() => {
      const reply = chooseBotReply(startFen, elo);
      if (reply) {
        setFen(reply.fen);
        setLastMove({ from: reply.from, to: reply.to });
        setReplySan(reply.san);
        playFeedback(soundForSan(reply.san));
      }
      setThinking(false);
    }, 360);
  }, []);

  const startFresh = useCallback(
    (nextColor: Color, nextElo: PracticeElo) => {
      if (replyTimer.current) clearTimeout(replyTimer.current);
      const freshFen = createGame().fen();
      setFen(freshFen);
      setFlipped(false);
      setResigned(false);
      setFeedback(null);
      setStatus(null);
      setReplySan(null);
      setThinking(false);
      setHighlights([]);
      setLastMove(null);
      setBlunder(null);
      setHistory([]);
      setPlayerMoves(0);
      setSessionBlunders([]);
      setBlundersAdded(false);
      checkpoint.current = null;
      retryUncounted.current = false;
      if (nextColor === 'b') {
        scheduleOpeningBotMove(freshFen, nextElo);
      }
    },
    [scheduleOpeningBotMove],
  );

  const resetBoard = useCallback(() => {
    startFresh(gate.current.playerColor, gate.current.botElo);
  }, [startFresh]);

  const setPlayerColor = useCallback(
    (next: Color) => {
      setPlayerColorState(next);
      startFresh(next, gate.current.botElo);
    },
    [startFresh],
  );

  const toggleFlip = useCallback(() => {
    setFlipped((value) => !value);
  }, []);

  const resignGame = useCallback(() => {
    if (gate.current.gameOver) return;
    if (replyTimer.current) clearTimeout(replyTimer.current);
    setThinking(false);
    setFeedback(null);
    setStatus(null);
    setHighlights([]);
    setResigned(true);
  }, []);

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

  const undoMove = () => {
    if (history.length === 0) return;
    if (replyTimer.current) clearTimeout(replyTimer.current);
    const previous = history[history.length - 1]!;
    setHistory((prev) => prev.slice(0, -1));
    if (previous.countedMove) {
      setPlayerMoves((n) => Math.max(0, n - 1));
    }
    if (previous.blunderFen) {
      setSessionBlunders((prev) => prev.filter((item) => item.fen !== previous.blunderFen));
      setBlundersAdded(false);
    }
    setResigned(false);
    setThinking(false);
    setFen(previous.fen);
    setLastMove(previous.lastMove);
    setFeedback(null);
    setStatus(null);
    setReplySan(null);
    setHighlights([]);
    setBlunder(null);
    checkpoint.current = null;
  };

  const addBlundersToReview = () => {
    if (blundersAdded || sessionBlunders.length === 0) return;
    for (const item of sessionBlunders) {
      const drill = drillFromBlunder(item);
      if (drill) savePersonalDrill(drill);
    }
    setBlundersAdded(true);
  };

  const onMove = useCallback(
    (event: BoardMoveEvent) => {
      const { thinking: busy, gameOver: over, playerColor: side, botElo: elo } = gate.current;
      if (busy || over || turnOf(event.beforeFen) !== side) return false;
      const result = judgePracticeMove(event.beforeFen, event.from, event.to, side, event.promotion);
      const hadHanging = findHangingPieces(event.beforeFen, side).length > 0;
      const retried = retryUncounted.current;
      retryUncounted.current = false;
      const countedMove = countRetriedMove(retried);
      const snapBefore: Snapshot = {
        fen: event.beforeFen,
        lastMove: lastMoveRef.current,
        countedMove,
        blunderFen: result.ok ? undefined : event.beforeFen,
      };
      setHistory((prev) => [...prev.slice(-40), snapBefore]);

      if (countedMove) {
        markPracticeMove(result.ok && hadHanging, !result.ok);
        awardXp(result.ok);
        setPlayerMoves((n) => n + 1);
      }
      if (result.ok) checkpoint.current = null;
      else checkpoint.current = snapBefore;
      const line = coachSpeech({
        kind: result.ok ? 'save' : 'blunder',
        fen: event.beforeFen,
        from: event.from,
        to: event.to,
      });
      setFen(event.afterFen);
      setLastMove({ from: event.from, to: event.to });
      setReplySan(null);
      const opp: Color = side === 'w' ? 'b' : 'w';
      const oppLabel = sideName(opp);
      if (result.ok) {
        // Quiet status note on clean moves avoids flashing a big green banner every turn.
        setFeedback(null);
        setStatus(`${sentence(line)} ${oppLabel} is moving…`);
        setTone('success');
        setHighlights([]);
        setBlunder(null);
      } else {
        const entry: PracticeBlunder = { fen: event.beforeFen, from: event.from, to: event.to, san: event.san };
        setStatus(null);
        setFeedback({ ...result, message: line });
        setTone('danger');
        setHighlights(result.squares);
        setBlunder(entry);
        setSessionBlunders((prev) => (prev.some((b) => b.fen === entry.fen) ? prev : [...prev, entry]));
        setBlundersAdded(false);
      }

      const afterSnap = snapshot(createGame(event.afterFen));
      if (afterSnap.isGameOver) {
        setStatus(null);
        setThinking(false);
        return result.ok;
      }

      const recentKeys = new Set<string>(historyRef.current.map((snap) => positionKey(snap.fen)));
      recentKeys.add(positionKey(event.beforeFen));
      recentKeys.add(positionKey(event.afterFen));

      setThinking(true);
      if (replyTimer.current) clearTimeout(replyTimer.current);
      replyTimer.current = setTimeout(() => {
        const reply = chooseBotReply(event.afterFen, elo, recentKeys);
        if (reply) {
          setFen(reply.fen);
          setLastMove({ from: reply.from, to: reply.to });
          setReplySan(reply.san);
          playFeedback(soundForSan(reply.san));
          if (!result.ok) {
            setHighlights([]);
          }
          if (result.ok) {
            setStatus(null);
            const mateThreat = incomingMateThreat(reply.fen, opp);
            if (mateThreat) {
              setFeedback({
                ok: false,
                title: 'Mate threat',
                message: `${oppLabel} played ${reply.san}. Watch out: ${mateThreat.san} threatens checkmate in one`,
                squares: [mateThreat.to, mateThreat.from],
                severity: 'blunder',
              });
              setTone('warn');
              setHighlights([mateThreat.to, mateThreat.from]);
            } else {
              const created = findHangingPieces(reply.fen, side);
              if (created[0]) {
                const name = created[0].message.replace(/^You left the /, '').replace(/ hanging$/, '');
                setFeedback({
                  ok: false,
                  title: 'Hanging piece',
                  message: `${oppLabel} played ${reply.san}. Before you move: your ${name} on ${created[0].squares[0]} is hanging`,
                  squares: created[0].squares,
                  severity: 'mistake',
                  pattern: created[0],
                });
                setTone('warn');
                setHighlights(created[0].squares);
              } else {
                setStatus(`${oppLabel} played ${reply.san}. Your move.`);
              }
            }
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
    const marked = highlights.length >= 2 ? highlights : preMoveHang?.squares;
    const arrowIsWarn = tone === 'warn' || Boolean(preMoveHang);
    if (marked?.[0] && marked[1]) {
      drawn.push({
        from: marked[1],
        to: marked[0],
        color: markColor(arrowIsWarn ? 'warning' : 'danger', scheme, colors),
      });
    }
    return drawn;
  }, [colors, feedback, hangingNow, highlights, scheme, status, tone]);

  const panelMessage = feedback
    ? replySan && tone !== 'warn'
      ? `${sentence(feedback.message)} ${oppName} played ${replySan}.`
      : thinking
        ? `${sentence(feedback.message)} ${oppName} is moving.`
        : sentence(feedback.message)
    : '';

  const cleanPct =
    playerMoves > 0
      ? Math.max(0, Math.round(((playerMoves - sessionBlunders.length) / playerMoves) * 100))
      : 100;

  return {
    fen,
    playerColor,
    orientation,
    flipped,
    botElo,
    isPlayerTurn,
    materialDelta,
    canUndo: history.length > 0,
    canResign: playerMoves > 0 && !gameOver,
    playerMoves,
    sessionBlunders,
    blundersAdded,
    cleanPct,
    feedback,
    status,
    tone,
    thinking,
    highlights,
    lastMove,
    resultLine,
    gameOver,
    hangingNow,
    blunder,
    arrow,
    panelMessage,
    setPlayerColor,
    setBotElo,
    toggleFlip,
    resignGame,
    resetBoard,
    undoMove,
    addBlundersToReview,
    dismissFeedback,
    tryAgain,
    onMove,
  };
}
