import type { Square } from 'chess.js';

import type { DrillRound } from '@/src/logic/saveFeedback';
import { palettes, type Palette } from '@/src/theme/tokens';

export type HighlightTone = 'danger' | 'success';

/** Quiet dots and capture rings share this ink. Red is only for a blunder. */
export function legalMoveInk(isDark: boolean, palette: Palette = palettes.dark): string {
  return isDark ? palette.boardLegalOnDark : palette.boardLegalOnLight;
}

type SquarePaint = {
  isDark: boolean;
  isLast: boolean;
  isAttention: boolean;
  isSelected: boolean;
  isHighlight: boolean;
  highlightTone: HighlightTone;
};

/** Blunder squares stay red. A correct save paints green, even on the last-move squares. */
export function squareBackground(input: SquarePaint, palette: Palette = palettes.dark): string {
  if (input.isHighlight) {
    return input.highlightTone === 'success' ? palette.boardSave : palette.boardBlunder;
  }
  if (input.isSelected) return palette.boardSelected;
  if (input.isAttention) return palette.boardAttention;
  if (input.isLast) return palette.boardLastMove;
  return input.isDark ? palette.boardDark : palette.boardLight;
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
