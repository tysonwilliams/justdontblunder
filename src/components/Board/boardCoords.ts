import type { Square } from 'chess.js';

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;
const RANKS_WHITE = [8, 7, 6, 5, 4, 3, 2, 1] as const;
const RANKS_BLACK = [1, 2, 3, 4, 5, 6, 7, 8] as const;

export function squareAt(fileIndex: number, rankIndex: number, orientation: 'white' | 'black'): Square {
  'worklet';
  const files = orientation === 'white' ? FILES : [...FILES].reverse();
  const ranks = orientation === 'white' ? RANKS_WHITE : RANKS_BLACK;
  return `${files[fileIndex]}${ranks[rankIndex]}` as Square;
}

export function centerOf(
  square: Square,
  orientation: 'white' | 'black',
  squareSize: number,
): { x: number; y: number } {
  const file = square.charCodeAt(0) - 97;
  const rank = Number(square[1]) - 1;
  const col = orientation === 'white' ? file : 7 - file;
  const row = orientation === 'white' ? 7 - rank : rank;
  return { x: (col + 0.5) * squareSize, y: (row + 0.5) * squareSize };
}

/** Top-left of a square in the same space as `centerOf`. */
export function squareOrigin(
  square: Square,
  orientation: 'white' | 'black',
  squareSize: number,
): { x: number; y: number } {
  const center = centerOf(square, orientation, squareSize);
  return { x: center.x - squareSize / 2, y: center.y - squareSize / 2 };
}

export function labelAnchor(
  square: Square,
  orientation: 'white' | 'black',
  squareSize: number,
): { x: number; y: number } {
  const center = centerOf(square, orientation, squareSize);
  const nudge = squareSize * 0.22;
  return {
    x: Math.min(center.x + nudge, squareSize * 8 - squareSize * 0.18),
    y: Math.max(center.y - nudge, squareSize * 0.18),
  };
}
