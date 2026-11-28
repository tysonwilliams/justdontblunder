import { Chess, type Color, type Square } from 'chess.js';

import { findBackRankMateThreat } from '@/src/engine/patterns';
import { isAbsolutePin, isLiveForkOn } from '@/src/logic/danger';
import { themeInstruction, type DrillPosition, type DrillTheme } from '@/src/logic/drills';
import { fenKey } from '@/src/logic/reviewPile';
import {
  listHangingPieces,
  moveOutcome,
  opponentThreatensMateInOne,
  pieceName,
  bestPunishment,
} from '@/src/logic/safety';

const FILES = 'abcdefgh';
const RANKS = '87654321';

export function ownDrillId(fen: string): string {
  const key = fenKey(fen);
  let hash = 2166136261;
  for (let i = 0; i < key.length; i += 1) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `own-${(hash >>> 0).toString(36)}`;
}

/**
 * The position before a move that drops material or allows mate in 1.
 * Pattern detectors name the theme. The material rule decides whether to keep it.
 */
export function drillFromBlunder(input: {
  fen: string;
  from: Square;
  to: Square;
  san: string;
  promotion?: 'q' | 'r' | 'b' | 'n';
}): DrillPosition | null {
  const game = readGame(input.fen);
  if (!game) return null;
  const side = game.turn();
  const promotion = input.promotion ?? 'q';
  const outcome = moveOutcome(game.fen(), input.from, input.to, side, promotion);
  if (outcome === null || outcome >= 0) return null;
  const after = readGame(game.fen());
  if (!after) return null;
  let played;
  try {
    played = after.move({ from: input.from, to: input.to, promotion });
  } catch {
    return null;
  }
  if (!played) return null;
  const kind = classify(game, side, input.from, after.fen());
  return build(
    game.fen(),
    side,
    kind.theme,
    kind.atRisk,
    blunderNote(input.san, after.fen()),
    Math.round(Math.abs(outcome) * 100),
  );
}

/** A hanging piece the player has not moved yet. */
export function drillFromHang(fen: string): DrillPosition | null {
  const game = readGame(fen);
  if (!game) return null;
  const side = game.turn();
  const hanging = listHangingPieces(game.fen(), side)[0];
  if (!hanging) return null;
  const note = `Your ${pieceName(hanging.type)} on ${hanging.square} is hanging.`;
  return build(game.fen(), side, 'hanging', hanging.square, note, hanging.gain * 100);
}

function readGame(fen: string): Chess | null {
  try {
    return new Chess(fen);
  } catch {
    return null;
  }
}

function isBackRankMateAfter(afterFen: string, victimSide: Color): boolean {
  const hit = bestPunishment(afterFen);
  if (!hit || !hit.mate) return false;
  const backRank = victimSide === 'w' ? '1' : '8';
  if (hit.to[1] !== backRank) return false;
  const game = readGame(afterFen);
  if (!game) return false;
  const king = kingSquare(game, victimSide);
  if (!king || king[1] !== backRank) return false;
  const mover = game.get(hit.from);
  return mover?.type === 'r' || mover?.type === 'q';
}

function classify(
  game: Chess,
  side: Color,
  from: Square,
  afterFen: string,
): { theme: DrillTheme; atRisk: Square } {
  if (opponentThreatensMateInOne(afterFen)) {
    const back = findBackRankMateThreat(game.fen());
    if (back?.squares[0] || isBackRankMateAfter(afterFen, side)) {
      return { theme: 'back_rank', atRisk: back?.squares[0] ?? kingSquare(game, side) ?? from };
    }
    return { theme: 'missed_mate', atRisk: kingSquare(game, side) ?? from };
  }
  const hanging = listHangingPieces(game.fen(), side)[0];
  if (hanging) {
    if (hanging.type !== 'p' && isLiveForkOn(game, hanging.square, side)) {
      return { theme: 'fork', atRisk: hanging.square };
    }
    if (isAbsolutePin(game, hanging.square, side)) {
      return { theme: 'pin', atRisk: hanging.square };
    }
  }
  const forked = firstSquare(game, side, isLiveForkOn, true);
  if (forked) return { theme: 'fork', atRisk: forked };
  if (hanging) return { theme: 'hanging', atRisk: hanging.square };
  const pinned = firstSquare(game, side, isAbsolutePin, true);
  if (pinned) return { theme: 'pin', atRisk: pinned };
  const back = findBackRankMateThreat(game.fen());
  if (back?.squares[0]) return { theme: 'back_rank', atRisk: back.squares[0] };
  return { theme: 'hanging', atRisk: from };
}

