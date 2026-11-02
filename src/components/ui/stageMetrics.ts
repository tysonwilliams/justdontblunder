import { layout } from '@/src/theme';

/** Turn line above the squares. Matches the board meta row at each size. */
export const TURN_ROW_PHONE = 22;
export const TURN_ROW_DESKTOP = 36;

const ASIDE_MIN = layout.asideMin;
const ASIDE_MAX = layout.asideMax;
const SPLIT_GAP = 20;
const SPLIT_BOARD_MIN = 480;

export type StageMetrics = {
  topNav: boolean;
  split: boolean;
  phone: boolean;
  /** Portrait phone with little room beside a full-width board. */
  tight: boolean;
  padX: number;
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
  const narrow = width < layout.split;
  const padX = narrow ? layout.padPhone : width >= 1280 ? layout.padDesktop : layout.padTablet;
  const padTop = topNav ? 10 : 4;
  const padBottom = topNav ? 12 : 2;
  const tabBar = topNav ? layout.tabBar + insetTop : layout.tabBarPhone + insetBottom;
  const rawW = Math.max(280, width - padX * 2);
  const contentHeight = Math.max(240, height - tabBar - padTop - padBottom);
  const turnRow = narrow ? TURN_ROW_PHONE : TURN_ROW_DESKTOP;
  const heightBoard = Math.floor(contentHeight - turnRow - 4);
  const splitCandidate = Math.min(heightBoard, layout.boardMax, rawW - ASIDE_MIN - SPLIT_GAP);
  const split =
    !narrow &&
    width >= layout.split &&
    height >= layout.splitMinHeight &&
    splitCandidate >= SPLIT_BOARD_MIN;

  if (!split) {
    const contentW = Math.min(rawW, layout.stageMax);
    // Portrait keeps the square edge to edge. A short landscape window is
    // shorter than it is wide, so the square yields to the height instead.
    const heightCap = Math.max(220, contentHeight - turnRow - 96);
    const boardWidth = Math.round(Math.min(contentW, heightCap));
    const chromeBudget = contentHeight - boardWidth - turnRow;
    return {
      topNav,
      split: false,
      phone: !topNav,
      tight: !topNav && chromeBudget < 260,
      padX,
      padTop,
      padBottom,
      contentW,
      contentHeight,
      gap: 6,
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
    tight: false,
    padX,
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
