import { describe, expect, it } from 'vitest';

import { skeletonPulseMs } from '@/src/components/ui/skeletonMotion';

describe('skeletonPulseMs', () => {
  it('pulses by default and holds still when motion is reduced', () => {
    expect(skeletonPulseMs(false)).toBeGreaterThan(0);
    expect(skeletonPulseMs(true)).toBe(0);
  });
});
