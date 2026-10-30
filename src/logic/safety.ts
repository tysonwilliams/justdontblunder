import { Chess, type Color, type PieceSymbol, type Square } from 'chess.js';

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

function balance(game: Chess, side: Color): number {
  let total = 0;
  for (const row of game.board()) {
    for (const piece of row) {
      if (!piece || piece.type === 'k') continue;
      total += piece.color === side ? VAL[piece.type] : -VAL[piece.type];
    }
  }
  return total;
}

/**
 * Material the side to move can win by capturing on `square`,
 * assuming both sides recapture on that square with legal moves
 * and either side may stop when a recapture loses material.
 */
export function see(fen: string, square: Square, capturer: Color): number {
  const game = new Chess(fen);
  if (game.turn() !== capturer) return 0;
  const captures = game.moves({ verbose: true }).filter((move) => move.to === square && move.captured);
  let best = 0;
  for (const move of captures) {
    const next = new Chess(fen);
    const played = next.move(move);
    if (!played || !played.captured) continue;
    let gain = VAL[played.captured];
    if (played.promotion) gain += VAL[played.promotion] - VAL.p;
    gain -= see(next.fen(), square, opposite(capturer));
    if (gain > best) best = gain;
  }
  return best;
}

function fenWithTurn(fen: string, turn: Color): string | null {
  const game = new Chess(fen);
  if (game.turn() === turn) return fen;
  const parts = fen.split(' ');
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
  const probe = fenWithTurn(fen, opposite(victim));
  if (!probe) return 0;
  return see(probe, square, opposite(victim));
}

export type HangingPiece = {
  square: Square;
  type: PieceSymbol;
  gain: number;
  attacker: Square | null;
};

export function listHangingPieces(fen: string, side: Color): HangingPiece[] {
  const game = new Chess(fen);
  const found: HangingPiece[] = [];
  const board = game.board();
  for (let rank = 0; rank < 8; rank += 1) {
    for (let file = 0; file < 8; file += 1) {
      const piece = board[rank]?.[file];
      if (!piece || piece.color !== side || piece.type === 'k') continue;
      const square = `${'abcdefgh'[file]}${'87654321'[rank]}` as Square;
      const gain = hangingGain(fen, square, side);
      if (gain <= 0) continue;
      found.push({
        square,
        type: piece.type,
        gain,
        attacker: attackerOf(fen, square, opposite(side)),
      });
    }
  }
  found.sort((a, b) => b.gain - a.gain || VAL[b.type] - VAL[a.type]);
  return found;
}

function attackerOf(fen: string, square: Square, by: Color): Square | null {
  const probe = fenWithTurn(fen, by);
  if (!probe) return null;
  const game = new Chess(probe);
  const captures = game
    .moves({ verbose: true })
    .filter((move) => move.to === square && move.captured)
    .sort((a, b) => VAL[a.piece] - VAL[b.piece]);
  return captures[0]?.from ?? null;
}

export function opponentThreatensMateInOne(fen: string): boolean {
  const game = new Chess(fen);
  for (const move of game.moves({ verbose: true })) {
    const next = new Chess(fen);
    next.move(move);
    if (next.isCheckmate()) return true;
  }
  return false;
}

export type Punishment = {
  san: string;
  from: Square;
  to: Square;
  captured: PieceSymbol;
  mate: boolean;
};

/** The capture or mate the opponent can play right now that hurts the most. */
export function bestPunishment(fen: string): Punishment | null {
  const game = new Chess(fen);
  let mate: Punishment | null = null;
  let best: { gain: number; punishment: Punishment } | null = null;
  for (const move of game.moves({ verbose: true })) {
    const next = new Chess(fen);
    const played = next.move(move);
    if (!played) continue;
    if (next.isCheckmate()) {
      mate = {
        san: played.san,
        from: played.from,
        to: played.to,
        captured: played.captured ?? 'k',
        mate: true,
      };
      continue;
    }
    if (!played.captured) continue;
    let gain = VAL[played.captured];
    if (played.promotion) gain += VAL[played.promotion] - VAL.p;
    gain -= see(next.fen(), played.to, opposite(game.turn()));
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
export function moveOutcome(fen: string, from: Square, to: Square, side: Color): number | null {
  const before = new Chess(fen);
  const start = balance(before, side);
  const after = new Chess(fen);
  let played;
  try {
    played = after.move({ from, to, promotion: 'q' });
  } catch {
    return null;
  }
  if (!played) return null;
  if (after.isCheckmate()) return 100;
  if (opponentThreatensMateInOne(after.fen())) return -100;
  const gained = balance(after, side) - start;
  let punishment = 0;
  const board = after.board();
  for (let rank = 0; rank < 8; rank += 1) {
    for (let file = 0; file < 8; file += 1) {
      const piece = board[rank]?.[file];
      if (!piece || piece.color !== side || piece.type === 'k') continue;
      const square = `${'abcdefgh'[file]}${'87654321'[rank]}` as Square;
      punishment = Math.max(punishment, see(after.fen(), square, opposite(side)));
    }
  }
  return gained - punishment;
}
