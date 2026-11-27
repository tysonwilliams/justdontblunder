import { Chess, type Color, type Move, type Square } from 'chess.js';

export type GameSnapshot = {
  fen: string;
  turn: Color;
  isCheck: boolean;
  isCheckmate: boolean;
  isStalemate: boolean;
  isGameOver: boolean;
  history: Move[];
};

export function createGame(fen?: string): Chess {
  return fen ? new Chess(fen) : new Chess();
}

export function snapshot(game: Chess): GameSnapshot {
  return {
    fen: game.fen(),
    turn: game.turn(),
    isCheck: game.isCheck(),
    isCheckmate: game.isCheckmate(),
    isStalemate: game.isStalemate(),
    isGameOver: game.isGameOver(),
    history: game.history({ verbose: true }),
  };
}

export type PromotionPiece = 'q' | 'r' | 'b' | 'n';

export function getLegalTargets(game: Chess, from: Square): Square[] {
  const seen = new Set<Square>();
  const targets: Square[] = [];
  for (const move of game.moves({ square: from, verbose: true })) {
    if (seen.has(move.to)) continue;
    seen.add(move.to);
    targets.push(move.to);
  }
  return targets;
}

export function isPromotionMove(game: Chess, from: Square, to: Square): boolean {
  return game
    .moves({ square: from, verbose: true })
    .some((move) => move.to === to && Boolean(move.promotion));
}

export function tryMove(
  game: Chess,
  from: Square,
  to: Square,
  promotion: PromotionPiece = 'q',
): Move | null {
  try {
    return game.move({ from, to, promotion });
  } catch {
    return null;
  }
}

export function pieceAt(game: Chess, square: Square) {
  return game.get(square);
}