function firstSquare(
  game: Chess,
  side: Color,
  hit: (game: Chess, square: Square, side: Color) => boolean,
  piecesOnly = false,
): Square | null {
  const board = game.board();
  for (let rank = 0; rank < 8; rank += 1) {
    for (let file = 0; file < 8; file += 1) {
      const piece = board[rank]?.[file];
      if (!piece || piece.color !== side || piece.type === 'k') continue;
      if (piecesOnly && piece.type === 'p') continue;
      const square = toSquare(file, rank);
      if (square && hit(game, square, side)) return square;
    }
  }
  return null;
}

function kingSquare(game: Chess, color: Color): Square | null {
  const board = game.board();
  for (let rank = 0; rank < 8; rank += 1) {
    for (let file = 0; file < 8; file += 1) {
      const piece = board[rank]?.[file];
      if (piece?.type === 'k' && piece.color === color) return toSquare(file, rank);
    }
  }
  return null;
}

function toSquare(file: number, rank: number): Square | null {
  const fileChar = FILES[file];
  const rankChar = RANKS[rank];
  if (!fileChar || !rankChar) return null;
  return `${fileChar}${rankChar}` as Square;
}

function blunderNote(san: string, afterFen: string): string {
  const hit = bestPunishment(afterFen);
  if (!hit) return `You played ${san}.`;
  if (hit.mate) return `You played ${san}. ${hit.san} is mate.`;
  return `You played ${san}. ${hit.san} wins your ${pieceName(hit.captured)} on ${hit.to}.`;
}

function build(
  fen: string,
  side: Color,
  theme: DrillTheme,
  atRisk: Square,
  note: string,
  expectedDropCp: number,
): DrillPosition | null {
  const solution = savingMoves(fen, side, atRisk);
  if (solution.length === 0) return null;
  return {
    id: ownDrillId(fen),
    fen,
    sideToMove: side,
    theme,
    atRiskSquare: atRisk,
    prompt: themeInstruction(theme),
    solution,
    acceptable: solution,
    traps: [],
    note,
    expectedDropCp,
  };
}

function savingMoves(fen: string, side: Color, atRisk: Square): string[] {
  const game = readGame(fen);
  if (!game || game.turn() !== side) return [];
  const ranked: { uci: string; rank: number }[] = [];
  for (const move of game.moves({ verbose: true })) {
    const promo = move.promotion as 'q' | 'r' | 'b' | 'n' | undefined;
    const outcome = moveOutcome(fen, move.from, move.to, side, promo ?? 'q');
    if (outcome === null || outcome < 0) continue;
    let rank = 0;
    if (move.from === atRisk) rank += 3;
    if (move.captured) rank += 1;
    if (promo === 'q') rank += 1;
    ranked.push({ uci: promo && promo !== 'q' ? `${move.from}${move.to}${promo}` : `${move.from}${move.to}`, rank });
  }
  ranked.sort((a, b) => b.rank - a.rank || (a.uci < b.uci ? -1 : a.uci > b.uci ? 1 : 0));
  const unique: string[] = [];
  for (const item of ranked) {
    if (unique.includes(item.uci)) continue;
    unique.push(item.uci);
    if (unique.length >= 8) break;
  }
  return unique;
}
