import { Chess, type Color, type PieceSymbol, type Square } from 'chess.js';

import type { DrillTheme } from '@/src/logic/drills';
import { materialIsReachable, moveOutcome } from '@/src/logic/safety';

const FILES = 'abcdefgh';
const RANKS = '12345678';

function sq(file: number, rank: number): Square {
  return `${FILES[file]}${RANKS[rank]}` as Square;
}

function findKing(game: Chess, color: Color): Square | null {
  const board = game.board();
  for (let r = 0; r < 8; r += 1) {
    for (let f = 0; f < 8; f += 1) {
      const piece = board[r]?.[f];
      if (piece?.type === 'k' && piece.color === color) return sq(f, 7 - r);
    }
  }
  return null;
}

function pathClear(game: Chess, from: Square, to: Square): boolean {
  const af = FILES.indexOf(from[0] ?? '');
  const ar = RANKS.indexOf(from[1] ?? '');
  const tf = FILES.indexOf(to[0] ?? '');
  const tr = RANKS.indexOf(to[1] ?? '');
  const dx = Math.sign(tf - af);
  const dy = Math.sign(tr - ar);
  if (dx === 0 && dy === 0) return false;
  const aligned = dx === 0 || dy === 0 || Math.abs(tf - af) === Math.abs(tr - ar);
  if (!aligned) return false;
  let f = af + dx;
  let r = ar + dy;
  while (f !== tf || r !== tr) {
    if (f < 0 || r < 0 || f > 7 || r > 7) return false;
    if (game.get(sq(f, r))) return false;
    f += dx;
    r += dy;
  }
  return true;
}

function rawAttacks(game: Chess, from: Square, to: Square): boolean {
  const piece = game.get(from);
  if (!piece) return false;
  const af = FILES.indexOf(from[0] ?? '');
  const ar = RANKS.indexOf(from[1] ?? '');
  const tf = FILES.indexOf(to[0] ?? '');
  const tr = RANKS.indexOf(to[1] ?? '');
  const dx = tf - af;
  const dy = tr - ar;
  const adx = Math.abs(dx);
  const ady = Math.abs(dy);
  switch (piece.type) {
    case 'n':
      return (adx === 1 && ady === 2) || (adx === 2 && ady === 1);
    case 'k':
      return adx <= 1 && ady <= 1 && (adx > 0 || ady > 0);
    case 'p': {
      const dir = piece.color === 'w' ? 1 : -1;
      return adx === 1 && dy === dir;
    }
    case 'b':
      return adx === ady && adx > 0 && pathClear(game, from, to);
    case 'r':
      return (dx === 0 || dy === 0) && adx + ady > 0 && pathClear(game, from, to);
    case 'q':
      return ((dx === 0 || dy === 0) || adx === ady) && adx + ady > 0 && pathClear(game, from, to);
    default: {
      const _exhaustive: never = piece.type;
      return _exhaustive;
    }
  }
}

function between(ax: number, ay: number, bx: number, by: number, cx: number, cy: number): boolean {
  const onLine =
    (ax === bx && bx === cx) ||
    (ay === by && by === cy) ||
    (Math.abs(ax - bx) === Math.abs(ay - by) &&
      Math.abs(bx - cx) === Math.abs(by - cy) &&
      Math.sign(bx - ax) === Math.sign(cx - bx) &&
      Math.sign(by - ay) === Math.sign(cy - by));
  if (!onLine) return false;
  return (
    bx >= Math.min(ax, cx) &&
    bx <= Math.max(ax, cx) &&
    by >= Math.min(ay, cy) &&
    by <= Math.max(ay, cy) &&
    !(bx === ax && by === ay) &&
    !(bx === cx && by === cy)
  );
}

/** Absolute pin: a slider attacks `square` and the line from that piece to its king is empty. */
export function pinSource(game: Chess, square: Square, color: Color): Square | null {
  const kingSq = findKing(game, color);
  if (!kingSq || kingSq === square) return null;
  if (!pathClear(game, square, kingSq)) return null;
  const opp: Color = color === 'w' ? 'b' : 'w';
  const kf = FILES.indexOf(kingSq[0] ?? '');
  const kr = RANKS.indexOf(kingSq[1] ?? '');
  const sf = FILES.indexOf(square[0] ?? '');
  const sr = RANKS.indexOf(square[1] ?? '');
  const board = game.board();
  for (let r = 0; r < 8; r += 1) {
    for (let f = 0; f < 8; f += 1) {
      const piece = board[r]?.[f];
      if (!piece || piece.color !== opp) continue;
      if (piece.type !== 'b' && piece.type !== 'r' && piece.type !== 'q') continue;
      const from = sq(f, 7 - r);
      if (!rawAttacks(game, from, square)) continue;
      if (between(f, 7 - r, sf, sr, kf, kr)) return from;
    }
  }
  return null;
}

export function isAbsolutePin(game: Chess, square: Square, side: Color): boolean {
  const piece = game.get(square);
  if (!piece || piece.color !== side || piece.type === 'k') return false;
  return pinSource(game, square, side) !== null;
}

const VAL: Record<PieceSymbol, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 };

/** A friendly unit is forked when one enemy piece also attacks another piece worth at least a knight. */
export function isLiveForkOn(game: Chess, square: Square, side: Color): boolean {
  const piece = game.get(square);
  if (!piece || piece.color !== side) return false;
  const opp: Color = side === 'w' ? 'b' : 'w';
  const friendly: Square[] = [];
  const board = game.board();
  for (let r = 0; r < 8; r += 1) {
    for (let f = 0; f < 8; f += 1) {
      const occupant = board[r]?.[f];
      if (!occupant || occupant.color !== side) continue;
      if (occupant.type === 'k' || VAL[occupant.type] >= 3) friendly.push(sq(f, 7 - r));
    }
  }
  if (!friendly.includes(square)) friendly.push(square);
  for (let r = 0; r < 8; r += 1) {
    for (let f = 0; f < 8; f += 1) {
      const occupant = board[r]?.[f];
      if (!occupant || occupant.color !== opp) continue;
      const from = sq(f, 7 - r);
      const hits = friendly.filter((target) => rawAttacks(game, from, target));
      if (hits.includes(square) && hits.length >= 2) return true;
    }
  }
  return false;
}

type DangerDrill = {
  fen: string;
  sideToMove: Color;
  theme: DrillTheme;
  atRiskSquare: Square;
};

/**
 * A move is a save when it does not drop material and does not allow mate in 1.
 * Delivering checkmate is always accepted.
 * Mate in 2 or more is not punished — beginners are not asked to see it.
 * Every theme, including pins, uses this rule rather than a hand-written move list.
 * `theme` stays on the drill so a new theme fails the build until it is judged here.
 */
export function moveRemovesDanger(drill: DangerDrill, from: Square, to: Square): boolean {
  switch (drill.theme) {
    case 'hanging':
    case 'fork':
    case 'pin':
    case 'back_rank':
    case 'missed_mate':
      break;
    default: {
      const _exhaustive: never = drill.theme;
      return _exhaustive;
    }
  }
  const outcome = moveOutcome(drill.fen, from, to, drill.sideToMove);
  if (outcome === null) return false;
  return outcome >= 0;
}

export function positionMaterialOk(fen: string): boolean {
  return materialIsReachable(fen);
}
