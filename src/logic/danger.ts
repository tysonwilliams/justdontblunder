import { Chess, type Color, type PieceSymbol, type Square } from 'chess.js';

import type { DrillTheme } from '@/src/logic/drills';

const VAL: Record<PieceSymbol, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 };
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

function pathClear(game: Chess, from: Square, to: Square): boolean {
  const af = FILES.indexOf(from[0] ?? '');
  const ar = RANKS.indexOf(from[1] ?? '');
  const tf = FILES.indexOf(to[0] ?? '');
  const tr = RANKS.indexOf(to[1] ?? '');
  const dx = Math.sign(tf - af);
  const dy = Math.sign(tr - ar);
  let f = af + dx;
  let r = ar + dy;
  while (f !== tf || r !== tr) {
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

function aligned(a: Square, b: Square, c: Square): boolean {
  const af = FILES.indexOf(a[0] ?? '');
  const ar = RANKS.indexOf(a[1] ?? '');
  const bf = FILES.indexOf(b[0] ?? '');
  const br = RANKS.indexOf(b[1] ?? '');
  const cf = FILES.indexOf(c[0] ?? '');
  const cr = RANKS.indexOf(c[1] ?? '');
  return (bf - af) * (cr - ar) === (br - ar) * (cf - af);
}

function pinSource(game: Chess, square: Square, color: Color): Square | null {
  const kingSq = findKing(game, color);
  if (!kingSq || kingSq === square) return null;
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

function attackersOf(game: Chess, square: Square, by: Color): { val: number }[] {
  const board = game.board();
  const out: { val: number }[] = [];
  const kingSq = findKing(game, by);
  for (let r = 0; r < 8; r += 1) {
    for (let f = 0; f < 8; f += 1) {
      const piece = board[r]?.[f];
      if (!piece || piece.color !== by) continue;
      const from = sq(f, 7 - r);
      if (!rawAttacks(game, from, square)) continue;
      const pinner = pinSource(game, from, by);
      if (pinner && kingSq && square !== pinner && !aligned(from, square, kingSq)) continue;
      out.push({ val: VAL[piece.type] });
    }
  }
  return out;
}

function isTrulyHanging(game: Chess, square: Square, side: Color): boolean {
  const piece = game.get(square);
  if (!piece || piece.color !== side || piece.type === 'k') return false;
  const opp: Color = side === 'w' ? 'b' : 'w';
  if (!game.isAttacked(square, opp)) return false;
  const attackers = attackersOf(game, square, opp);
  if (!attackers.length) return false;
  const defended = game.isAttacked(square, side);
  const cheapest = Math.min(...attackers.map((attacker) => attacker.val));
  return !defended || cheapest < VAL[piece.type];
}

function isLiveForkOn(game: Chess, square: Square, side: Color): boolean {
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

function opponentThreatensMateInOne(fen: string, side: Color): boolean {
  const opp: Color = side === 'w' ? 'b' : 'w';
  const parts = fen.split(' ');
  parts[1] = opp;
  const probe = new Chess(parts.join(' '));
  for (const move of probe.moves({ verbose: true })) {
    const next = new Chess(probe.fen());
    next.move(move);
    if (next.isCheckmate()) return true;
  }
  return false;
}

function squareAfterMove(
  after: Chess,
  from: Square,
  to: Square,
  risk: Square,
  side: Color,
  type: PieceSymbol,
): Square | null {
  if (from === risk) {
    const landed = after.get(to);
    if (landed?.color === side && landed.type === type) return to;
    return null;
  }
  const stayed = after.get(risk);
  if (stayed?.color === side && stayed.type === type) return risk;
  return null;
}

type DangerDrill = {
  fen: string;
  sideToMove: Color;
  theme: DrillTheme;
  atRiskSquare: Square;
};

/** True when this legal move removes the drill's immediate threat. */
export function moveRemovesDanger(drill: DangerDrill, from: Square, to: Square): boolean {
  const before = new Chess(drill.fen);
  const piece = before.get(drill.atRiskSquare);
  if (!piece) return false;
  let after: Chess;
  try {
    after = new Chess(drill.fen);
    const played = after.move({ from, to, promotion: 'q' });
    if (!played || after.isCheckmate()) return false;
  } catch {
    return false;
  }

  switch (drill.theme) {
    case 'hanging': {
      const square = squareAfterMove(after, from, to, drill.atRiskSquare, drill.sideToMove, piece.type);
      return square !== null && !isTrulyHanging(after, square, drill.sideToMove);
    }
    case 'fork': {
      const square = squareAfterMove(after, from, to, drill.atRiskSquare, drill.sideToMove, piece.type);
      return square !== null && !isLiveForkOn(after, square, drill.sideToMove);
    }
    case 'pin':
      return false;
    case 'back_rank':
    case 'missed_mate':
      return !opponentThreatensMateInOne(after.fen(), drill.sideToMove);
    default: {
      const _exhaustive: never = drill.theme;
      return _exhaustive;
    }
  }
}
