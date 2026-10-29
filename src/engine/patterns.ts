import { Chess, type Color, type PieceSymbol, type Square } from 'chess.js';

const FILES = 'abcdefgh';
const RANKS = '12345678';

const PIECE_VALUE: Record<PieceSymbol, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 0,
};

export type PatternFinding = {
  kind: 'hanging' | 'fork' | 'pin' | 'back_rank' | 'missed_mate';
  message: string;
  squares: Square[];
  severity: 'tip' | 'mistake' | 'blunder';
};

function sq(file: number, rank: number): Square | null {
  if (file < 0 || file > 7 || rank < 0 || rank > 7) return null;
  return `${FILES[file]}${RANKS[rank]}` as Square;
}

function parseSquare(square: Square): { file: number; rank: number } {
  return {
    file: FILES.indexOf(square[0]),
    rank: RANKS.indexOf(square[1]),
  };
}

function opponent(color: Color): Color {
  return color === 'w' ? 'b' : 'w';
}

function pieceName(type: PieceSymbol): string {
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

/** Collect squares of `by` that currently attack `square` (turn-independent). */
function attackerSquares(game: Chess, square: Square, by: Color): Square[] {
  const board = game.board();
  const attackers: Square[] = [];
  for (let rank = 0; rank < 8; rank += 1) {
    for (let file = 0; file < 8; file += 1) {
      const piece = board[rank]?.[file];
      if (!piece || piece.color !== by) continue;
      const from = sq(file, 7 - rank);
      if (!from) continue;
      // Probe: if removing other side-to-move constraint via temporary fen is heavy,
      // use isAttacked on the target and verify this piece participates by
      // checking attacks from `from` with a cloned position where `by` to move.
      const clone = new Chess(game.fen());
      const parts = clone.fen().split(' ');
      parts[1] = by;
      try {
        clone.load(parts.join(' '));
      } catch {
        continue;
      }
      const hits = clone.moves({ square: from, verbose: true }).some((m) => m.to === square);
      if (hits) attackers.push(from);
    }
  }
  // Fallback: if isAttacked but scan missed (edge fen), still report target.
  if (attackers.length === 0 && game.isAttacked(square, by)) {
    attackers.push(square);
  }
  return attackers;
}

export function findHangingPieces(fen: string, side?: Color): PatternFinding[] {
  const game = new Chess(fen);
  const findings: PatternFinding[] = [];
  const board = game.board();
  const focus = side ?? opponent(game.turn());

  for (let rank = 0; rank < 8; rank += 1) {
    for (let file = 0; file < 8; file += 1) {
      const piece = board[rank]?.[file];
      if (!piece || piece.color !== focus || piece.type === 'k') continue;
      const square = sq(file, 7 - rank);
      if (!square) continue;

      const attacked = game.isAttacked(square, opponent(focus));
      if (!attacked) continue;

      const defended = game.isAttacked(square, focus);
      const attacks = attackerSquares(game, square, opponent(focus));
      const attackedValue = PIECE_VALUE[piece.type];
      const cheapestAttacker = Math.min(
        ...attacks.map((a) => {
          if (a === square) return 1;
          const atk = game.get(a);
          return atk ? PIECE_VALUE[atk.type] : 9;
        }),
        9,
      );

      const hanging = !defended || cheapestAttacker < attackedValue;
      if (hanging) {
        findings.push({
          kind: 'hanging',
          message: `You left the ${pieceName(piece.type)} hanging`,
          squares: [square, ...(attacks[0] && attacks[0] !== square ? [attacks[0]] : [])],
          severity: attackedValue >= 5 ? 'blunder' : 'mistake',
        });
      }
    }
  }

  return findings;
}

export function findSimpleForks(fen: string, forColor?: Color): PatternFinding[] {
  const game = new Chess(fen);
  const findings: PatternFinding[] = [];
  const color = forColor ?? game.turn();
  const board = game.board();

  // Ensure the forking side can generate moves.
  const parts = game.fen().split(' ');
  parts[1] = color;
  let probe: Chess;
  try {
    probe = new Chess(parts.join(' '));
  } catch {
    probe = game;
  }

  for (let rank = 0; rank < 8; rank += 1) {
    for (let file = 0; file < 8; file += 1) {
      const piece = board[rank]?.[file];
      if (!piece || piece.color !== color || (piece.type !== 'n' && piece.type !== 'p')) {
        continue;
      }
      const from = sq(file, 7 - rank);
      if (!from) continue;
      const attacks = probe
        .moves({ square: from, verbose: true })
        .filter((move) => Boolean(move.captured));
      const highValue = attacks.filter((move) => {
        const target = probe.get(move.to);
        return target && (target.type === 'k' || target.type === 'q' || target.type === 'r');
      });
      if (attacks.length >= 2 && highValue.length >= 1) {
        findings.push({
          kind: 'fork',
          message: `Missed a ${pieceName(piece.type)} fork`,
          squares: [from, ...attacks.slice(0, 2).map((m) => m.to)],
          severity: 'mistake',
        });
      }
    }
  }

  return findings;
}

export function findBackRankMateThreat(fen: string): PatternFinding | null {
  const game = new Chess(fen);
  const turn = game.turn();
  const kingSquare = findKing(game, turn);
  if (!kingSquare) return null;

  const { rank } = parseSquare(kingSquare);
  const backRank = turn === 'w' ? 0 : 7;
  if (rank !== backRank) return null;

  const escapes = (() => {
    const parts = game.fen().split(' ');
    parts[1] = turn;
    try {
      return new Chess(parts.join(' ')).moves({ square: kingSquare, verbose: true });
    } catch {
      return game.moves({ square: kingSquare, verbose: true });
    }
  })();
  if (escapes.length > 0) return null;

  // Pawn shield still on? if three pawns on f/g/h in front, less urgent
  const board = game.board();
  let enemyHeavy: Square | null = null;
  for (let r = 0; r < 8; r += 1) {
    for (let f = 0; f < 8; f += 1) {
      const piece = board[r]?.[f];
      if (!piece || piece.color === turn) continue;
      if (piece.type === 'r' || piece.type === 'q') {
        const from = sq(f, 7 - r);
        if (from && game.isAttacked(kingSquare, opponent(turn))) {
          enemyHeavy = from;
        } else if (from) {
          enemyHeavy = enemyHeavy ?? from;
        }
      }
    }
  }

  if (!enemyHeavy) return null;

  return {
    kind: 'back_rank',
    message: 'Watch the back rank — your king is trapped',
    squares: [kingSquare, enemyHeavy],
    severity: 'blunder',
  };
}

function findKing(game: Chess, color: Color): Square | null {
  const board = game.board();
  for (let rank = 0; rank < 8; rank += 1) {
    for (let file = 0; file < 8; file += 1) {
      const piece = board[rank]?.[file];
      if (piece?.type === 'k' && piece.color === color) {
        return sq(file, 7 - rank);
      }
    }
  }
  return null;
}

export function detectPatterns(fen: string, sideThatMoved: Color): PatternFinding[] {
  const findings: PatternFinding[] = [];
  findings.push(...findHangingPieces(fen, sideThatMoved));
  findings.push(...findSimpleForks(fen, opponent(sideThatMoved)));
  const backRank = findBackRankMateThreat(fen);
  if (backRank && backRank.squares[0] && findKing(new Chess(fen), sideThatMoved) === backRank.squares[0]) {
    findings.push(backRank);
  }
  return findings;
}
