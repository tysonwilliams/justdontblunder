import { describe, expect, it } from 'vitest';

import {
  APPLE_BUTTON_TITLE,
  APPLE_LOGO_PATH,
  APPLE_TITLE_FONT_WEIGHT,
  appleButtonPaint,
  appleButtonStyle,
  appleLogoSize,
  appleTitleFontSize,
  appleTitleLetterSpacing,
} from '@/src/auth/appleButton';
import { SIGN_IN_BUTTON_HEIGHT, SIGN_IN_BUTTON_RADIUS } from '@/src/auth/signInButtonMetrics';
import { SIGN_IN_BLACK, SIGN_IN_WHITE } from '@/src/theme/signInBrand';

describe('Continue with Apple', () => {
  it('uses the white style on dark and the black style on light', () => {
    expect(appleButtonStyle('dark')).toBe('white');
    expect(appleButtonStyle('light')).toBe('black');
    expect(appleButtonPaint('white')).toMatchObject({ background: SIGN_IN_WHITE, foreground: SIGN_IN_BLACK });
    expect(appleButtonPaint('black')).toMatchObject({ background: SIGN_IN_BLACK, foreground: SIGN_IN_WHITE });
  });

  it('keeps the title, weight, and radius inside Apple’s button rules', () => {
    expect(APPLE_BUTTON_TITLE).toBe('Continue with Apple');
    expect(APPLE_TITLE_FONT_WEIGHT).toBe('500');
    expect(SIGN_IN_BUTTON_RADIUS).toBeGreaterThanOrEqual(0);
    expect(SIGN_IN_BUTTON_RADIUS).toBeLessThanOrEqual(50);
    expect(SIGN_IN_BUTTON_HEIGHT).toBeGreaterThanOrEqual(30);
    expect(SIGN_IN_BUTTON_HEIGHT).toBeLessThanOrEqual(64);
    const fontSize = appleTitleFontSize(SIGN_IN_BUTTON_HEIGHT);
    expect(fontSize).toBe(17);
    expect(Math.round(fontSize * 2.33)).toBe(SIGN_IN_BUTTON_HEIGHT);
    expect(appleTitleLetterSpacing(fontSize)).toBeCloseTo(fontSize * -0.022);
  });

  it('scales the official glyph to the button height', () => {
    expect(APPLE_LOGO_PATH.startsWith('M')).toBe(true);
    expect(appleLogoSize(SIGN_IN_BUTTON_HEIGHT)).toEqual({
      width: (40 * 17) / 44,
      height: 40,
    });
  });
});
