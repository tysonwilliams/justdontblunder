import { describe, expect, it } from 'vitest';

import { stageMetrics } from '@/src/components/ui/stageMetrics';

describe('stageMetrics', () => {
  it('keeps a phone in a single column with a full-width board', () => {
    for (const [width, height] of [
      [390, 844],
      [375, 667],
      [430, 932],
    ] as const) {
      const metrics = stageMetrics(width, height);
      expect(metrics.split).toBe(false);
      expect(metrics.topNav).toBe(false);
      expect(metrics.boardWidth).toBe(metrics.contentW);
      expect(metrics.contentW).toBeGreaterThanOrEqual(width - 12);
      expect(metrics.boardWidth).toBeLessThanOrEqual(width);
    }
  });

  it('marks the short phone as tight and a normal phone as roomy', () => {
    expect(stageMetrics(375, 667).tight).toBe(true);
    expect(stageMetrics(390, 844).tight).toBe(false);
    expect(stageMetrics(430, 932).tight).toBe(false);
  });

  it('stacks a tall tablet so the board is not stuck in the top half', () => {
    const metrics = stageMetrics(834, 1112);
    expect(metrics.split).toBe(false);
    expect(metrics.topNav).toBe(false);
    expect(metrics.boardWidth).toBe(metrics.contentW);
  });

  it('splits a landscape tablet when the board can fill the height', () => {
    const metrics = stageMetrics(1112, 834);
    expect(metrics.split).toBe(true);
    expect(metrics.topNav).toBe(true);
    expect(metrics.boardWidth).toBeGreaterThanOrEqual(560);
    expect(metrics.boardWidth + metrics.turnRow).toBeLessThanOrEqual(metrics.contentHeight);
    expect(metrics.boardWidth + metrics.gap + metrics.asideWidth).toBeLessThanOrEqual(metrics.contentW + 1);
  });

  it('grows the desktop board with the viewport and keeps the side panel readable', () => {
    const laptop = stageMetrics(1280, 800);
    const desktop = stageMetrics(1440, 900);
    const wide = stageMetrics(1920, 1080);
    for (const metrics of [laptop, desktop, wide]) {
      expect(metrics.split).toBe(true);
      expect(metrics.topNav).toBe(true);
      expect(metrics.boardWidth + metrics.turnRow).toBeLessThanOrEqual(metrics.contentHeight);
      expect(metrics.boardWidth + metrics.turnRow).toBeGreaterThan(metrics.contentHeight * 0.9);
      expect(metrics.asideWidth).toBeGreaterThanOrEqual(300);
      expect(metrics.asideWidth).toBeLessThanOrEqual(440);
      expect(metrics.boardWidth + metrics.gap + metrics.asideWidth).toBeLessThanOrEqual(metrics.contentW + 1);
    }
    expect(desktop.boardWidth).toBeGreaterThan(720);
    expect(wide.boardWidth).toBeGreaterThan(desktop.boardWidth);
    expect(laptop.boardWidth).toBeGreaterThan(600);
  });

  it('does not split a short landscape phone', () => {
    const metrics = stageMetrics(844, 390);
    expect(metrics.split).toBe(false);
  });

  it('clears a phone notch without giving up a full-width board', () => {
    const metrics = stageMetrics(390, 844, 47, 34);
    expect(metrics.phone).toBe(true);
    expect(metrics.split).toBe(false);
    expect(metrics.padTop).toBeGreaterThanOrEqual(47);
    expect(metrics.boardWidth).toBe(metrics.contentW);
    expect(metrics.boardWidth).toBeLessThanOrEqual(390);
  });
});
