import { Chess, type Color, type Square } from 'chess.js';

import { detectPatterns, type PatternFinding } from '@/src/engine/patterns';
import { evaluate, isBlunder, type BlunderCheck, type EvalResult } from '@/src/engine/stockfish';

export type MoveFeedback = {
  ok: boolean;
  title: string;
  message: string;
  squares: Square[];
  severity: 'ok' | 'inaccuracy' | 'mistake' | 'blunder';
  pattern?: PatternFinding;
  engine?: EvalResult;
  blunderCheck?: BlunderCheck;
  bestMoveHint?: string;
};

function flipScoreForMover(score: number, moverWasWhite: boolean, sideToMoveInFen: Color): number {
  // Stockfish score is from side-to-move. Convert to mover's perspective.
  const scoreForSideToMove = score;
  const sideToMoveIsMover = (sideToMoveInFen === 'w') === moverWasWhite;
  return sideToMoveIsMover ? scoreForSideToMove : -scoreForSideToMove;
}

export async function analyzeMove(options: {
  beforeFen: string;
  afterFen: string;
  useEngine?: boolean;
  depth?: number;
}): Promise<MoveFeedback> {
  const { beforeFen, afterFen, useEngine = true, depth = 10 } = options;
  const before = new Chess(beforeFen);
  const after = new Chess(afterFen);
  const mover: Color = before.turn();

  const patterns = detectPatterns(afterFen, mover);
  const worstPattern = patterns.sort((a, b) => {
    const rank = { tip: 0, mistake: 1, blunder: 2 } as const;
    return rank[b.severity] - rank[a.severity];
  })[0];

  let engineResult: EvalResult | undefined;
  let blunderCheck: BlunderCheck | undefined;
  let bestMoveHint: string | undefined;

  if (useEngine) {
    const [beforeEval, afterEval] = await Promise.all([
      evaluate(beforeFen, depth),
      evaluate(afterFen, depth),
    ]);
    engineResult = afterEval;
    bestMoveHint = beforeEval.bestMove || undefined;

    const bestForMover = beforeEval.score;
    const afterForMover = flipScoreForMover(afterEval.score, mover === 'w', after.turn());
    blunderCheck = isBlunder(afterForMover, bestForMover);
  }

  if (worstPattern && (worstPattern.severity === 'blunder' || worstPattern.severity === 'mistake')) {
    return {
      ok: false,
      title: worstPattern.kind === 'hanging' ? 'Hanging piece!' : titleForKind(worstPattern.kind),
      message: worstPattern.message,
      squares: worstPattern.squares,
      severity: worstPattern.severity === 'blunder' ? 'blunder' : 'mistake',
      pattern: worstPattern,
      engine: engineResult,
      blunderCheck,
      bestMoveHint,
    };
  }

  if (blunderCheck?.isBlunder) {
    return {
      ok: false,
      title: blunderCheck.severity === 'blunder' ? 'Blunder!' : 'Slippery move',
      message:
        blunderCheck.severity === 'blunder'
          ? 'That drop was costly — check what you left loose.'
          : 'There was a stronger idea. Peek at the board again.',
      squares: [],
      severity: blunderCheck.severity,
      engine: engineResult,
      blunderCheck,
      bestMoveHint,
    };
  }

  return {
    ok: true,
    title: 'Solid',
    message: 'Nice — nothing obvious hanging.',
    squares: [],
    severity: blunderCheck?.severity === 'inaccuracy' ? 'inaccuracy' : 'ok',
    pattern: worstPattern,
    engine: engineResult,
    blunderCheck,
    bestMoveHint,
  };
}

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
