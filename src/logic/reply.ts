import { Chess, type Square } from 'chess.js';

import { findHangingPieces } from '@/src/engine/patterns';

const BOOK = [
  'e7e5',
  'd7d5',
  'g8f6',
  'b8c6',
  'c7c5',
  'e7e6',
  'd7d6',
  'f8c5',
  'f8b4',
  'f8e7',
  'g8e7',
  'c7c6',
];

const CENTER = new Set(['c5', 'd5', 'e5', 'd4', 'e4', 'c4', 'f5', 'f4']);

export type BlackReply = {
  from: Square;
  to: Square;
  san: string;
  fen: string;
};

function capturedValue(type: string | undefined): number {
  switch (type) {
    case 'p':
      return 1;
    case 'n':
    case 'b':
      return 3;
    case 'r':
      return 5;
    case 'q':
      return 9;
    default:
      return 0;
  }
}

/** Black's reply: take a hanging white piece when possible, otherwise develop. */
export function chooseBlackReply(fen: string): BlackReply | null {
  const game = new Chess(fen);
  if (game.turn() !== 'b') return null;
  const moves = game.moves({ verbose: true });
  if (!moves.length) return null;

  const hanging = new Set(
    findHangingPieces(fen, 'w').flatMap((finding) => finding.squares.slice(0, 1)),
  );
  const takesHanging = moves
    .filter((move) => move.captured && hanging.has(move.to))
    .sort((a, b) => capturedValue(b.captured) - capturedValue(a.captured));
  const chosen =
    takesHanging[0] ??
    BOOK.map((uci) => moves.find((move) => `${move.from}${move.to}` === uci)).find(Boolean) ??
    moves.find((move) => CENTER.has(move.to) && move.piece !== 'k') ??
    moves.find((move) => move.piece !== 'k') ??
    moves[0];
  if (!chosen) return null;

  const played = game.move(chosen);
  if (!played) return null;
  return { from: played.from, to: played.to, san: played.san, fen: game.fen() };
}
