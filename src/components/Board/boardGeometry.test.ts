import { describe, expect, it } from 'vitest';

import { squareSizeForFrame } from '@/src/components/Board/boardGeometry';

describe('squareSizeForFrame', () => {
  it('fills a desktop frame instead of a stale 320px grid', () => {
    const square = squareSizeForFrame(720);
    expect(square * 8).toBe(716);
    expect(square).toBeGreaterThan(80);
  });

  it('fills a phone frame', () => {
    expect(squareSizeForFrame(358) * 8).toBe(354);
  });

  it('returns 0 until the frame has a real size', () => {
    expect(squareSizeForFrame(0)).toBe(0);
    expect(squareSizeForFrame(4)).toBe(0);
  });
});
