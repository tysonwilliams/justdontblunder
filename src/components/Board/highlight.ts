import type { Square } from 'chess.js';

import type { DrillRound } from '@/src/logic/saveFeedback';
import { colors } from '@/src/theme';

export type HighlightTone = 'danger' | 'success';

type SquarePaint = {
  isDark: boolean;
  isLast: boolean;
  isAttention: boolean;
  isSelected: boolean;
  isHighlight: boolean;
  highlightTone: HighlightTone;
};

/** Blunder squares stay red. A correct save paints green, even on the last-move squares. */
export function squareBackground(input: SquarePaint): string {
  if (input.isHighlight) {
    return input.highlightTone === 'success' ? colors.boardSave : colors.boardBlunder;
  }
  if (input.isSelected) return colors.boardSelected;
  if (input.isAttention) return colors.boardAttention;
  if (input.isLast) return colors.boardLastMove;
  return input.isDark ? colors.boardDark : colors.boardLight;
}

function uniqueSquares(squares: Square[]): Square[] {
  const seen = new Set<string>();
  const out: Square[] = [];
  for (const square of squares) {
    if (seen.has(square)) continue;
    seen.add(square);
    out.push(square);
  }
  return out;
}

export function highlightsForRound(
  round: DrillRound,
  move: { from: Square; to: Square } | null,
  atRisk: Square,
): { squares: Square[]; tone: HighlightTone } {
  switch (round) {
    case 'playing':
      return { squares: [], tone: 'danger' };
    case 'correct':
    case 'revealed':
      return {
        squares: move ? uniqueSquares([move.from, move.to]) : [atRisk],
        tone: move ? 'success' : 'danger',
      };
    case 'retry':
    case 'streakEnd':
      return {
        squares: move ? uniqueSquares([move.from, move.to, atRisk]) : [atRisk],
        tone: 'danger',
      };
    default: {
      const _exhaustive: never = round;
      return _exhaustive;
    }
  }
}
