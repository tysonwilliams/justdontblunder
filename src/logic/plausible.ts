import { Chess, type Color, type PieceSymbol, type Square } from 'chess.js';

import { materialIsReachable } from '@/src/logic/safety';

/**
 * A position is plausible when a real game could have produced it.
 * chess.js rejects broken FENs, pawns on the edge ranks, and a missing king.
 * This adds the checks chess.js does not: the other king is not already in
 * check, castling rights match the king and rook, en passant matches a
 * double step, pawn captures fit the pieces that are missing, and a rook,
 * bishop, or queen that has left home had a way out. A piece still on its
 * starting square is treated as never having moved, so it still blocks that
 * exit.
 */

const FILES = 'abcdefgh';
const RANKS = '12345678';
const NON_KING = 15;

type Slide = 'b' | 'r' | 'q';

type Placed = {
  color: Color;
  type: PieceSymbol;
  square: Square;
};

const DIRECTIONS: Record<Slide, readonly (readonly [number, number])[]> = {
  b: [
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ],
  r: [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ],
  q: [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ],
};

const START: Record<Color, Record<PieceSymbol, readonly Square[]>> = {
  w: {
    p: ['a2', 'b2', 'c2', 'd2', 'e2', 'f2', 'g2', 'h2'],
    n: ['b1', 'g1'],
    b: ['c1', 'f1'],
    r: ['a1', 'h1'],
    q: ['d1'],
    k: ['e1'],
  },
  b: {
    p: ['a7', 'b7', 'c7', 'd7', 'e7', 'f7', 'g7', 'h7'],
    n: ['b8', 'g8'],
    b: ['c8', 'f8'],
    r: ['a8', 'h8'],
    q: ['d8'],
    k: ['e8'],
  },
};

const CASTLING: readonly {
  flag: string;
  color: Color;
  king: Square;
  rook: Square;
  side: string;
}[] = [
  { flag: 'K', color: 'w', king: 'e1', rook: 'h1', side: 'White kingside' },
  { flag: 'Q', color: 'w', king: 'e1', rook: 'a1', side: 'White queenside' },
  { flag: 'k', color: 'b', king: 'e8', rook: 'h8', side: 'Black kingside' },
  { flag: 'q', color: 'b', king: 'e8', rook: 'a8', side: 'Black queenside' },
];

function squareAt(file: number, rank: number): Square {
  return `${FILES[file]}${RANKS[rank]}` as Square;
}

function coords(square: Square): [number, number] {
  return [square.charCodeAt(0) - 97, square.charCodeAt(1) - 49];
}

function isDark(square: Square): boolean {
  const [file, rank] = coords(square);
  return (file + rank) % 2 === 0;
}

function colorName(color: Color): string {
  switch (color) {
    case 'w':
      return 'White';
    case 'b':
      return 'Black';
    default: {
      const exhaustive: never = color;
      return exhaustive;
    }
  }
}

function pieceName(kind: Slide, count: number): string {
  const singular = kind === 'r' ? 'rook' : kind === 'b' ? 'bishop' : 'queen';
  return count === 1 ? singular : `${singular}s`;
}

function listSquares(squares: readonly Square[]): string {
  if (squares.length === 0) return 'its home square';
  if (squares.length === 1) return squares[0] ?? 'its home square';
  return squares.join(' or ');
}

function readPieces(game: Chess): Placed[] {
  const placed: Placed[] = [];
  for (let file = 0; file < 8; file += 1) {
    for (let rank = 0; rank < 8; rank += 1) {
      const square = squareAt(file, rank);
      const piece = game.get(square);
      if (!piece) continue;
      placed.push({ color: piece.color, type: piece.type, square });
    }
  }
  return placed;
}

function unmovedWalls(pieces: readonly Placed[]): Set<Square> {
  const walls = new Set<Square>();
  for (const piece of pieces) {
    if (START[piece.color][piece.type].includes(piece.square)) walls.add(piece.square);
  }
  return walls;
}

/** A slider can cross any square that is not still occupied by an unmoved piece. */
function canReach(from: Square, to: Square, kind: Slide, walls: ReadonlySet<Square>): boolean {
  if (from === to) return true;
  const seen = new Set<Square>([from]);
  const stack: Square[] = [from];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) break;
    const [file, rank] = coords(current);
    for (const [df, dr] of DIRECTIONS[kind]) {
      let nextFile = file + df;
      let nextRank = rank + dr;
      while (nextFile >= 0 && nextFile < 8 && nextRank >= 0 && nextRank < 8) {
        const square = squareAt(nextFile, nextRank);
        if (walls.has(square)) break;
        if (square === to) return true;
        if (!seen.has(square)) {
          seen.add(square);
          stack.push(square);
        }
        nextFile += df;
        nextRank += dr;
      }
    }
  }
  return false;
}

function promotionSquares(color: Color, walls: ReadonlySet<Square>, dark: boolean | null): Square[] {
  const rank = color === 'w' ? 7 : 0;
  const squares: Square[] = [];
  for (let file = 0; file < 8; file += 1) {
    const square = squareAt(file, rank);
    if (walls.has(square)) continue;
    if (dark !== null && isDark(square) !== dark) continue;
    squares.push(square);
  }
  return squares;
}

