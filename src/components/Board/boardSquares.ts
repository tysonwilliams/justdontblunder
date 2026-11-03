import type { Chess, Square } from 'chess.js';

import { squareAt } from '@/src/components/Board/boardCoords';
import { squareBackground, type HighlightTone } from '@/src/components/Board/highlight';
import { pieceCodeFrom, type PieceCode } from '@/src/components/Board/pieceCode';
import { squareLabel } from '@/src/components/Board/squareLabel';
import { pieceAt } from '@/src/logic/game';
import { palettes, type Palette } from '@/src/theme/tokens';

export type BoardSquareModel = {
  square: Square;
  squareSize: number;
  backgroundColor: string;
  pieceCode: PieceCode | null;
  isLegal: boolean;
  isDark: boolean;
  showFile: boolean;
  showRank: boolean;
  hidePiece: boolean;
  label: string;
  selected: boolean;
};

export function buildBoardRows(input: {
  game: Chess;
  orientation: 'white' | 'black';
  selected: Square | null;
  legal: readonly Square[];
  highlightSquares: readonly Square[];
  attentionSquares: readonly Square[];
  highlightTone: HighlightTone;
  lastMove: { from: Square; to: Square } | null;
  dragSquare: Square | null;
  squareSize: number;
  palette?: Palette;
}): BoardSquareModel[][] {
  const palette = input.palette ?? palettes.dark;
  const legal = new Set(input.legal);
  const highlights = new Set(input.highlightSquares);
  const attention = new Set(input.attentionSquares);
  const rows: BoardSquareModel[][] = [];

  for (let rankIndex = 0; rankIndex < 8; rankIndex += 1) {
    const row: BoardSquareModel[] = [];
    for (let fileIndex = 0; fileIndex < 8; fileIndex += 1) {
      const square = squareAt(fileIndex, rankIndex, input.orientation);
      const isDark = (fileIndex + rankIndex) % 2 === 1;
      const piece = pieceAt(input.game, square) ?? null;
      const isSelected = input.selected === square;
      const isHighlight = highlights.has(square);
      const isAttention = attention.has(square);
      const isLast = input.lastMove != null && (input.lastMove.from === square || input.lastMove.to === square);
      row.push({
        square,
        squareSize: input.squareSize,
        backgroundColor: squareBackground(
          {
            isDark,
            isLast,
            isAttention,
            isSelected,
            isHighlight,
            highlightTone: input.highlightTone,
          },
          palette,
        ),
        pieceCode: piece ? pieceCodeFrom(piece.color, piece.type) : null,
        isLegal: legal.has(square),
        isDark,
        showFile: rankIndex === 7,
        showRank: fileIndex === 0,
        hidePiece: input.dragSquare === square,
        label: squareLabel(square, piece, {
          selected: isSelected,
          highlighted: isHighlight || isAttention,
        }),
        selected: isSelected,
      });
    }
    rows.push(row);
  }

  return rows;
}

export function squareVisualKey(model: BoardSquareModel): string {
  return [
    model.squareSize,
    model.backgroundColor,
    model.pieceCode ?? '',
    model.isLegal ? '1' : '0',
    model.isDark ? '1' : '0',
    model.showFile ? '1' : '0',
    model.showRank ? '1' : '0',
    model.hidePiece ? '1' : '0',
    model.label,
    model.selected ? '1' : '0',
  ].join('|');
}
