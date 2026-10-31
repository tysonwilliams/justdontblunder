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

/** Passes the drill judge: no mate in 1, no material loss, and not a listed trap. */
function isReallySafe(drill: DrillPosition, from: Square, to: Square): boolean {
  if (!isCorrectDrillMove(drill, from, to)) return false;
  if (drillTrap(drill, from, to)) return false;
  const outcome = moveOutcome(drill.fen, from, to, drill.sideToMove);
  return outcome !== null && outcome >= 0;
}

/**
 * Fails the drill judge by hanging material, allowing mate in 1,
 * or walking into a precomputed two-move trap.
 */
function isRealBlunder(drill: DrillPosition, from: Square, to: Square): boolean {
  if (isCorrectDrillMove(drill, from, to)) return false;
  const outcome = moveOutcome(drill.fen, from, to, drill.sideToMove);
  if (outcome === null) return false;
  if (outcome < 0) return true;
  return drillTrap(drill, from, to) !== null;
}

function pickSafe(drill: DrillPosition, moves: Move[]): Move | null {
  const preferred = [...drill.solution, ...(drill.acceptable ?? [])];
  for (const uci of preferred) {
    const move = findUci(moves, uci);
    if (move && isReallySafe(drill, move.from, move.to)) return move;
  }
  return moves.find((move) => isReallySafe(drill, move.from, move.to)) ?? null;
}

function pickBlunder(drill: DrillPosition, moves: Move[]): Move | null {
  for (const trap of drill.traps) {
    const move = findUci(moves, trap.move);
    if (move && isRealBlunder(drill, move.from, move.to)) return move;
  }
  const fromRisk = moves.find(
    (move) => move.from === drill.atRiskSquare && isRealBlunder(drill, move.from, move.to),
  );
  if (fromRisk) return fromRisk;
  return moves.find((move) => isRealBlunder(drill, move.from, move.to)) ?? null;
}

/**
 * Two candidates for "pick the safe move".
 * Returns null when the position cannot show one passing move and one real blunder.
 */
export function safeChoiceFor(drill: DrillPosition): SafeChoice | null {
  const moves = legalMoves(drill.fen);
  const safe = pickSafe(drill, moves);
  const blunder = pickBlunder(drill, moves);
  if (!safe || !blunder) return null;
  if (`${safe.from}${safe.to}` === `${blunder.from}${blunder.to}`) return null;
  if (!isReallySafe(drill, safe.from, safe.to)) return null;
  if (!isRealBlunder(drill, blunder.from, blunder.to)) return null;
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
