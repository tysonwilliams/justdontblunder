import { describe, expect, it } from 'vitest';

import { unionInsets } from '@/src/components/ui/screenInsetsMath';

describe('screen insets', () => {
  it('uses the CSS env() when the web provider reports zeros', () => {
    expect(
      unionInsets(
        { top: 0, right: 0, bottom: 0, left: 0 },
        { top: 47, right: 0, bottom: 34, left: 0 },
      ),
    ).toEqual({ top: 47, right: 0, bottom: 34, left: 0 });
  });

  it('keeps a real provider inset when the CSS env() is zero', () => {
    expect(
      unionInsets(
        { top: 20, right: 0, bottom: 12, left: 0 },
        { top: 0, right: 0, bottom: 0, left: 0 },
      ),
    ).toEqual({ top: 20, right: 0, bottom: 12, left: 0 });
  });
});
