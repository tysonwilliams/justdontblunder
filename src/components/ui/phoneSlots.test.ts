import { describe, expect, it } from 'vitest';

import { PHONE_BANNER, PHONE_FOOT_MIN, PHONE_LEAD, phoneSlots } from '@/src/components/ui/phoneSlots';
import { stageMetrics } from '@/src/components/ui/stageMetrics';

describe('phoneSlots', () => {
  it('keeps the lead identical before and after a move on the checked phones', () => {
    for (const [width, height] of [
      [390, 844],
      [360, 740],
    ] as const) {
      const metrics = stageMetrics(width, height);
      const before = phoneSlots(metrics.contentHeight, metrics.boardWidth, metrics.turnRow);
      const after = phoneSlots(metrics.contentHeight, metrics.boardWidth, metrics.turnRow);
      expect(metrics.phone).toBe(true);
      expect(metrics.boardWidth).toBe(metrics.contentW);
      expect(before).toEqual(after);
      expect(before.lead).toBe(PHONE_LEAD);
      expect(before.foot).toBeGreaterThanOrEqual(PHONE_FOOT_MIN);
      expect(before.foot).toBeGreaterThanOrEqual(PHONE_BANNER);
      expect(before.lead + before.boardBlock + before.foot).toBe(metrics.contentHeight);
    }
  });

  it('still leaves a result tray when a notch and home indicator are inset', () => {
    const metrics = stageMetrics(390, 844, 47, 34);
    const slots = phoneSlots(metrics.contentHeight, metrics.boardWidth, metrics.turnRow);
    expect(metrics.boardWidth).toBe(metrics.contentW);
    expect(metrics.padTop).toBeGreaterThanOrEqual(47);
    expect(slots.lead).toBe(PHONE_LEAD);
    expect(slots.foot).toBeGreaterThanOrEqual(PHONE_BANNER);
    expect(slots.lead + slots.boardBlock + slots.foot).toBe(metrics.contentHeight);
  });

  it('shrinks the lead before it steals the result tray on a short phone', () => {
    const metrics = stageMetrics(375, 667);
    const slots = phoneSlots(metrics.contentHeight, metrics.boardWidth, metrics.turnRow);
    expect(metrics.boardWidth).toBe(metrics.contentW);
    expect(slots.foot).toBeGreaterThanOrEqual(Math.min(PHONE_FOOT_MIN, metrics.contentHeight - slots.boardBlock));
    expect(slots.lead + slots.boardBlock + slots.foot).toBe(metrics.contentHeight);
    expect(slots.lead).toBeLessThanOrEqual(PHONE_LEAD);
  });
});
