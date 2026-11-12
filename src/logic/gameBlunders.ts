import { Chess, type Color } from 'chess.js';

import type { DrillPosition } from '@/src/logic/drills';
import { drillFromBlunder } from '@/src/logic/personalDrill';

/** Let taps, drags, and piece animation run before the next move is judged. */
export function yieldToMain(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

/** Blunders by `userColor`, earliest move first. Same list the scan has always kept. */
export function blundersInGame(pgn: string, userColor: Color): DrillPosition[] {
  const found: DrillPosition[] = [];
  for (const drill of replayBlunders(pgn, userColor)) {
    if (drill) found.push(drill);
  }
  return found;
}

/**
 * Same selection as `blundersInGame`, but the caller gets a turn after every ply.
 * Used when a worker is not available.
 */
export async function blundersInGameYielding(
  pgn: string,
  userColor: Color,
  pause: () => Promise<void> = yieldToMain,
): Promise<DrillPosition[]> {
  const found: DrillPosition[] = [];
  for (const drill of replayBlunders(pgn, userColor)) {
    if (drill) found.push(drill);
    await pause();
  }
  return found;
}

function* replayBlunders(pgn: string, userColor: Color): Generator<DrillPosition | null> {
  let game: Chess;
  try {
    game = new Chess();
    game.loadPgn(pgn);
  } catch {
    return;
  }
  const moves = game.history({ verbose: true });
  for (let index = moves.length - 1; index >= 0; index -= 1) game.undo();
  for (const move of moves) {
    const before = game.fen();
    const side = game.turn();
    let played;
    try {
      played = game.move({ from: move.from, to: move.to, promotion: move.promotion });
    } catch {
      return;
    }
    if (!played) return;
    if (side !== userColor) {
      yield null;
      continue;
    }
    yield drillFromBlunder({
      fen: before,
      from: played.from,
      to: played.to,
      san: played.san,
    });
  }
}
