import { layout } from '@/src/theme';

const TURN_ROW = 46;

export type StageMetrics = {
  topNav: boolean;
  split: boolean;
  padX: number;
  padTop: number;
  padBottom: number;
  contentW: number;
  contentHeight: number;
  gap: number;
  boardWidth: number;
  asideWidth: number;
};

export function stageMetrics(
  width: number,
  height: number,
  insetTop = 0,
  insetBottom = 0,
): StageMetrics {
  const topNav = width >= layout.nav;
  const padX = width >= 1280 ? layout.padDesktop : width >= layout.split ? layout.padTablet : layout.padPhone;
  const padTop = topNav ? 20 : 16;
  const padBottom = topNav ? 24 : 16;
  const tabBar = layout.tabBar + (topNav ? insetTop : insetBottom);
  const contentW = Math.min(Math.max(width - padX * 2, 280), layout.stageMax);
  const contentHeight = Math.max(280, height - tabBar - padTop - padBottom);
  // Side-by-side only when the square board can fill the frame. A tall tablet
  // is too narrow for that, so it stacks and lets the board use the width.
  const splitGap = 28;
  const splitBoard = Math.min(
    layout.boardMax,
    contentHeight - TURN_ROW,
    contentW - layout.asideMin - splitGap,
  );
  const split =
    width >= layout.split &&
    height >= layout.splitMinHeight &&
    splitBoard >= 520 &&
    splitBoard + TURN_ROW >= contentHeight * 0.68;
  const gap = split ? splitGap : 16;

  const targetAside = Math.round(
    Math.min(layout.asideMax, Math.max(layout.asideMin, contentW * 0.36)),
  );
  let boardWidth = split
    ? Math.min(layout.boardMax, contentHeight - TURN_ROW, contentW - targetAside - gap)
    : contentW;
  boardWidth = Math.max(240, Math.round(boardWidth));

  let asideWidth = split ? contentW - boardWidth - gap : contentW;
  if (split && asideWidth > layout.asideMax) asideWidth = layout.asideMax;
  if (split && asideWidth < layout.asideMin) {
    asideWidth = layout.asideMin;
    boardWidth = Math.max(240, Math.round(contentW - asideWidth - gap));
  }
  asideWidth = Math.round(asideWidth);

  return {
    topNav,
    split,
    padX,
    padTop,
    padBottom,
    contentW,
    contentHeight,
    gap,
    boardWidth,
    asideWidth,
  };
}
