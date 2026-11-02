import type { Square } from 'chess.js';

import type { HighlightTone } from '@/src/components/Board/highlight';
import type { GameSnapshot } from '@/src/logic/game';

export type BoardArrow = {
  from: Square;
  to: Square;
  color?: string;
  /** Short mark drawn on the arrow, such as A or B for a two-move choice. */
  label?: string;
};

export type BoardMoveEvent = {
  from: Square;
  to: Square;
  beforeFen: string;
  afterFen: string;
  san: string;
};

export type ChessBoardProps = {
  fen?: string;
  orientation?: 'white' | 'black';
  interactive?: boolean;
  highlightSquares?: Square[];
  /** Danger (red) is a blunder. Success (green) is a save. */
  highlightTone?: HighlightTone;
  /** Softer amber attention (e.g. your hanging piece to save). */
  attentionSquares?: Square[];
  lastMove?: { from: Square; to: Square } | null;
  arrows?: BoardArrow[];
  /** Black-to-move drills flip the board. Say so next to the turn. */
  flipCue?: boolean;
  /**
   * The screen already says whose move it is. Hide that line, and still
   * surface check, mate, and the flip cue.
   */
  hideTurn?: boolean;
  /**
   * Border-box width of the frame, in px. Comes from the layout that sizes
   * the slot, so the squares match the frame before onLayout runs.
   */
  size?: number;
  onMove?: (event: BoardMoveEvent) => boolean | void;
  onPositionChange?: (snap: GameSnapshot) => void;
};
