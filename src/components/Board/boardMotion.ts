import { Chess, type Color, type PieceSymbol, type Square } from 'chess.js';

import { squareAt } from '@/src/components/Board/boardCoords';
import { BOARD_BORDER } from '@/src/components/Board/boardGeometry';

/** A played move eases across the board in this window. */
export const SLIDE_MS = 180;

/** Lifted piece while a drag is active. 1 is the square size. */
export const DRAG_SCALE = 1.12;

/**
 * A rewind of a short line (a move, the reply, maybe one more ply) still
 * slides. A new puzzle is a different position and should snap instead.
 */
const MAX_SLIDES = 3;
const MAX_FADES = 3;

export type DropReason = 'off-board' | 'illegal' | 'origin';

export type DropIntent = { kind: 'move'; to: Square } | { kind: 'snap'; reason: DropReason };

export type SlideMotion = {
  kind: 'slide';
  from: Square;
  to: Square;
  color: Color;
  type: PieceSymbol;
};

export type FadeMotion = {
  kind: 'fade';
  direction: 'in' | 'out';
  square: Square;
  color: Color;
  type: PieceSymbol;
};

export type BoardMotion = SlideMotion | FadeMotion;

type PieceSpot = {
  square: Square;
  color: Color;
  type: PieceSymbol;
};

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;
const RANKS = ['1', '2', '3', '4', '5', '6', '7', '8'] as const;

function fileOf(square: Square): number {
  return square.charCodeAt(0) - 97;
}

function rankOf(square: Square): number {
  return Number(square[1]);
}

/** Gesture coordinates include the frame border. Square math starts inside it. */
export function pointerToBoard(x: number, y: number): { x: number; y: number } {
  'worklet';
  return { x: x - BOARD_BORDER, y: y - BOARD_BORDER };
}

/**
 * Square under a point in board space (origin at the top-left square).
 * Points outside the 8×8 grid are off the board — they are not clamped
 * onto the rim, so a drop past the edge can snap back.
 */
export function pointToSquare(
  x: number,
  y: number,
  squareSize: number,
  orientation: 'white' | 'black',
): Square | null {
  'worklet';
  if (squareSize <= 0) return null;
  const span = squareSize * 8;
  if (x < 0 || y < 0 || x >= span || y >= span) return null;
  const fileIndex = Math.floor(x / squareSize);
  const rankIndex = Math.floor(y / squareSize);
  return squareAt(fileIndex, rankIndex, orientation);
}

/** Where a drag should land. Illegal squares and off-board drops snap back. */
export function dragDropIntent(input: {
  from: Square;
  x: number;
  y: number;
  squareSize: number;
  orientation: 'white' | 'black';
  legal: readonly Square[];
}): DropIntent {
  const to = pointToSquare(input.x, input.y, input.squareSize, input.orientation);
  if (!to) return { kind: 'snap', reason: 'off-board' };
  if (to === input.from) return { kind: 'snap', reason: 'origin' };
  if (!input.legal.includes(to)) return { kind: 'snap', reason: 'illegal' };
  return { kind: 'move', to };
}

function readBoard(fen: string): Map<Square, { color: Color; type: PieceSymbol }> | null {
  try {
    const game = new Chess(fen);
    const pieces = new Map<Square, { color: Color; type: PieceSymbol }>();
    for (const file of FILES) {
      for (const rank of RANKS) {
        const square = `${file}${rank}` as Square;
        const piece = game.get(square);
        if (piece) pieces.set(square, { color: piece.color, type: piece.type });
      }
    }
    return pieces;
  } catch {
    return null;
  }
}

function samePiece(
  left: { color: Color; type: PieceSymbol } | undefined,
  right: { color: Color; type: PieceSymbol } | undefined,
): boolean {
  return left?.color === right?.color && left?.type === right?.type;
}

function pieceKey(piece: { color: Color; type: PieceSymbol }): string {
  return `${piece.color}${piece.type}`;
}

function squareDistance(left: Square, right: Square): number {
  const file = fileOf(left) - fileOf(right);
  const rank = rankOf(left) - rankOf(right);
  return file * file + rank * rank;
}

function pairPieces(sources: PieceSpot[], destinations: PieceSpot[]): {
  slides: SlideMotion[];
  unmatchedSources: PieceSpot[];
  unmatchedDestinations: PieceSpot[];
} {
  const candidates: { source: number; destination: number; distance: number }[] = [];
  for (let source = 0; source < sources.length; source += 1) {
    for (let destination = 0; destination < destinations.length; destination += 1) {
      candidates.push({
        source,
        destination,
        distance: squareDistance(sources[source].square, destinations[destination].square),
      });
    }
  }
  candidates.sort(
    (left, right) => left.distance - right.distance || left.source - right.source || left.destination - right.destination,
  );
  const usedSources = new Set<number>();
  const usedDestinations = new Set<number>();
  const slides: SlideMotion[] = [];
  for (const candidate of candidates) {
    if (usedSources.has(candidate.source) || usedDestinations.has(candidate.destination)) continue;
    usedSources.add(candidate.source);
    usedDestinations.add(candidate.destination);
    const from = sources[candidate.source];
    const to = destinations[candidate.destination];
    slides.push({ kind: 'slide', from: from.square, to: to.square, color: from.color, type: from.type });
  }
  return {
    slides,
    unmatchedSources: sources.filter((_, index) => !usedSources.has(index)),
    unmatchedDestinations: destinations.filter((_, index) => !usedDestinations.has(index)),
  };
}

