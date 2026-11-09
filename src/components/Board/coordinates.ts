import type { Square } from 'chess.js';

export type BoardOrientation = 'white' | 'black';

export type CoordinateMark = {
  square: Square;
  text: string;
  /** File letters sit in the bottom corner. Rank numbers sit in the top corner. */
  corner: 'file' | 'rank';
  left: number;
  top: number;
  size: number;
};

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;

function squareOf(fileIndex: number, rankIndex: number, orientation: BoardOrientation): Square {
  const file = orientation === 'white' ? FILES[fileIndex] : FILES[7 - fileIndex];
  const rank = orientation === 'white' ? 8 - rankIndex : rankIndex + 1;
  return `${file}${rank}` as Square;
}

/**
 * File letters along the near edge and rank numbers down the left edge.
 * Each box is inside its own square, in the corner, for both orientations.
 */
export function coordinateMarks(orientation: BoardOrientation, squareSize: number): CoordinateMark[] {
  const box = Math.max(12, Math.min(22, Math.round(squareSize * 0.28)));
  const pad = Math.max(1, Math.round(squareSize * 0.04));
  const marks: CoordinateMark[] = [];
  for (let fileIndex = 0; fileIndex < 8; fileIndex += 1) {
    const square = squareOf(fileIndex, 7, orientation);
    marks.push({
      square,
      text: square[0],
      corner: 'file',
      left: fileIndex * squareSize + squareSize - box - pad,
      top: 7 * squareSize + squareSize - box - pad,
      size: box,
    });
  }
  for (let rankIndex = 0; rankIndex < 8; rankIndex += 1) {
    const square = squareOf(0, rankIndex, orientation);
    marks.push({
      square,
      text: square[1],
      corner: 'rank',
      left: pad,
      top: rankIndex * squareSize + pad,
      size: box,
    });
  }
  return marks;
}

/** The only line above the board. It names the side that is actually to move. */
export function boardStatusLine(input: {
  turn: 'w' | 'b';
  inCheck: boolean;
  checkmate: boolean;
  stalemate: boolean;
}): string {
  if (input.checkmate) return 'Checkmate';
  if (input.stalemate) return 'Stalemate';
  const who = input.turn === 'w' ? 'White' : 'Black';
  if (input.inCheck) return `${who} is in check`;
  return `${who} to move`;
}
