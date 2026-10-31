import { Chess, type Square } from 'chess.js';

import { drillTrap, type DrillPosition } from '@/src/logic/drills';
import { bestPunishment } from '@/src/logic/safety';

/** One ply of the opponent's punishment, after the move that failed. */
export type PunishmentStep = {
  from: Square;
  to: Square;
  san: string;
  fen: string;
  mate: boolean;
  captured: boolean;
};

function playUci(game: Chess, uci: string): PunishmentStep | null {
  if (uci.length < 4) return null;
  const promotion = uci.length >= 5 ? uci[4] : 'q';
  if (promotion !== 'q' && promotion !== 'r' && promotion !== 'b' && promotion !== 'n') return null;
  let played;
  try {
    played = game.move({
      from: uci.slice(0, 2) as Square,
      to: uci.slice(2, 4) as Square,
      promotion,
    });
  } catch {
    return null;
  }
  if (!played) return null;
  return {
    from: played.from,
    to: played.to,
    san: played.san,
    fen: game.fen(),
    mate: game.isCheckmate(),
    captured: Boolean(played.captured),
  };
}

/**
 * Moves to show after a failed drill move.
 * A precomputed trap plays its whole line (the two-move trick).
 * Anything else plays the single capture or mate in 1.
 */
export function punishmentLine(drill: DrillPosition, from: Square, to: Square): PunishmentStep[] {
  const game = new Chess(drill.fen);
  const student = playUci(game, `${from}${to}`);
  if (!student) return [];

  const trap = drillTrap(drill, from, to);
  const script = trap?.line?.length
    ? trap.line
    : (() => {
        const hit = bestPunishment(game.fen());
        return hit ? [`${hit.from}${hit.to}`] : [];
      })();

  const steps: PunishmentStep[] = [];
  for (const uci of script) {
    const step = playUci(game, uci);
    if (!step) break;
    steps.push(step);
  }
  return steps;
}
