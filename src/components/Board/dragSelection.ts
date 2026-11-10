import type { Color, Square } from 'chess.js';

import type { DropIntent } from '@/src/components/Board/boardMotion';

export type DragPhase = 'idle' | 'dragging' | 'settling';

/** Legal-move marks already painted for one piece. */
export type ShownMarks = {
  square: Square;
  legal: Square[];
};

export type DragMarkDecision =
  | { action: 'ignore' }
  | { action: 'unchanged'; square: Square; legal: Square[] }
  | { action: 'show'; square: Square; legal: Square[] };

export type DragPressInput = {
  phase: DragPhase;
  interactive: boolean;
  squareSize: number;
  square: Square | null;
  pieceColor: Color | null;
  turn: Color;
  /** Marks from this press, including a selection React has not painted yet. */
  shown: ShownMarks | null;
};

/**
 * Legal-move dots, capture rings, and the corner brackets for a press that
 * may become a drag. The target list is built once, when the piece is first
 * marked. A later call for the same piece — including every drag frame —
 * reuses `shown` and does not ask the engine again.
 */
export function marksForDragPress(
  input: DragPressInput,
  legalTargets: (square: Square) => readonly Square[],
): DragMarkDecision {
  if (input.phase !== 'idle' || !input.interactive || !(input.squareSize > 0)) {
    return { action: 'ignore' };
  }
  if (input.square == null || input.pieceColor == null || input.pieceColor !== input.turn) {
    return { action: 'ignore' };
  }
  if (input.shown?.square === input.square) {
    return { action: 'unchanged', square: input.square, legal: input.shown.legal };
  }
  return { action: 'show', square: input.square, legal: [...legalTargets(input.square)] };
}

/**
 * A drop on the square the piece came from keeps the marks, the way a click does.
 * A played move, an illegal square, and a drop off the board clear them.
 */
export function keepMarksAfterDrop(intent: DropIntent): boolean {
  switch (intent.kind) {
    case 'move':
      return false;
    case 'snap':
      return intent.reason === 'origin';
    default: {
      const _exhaustive: never = intent;
      return _exhaustive;
    }
  }
}
