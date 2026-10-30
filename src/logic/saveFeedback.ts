import { Chess, type PieceSymbol, type Square } from 'chess.js';

import type { DrillPosition } from '@/src/logic/drills';

export type DrillRound = 'playing' | 'correct' | 'retry' | 'revealed' | 'streakEnd';

const NAMES: Record<PieceSymbol, string> = {
  p: 'pawn',
  n: 'knight',
  b: 'bishop',
  r: 'rook',
  q: 'queen',
  k: 'king',
};

/**
 * Describe the save that was just played.
 * Hint copy (`drill.note`) stays on the reveal and miss paths.
 */
export function saveFeedback(drill: DrillPosition, from: Square, to: Square): string {
  const game = new Chess(drill.fen);
  const atRisk = game.get(drill.atRiskSquare);
  const opponent = drill.sideToMove === 'w' ? 'b' : 'w';
  const attackers = game.attackers(drill.atRiskSquare, opponent);

  let san: string;
  let piece: PieceSymbol;
  let captured: PieceSymbol | undefined;
  try {
    const move = game.move({ from, to, promotion: 'q' });
    if (!move) return 'That gets the piece to safety.';
    san = move.san;
    piece = move.piece;
    captured = move.captured;
  } catch {
    return 'That gets the piece to safety.';
  }

  if (!atRisk) return `${san} gets the piece to safety.`;

  const movedName = NAMES[piece];
  const riskName = NAMES[atRisk.type];
  const capturedName = captured ? NAMES[captured] : null;

  if (from === drill.atRiskSquare) {
    if (capturedName) {
      return `${san} takes the ${capturedName} and gets your ${movedName} off ${from}.`;
    }
    return `${san} gets your ${movedName} off ${from}.`;
  }

  if (capturedName && attackers.includes(to)) {
    return `${san} takes the ${capturedName} that was attacking your ${riskName}.`;
  }

  switch (drill.theme) {
    case 'back_rank':
    case 'missed_mate':
      return `${san} stops the mating threat.`;
    case 'fork':
      return `${san} breaks the fork.`;
    case 'pin':
      return `${san} answers the pin on your ${riskName}.`;
    case 'hanging': {
      const stillThere = game.get(drill.atRiskSquare);
      if (stillThere && game.attackers(drill.atRiskSquare, drill.sideToMove).includes(to)) {
        return `${san} defends your ${riskName} on ${drill.atRiskSquare}.`;
      }
      return `${san} saves your ${riskName} on ${drill.atRiskSquare}.`;
    }
    default: {
      const _exhaustive: never = drill.theme;
      return _exhaustive;
    }
  }
}

const RETRY_COPY = "That doesn't save your piece. Look again and try another move.";

/** Success describes the move played. Hints and misses keep the drill note. */
export function feedbackForRound(
  round: DrillRound,
  drill: DrillPosition,
  move: { from: Square; to: Square } | null,
): string | null {
  switch (round) {
    case 'playing':
      return null;
    case 'correct':
      return move ? saveFeedback(drill, move.from, move.to) : 'That gets the piece to safety.';
    case 'retry':
      return RETRY_COPY;
    case 'revealed':
    case 'streakEnd':
      return drill.note;
    default: {
      const _exhaustive: never = round;
      return _exhaustive;
    }
  }
}
