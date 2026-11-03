import { palettes, type Palette } from '@/src/theme/tokens';

let active: Palette = palettes.dark;

export function getActivePalette(): Palette {
  return active;
}

export function setActivePalette(palette: Palette): void {
  active = palette;
}