function canPromoteTo(square: Square, kind: Slide, walls: ReadonlySet<Square>, promos: readonly Square[]): boolean {
  return promos.some((promo) => promo === square || canReach(promo, square, kind, walls));
}

/**
 * Original sliders have to match a home they can still exit.
 * Pieces beyond the starting count have to reach their square from the promotion rank.
 */
function canExplain(
  offHome: readonly Square[],
  emptyHomes: readonly Square[],
  originalsOff: number,
  extras: number,
  kind: Slide,
  walls: ReadonlySet<Square>,
  promos: readonly Square[],
): boolean {
  if (offHome.length !== originalsOff + extras) return false;
  if (emptyHomes.length < originalsOff) return false;
  const reachable = offHome.map((square) => emptyHomes.filter((home) => canReach(home, square, kind, walls)));
  const promoted = offHome.map((square) => canPromoteTo(square, kind, walls, promos));

  function assign(index: number, used: Set<Square>, homesUsed: number, promosUsed: number): boolean {
    if (index === offHome.length) return homesUsed === originalsOff && promosUsed === extras;
    const homes = reachable[index] ?? [];
    for (const home of homes) {
      if (used.has(home) || homesUsed === originalsOff) continue;
      used.add(home);
      if (assign(index + 1, used, homesUsed + 1, promosUsed)) return true;
      used.delete(home);
    }
    if (promoted[index] && promosUsed < extras) {
      return assign(index + 1, used, homesUsed, promosUsed + 1);
    }
    return false;
  }

  return assign(0, new Set(), 0, 0);
}

function explainGroup(input: {
  color: Color;
  kind: Slide;
  squares: readonly Square[];
  homes: readonly Square[];
  walls: ReadonlySet<Square>;
  promoDark: boolean | null;
}): string | null {
  const onHome = input.squares.filter((square) => input.homes.includes(square));
  const offHome = input.squares.filter((square) => !input.homes.includes(square));
  const extras = Math.max(0, input.squares.length - input.homes.length);
  const originalsOff = Math.min(input.squares.length, input.homes.length) - onHome.length;
  const emptyHomes = input.homes.filter((home) => !onHome.includes(home));
  const promos = promotionSquares(input.color, input.walls, input.promoDark);
  if (canExplain(offHome, emptyHomes, originalsOff, extras, input.kind, input.walls, promos)) return null;
  const who = colorName(input.color);
  const name = pieceName(input.kind, offHome.length);
  const where = offHome.join(' and ');
  if (extras === 0) {
    return `${who}'s ${name} on ${where} has no legal exit from ${listSquares(emptyHomes)} while the pieces blocking that exit are still on their starting squares.`;
  }
  if (originalsOff === 0) {
    return `${who}'s ${name} on ${where} would have to be promoted, but it cannot reach that square from the promotion rank without passing a piece that is still on its starting square.`;
  }
  return `${who}'s ${name} on ${where} cannot be explained by a home-square exit or by a promotion.`;
}

function sliderIssues(pieces: readonly Placed[], walls: ReadonlySet<Square>): string[] {
  const issues: string[] = [];
  for (const color of ['w', 'b'] as const) {
    const rooks = pieces.filter((piece) => piece.color === color && piece.type === 'r').map((piece) => piece.square);
    const queens = pieces.filter((piece) => piece.color === color && piece.type === 'q').map((piece) => piece.square);
    const rookIssue = explainGroup({
      color,
      kind: 'r',
      squares: rooks,
      homes: color === 'w' ? ['a1', 'h1'] : ['a8', 'h8'],
      walls,
      promoDark: null,
    });
    const queenIssue = explainGroup({
      color,
      kind: 'q',
      squares: queens,
      homes: color === 'w' ? ['d1'] : ['d8'],
      walls,
      promoDark: null,
    });
    if (rookIssue) issues.push(rookIssue);
    if (queenIssue) issues.push(queenIssue);
    for (const dark of [true, false]) {
      const bishops = pieces
        .filter((piece) => piece.color === color && piece.type === 'b' && isDark(piece.square) === dark)
        .map((piece) => piece.square);
      const home = color === 'w' ? (dark ? 'c1' : 'f1') : dark ? 'f8' : 'c8';
      const bishopIssue = explainGroup({
        color,
        kind: 'b',
        squares: bishops,
        homes: [home],
        walls,
        promoDark: dark,
      });
      if (bishopIssue) issues.push(bishopIssue);
    }
  }
  return issues;
}

