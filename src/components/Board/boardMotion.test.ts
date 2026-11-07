import { Chess, type Square } from 'chess.js';
import { describe, expect, it } from 'vitest';

import { centerOf } from '@/src/components/Board/boardCoords';
import { BOARD_BORDER } from '@/src/components/Board/boardGeometry';
import {
  dragDropIntent,
  motionsBetween,
  pointerToBoard,
  pointToSquare,
  type BoardMotion,
} from '@/src/components/Board/boardMotion';
import { createGame, getLegalTargets } from '@/src/logic/game';

const SIZE = 40;

function applyMove(chess: Chess, move: string) {
  try {
    const played = chess.move(move);
    if (!played) throw new Error(`rejected ${move}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${move} failed at ${chess.fen()}: ${message}`);
  }
}

function play(moves: string[], fen?: string) {
  const chess = new Chess(fen);
  for (const move of moves.slice(0, -1)) applyMove(chess, move);
  const before = chess.fen();
  applyMove(chess, moves[moves.length - 1]);
  return { before, after: chess.fen() };
}

function describeMotion(motion: BoardMotion): string {
  if (motion.kind === 'slide') return `${motion.color}${motion.type}:${motion.from}${motion.to}`;
  return `${motion.direction}:${motion.color}${motion.type}:${motion.square}`;
}

function motionCodes(before: string, after: string): string[] | null {
  const motions = motionsBetween(before, after);
  return motions ? motions.map(describeMotion).sort() : null;
}

describe('pointToSquare', () => {
  it('maps the white board from a8 at the top-left and keeps the rim off-board', () => {
    expect(pointToSquare(0, 0, SIZE, 'white')).toBe('a8');
    expect(pointToSquare(SIZE, 0, SIZE, 'white')).toBe('b8');
    expect(pointToSquare(0, SIZE, SIZE, 'white')).toBe('a7');
    expect(pointToSquare(SIZE * 8 - 0.1, SIZE * 8 - 0.1, SIZE, 'white')).toBe('h1');
    expect(pointToSquare(-1, SIZE, SIZE, 'white')).toBeNull();
    expect(pointToSquare(SIZE * 8, SIZE, SIZE, 'white')).toBeNull();
    expect(pointToSquare(SIZE, SIZE * 8, SIZE, 'white')).toBeNull();
  });

  it('maps the black board from h1 at the top-left', () => {
    expect(pointToSquare(0, 0, SIZE, 'black')).toBe('h1');
    expect(pointToSquare(SIZE, 0, SIZE, 'black')).toBe('g1');
    expect(pointToSquare(0, SIZE, SIZE, 'black')).toBe('h2');
    const e7 = centerOf('e7', 'black', SIZE);
    expect(pointToSquare(e7.x, e7.y, SIZE, 'black')).toBe('e7');
  });
});

describe('dragDropIntent', () => {
  it('subtracts the frame border before choosing a square', () => {
    expect(pointerToBoard(BOARD_BORDER, BOARD_BORDER + SIZE)).toEqual({ x: 0, y: SIZE });
  });

  it('plays a legal drop, and snaps an illegal square, the origin, or a point off the board', () => {
    const game = createGame();
    const legal = getLegalTargets(game, 'e2');
    const drop = (square: Square) => {
      const point = centerOf(square, 'white', SIZE);
      return dragDropIntent({ from: 'e2', x: point.x, y: point.y, squareSize: SIZE, orientation: 'white', legal });
    };
    expect(drop('e4')).toEqual({ kind: 'move', to: 'e4' });
    expect(drop('e3')).toEqual({ kind: 'move', to: 'e3' });
    expect(drop('e5')).toEqual({ kind: 'snap', reason: 'illegal' });
    expect(drop('e2')).toEqual({ kind: 'snap', reason: 'origin' });
    expect(
      dragDropIntent({ from: 'e2', x: -8, y: 10, squareSize: SIZE, orientation: 'white', legal }),
    ).toEqual({ kind: 'snap', reason: 'off-board' });
    expect(
      dragDropIntent({ from: 'e2', x: SIZE * 8, y: centerOf('e4', 'white', SIZE).y, squareSize: SIZE, orientation: 'white', legal }),
    ).toEqual({ kind: 'snap', reason: 'off-board' });
  });

  it('reads a black-to-move pawn push in black orientation', () => {
    const game = createGame();
    expect(game.move('e4')).not.toBeNull();
    const legal = getLegalTargets(game, 'e7');
    const point = centerOf('e5', 'black', SIZE);
    expect(
      dragDropIntent({ from: 'e7', x: point.x, y: point.y, squareSize: SIZE, orientation: 'black', legal }),
    ).toEqual({ kind: 'move', to: 'e5' });
  });
});

describe('motionsBetween', () => {
  it('slides a quiet move and the same piece back on undo', () => {
    const played = play(['e4']);
    expect(motionCodes(played.before, played.after)).toEqual(['wp:e2e4']);
    expect(motionCodes(played.after, played.before)).toEqual(['wp:e4e2']);
  });

  it('fades a captured piece while the capturer slides onto its square', () => {
    const played = play(['e4', 'd5', 'exd5']);
    expect(motionCodes(played.before, played.after)).toEqual(['out:bp:d5', 'wp:e4d5']);
  });

  it('slides both the king and the rook for kingside castling', () => {
    const played = play(['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'O-O']);
    expect(motionCodes(played.before, played.after)).toEqual(['wk:e1g1', 'wr:h1f1']);
  });

  it('slides both the king and the rook for queenside castling', () => {
    const played = play(['d4', 'd5', 'Nc3', 'Nc6', 'Be3', 'Be6', 'Qd2', 'Qd7', 'O-O-O']);
    expect(motionCodes(played.before, played.after)).toEqual(['wk:e1c1', 'wr:a1d1']);
  });

  it('fades the captured pawn on its own square for en passant', () => {
    const played = play(['e4', 'e6', 'e5', 'd5', 'exd6']);
    expect(motionCodes(played.before, played.after)).toEqual(['out:bp:d5', 'wp:e5d6']);
  });

  it('slides the queen that arrives on promotion, including a capture', () => {
    const quiet = play(['a8=Q'], '4k3/P7/8/8/8/8/8/4K3 w - - 0 1');
    expect(motionCodes(quiet.before, quiet.after)).toEqual(['wq:a7a8']);
    const capture = play(['axb8=Q'], '1n2k3/P7/8/8/8/8/8/4K3 w - - 0 1');
    expect(motionCodes(capture.before, capture.after)).toEqual(['out:bn:b8', 'wq:a7b8']);
  });

  it('slides a two-ply rewind home and snaps a long reset', () => {
    const opening = play(['e4', 'e5']);
    expect(motionCodes(opening.after, new Chess().fen())).toEqual(['bp:e5e7', 'wp:e4e2']);
    const developed = play(['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6', 'Ba4', 'Nf6', 'O-O', 'Be7']);
    expect(motionsBetween(developed.after, new Chess().fen())).toBeNull();
  });

  it('returns nothing for an unchanged fen and null for an invalid fen', () => {
    const start = new Chess().fen();
    expect(motionsBetween(start, start)).toEqual([]);
    expect(motionsBetween('not-a-fen', start)).toBeNull();
  });
});
