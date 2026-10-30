import { Chess, type Color, type Move, type PieceSymbol, type Square } from 'chess.js';

import { pieceValue } from '@/src/logic/safety';

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

/**
 * Practice opponent, about a solid club beginner (1000–1200).
 * 1100 searches 2 plies with captures first, always takes a free piece or mate in 1,
 * and steps a piece out of a one-move attack. Quieter pawn decisions still slip.
 * Drop the number for more slips; below 800 the search is only 1 ply.
 */
export const PRACTICE_OPPONENT_ELO = 1100;

const MATE_SCORE = 100;

export type BlackReply = {
  from: Square;
  to: Square;
  san: string;
  fen: string;
};

function searchPlies(elo: number): number {
  return elo >= 800 ? 2 : 1;
}

/** Share of non-forcing choices the opponent misses. Derived only from the Elo constant. */
function slipRate(elo: number): number {
  return Math.min(0.45, Math.max(0, (1400 - elo) / 1500));
}

function slipBucket(fen: string): number {
  let hash = 2166136261;
  for (let i = 0; i < fen.length; i += 1) {
    hash ^= fen.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % 1000;
}

function materialFor(game: Chess, side: Color): number {
  let total = 0;
  for (const row of game.board()) {
    for (const piece of row) {
      if (!piece || piece.type === 'k') continue;
      const value = pieceValue(piece.type);
      total += piece.color === side ? value : -value;
    }
  }
  return total;
}

function captureRank(move: Move): number {
  if (!move.captured) return 0;
  return pieceValue(move.captured) * 10 - pieceValue(move.piece);
}

/** Captures first (most valuable victim, cheapest attacker), then checks. */
function orderedMoves(game: Chess): Move[] {
  return game.moves({ verbose: true }).sort((a, b) => {
    const capture = captureRank(b) - captureRank(a);
    if (capture !== 0) return capture;
    const aCheck = a.san.includes('+') || a.san.includes('#') ? 1 : 0;
    const bCheck = b.san.includes('+') || b.san.includes('#') ? 1 : 0;
    return bCheck - aCheck;
  });
}

function negamax(game: Chess, depth: number, alpha: number, beta: number): number {
  if (game.isCheckmate()) return -MATE_SCORE;
  if (game.isDraw()) return 0;
  if (depth <= 0) return materialFor(game, game.turn());
  const moves = orderedMoves(game);
  if (!moves.length) return 0;
  let best = -MATE_SCORE - 1;
  for (const move of moves) {
    game.move(move);
    const score = -negamax(game, depth - 1, -beta, -alpha);
    game.undo();
    if (score > best) best = score;
    if (score > alpha) alpha = score;
    if (alpha >= beta) break;
  }
  return best;
}

function bookRank(move: Move): number {
  const index = BOOK.indexOf(`${move.from}${move.to}`);
  return index === -1 ? BOOK.length : index;
}

function pieceRank(type: PieceSymbol): number {
  switch (type) {
    case 'n':
    case 'b':
      return 0;
    case 'p':
      return 1;
    case 'r':
      return 2;
    case 'q':
      return 3;
    case 'k':
      return 4;
    default: {
      const _exhaustive: never = type;
      return _exhaustive;
    }
  }
}

type Scored = { move: Move; score: number };

function byHumanOrder(a: Scored, b: Scored): number {
  const book = bookRank(a.move) - bookRank(b.move);
  if (book !== 0) return book;
  const develop = pieceRank(a.move.piece) - pieceRank(b.move.piece);
  if (develop !== 0) return develop;
  const center = (CENTER.has(b.move.to) ? 1 : 0) - (CENTER.has(a.move.to) ? 1 : 0);
  if (center !== 0) return center;
  return captureRank(b.move) - captureRank(a.move);
}

function shouldSlip(fen: string, best: number, second: number): boolean {
  if (best >= 3) return false;
  if (best - second >= 3) return false;
  if (best <= second) return false;
  const fullmove = Number(fen.split(' ')[5] ?? '1');
  if (fullmove < 8 && best <= 0) return false;
  return slipBucket(fen) < slipRate(PRACTICE_OPPONENT_ELO) * 1000;
}

/** Black's reply at club-beginner strength. */
export function chooseBlackReply(fen: string): BlackReply | null {
  const game = new Chess(fen);
  if (game.turn() !== 'b') return null;
  const moves = orderedMoves(game);
  if (!moves.length) return null;

  const plies = searchPlies(PRACTICE_OPPONENT_ELO);
  const ranked: Scored[] = [];
  for (const move of moves) {
    game.move(move);
    const score = game.isCheckmate() ? MATE_SCORE : -negamax(game, plies - 1, -1000, 1000);
    game.undo();
    ranked.push({ move, score });
  }
  ranked.sort((a, b) => b.score - a.score || byHumanOrder(a, b));
  const best = ranked[0];
  if (!best) return null;
  const second = ranked[1]?.score ?? best.score;

  let chosen = best;
  if (shouldSlip(fen, best.score, second)) {
    const floor = Math.max(-1, best.score - 1);
    const softer = ranked.filter((entry) => entry.score >= floor && entry.score < best.score);
    softer.sort(byHumanOrder);
    if (softer[0]) chosen = softer[0];
  }

  const played = game.move(chosen.move);
  if (!played) return null;
  return { from: played.from, to: played.to, san: played.san, fen: game.fen() };
}
