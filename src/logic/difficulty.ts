import { Chess, type Color, type PieceSymbol, type Square } from 'chess.js';

import type { DrillPosition } from '@/src/logic/drills';
import { bestPunishment, opposite, pieceValue } from '@/src/logic/safety';

export type DrillDifficulty = 'starter' | 'club' | 'sharp';

function pieceCount(fen: string): number {
  const board = fen.split(' ')[0] ?? '';
  let count = 0;
  for (let i = 0; i < board.length; i += 1) {
    const ch = board[i]!;
    if ((ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z')) count += 1;
  }
  return count;
}

/**
 * Classifies a drill position into Starter / Club / Sharp based on tactical
 * complexity, board density, and trap replies.
 */
export function drillDifficulty(drill: Pick<DrillPosition, 'fen' | 'theme' | 'traps' | 'expectedDropCp'>): DrillDifficulty {
  const pieces = pieceCount(drill.fen);
  if (drill.traps.length > 0) return 'sharp';
  if ((drill.theme === 'fork' || drill.theme === 'pin' || drill.theme === 'missed_mate') && pieces >= 22) {
    return 'sharp';
  }
  if (drill.theme !== 'hanging' || pieces >= 20 || drill.expectedDropCp <= 300) {
    return 'club';
  }
  return 'starter';
}

export function difficultyLabel(tier: DrillDifficulty): string {
  switch (tier) {
    case 'starter':
      return 'Starter';
    case 'club':
      return 'Club';
    case 'sharp':
      return 'Sharp';
    default: {
      const _exhaustive: never = tier;
      return _exhaustive;
    }
  }
}

function fenWithTurn(fen: string, turn: Color): string | null {
  try {
    const parts = fen.split(' ');
    parts[1] = turn;
    parts[3] = '-';
    return new Chess(parts.join(' ')).fen();
  } catch {
    return null;
  }
}

/**
 * Finds the concrete opponent threat arrow for progressive Hint Step 2:
 * either the opponent's mate-in-1 move or the lowest-value piece attacking `atRiskSquare`.
 */
export function threatAttackerArrow(
  drill: Pick<DrillPosition, 'fen' | 'sideToMove' | 'atRiskSquare'>,
): { from: Square; to: Square } | null {
  const opp = opposite(drill.sideToMove);
  const flipped = fenWithTurn(drill.fen, opp);
  if (!flipped) return null;
  const game = new Chess(flipped);
  const direct = game
    .moves({ verbose: true })
    .filter((move) => move.to === drill.atRiskSquare)
    .sort((a, b) => pieceValue(a.piece as PieceSymbol) - pieceValue(b.piece as PieceSymbol));
  if (direct[0]) return { from: direct[0].from, to: direct[0].to };
  const hit = bestPunishment(flipped);
  return hit ? { from: hit.from, to: hit.to } : null;
}
