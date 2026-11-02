import type { Square } from 'chess.js';

import type { BoardArrow, ChessBoardProps } from '@/src/components/Board/boardTypes';

function sameSquares(a?: readonly Square[], b?: readonly Square[]): boolean {
  const left = a ?? [];
  const right = b ?? [];
  if (left.length !== right.length) return false;
  for (let i = 0; i < left.length; i += 1) {
    if (left[i] !== right[i]) return false;
  }
  return true;
}

function sameMove(
  a?: { from: Square; to: Square } | null,
  b?: { from: Square; to: Square } | null,
): boolean {
  if (a === b) return true;
  if (!a || !b) return !a && !b;
  return a.from === b.from && a.to === b.to;
}

function sameArrows(a?: readonly BoardArrow[], b?: readonly BoardArrow[]): boolean {
  const left = a ?? [];
  const right = b ?? [];
  if (left.length !== right.length) return false;
  for (let i = 0; i < left.length; i += 1) {
    const x = left[i];
    const y = right[i];
    if (!x || !y) return false;
    if (x.from !== y.from || x.to !== y.to || x.color !== y.color || x.label !== y.label) return false;
  }
  return true;
}

export function chessBoardPropsEqual(prev: ChessBoardProps, next: ChessBoardProps): boolean {
  return (
    prev.fen === next.fen &&
    (prev.orientation ?? 'white') === (next.orientation ?? 'white') &&
    (prev.interactive ?? true) === (next.interactive ?? true) &&
    (prev.highlightTone ?? 'danger') === (next.highlightTone ?? 'danger') &&
    (prev.flipCue ?? false) === (next.flipCue ?? false) &&
    (prev.hideTurn ?? false) === (next.hideTurn ?? false) &&
    prev.size === next.size &&
    prev.onMove === next.onMove &&
    prev.onPositionChange === next.onPositionChange &&
    sameSquares(prev.highlightSquares, next.highlightSquares) &&
    sameSquares(prev.attentionSquares, next.attentionSquares) &&
    sameMove(prev.lastMove, next.lastMove) &&
    sameArrows(prev.arrows, next.arrows)
  );
}
