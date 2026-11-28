import { Chess, type Color, type Move, type PieceSymbol, type Square } from 'chess.js';

const VAL: Record<PieceSymbol, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 };

export function pieceValue(type: PieceSymbol): number {
  return VAL[type];
}

export function opposite(color: Color): Color {
  return color === 'w' ? 'b' : 'w';
}

export function pieceName(type: PieceSymbol): string {
  switch (type) {
    case 'p':
      return 'pawn';
    case 'n':
      return 'knight';
    case 'b':
      return 'bishop';
    case 'r':
      return 'rook';
    case 'q':
      return 'queen';
    case 'k':
      return 'king';
    default: {
      const _exhaustive: never = type;
      return _exhaustive;
    }
  }
}

/** Extra officers must be paid for by missing pawns (promotions). */
export function materialIsReachable(fen: string): boolean {
  let game: Chess;
  try {
    game = new Chess(fen);
  } catch {
    return false;
  }
  const counts: Record<Color, Record<PieceSymbol, number>> = {
    w: { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 },
    b: { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 },
  };
  for (const row of game.board()) {
    for (const piece of row) {
      if (!piece) continue;
      counts[piece.color][piece.type] += 1;
    }
  }
  for (const color of ['w', 'b'] as const) {
    const tally = counts[color];
    if (tally.k !== 1) return false;
    if (tally.p > 8) return false;
    const extras =
      Math.max(0, tally.q - 1) +
      Math.max(0, tally.r - 2) +
      Math.max(0, tally.b - 2) +
      Math.max(0, tally.n - 2);
    if (extras > 8 - tally.p) return false;
  }
  return true;
}

function captureGain(move: Pick<Move, 'captured' | 'promotion'>): number {
  let gain = move.captured ? VAL[move.captured] : 0;
  if (move.promotion) gain += VAL[move.promotion] - VAL.p;
  return gain;
}

function seeOnGame(game: Chess, square: Square, precomputed?: readonly Move[]): number {
  let moves: readonly Move[];
  if (precomputed) {
    moves = precomputed;
  } else {
    const attackers = game.attackers(square, game.turn());
    if (attackers.length === 0) return 0;
    const subset: Move[] = [];
    for (const from of attackers) {
      for (const move of game.moves({ square: from, verbose: true })) {
        if (move.to === square && move.captured) subset.push(move);
      }
    }
    moves = subset;
  }
  let best = 0;
  for (const move of moves) {
    if (move.to !== square || !move.captured) continue;
    if (move.san.endsWith('#')) return 100;
    const played = game.move(move);
    if (!played || !played.captured) continue;
    let gain: number;
    if (game.isCheckmate()) {
      gain = 100;
    } else {
      gain = captureGain(played) - seeOnGame(game, square);
    }
    game.undo();
    if (gain > best) best = gain;
  }
  return best;
}

/**
 * Material the side to move can win by capturing on `square`,
 * assuming both sides recapture on that square with legal moves
 * and either side may stop when a recapture loses material.
 */
export function see(fen: string, square: Square, capturer: Color): number {
  const game = new Chess(fen);
  if (game.turn() !== capturer) return 0;
  return seeOnGame(game, square);
}

function fenWithTurn(fen: string, turn: Color): string | null {
  const parts = fen.split(' ');
  if (parts[1] === turn) return fen;
  parts[1] = turn;
  parts[3] = '-';
  try {
    return new Chess(parts.join(' ')).fen();
  } catch {
    return null;
  }
}

/** How much material the opponent wins by taking on this square (0 when they cannot). */
export function hangingGain(fen: string, square: Square, victim: Color): number {
  const opp = opposite(victim);
  const probe = fenWithTurn(fen, opp);
  if (!probe) return 0;
  const game = new Chess(probe);
  const moves = game.moves({ verbose: true });
  let best = seeOnGame(game, square, moves);
  // Check if an en passant capture removes a pawn standing on `square`.
  for (const move of moves) {
    if (!move.isEnPassant()) continue;
    const victimSq = `${move.to[0]}${move.from[1]}` as Square;
    if (victimSq === square) {
      best = Math.max(best, seeOnGame(game, move.to, moves));
    }
  }
  return best;
}

export type HangingPiece = {
  square: Square;
  type: PieceSymbol;
  gain: number;
  attacker: Square | null;
};

export function listHangingPieces(fen: string, side: Color): HangingPiece[] {
  const opp = opposite(side);
  const probe = fenWithTurn(fen, opp);
  if (!probe) return [];
  const game = new Chess(probe);
  const moves = game.moves({ verbose: true });
  const byTarget = new Map<Square, Move[]>();
  for (const move of moves) {
    if (!move.captured) continue;
    const list = byTarget.get(move.to);
    if (list) list.push(move);
    else byTarget.set(move.to, [move]);
  }
  const found: HangingPiece[] = [];
  for (const [target, captures] of byTarget) {
    const sample = captures[0]!;
    const victimSq = sample.isEnPassant() ? (`${target[0]}${sample.from[1]}` as Square) : target;
    const victim = game.get(victimSq);
    if (!victim || victim.color !== side || victim.type === 'k') continue;
    const gain = seeOnGame(game, target, moves);
    if (gain <= 0) continue;
    captures.sort((a, b) => VAL[a.piece] - VAL[b.piece]);
    found.push({
      square: victimSq,
      type: victim.type,
      gain,
      attacker: captures[0]?.from ?? null,
    });
  }
  found.sort((a, b) => b.gain - a.gain || VAL[b.type] - VAL[a.type]);
  return found;
}

export function opponentThreatensMateInOne(fen: string): boolean {
  const game = new Chess(fen);
  for (const move of game.moves({ verbose: true })) {
    if (move.san.endsWith('#')) return true;
  }
  return false;
}

