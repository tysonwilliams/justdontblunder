import { Chess, type Square } from 'chess.js';

import { bestPunishment, pieceName } from '@/src/logic/safety';

export type CoachKind = 'save' | 'blunder';

const MAX_CHARS = 92;

/**
 * One short sentence a beginner can read in the phone feedback tray.
 * Built from the position before the move and the punishment chess.js already finds.
 */
export function coachSpeech(input: { kind: CoachKind; fen: string; from: Square; to: Square }): string {
  const game = new Chess(input.fen);
  const mover = game.get(input.from);
  const moverName = mover ? pieceName(mover.type) : 'piece';
  let played;
  try {
    played = game.move({ from: input.from, to: input.to, promotion: 'q' });
  } catch {
    played = null;
  }
  if (!played) {
    return input.kind === 'save' ? 'That move is safe.' : 'That move loses material.';
  }

  if (input.kind === 'save') {
    if (played.captured) return fit(`Your ${moverName} takes the ${pieceName(played.captured)}. Safe.`);
    return fit(`Your ${moverName} steps off ${input.from}. Safe.`);
  }

  const punishment = bestPunishment(game.fen());
  if (!punishment) return 'That move loses material.';
  if (punishment.mate) {
    const attacker = game.get(punishment.from);
    const attackerName = attacker ? pieceName(attacker.type) : 'piece';
    return fit(`That's mate. The ${attackerName} on ${punishment.from} can reach your king.`);
  }

  const victim = pieceName(punishment.captured);
  const attacker = game.get(punishment.from);
  const attackerName = attacker ? pieceName(attacker.type) : 'piece';
  const guarded = game.attackers(punishment.to, played.color).length > 0;
  const how = guarded ? "isn't safe" : 'is undefended';
  return fit(`Your ${victim} on ${punishment.to} ${how} — the ${attackerName} takes it.`);
}

export function coachForRound(
  kind: CoachKind | 'idea',
  fen: string,
  move: { from: Square; to: Square } | null,
  fallback: string,
): string {
  if (kind === 'idea' || !move) return fallback;
  try {
    return coachSpeech({ kind, fen, from: move.from, to: move.to });
  } catch {
    return fallback;
  }
}

function fit(line: string): string {
  if (line.length <= MAX_CHARS) return line;
  return `${line.slice(0, MAX_CHARS - 1).trimEnd()}…`;
}
