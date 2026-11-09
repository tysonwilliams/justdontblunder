import { describe, expect, it } from 'vitest';

import { boardStatusLine, coordinateMarks, type CoordinateMark } from '@/src/components/Board/coordinates';

const SIZE = 80;

function insideItsSquare(mark: CoordinateMark, squareSize: number, column: number, row: number) {
  expect(mark.left).toBeGreaterThanOrEqual(column * squareSize);
  expect(mark.top).toBeGreaterThanOrEqual(row * squareSize);
  expect(mark.left + mark.size).toBeLessThanOrEqual((column + 1) * squareSize);
  expect(mark.top + mark.size).toBeLessThanOrEqual((row + 1) * squareSize);
}

describe('coordinateMarks', () => {
  it('reads a through h along the bottom and 8 down to 1 on the left for White', () => {
    const marks = coordinateMarks('white', SIZE);
    const files = marks.filter((mark) => mark.corner === 'file');
    const ranks = marks.filter((mark) => mark.corner === 'rank');
    expect(files.map((mark) => mark.text)).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']);
    expect(ranks.map((mark) => mark.text)).toEqual(['8', '7', '6', '5', '4', '3', '2', '1']);
    files.forEach((mark, index) => insideItsSquare(mark, SIZE, index, 7));
    ranks.forEach((mark, index) => insideItsSquare(mark, SIZE, 0, index));
  });

  it('reads h through a along the bottom and 1 down to 8 on the left for Black', () => {
    const marks = coordinateMarks('black', SIZE);
    const files = marks.filter((mark) => mark.corner === 'file');
    const ranks = marks.filter((mark) => mark.corner === 'rank');
    expect(files.map((mark) => mark.text)).toEqual(['h', 'g', 'f', 'e', 'd', 'c', 'b', 'a']);
    expect(ranks.map((mark) => mark.text)).toEqual(['1', '2', '3', '4', '5', '6', '7', '8']);
    files.forEach((mark, index) => insideItsSquare(mark, SIZE, index, 7));
    ranks.forEach((mark, index) => insideItsSquare(mark, SIZE, 0, index));
  });

  it('puts both labels of a1 in opposite corners of that square', () => {
    const marks = coordinateMarks('white', SIZE).filter((mark) => mark.square === 'a1');
    expect(marks.map((mark) => mark.corner).sort()).toEqual(['file', 'rank']);
    const file = marks.find((mark) => mark.corner === 'file');
    const rank = marks.find((mark) => mark.corner === 'rank');
    expect(file && rank).toBeTruthy();
    if (!file || !rank) return;
    expect(file.top).toBeGreaterThan(rank.top);
    expect(file.left).toBeGreaterThan(rank.left);
  });
});

describe('boardStatusLine', () => {
  it('names the side to move and never the board orientation', () => {
    expect(boardStatusLine({ turn: 'w', inCheck: false, checkmate: false, stalemate: false })).toBe('White to move');
    expect(boardStatusLine({ turn: 'b', inCheck: false, checkmate: false, stalemate: false })).toBe('Black to move');
    expect(boardStatusLine({ turn: 'w', inCheck: true, checkmate: false, stalemate: false })).toBe('White is in check');
    expect(boardStatusLine({ turn: 'b', inCheck: false, checkmate: true, stalemate: false })).toBe('Checkmate');
    expect(boardStatusLine({ turn: 'w', inCheck: false, checkmate: false, stalemate: true })).toBe('Stalemate');
    for (const turn of ['w', 'b'] as const) {
      const line = boardStatusLine({ turn, inCheck: false, checkmate: false, stalemate: false });
      expect(line.toLowerCase()).not.toContain('flipped');
      expect(line.toLowerCase()).not.toContain('playing');
    }
  });
});
