import { cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';

/** Border on each side of the board frame. Squares are laid out inside it. */
export const BOARD_BORDER = 2;

/**
 * Width of one square for a frame whose border box is `outer` pixels.
 * The frame and the squares share this number so the grid fills the frame
 * on the first paint, before an onLayout measurement comes back.
 */
export function squareSizeForFrame(outer: number): number {
  const inner = outer - BOARD_BORDER * 2;
  if (!(inner > 0)) return 0;
  return inner / 8;
}

/** Pass the frame width into a board element without waiting for layout. */
export function withBoardSize(node: ReactNode, size: number): ReactNode {
  if (!isValidElement(node)) return node;
  return cloneElement(node as ReactElement<{ size?: number }>, { size: Math.round(size) });
}