export type Punishment = {
  san: string;
  from: Square;
  to: Square;
  captured: PieceSymbol;
  mate: boolean;
  promotion?: 'q' | 'r' | 'b' | 'n';
};

/** The capture or mate the opponent can play right now that hurts the most. */
export function bestPunishment(fen: string): Punishment | null {
  const game = new Chess(fen);
  const moves = game.moves({ verbose: true });
  let mate: Punishment | null = null;
  let best: { gain: number; punishment: Punishment } | null = null;
  for (const move of moves) {
    if (move.san.endsWith('#')) {
      mate = {
        san: move.san,
        from: move.from,
        to: move.to,
        captured: move.captured ?? 'k',
        mate: true,
        ...(move.promotion ? { promotion: move.promotion as 'q' | 'r' | 'b' | 'n' } : {}),
      };
      continue;
    }
    if (!move.captured) continue;
    const played = game.move(move);
    if (!played || !played.captured) continue;
    const gain = captureGain(played) - seeOnGame(game, played.to);
    game.undo();
    if (gain <= 0) continue;
    if (!best || gain > best.gain) {
      best = {
        gain,
        punishment: {
          san: played.san,
          from: played.from,
          to: played.to,
          captured: played.captured,
          mate: false,
          ...(played.promotion ? { promotion: played.promotion as 'q' | 'r' | 'b' | 'n' } : {}),
        },
      };
    }
  }
  return mate ?? best?.punishment ?? null;
}

/**
 * Material result of a move for `side`, after the opponent's best same-square recapture.
 * Checkmate is largely positive. Allowing mate in 1 is largely negative.
 * 0 means an even trade or a quiet move that drops nothing.
 */
export function moveOutcome(
  fen: string,
  from: Square,
  to: Square,
  side: Color,
  promotion: 'q' | 'r' | 'b' | 'n' = 'q',
): number | null {
  const after = new Chess(fen);
  let played;
  try {
    played = after.move({ from, to, promotion });
  } catch {
    return null;
  }
  if (!played) return null;
  if (after.isCheckmate()) return 100;
  const replies = after.moves({ verbose: true });
  const captureSquares = new Set<Square>();
  for (const reply of replies) {
    if (reply.san.endsWith('#')) return -100;
    if (reply.captured) captureSquares.add(reply.to);
  }
  const gained = captureGain(played);
  let punishment = 0;
  for (const square of captureSquares) {
    punishment = Math.max(punishment, seeOnGame(after, square, replies));
  }
  return gained - punishment;
}

const FILES_LIST = 'abcdefgh';
const RANKS_LIST = '87654321';

function attackedFriendlyTargets(game: Chess, bySquare: Square, victimSide: Color): { square: Square; type: PieceSymbol }[] {
  const targets: { square: Square; type: PieceSymbol }[] = [];
  const opp = opposite(victimSide);
  const board = game.board();
  for (let rank = 0; rank < 8; rank += 1) {
    for (let file = 0; file < 8; file += 1) {
      const piece = board[rank]?.[file];
      if (!piece || piece.color !== victimSide) continue;
      if (piece.type !== 'k' && VAL[piece.type] < 3) continue;
      const sq = `${FILES_LIST[file]}${RANKS_LIST[rank]}` as Square;
      if (game.attackers(sq, opp).includes(bySquare)) {
        targets.push({ square: sq, type: piece.type });
      }
    }
  }
  return targets;
}

/**
 * Club-level (900–1600) 2-ply radar: after a move that passes the 1-move rule,
 * checks if the opponent has a safe reply that forks the king and a major/minor piece
 * (or two valuable pieces) where the forking piece cannot be captured for free.
 * Advisory coaching note only — never fails a 1-move-safe drill move.
 */
export function clubTacticalWarning(
  beforeFen: string,
  from: Square,
  to: Square,
  side: Color,
  promotion: 'q' | 'r' | 'b' | 'n' = 'q',
): string | null {
  const after = new Chess(beforeFen);
  let played;
  try {
    played = after.move({ from, to, promotion });
  } catch {
    return null;
  }
  if (!played || after.isGameOver()) return null;
  const opp = opposite(side);
  const replies = after.moves({ verbose: true });
  for (const reply of replies) {
    if (reply.piece === 'k') continue;
    const moved = after.move(reply);
    if (!moved) continue;
    const captureValue = moved.captured ? VAL[moved.captured] : 0;
    // Skip if the forking piece loses material right away when captured.
    const lossIfCaptured = seeOnGame(after, moved.to);
    if (lossIfCaptured > captureValue) {
      after.undo();
      continue;
    }
    const rawTargets = attackedFriendlyTargets(after, moved.to, side);
    if (rawTargets.length < 2) {
      after.undo();
      continue;
    }
    const nextFen = after.fen();
    const realTargets = rawTargets.filter((target) => {
      if (target.type === 'k') return true;
      return VAL[target.type] > VAL[reply.piece] || hangingGain(nextFen, target.square, side) > 0;
    });
    after.undo();
    if (realTargets.length < 2) continue;
    const hasKing = realTargets.some((t) => t.type === 'k');
    const heavyCount = realTargets.filter((t) => t.type === 'q' || t.type === 'r').length;
    if (!hasKing && heavyCount < 2) continue;
    const sorted = [...realTargets].sort((a, b) => VAL[b.type] - VAL[a.type]);
    const first = pieceName(sorted[0]!.type);
    const second = pieceName(sorted[1]!.type);
    const who = opp === 'w' ? 'White' : 'Black';
    return `Watch ${who}'s ${moved.san} — it forks your ${first} and ${second}.`;
  }
  return null;
}
