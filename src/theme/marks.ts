import { marks } from '@/src/theme/tokens';
import type { ColorScheme, Palette } from '@/src/theme/tokens';

export type MarkRole = 'danger' | 'warning' | 'info' | 'success';

/**
 * Color for arrows and threat marks. Dark mode returns the palette token
 * unchanged. Light mode returns the brighter board ink.
 */
export function markColor(role: MarkRole, scheme: ColorScheme, colors: Palette): string {
  switch (scheme) {
    case 'dark':
      switch (role) {
        case 'danger':
          return colors.danger;
        case 'warning':
          return colors.warning;
        case 'info':
          return colors.info;
        case 'success':
          return colors.success;
        default: {
          const _exhaustive: never = role;
          return _exhaustive;
        }
      }
    case 'light':
      return marks.light[role];
    default: {
      const _exhaustive: never = scheme;
      return _exhaustive;
    }
  }
}
