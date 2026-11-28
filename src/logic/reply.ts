import { Chess, type Color, type Move, type Square } from 'chess.js';

import { pieceValue } from '@/src/logic/safety';

const WHITE_BOOK = [
  'e2e4',
  'd2d4',
  'g1f3',
  'b1c3',
  'f1c4',
  'f1b5',
  'c2c4',
  'e2e3',
  'd2d3',
  'f1e2',
];

const BLACK_BOOK = [
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

export const PRACTICE_ELOS = [600, 900, 1200, 1500] as const;
export type PracticeElo = (typeof PRACTICE_ELOS)[number];

export function defaultPracticeElo(experience: 'new' | 'basics' | 'intermediate' | null): PracticeElo {
  switch (experience) {
    case 'new':
      return 600;
    case 'intermediate':
      return 1500;
    case 'basics':
    case null:
      return 1200;
    default: {
      const _exhaustive: never = experience;
      return _exhaustive;
    }
  }
}

const MATE_SCORE = 100;

export type BotReply = {
  from: Square;
  to: Square;
  san: string;
  fen: string;
};

export type BlackReply = BotReply;

function searchPlies(_elo: number): number {
  return 2;
}

/** Share of non-forcing choices the opponent misses. Derived only from the Elo rating. */
function slipRate(elo: number): number {
  return Math.min(0.45, Math.max(0, (1500 - elo) / 1450));
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

/** Net material delta in pawns from `side`'s perspective. */
export function materialBalance(fen: string, side: Color): number {
  try {
    return materialFor(new Chess(fen), side);
  } catch {
    return 0;
  }
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

/** Capture-only quiescence search so 2-ply evaluation never panics on safely defended pieces. */
function quiesce(game: Chess, alpha: number, beta: number, qDepth: number): number {
  const standPat = materialFor(game, game.turn());
  if (standPat >= beta || qDepth <= 0) return standPat;
  let best = standPat;
  if (best > alpha) alpha = best;
  const captures = game
    .moves({ verbose: true })
    .filter((move) => Boolean(move.captured || move.promotion))
    .sort((a, b) => captureRank(b) - captureRank(a));
  for (const move of captures) {
    game.move(move);
    const score = game.isCheckmate() ? MATE_SCORE : -quiesce(game, -beta, -alpha, qDepth - 1);
    game.undo();
    if (score > best) best = score;
    if (score > alpha) alpha = score;
    if (alpha >= beta) break;
  }
  return best;
}

function negamax(game: Chess, depth: number, alpha: number, beta: number): number {
  if (depth <= 0) {
    if (game.inCheck() && game.isCheckmate()) return -MATE_SCORE;
    return quiesce(game, alpha, beta, 4);
  }
  const moves = orderedMoves(game);
  if (!moves.length) return game.inCheck() ? -MATE_SCORE : 0;
  if (game.isInsufficientMaterial()) return 0;
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

function bookRank(move: Move, side: Color): number {
  const book = side === 'w' ? WHITE_BOOK : BLACK_BOOK;
  const index = book.indexOf(`${move.from}${move.to}`);
  return index === -1 ? book.length : index;
}

function pieceRank(move: Move): number {
  if (move.san === 'O-O' || move.san === 'O-O-O') return -1;
  switch (move.piece) {
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
      const _exhaustive: never = move.piece;
      return _exhaustive;
    }
  }
}

type Scored = { move: Move; score: number };

function byHumanOrder(a: Scored, b: Scored, side: Color): number {
  const book = bookRank(a.move, side) - bookRank(b.move, side);
  if (book !== 0) return book;
  const develop = pieceRank(a.move) - pieceRank(b.move);
  if (develop !== 0) return develop;
  const center = (CENTER.has(b.move.to) ? 1 : 0) - (CENTER.has(a.move.to) ? 1 : 0);
  if (center !== 0) return center;
  return captureRank(b.move) - captureRank(a.move);
}

function shouldSlip(fen: string, best: number, second: number, elo: number): boolean {
  if (best >= 3) return false;
  if (best - second >= 3) return false;
  if (best <= second) return false;
  const fullmove = Number(fen.split(' ')[5] ?? '1');
  if (fullmove < 8 && best <= 0) return false;
  return slipBucket(fen) < slipRate(elo) * 1000;
}

function positionKey(fen: string): string {
  return fen.split(' ').slice(0, 4).join(' ');
}

/** Opponent reply for whichever side is to move, tuned to `elo`. */
export function chooseBotReply(
  fen: string,
  elo: number = PRACTICE_OPPONENT_ELO,
  recentPositionKeys?: ReadonlySet<string>,
): BotReply | null {
  const game = new Chess(fen);
  const side = game.turn();
  const moves = orderedMoves(game);
  if (!moves.length) return null;

  const plies = searchPlies(elo);
  const ranked: Scored[] = [];
  for (const move of moves) {
    game.move(move);
    let score = game.isCheckmate() ? MATE_SCORE : -negamax(game, plies - 1, -1000, 1000);
    if (recentPositionKeys && recentPositionKeys.has(positionKey(game.fen())) && score < MATE_SCORE - 1) {
      score -= 0.5;
    }
    game.undo();
    ranked.push({ move, score });
  }
  ranked.sort((a, b) => b.score - a.score || byHumanOrder(a, b, side));
  const best = ranked[0];
  if (!best) return null;
  const second = ranked[1]?.score ?? best.score;

  let chosen = best;
  if (shouldSlip(fen, best.score, second, elo)) {
    const drop = elo <= 600 ? 2 : 1;
    const floor = Math.max(-drop, best.score - drop);
    const softer = ranked.filter((entry) => entry.score >= floor && entry.score < best.score);
    softer.sort((a, b) => byHumanOrder(a, b, side));
    if (softer[0]) chosen = softer[0];
  } else if (elo <= 900 && ranked.length > 1) {
    const ties = ranked.filter((entry) => entry.score === best.score);
    if (ties.length > 1 && slipBucket(fen) < (elo <= 600 ? 500 : 250)) {
      chosen = ties[slipBucket(`${fen}:${elo}`) % ties.length] ?? best;
    }
  }

  const played = game.move(chosen.move);
  if (!played) return null;
  return { from: played.from, to: played.to, san: played.san, fen: game.fen() };
}

/** Black's reply at club-beginner strength. */
export function chooseBlackReply(fen: string): BlackReply | null {
  const game = new Chess(fen);
  if (game.turn() !== 'b') return null;
  return chooseBotReply(fen, PRACTICE_OPPONENT_ELO);
}
