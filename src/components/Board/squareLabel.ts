import type { Color, PieceSymbol, Square } from 'chess.js';

import { pieceName } from '@/src/logic/safety';

export function squareLabel(
  square: Square,
  piece: { color: Color; type: PieceSymbol } | null,
  state: { selected: boolean; highlighted: boolean },
): string {
  const occupant = piece ? `${piece.color === 'w' ? 'white' : 'black'} ${pieceName(piece.type)}` : 'empty';
  const notes: string[] = [];
  if (state.selected) notes.push('selected');
  if (state.highlighted) notes.push('highlighted');
  if (notes.length === 0) return `${square}, ${occupant}`;
  return `${square}, ${occupant}, ${notes.join(', ')}`;
}
