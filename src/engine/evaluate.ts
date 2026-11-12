import { Chess, type Color, type Square } from 'chess.js';

import { detectPatterns, findHangingPieces, type PatternFinding } from '@/src/engine/patterns';
import { bestPunishment, moveOutcome, opponentThreatensMateInOne } from '@/src/logic/safety';

export type MoveFeedback = {
  ok: boolean;
  title: string;
  message: string;
  squares: Square[];
  severity: 'ok' | 'inaccuracy' | 'mistake' | 'blunder';
  pattern?: PatternFinding;
  bestMoveHint?: string;
};

function titleForKind(kind: PatternFinding['kind']): string {
  switch (kind) {
    case 'hanging':
      return 'Hanging piece!';
    case 'fork':
      return 'Missed fork';
    case 'pin':
      return 'Pinned!';
    case 'back_rank':
      return 'Back-rank danger';
    case 'missed_mate':
      return 'Mate was there';
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

/**
 * Practice verdict for the move just played.
 * Net material comes from `moveOutcome` (the capture just made, minus a full
 * static exchange on every friendly piece, plus mate in 1). An even or winning
 * trade is clean. Mate in 2 or deeper is not, by itself, a blunder.
 */
export function judgePracticeMove(
  beforeFen: string,
  from: Square,
  to: Square,
  mover: Color,
): MoveFeedback {
  const outcome = moveOutcome(beforeFen, from, to, mover);
  if (outcome === null) {
    return {
      ok: false,
      title: 'Illegal',
      message: 'That move cannot be played.',
      squares: [],
      severity: 'blunder',
    };
  }
  const after = new Chess(beforeFen);
  const played = after.move({ from, to, promotion: 'q' });
  if (!played) {
    return {
      ok: false,
      title: 'Illegal',
      message: 'That move cannot be played.',
      squares: [],
      severity: 'blunder',
    };
  }
  if (outcome >= 0) {
    const fair = Boolean(played.captured) && outcome === 0;
    return {
      ok: true,
      title: fair ? 'Fair trade' : 'Clean',
      message: fair
        ? 'Even trade. You do not come out behind.'
        : played.captured
          ? 'You come out ahead.'
          : 'No hanging pieces spotted.',
      squares: [],
      severity: 'ok',
    };
  }
  if (opponentThreatensMateInOne(after.fen())) {
    const mate = bestPunishment(after.fen());
    const who = after.turn() === 'w' ? 'White' : 'Black';
    return {
      ok: false,
      title: 'Blunder!',
      message: mate ? `${who} plays ${mate.san}.` : 'That allows mate in one.',
      squares: mate ? [mate.to, mate.from] : [from, to],
      severity: 'blunder',
    };
  }
  const hanging = findHangingPieces(after.fen(), mover);
  const worst = hanging[0];
  if (worst) {
    return {
      ok: false,
      title: 'Hanging piece!',
      message: worst.message,
      squares: worst.squares,
      severity: 'blunder',
    };
  }
  return {
    ok: false,
    title: 'Blunder!',
    message: 'That loses material.',
    squares: [from, to],
    severity: 'blunder',
  };
}

export function quickPatternFeedback(afterFen: string, mover: Color): MoveFeedback {
  const patterns = detectPatterns(afterFen, mover);
  const worst = patterns[0];
  if (!worst) {
    return {
      ok: true,
      title: 'Clean',
      message: 'No hanging pieces spotted.',
      squares: [],
      severity: 'ok',
    };
  }
  return {
    ok: false,
    title: titleForKind(worst.kind),
    message: worst.message,
    squares: worst.squares,
    severity: worst.severity === 'tip' ? 'inaccuracy' : worst.severity,
    pattern: worst,
  };
}
