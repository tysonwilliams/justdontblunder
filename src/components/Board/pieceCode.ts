export type PieceCode = 'wK' | 'wQ' | 'wR' | 'wB' | 'wN' | 'wP' | 'bK' | 'bQ' | 'bR' | 'bB' | 'bN' | 'bP';

export function pieceCodeFrom(color: 'w' | 'b', type: string): PieceCode {
  return `${color}${type.toUpperCase()}` as PieceCode;
}
