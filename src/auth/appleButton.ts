import { SIGN_IN_BLACK, SIGN_IN_OUTLINE_BORDER, SIGN_IN_WHITE } from '@/src/theme/signInBrand';

export const APPLE_BUTTON_TITLE = 'Continue with Apple';

/**
 * Official Apple logo glyph from the Sign in with Apple button, inlined.
 * The viewBox is the medium logo slot: 17 units wide inside a 44-unit button.
 */
export const APPLE_LOGO_VIEWBOX = '7 0 17 44';

export const APPLE_LOGO_WIDTH_UNITS = 17;

export const APPLE_LOGO_HEIGHT_UNITS = 44;

export const APPLE_LOGO_PATH =
  'M15.7099491,14.8846154 C16.5675461,14.8846154 17.642562,14.3048315 18.28274,13.5317864 C18.8625238,12.8312142 19.2852829,11.852829 19.2852829,10.8744437 C19.2852829,10.7415766 19.2732041,10.6087095 19.2490464,10.5 C18.2948188,10.5362365 17.1473299,11.140178 16.4588366,11.9494596 C15.9152893,12.56548 15.4200572,13.5317864 15.4200572,14.5222505 C15.4200572,14.6671964 15.4442149,14.8121424 15.4562937,14.8604577 C15.5166879,14.8725366 15.6133185,14.8846154 15.7099491,14.8846154 Z M12.6902416,29.5 C13.8618881,29.5 14.3812778,28.714876 15.8428163,28.714876 C17.3285124,28.714876 17.6546408,29.4758423 18.9591545,29.4758423 C20.2395105,29.4758423 21.0971074,28.292117 21.9063891,27.1325493 C22.8123013,25.8038779 23.1867451,24.4993643 23.2109027,24.4389701 C23.1263509,24.4148125 20.6743484,23.4122695 20.6743484,20.5979021 C20.6743484,18.1579784 22.6069612,17.0588048 22.7156707,16.974253 C21.4353147,15.1382708 19.490623,15.0899555 18.9591545,15.0899555 C17.5217737,15.0899555 16.3501271,15.9596313 15.6133185,15.9596313 C14.8161157,15.9596313 13.7652575,15.1382708 12.521138,15.1382708 C10.1536872,15.1382708 7.75,17.0950413 7.75,20.7911634 C7.75,23.0861411 8.64383344,25.513986 9.74300699,27.0842339 C10.6851558,28.4129053 11.5065162,29.5 12.6902416,29.5 Z';

/** System face. Apple's button uses the system font, not a custom family. */
export const APPLE_TITLE_FONT_FAMILY =
  '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

/** Medium. Apple lets a custom button change the system font's weight. */
export const APPLE_TITLE_FONT_WEIGHT = '500';

/** Official Continue label tracking. */
export const APPLE_TITLE_TRACKING = -0.022;

export type AppleButtonStyleName = 'white' | 'black';

export type AppleButtonPaint = {
  background: string;
  foreground: string;
  borderColor: string;
  borderWidth: number;
};

/** White on a dark page, black on a light page. */
export function appleButtonStyle(scheme: 'dark' | 'light'): AppleButtonStyleName {
  switch (scheme) {
    case 'dark':
      return 'white';
    case 'light':
      return 'black';
    default: {
      const _exhaustive: never = scheme;
      return _exhaustive;
    }
  }
}

export function appleButtonPaint(style: AppleButtonStyleName): AppleButtonPaint {
  switch (style) {
    case 'white':
      return {
        background: SIGN_IN_WHITE,
        foreground: SIGN_IN_BLACK,
        borderColor: SIGN_IN_OUTLINE_BORDER,
        borderWidth: 1,
      };
    case 'black':
      return {
        background: SIGN_IN_BLACK,
        foreground: SIGN_IN_WHITE,
        borderColor: SIGN_IN_BLACK,
        borderWidth: 0,
      };
    default: {
      const _exhaustive: never = style;
      return _exhaustive;
    }
  }
}

/** The system title is 43% of the button height. */
export function appleTitleFontSize(height: number): number {
  return Math.round(height * 0.43);
}

export function appleTitleLetterSpacing(fontSize: number): number {
  return fontSize * APPLE_TITLE_TRACKING;
}

/** Logo slot scaled so its height matches the button, padding included. */
export function appleLogoSize(buttonHeight: number): { width: number; height: number } {
  return {
    width: (buttonHeight * APPLE_LOGO_WIDTH_UNITS) / APPLE_LOGO_HEIGHT_UNITS,
    height: buttonHeight,
  };
}
