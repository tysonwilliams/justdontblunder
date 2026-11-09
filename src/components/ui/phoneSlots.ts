/**
 * Phone column above and below the board.
 *
 * Lead height depends on the viewport only. Prompts, round state, and
 * feedback must not change it, or the squares move. The foot is the space
 * left under the square and the reserved turn row. It clips instead of scrolling.
 */

export const PHONE_LEAD = 120;

/** Result tray that stays on screen under the board, including on a short phone. */
export const PHONE_FOOT_MIN = 92;

/** Coach line, result banner, and choice buttons share this phone height. */
export const PHONE_BANNER = 88;

/** Two-line prompt. A one-line prompt still occupies both lines. */
export const PHONE_PROMPT_HEIGHT = 36;

/** Mode row, the gap, and the theme row. */
export const PHONE_TOOLBAR_HEIGHT = 60;

export type PhoneSlots = {
  lead: number;
  /** Square plus the reserved turn row. */
  boardBlock: number;
  foot: number;
};

export function phoneSlots(contentHeight: number, boardWidth: number, turnRow: number): PhoneSlots {
  const boardBlock = Math.max(0, boardWidth + Math.max(0, turnRow));
  const remain = contentHeight - boardBlock;
  if (remain <= 0) return { lead: 0, boardBlock, foot: 0 };
  const footFloor = Math.min(PHONE_FOOT_MIN, remain);
  const lead = Math.min(PHONE_LEAD, Math.max(0, remain - footFloor));
  return { lead, boardBlock, foot: remain - lead };
}

/** Room under the banner for a second control such as the home cards. */
export function footFitsExtra(foot: number, extra: number): boolean {
  return foot >= PHONE_BANNER + extra;
}