function minPawnCaptures(pieces: readonly Placed[], color: Color): number {
  const startRank = color === 'w' ? 1 : 6;
  const fixed = new Set<number>();
  const movers: number[] = [];
  for (const piece of pieces) {
    if (piece.color !== color || piece.type !== 'p') continue;
    const [file, rank] = coords(piece.square);
    if (rank === startRank) fixed.add(file);
    else movers.push(file);
  }
  if (movers.length === 0) return 0;
  const available: number[] = [];
  for (let file = 0; file < 8; file += 1) {
    if (!fixed.has(file)) available.push(file);
  }
  if (movers.length > available.length) return Number.POSITIVE_INFINITY;
  const targets = [...movers].sort((a, b) => a - b);
  let best = Number.POSITIVE_INFINITY;
  const chosen: number[] = [];
  function choose(start: number): void {
    if (chosen.length === targets.length) {
      const starts = [...chosen].sort((a, b) => a - b);
      let cost = 0;
      for (let i = 0; i < targets.length; i += 1) cost += Math.abs((starts[i] ?? 0) - (targets[i] ?? 0));
      if (cost < best) best = cost;
      return;
    }
    for (let i = start; i < available.length; i += 1) {
      const file = available[i];
      if (file === undefined) continue;
      chosen.push(file);
      choose(i + 1);
      chosen.pop();
    }
  }
  choose(0);
  return best;
}

function pawnIssues(pieces: readonly Placed[]): string[] {
  const issues: string[] = [];
  for (const color of ['w', 'b'] as const) {
    const needed = minPawnCaptures(pieces, color);
    const opponent: Color = color === 'w' ? 'b' : 'w';
    const missing = NON_KING - pieces.filter((piece) => piece.color === opponent && piece.type !== 'k').length;
    const who = colorName(color);
    if (!Number.isFinite(needed)) {
      issues.push(`${who}'s pawns cannot be traced back to eight starting files.`);
      continue;
    }
    if (needed > missing) {
      issues.push(
        `${who}'s pawns need at least ${needed} capture${needed === 1 ? '' : 's'}, but the other side is only missing ${Math.max(0, missing)} piece${missing === 1 ? '' : 's'}.`,
      );
    }
  }
  return issues;
}

function castlingIssues(game: Chess, fen: string): string[] {
  const rights = fen.trim().split(/\s+/)[2] ?? '-';
  if (rights === '-') return [];
  const issues: string[] = [];
  for (const right of CASTLING) {
    if (!rights.includes(right.flag)) continue;
    const king = game.get(right.king);
    const rook = game.get(right.rook);
    if (!king || king.type !== 'k' || king.color !== right.color) {
      issues.push(`${right.side} castling is still available, but the king is not on ${right.king}.`);
    }
    if (!rook || rook.type !== 'r' || rook.color !== right.color) {
      issues.push(`${right.side} castling is still available, but the rook is not on ${right.rook}.`);
    }
  }
  return issues;
}

function enPassantIssues(game: Chess, fen: string): string[] {
  const ep = fen.trim().split(/\s+/)[3] ?? '-';
  if (ep === '-') return [];
  const file = ep[0];
  if (!file) return [`En passant square ${ep} is invalid.`];
  const issues: string[] = [];
  if (game.get(ep as Square)) issues.push(`En passant square ${ep} is occupied.`);
  if (game.turn() === 'w') {
    const pawnSquare = `${file}5` as Square;
    const pawn = game.get(pawnSquare);
    if (!pawn || pawn.type !== 'p' || pawn.color !== 'b') {
      issues.push(`En passant square ${ep} needs a black pawn on ${file}5.`);
    }
    if (game.get(`${file}7` as Square)) {
      issues.push(`The pawn on ${file}7 never left home, so it did not just pass ${ep}.`);
    }
  } else {
    const pawnSquare = `${file}4` as Square;
    const pawn = game.get(pawnSquare);
    if (!pawn || pawn.type !== 'p' || pawn.color !== 'w') {
      issues.push(`En passant square ${ep} needs a white pawn on ${file}4.`);
    }
    if (game.get(`${file}2` as Square)) {
      issues.push(`The pawn on ${file}2 never left home, so it did not just pass ${ep}.`);
    }
  }
  return issues;
}

function otherKingInCheck(fen: string): string | null {
  const parts = fen.trim().split(/\s+/);
  const mover = parts[1] === 'b' ? 'b' : 'w';
  parts[1] = mover === 'w' ? 'b' : 'w';
  parts[3] = '-';
  const flipped = new Chess(parts.join(' '));
  if (!flipped.isCheck()) return null;
  const stuck = mover === 'w' ? 'Black' : 'White';
  const toMove = mover === 'w' ? 'White' : 'Black';
  return `${stuck}'s king is in check, but it is ${toMove}'s turn.`;
}

/** Reasons this FEN could not occur in a real game. An empty list means it could. */
export function plausibilityIssues(fen: string): string[] {
  let game: Chess;
  try {
    game = new Chess(fen);
  } catch (error) {
    return [error instanceof Error ? error.message : 'Invalid FEN.'];
  }
  const issues: string[] = [];
  const check = otherKingInCheck(fen);
  if (check) issues.push(check);
  issues.push(...castlingIssues(game, fen));
  issues.push(...enPassantIssues(game, fen));
  if (!materialIsReachable(fen)) {
    issues.push('Piece counts need more promotions than the missing pawns can pay for.');
  }
  const pieces = readPieces(game);
  issues.push(...pawnIssues(pieces));
  issues.push(...sliderIssues(pieces, unmovedWalls(pieces)));
  return issues;
}
