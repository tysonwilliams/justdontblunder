import { PHONE_FOOT_MIN, PHONE_LEAD } from '@/src/components/ui/phoneSlots';
import { layout, spacing } from '@/src/theme';

/** Turn line above the squares. Matches the board meta row at each size. */
export const TURN_ROW_PHONE = 22;
export const TURN_ROW_DESKTOP = 36;

const ASIDE_MIN = layout.asideMin;
const ASIDE_MAX = layout.asideMax;
const SPLIT_GAP = spacing[20];
const SPLIT_BOARD_MIN = 480;

export type StageMetrics = {
  topNav: boolean;
  split: boolean;
  phone: boolean;
  /** Portrait tablet (600–899px): stacked full-width board with desktop-scale typography & inline controls. */
  tablet: boolean;
  /** Portrait phone with little room beside a full-width board. */
  tight: boolean;
  /** Inset for text, lists, controls, and footers. */
  padX: number;
  /** Inset of the board frame. On a phone this is smaller than `padX`. */
  boardInset: number;
  /** Extra inset inside the board frame so lead and foot copy meet `padX`. */
  chromePad: number;
  padTop: number;
  padBottom: number;
  contentW: number;
  contentHeight: number;
  gap: number;
  boardWidth: number;
  asideWidth: number;
  turnRow: number;
};

export function stageMetrics(
  width: number,
  height: number,
  insetTop = 0,
  insetBottom = 0,
): StageMetrics {
  const topNav = width >= layout.nav;
  const railWidth = topNav
    ? width >= layout.navRailExpandedMin
      ? layout.navRail
      : layout.navRailCompact
    : 0;
  const stageWidth = Math.max(280, width - railWidth);
  const narrow = stageWidth < layout.split;
  const padX = narrow ? layout.gutter : width >= 1280 ? layout.padDesktop : layout.padTablet;
  const boardInset = narrow ? layout.boardInset : padX;
  const chromePad = padX - boardInset;
  // Phone content starts below the notch. Desktop uses a left rail, reclaiming full height for the board.
  const padTop = topNav ? spacing[10] : Math.max(spacing.sm, insetTop);
  const padBottom = topNav ? spacing[12] : spacing.xxs;
  const tabBar = topNav ? insetTop : layout.tabBarPhone + insetBottom;
  const rawW = Math.max(280, stageWidth - boardInset * 2);
  const contentHeight = Math.max(240, height - tabBar - padTop - padBottom);
  const turnRow = narrow ? TURN_ROW_PHONE : TURN_ROW_DESKTOP;
  const heightBoard = Math.floor(contentHeight - turnRow - spacing.xs);
  const splitCandidate = Math.min(heightBoard, layout.boardMax, rawW - ASIDE_MIN - SPLIT_GAP);
  const split =
    !narrow &&
    stageWidth >= layout.split &&
    height >= layout.splitMinHeight &&
    splitCandidate >= SPLIT_BOARD_MIN;

  if (!split) {
    const contentW = Math.min(rawW, layout.stageMax);
    const isPhone = !topNav && (width < 600 || height < 500);
    const isTablet = !topNav && !isPhone;
    // Keep the square full width on standard phones, while yielding on very short
    // viewports (such as Mobile Safari on compact phones) so the header and tray never clip.
    const reserve = isPhone ? PHONE_LEAD + PHONE_FOOT_MIN : 160;
    const heightCap = Math.max(220, contentHeight - turnRow - reserve);
    const boardWidth = Math.round(Math.min(contentW, heightCap));
    const chromeBudget = contentHeight - boardWidth - turnRow;
    return {
      topNav,
      split: false,
      phone: isPhone,
      tablet: isTablet,
      tight: isPhone && chromeBudget < 260,
      padX,
      boardInset,
      chromePad,
      padTop,
      padBottom,
      contentW,
      contentHeight,
      gap: isTablet ? spacing[12] : spacing[6],
      boardWidth,
      asideWidth: contentW,
      turnRow,
    };
  }

  let boardWidth = Math.min(heightBoard, layout.boardMax, rawW - ASIDE_MIN - SPLIT_GAP);
  let asideWidth = Math.min(ASIDE_MAX, rawW - boardWidth - SPLIT_GAP);
  if (asideWidth < ASIDE_MIN) {
    asideWidth = ASIDE_MIN;
    boardWidth = rawW - asideWidth - SPLIT_GAP;
  }
  boardWidth = Math.round(boardWidth);
  asideWidth = Math.round(asideWidth);
  let contentW = boardWidth + SPLIT_GAP + asideWidth;
  if (contentW > layout.stageMax) {
    contentW = layout.stageMax;
    asideWidth = Math.min(ASIDE_MAX, Math.max(ASIDE_MIN, contentW - boardWidth - SPLIT_GAP));
    if (boardWidth + SPLIT_GAP + asideWidth > contentW) {
      boardWidth = Math.max(240, contentW - SPLIT_GAP - asideWidth);
    }
  }

  return {
    topNav,
    split: true,
    phone: false,
    tablet: false,
    tight: false,
    padX,
    boardInset,
    chromePad,
    padTop,
    padBottom,
    contentW,
    contentHeight,
    gap: SPLIT_GAP,
    boardWidth,
    asideWidth,
    turnRow,
  };
}
