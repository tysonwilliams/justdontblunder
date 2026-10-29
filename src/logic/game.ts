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

export function getLegalTargets(game: Chess, from: Square): Square[] {
  return game.moves({ square: from, verbose: true }).map((move) => move.to);
}

export function tryMove(
  game: Chess,
  from: Square,
  to: Square,
  promotion: 'q' | 'r' | 'b' | 'n' = 'q',
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

export function cloneFromFen(fen: string): Chess {
  return new Chess(fen);
}

export function undo(game: Chess): Move | null {
  return game.undo();
}

export function lastMove(game: Chess): Move | undefined {
  const history = game.history({ verbose: true });
  return history[history.length - 1];
}
