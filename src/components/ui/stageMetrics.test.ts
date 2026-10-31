import { describe, expect, it } from 'vitest';

import { stageMetrics } from '@/src/components/ui/stageMetrics';

describe('stageMetrics', () => {
  it('keeps a phone in a single column with a full-width board', () => {
    const metrics = stageMetrics(390, 844);
    expect(metrics.split).toBe(false);
    expect(metrics.topNav).toBe(false);
    expect(metrics.boardWidth).toBe(metrics.contentW);
    expect(metrics.contentW).toBeLessThanOrEqual(390);
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
    expect(metrics.boardWidth + 46).toBeLessThanOrEqual(metrics.contentHeight + 1);
    expect(metrics.boardWidth + metrics.gap + metrics.asideWidth).toBeLessThanOrEqual(metrics.contentW + 1);
  });

  it('fits the desktop board inside a short viewport', () => {
    const metrics = stageMetrics(1440, 900);
    expect(metrics.split).toBe(true);
    expect(metrics.topNav).toBe(true);
    expect(metrics.boardWidth).toBeGreaterThanOrEqual(640);
    expect(metrics.boardWidth).toBeLessThanOrEqual(720);
    expect(metrics.boardWidth + 46).toBeLessThanOrEqual(metrics.contentHeight);
    expect(metrics.asideWidth).toBeGreaterThanOrEqual(360);
  });

  it('does not split a short landscape phone', () => {
    const metrics = stageMetrics(844, 390);
    expect(metrics.split).toBe(false);
  });
});
