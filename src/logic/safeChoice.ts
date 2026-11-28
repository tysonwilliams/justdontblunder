import { Chess, type Move, type Square } from 'chess.js';

import {
  drillTrap,
  isCorrectDrillMove,
  type DrillPosition,
} from '@/src/logic/drills';
import { moveOutcome } from '@/src/logic/safety';

export type ChoiceMove = {
  from: Square;
  to: Square;
  uci: string;
  san: string;
};

/** One safe move and one blunder, both checked against the drill judge. */
export type SafeChoice = {
  drillId: string;
  safe: ChoiceMove;
  blunder: ChoiceMove;
};

export type PresentedOption = ChoiceMove & { key: 'A' | 'B' };

export type PresentedSafeChoice = {
  drillId: string;
  options: [PresentedOption, PresentedOption];
  safeKey: 'A' | 'B';
  blunderKey: 'A' | 'B';
};

function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) {
    h = (h * 33 + id.charCodeAt(i)) >>> 0;
  }
  return h;
}

function legalMoves(fen: string): Move[] {
  try {
    return new Chess(fen).moves({ verbose: true });
  } catch {
    return [];
  }
}

function findUci(moves: Move[], uci: string): Move | undefined {
  const from = uci.slice(0, 2);
  const to = uci.slice(2, 4);
  return moves.find((move) => move.from === from && move.to === to);
}

function toChoice(move: Move): ChoiceMove {
  return {
    from: move.from,
    to: move.to,
    uci: `${move.from}${move.to}`,
    san: move.san,
  };
}

/**
 * Two candidates for "pick the safe move".
 * Returns null when the position cannot show one passing move and one real blunder.
 */
export function safeChoiceFor(drill: DrillPosition): SafeChoice | null {
  const moves = legalMoves(drill.fen);
  const outcomes = new Map<string, number | null>();
  const outcomeOf = (move: Move): number | null => {
    const key = `${move.from}${move.to}`;
    if (outcomes.has(key)) return outcomes.get(key) ?? null;
    const score = moveOutcome(drill.fen, move.from, move.to, drill.sideToMove);
    outcomes.set(key, score);
    return score;
  };
  const safeCheck = (move: Move): boolean => {
    const score = outcomeOf(move);
    if (score === null || score < 0) return false;
    return isCorrectDrillMove(drill, move.from, move.to);
  };
  const blunderCheck = (move: Move): boolean => {
    const score = outcomeOf(move);
    if (score === null || score >= 0) return false;
    return !isCorrectDrillMove(drill, move.from, move.to);
  };

  let safe: Move | null = null;
  const preferred = [...drill.solution, ...(drill.acceptable ?? [])];
  for (const uci of preferred) {
    const move = findUci(moves, uci);
    if (move && !drillTrap(drill, move.from, move.to) && safeCheck(move)) {
      safe = move;
      break;
    }
  }
  if (!safe) {
    safe = moves.find((move) => !drillTrap(drill, move.from, move.to) && safeCheck(move)) ?? null;
  }
  if (!safe) {
    safe = moves.find((move) => safeCheck(move)) ?? null;
  }

  let blunder: Move | null =
    moves.find((move) => move.from === drill.atRiskSquare && blunderCheck(move)) ?? null;
  if (!blunder) {
    blunder = moves.find((move) => blunderCheck(move)) ?? null;
  }

  if (!safe || !blunder) return null;
  if (`${safe.from}${safe.to}` === `${blunder.from}${blunder.to}`) return null;
  return {
    drillId: drill.id,
    safe: toChoice(safe),
    blunder: toChoice(blunder),
  };
}

/** Stable A/B order so the safe move is not always the first button. */
export function presentSafeChoice(choice: SafeChoice): PresentedSafeChoice {
  const safeFirst = hashId(choice.drillId) % 2 === 0;
  const [first, second] = safeFirst
    ? [choice.safe, choice.blunder]
    : [choice.blunder, choice.safe];
  return {
    drillId: choice.drillId,
    options: [
      { ...first, key: 'A' },
      { ...second, key: 'B' },
    ],
    safeKey: safeFirst ? 'A' : 'B',
    blunderKey: safeFirst ? 'B' : 'A',
  };
}