function isPromotionPair(gone: PieceSpot, came: PieceSpot): boolean {
  if (gone.color !== came.color) return false;
  const fileGap = Math.abs(fileOf(gone.square) - fileOf(came.square));
  if (fileGap > 1) return false;
  const rankGap = rankOf(came.square) - rankOf(gone.square);
  const forward = gone.color === 'w' ? 1 : -1;
  const promoted = gone.type === 'p' && came.type !== 'p' && rankGap === forward;
  const undone = gone.type !== 'p' && came.type === 'p' && rankGap === -forward;
  return promoted || undone;
}

/** A pawn that becomes a queen (or the reverse on undo) is one slide of the arriving piece. */
function absorbPromotion(fades: FadeMotion[]): { slides: SlideMotion[]; fades: FadeMotion[] } {
  const outgoing = fades.filter((fade) => fade.direction === 'out');
  const incoming = fades.filter((fade) => fade.direction === 'in');
  const usedOut = new Set<number>();
  const usedIn = new Set<number>();
  const slides: SlideMotion[] = [];

  for (let cameIndex = incoming.length - 1; cameIndex >= 0; cameIndex -= 1) {
    for (let goneIndex = outgoing.length - 1; goneIndex >= 0; goneIndex -= 1) {
      if (usedOut.has(goneIndex)) continue;
      const came = incoming[cameIndex];
      const gone = outgoing[goneIndex];
      const goneSpot: PieceSpot = { square: gone.square, color: gone.color, type: gone.type };
      const cameSpot: PieceSpot = { square: came.square, color: came.color, type: came.type };
      if (!isPromotionPair(goneSpot, cameSpot)) continue;
      slides.push({
        kind: 'slide',
        from: gone.square,
        to: came.square,
        color: came.color,
        type: came.type,
      });
      usedOut.add(goneIndex);
      usedIn.add(cameIndex);
      break;
    }
  }

  const remaining: FadeMotion[] = [
    ...outgoing.filter((_, index) => !usedOut.has(index)),
    ...incoming.filter((_, index) => !usedIn.has(index)),
  ];
  return { slides, fades: remaining };
}

/**
 * Piece motions that turn `beforeFen` into `afterFen`.
 * `null` means the change is too large to animate (a new puzzle, or an invalid fen).
 */
export function motionsBetween(beforeFen: string, afterFen: string): BoardMotion[] | null {
  if (beforeFen === afterFen) return [];
  const before = readBoard(beforeFen);
  const after = readBoard(afterFen);
  if (!before || !after) return null;

  const gone: PieceSpot[] = [];
  const came: PieceSpot[] = [];
  for (const file of FILES) {
    for (const rank of RANKS) {
      const square = `${file}${rank}` as Square;
      const previous = before.get(square);
      const next = after.get(square);
      if (samePiece(previous, next)) continue;
      if (previous) gone.push({ square, color: previous.color, type: previous.type });
      if (next) came.push({ square, color: next.color, type: next.type });
    }
  }
  if (gone.length > 8 || came.length > 8) return null;

  const sources = new Map<string, PieceSpot[]>();
  const destinations = new Map<string, PieceSpot[]>();
  for (const piece of gone) {
    const key = pieceKey(piece);
    const list = sources.get(key) ?? [];
    list.push(piece);
    sources.set(key, list);
  }
  for (const piece of came) {
    const key = pieceKey(piece);
    const list = destinations.get(key) ?? [];
    list.push(piece);
    destinations.set(key, list);
  }

  const slides: SlideMotion[] = [];
  const fades: FadeMotion[] = [];
  const keys = new Set([...sources.keys(), ...destinations.keys()]);
  for (const key of keys) {
    const paired = pairPieces(sources.get(key) ?? [], destinations.get(key) ?? []);
    slides.push(...paired.slides);
    for (const piece of paired.unmatchedSources) {
      fades.push({ kind: 'fade', direction: 'out', square: piece.square, color: piece.color, type: piece.type });
    }
    for (const piece of paired.unmatchedDestinations) {
      fades.push({ kind: 'fade', direction: 'in', square: piece.square, color: piece.color, type: piece.type });
    }
  }

  const absorbed = absorbPromotion(fades);
  const motions: BoardMotion[] = [...slides, ...absorbed.slides, ...absorbed.fades];
  const slideCount = motions.filter((motion) => motion.kind === 'slide').length;
  const fadeCount = motions.length - slideCount;
  if (slideCount > MAX_SLIDES || fadeCount > MAX_FADES) return null;
  return motions;
}
