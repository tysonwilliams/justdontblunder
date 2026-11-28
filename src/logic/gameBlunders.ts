import { Chess, type Color } from 'chess.js';

import type { DrillPosition } from '@/src/logic/drills';
import { drillFromBlunder } from '@/src/logic/personalDrill';
import { fenKey } from '@/src/logic/reviewPile';
import { throwIfAborted } from '@/src/logic/scanAbort';

/** Same cap a pasted game used before it moved into the scan worker. */
const PASTE_DRILL_LIMIT = 100;

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
 * Used when a worker is not available. An aborted signal stops before the next ply.
 */
export async function blundersInGameYielding(
  pgn: string,
  userColor: Color,
  pause: () => Promise<void> = yieldToMain,
  signal?: AbortSignal,
): Promise<DrillPosition[]> {
  const found: DrillPosition[] = [];
  const replay = replayBlunders(pgn, userColor);
  while (true) {
    throwIfAborted(signal);
    const step = replay.next();
    if (step.done) break;
    if (step.value) found.push(step.value);
    await pause();
    throwIfAborted(signal);
  }
  return found;
}

/** Whether a pasted PGN is one game, and the blunders in the player's moves. */
export function readPastedGame(
  pgn: string,
  userColor: Color,
): { readable: boolean; drills: DrillPosition[] } {
  const trimmed = pgn.trim();
  if (!trimmed) return { readable: false, drills: [] };
  try {
    const parsed = new Chess();
    parsed.loadPgn(trimmed);
    if (parsed.history().length === 0) return { readable: false, drills: [] };
  } catch {
    return { readable: false, drills: [] };
  }
  return { readable: true, drills: latestFirst(blundersInGame(trimmed, userColor), PASTE_DRILL_LIMIT) };
}

/** Latest blunder first, one per position. Matches `drillsFromGames` for a single game. */
function latestFirst(chronological: readonly DrillPosition[], limit: number): DrillPosition[] {
  const seen = new Set<string>();
  const drills: DrillPosition[] = [];
  for (let index = chronological.length - 1; index >= 0; index -= 1) {
    const drill = chronological[index];
    if (!drill) continue;
    const key = fenKey(drill.fen);
    if (seen.has(key)) continue;
    seen.add(key);
    drills.push(drill);
    if (drills.length >= limit) break;
  }
  return drills;
}

function cleanHeader(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed || trimmed === '?' || trimmed === 'Unknown') return undefined;
  return trimmed.slice(0, 64);
}

function* replayBlunders(pgn: string, userColor: Color): Generator<DrillPosition | null> {
  let game: Chess;
  try {
    game = new Chess();
    game.loadPgn(pgn);
  } catch {
    return;
  }
  const headers = game.getHeaders();
  const opponent = cleanHeader(userColor === 'w' ? headers.Black : headers.White);
  const moves = game.history({ verbose: true });
  for (let index = moves.length - 1; index >= 0; index -= 1) game.undo();
  let prevFen: string | undefined;
  let prevMove: { from: import('chess.js').Square; to: import('chess.js').Square } | undefined;
  for (let ply = 0; ply < moves.length; ply += 1) {
    const move = moves[ply]!;
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
      prevFen = before;
      prevMove = { from: played.from, to: played.to };
      yield null;
      continue;
    }
    const built = drillFromBlunder({
      fen: before,
      from: played.from,
      to: played.to,
      san: played.san,
      promotion: played.promotion as 'q' | 'r' | 'b' | 'n' | undefined,
    });
    // Opening gambit pawns (e.g. 1. d4 d5 2. c4) are not real one-move blunders.
    const isOpeningGambit =
      built != null && ply < 10 && !played.captured && built.expectedDropCp <= 100 && built.theme === 'hanging';
    const kept = isOpeningGambit ? null : built;
    const moveNumber = Number(before.split(' ')[5]) || Math.floor(ply / 2) + 1;
    yield kept
      ? {
          ...kept,
          source: {
            gameId: 'pasted',
            move: played.san,
            moveNumber,
            ...(opponent ? { opponent } : {}),
            ...(prevMove ? { lastMove: prevMove } : {}),
            ...(prevFen ? { setupFen: prevFen } : {}),
          },
        }
      : null;
    prevFen = before;
    prevMove = { from: played.from, to: played.to };
  }
}
