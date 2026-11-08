import { describe, expect, it } from 'vitest';

import { controlA11y, liveA11y, squareA11y, switchA11y } from '@/src/components/ui/a11y';

describe('accessibility props', () => {
  it('exposes button and tab state as aria attributes', () => {
    expect(controlA11y('button', 'Next puzzle', false)).toMatchObject({
      accessibilityRole: 'button',
      accessibilityLabel: 'Next puzzle',
      accessibilityState: { selected: false },
      'aria-label': 'Next puzzle',
      'aria-selected': false,
    });
    expect(controlA11y('tab', 'Drills', true)).toMatchObject({
      accessibilityRole: 'tab',
      accessibilityLabel: 'Drills',
      accessibilityState: { selected: true },
      'aria-label': 'Drills',
      'aria-selected': true,
    });
  });

  it('exposes a switch as checked on native and web', () => {
    expect(switchA11y('Sound', true)).toMatchObject({
      accessibilityRole: 'switch',
      accessibilityLabel: 'Sound',
      accessibilityState: { checked: true },
      'aria-label': 'Sound',
      'aria-checked': true,
    });
    expect(switchA11y('Haptics', false)['aria-checked']).toBe(false);
  });

  it('announces feedback politely on native and web', () => {
    expect(liveA11y()).toEqual({
      accessibilityLiveRegion: 'polite',
      'aria-live': 'polite',
    });
  });

  it('labels a square without turning it into a button', () => {
    const props = squareA11y('e4, white pawn, selected', true);
    expect(props).toMatchObject({
      accessibilityLabel: 'e4, white pawn, selected',
      accessibilityState: { selected: true },
      'aria-label': 'e4, white pawn, selected',
      'aria-selected': true,
    });
    expect(props).not.toHaveProperty('accessibilityRole');
    expect(props).not.toHaveProperty('role');
  });
});
