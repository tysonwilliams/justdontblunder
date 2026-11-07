import { useCallback } from 'react';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import type { ReactNode } from 'react';
import type { Square } from 'chess.js';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { BoardSquare } from '@/src/components/Board/BoardSquare';
import { buildBoardRows, squareVisualKey, type BoardSquareModel } from '@/src/components/Board/boardSquares';
import { resetSquareRenderCounts, squareRenderCount } from '@/src/components/Board/squareRenderCount';
import { createGame, getLegalTargets, tryMove } from '@/src/logic/game';
import { colors } from '@/src/theme/tokens';

vi.mock('react-native', () => {
  const React = require('react') as typeof import('react');
  const host = (type: string) =>
    function Host(props: { children?: ReactNode }) {
      return React.createElement(type, props, props.children);
    };
  return {
    Pressable: host('pressable'),
    View: host('view'),
    Text: host('text'),
    StyleSheet: { create: <T,>(styles: T) => styles },
    Platform: { OS: 'web' },
  };
});

vi.mock('@/src/components/Board/Piece', () => {
  const React = require('react') as typeof import('react');
  return { Piece: () => React.createElement('piece') };
});

const quiet = {
  orientation: 'white' as const,
  selected: null,
  legal: [] as Square[],
  highlightSquares: [] as Square[],
  attentionSquares: [] as Square[],
  highlightTone: 'danger' as const,
  lastMove: null,
  dragSquare: null,
  squareSize: 40,
};

function changedSquares(before: BoardSquareModel[][], after: BoardSquareModel[][]): string[] {
  const prev = new Map(before.flat().map((model) => [model.square, squareVisualKey(model)]));
  return after.flat().flatMap((model) => (prev.get(model.square) === squareVisualKey(model) ? [] : [model.square]));
}

function Grid({ rows, onPress }: { rows: BoardSquareModel[][]; onPress: (square: Square) => void }) {
  return rows.map((row) => row.map((model) => <BoardSquare key={model.square} {...model} onPress={onPress} />));
}

function Harness({ rows }: { rows: BoardSquareModel[][] }) {
  const onPress = useCallback((_square: Square) => undefined, []);
  return <Grid rows={rows} onPress={onPress} />;
}

describe('board square renders', () => {
  beforeEach(() => {
    resetSquareRenderCounts();
  });

  it('a selection touches the chosen square and its legal moves, not the whole board', () => {
    const game = createGame();
    const before = buildBoardRows({ ...quiet, game });
    const legal = getLegalTargets(game, 'e2');
    const after = buildBoardRows({ ...quiet, game, selected: 'e2', legal });
    const changed = changedSquares(before, after);
    expect(changed.length).toBeLessThan(64);
    expect(new Set(changed)).toEqual(new Set(['e2', ...legal]));
    expect(after.flat().find((square) => square.square === 'e2')?.label).toBe('e2, white pawn, selected');
    expect(after.flat().find((square) => square.square === 'e4')?.label).toBe('e4, empty');
    expect(after.flat().find((square) => square.square === 'e4')?.isLegal).toBe(true);
  });

  it('a single move does not re-render all 64 squares', () => {
    const game = createGame();
    const before = buildBoardRows({ ...quiet, game });
    const moved = createGame();
    expect(tryMove(moved, 'e2', 'e4')).not.toBeNull();
    const after = buildBoardRows({
      ...quiet,
      game: moved,
      lastMove: { from: 'e2', to: 'e4' },
    });
    const changed = changedSquares(before, after);
    expect(changed.sort()).toEqual(['e2', 'e4']);
    expect(before.flat().find((square) => square.square === 'e2')?.label).toBe('e2, white pawn');
    expect(after.flat().find((square) => square.square === 'e4')?.label).toBe('e4, white pawn');
    expect(after.flat().find((square) => square.square === 'e5')?.label).toBe('e5, empty');

    let renderer: ReactTestRenderer | undefined;
    act(() => {
      renderer = create(<Harness rows={before} />);
    });
    resetSquareRenderCounts();
    act(() => {
      renderer?.update(<Harness rows={after} />);
    });

    const rendered = after.flat().flatMap((model) => (squareRenderCount(model.square) > 0 ? [model.square] : []));
    expect(rendered.sort()).toEqual(['e2', 'e4']);
    expect(rendered.length).toBeLessThan(64);
    expect(squareRenderCount('a8')).toBe(0);
    expect(squareRenderCount('e2')).toBeGreaterThan(0);
    expect(squareRenderCount('e4')).toBeGreaterThan(0);
  });

  it('a drop hover changes only the target square', () => {
    const game = createGame();
    const legal = getLegalTargets(game, 'e2');
    const before = buildBoardRows({ ...quiet, game, selected: 'e2', legal });
    const after = buildBoardRows({ ...quiet, game, selected: 'e2', legal, dropSquare: 'd4' });
    expect(changedSquares(before, after)).toEqual(['d4']);
    expect(after.flat().find((square) => square.square === 'd4')?.backgroundColor).toBe(colors.boardSelected);
    expect(after.flat().find((square) => square.square === 'e2')?.backgroundColor).toBe(colors.boardSelected);
  });

  it('hiding a destination square redraws only that square and keeps its piece', () => {
    const moved = createGame();
    expect(tryMove(moved, 'e2', 'e4')).not.toBeNull();
    const before = buildBoardRows({ ...quiet, game: moved, lastMove: { from: 'e2', to: 'e4' } });
    const after = buildBoardRows({
      ...quiet,
      game: moved,
      lastMove: { from: 'e2', to: 'e4' },
      hiddenSquares: ['e4'],
    });
    expect(changedSquares(before, after)).toEqual(['e4']);
    const landed = after.flat().find((square) => square.square === 'e4');
    expect(landed?.hidePiece).toBe(true);
    expect(landed?.pieceCode).toBe(before.flat().find((square) => square.square === 'e4')?.pieceCode);
  });
});
