import { describe, expect, it } from 'vitest';

import { markColor } from '@/src/theme/marks';
import { fontWeight, marks, palettes, spacing, themeFor, typeRole } from '@/src/theme/tokens';

describe('themeFor', () => {
  it('returns a stable theme for each scheme and fills both palettes', () => {
    expect(themeFor('dark')).toBe(themeFor('dark'));
    expect(themeFor('light')).toBe(themeFor('light'));
    expect(themeFor('dark').scheme).toBe('dark');
    expect(themeFor('light').scheme).toBe('light');
    expect(themeFor('dark').colors).toBe(palettes.dark);
    expect(themeFor('light').colors).toBe(palettes.light);
    expect(Object.keys(palettes.light).sort()).toEqual(Object.keys(palettes.dark).sort());
  });

  it('keeps the dark colors that were on screen before the token move', () => {
    const { colors } = themeFor('dark');
    expect(colors.background).toBe('#1C1B19');
    expect(colors.surface).toBe('#2A2826');
    expect(colors.surfaceRaised).toBe('#343230');
    expect(colors.text).toBe('#F6F3EE');
    expect(colors.textMuted).toBe('#D5D0C8');
    expect(colors.accent).toBe('#8EBF55');
    expect(colors.danger).toBe('#E25B5B');
    expect(colors.warning).toBe('#E8B84A');
    expect(colors.info).toBe('#8EB4E8');
    expect(colors.boardLight).toBe('#D7DEEA');
    expect(colors.boardDark).toBe('#3A4A63');
    expect(colors.boardBlunder).toBe('#FF5C5C8C');
    expect(colors.boardAttention).toBe('#F5C54299');
  });

  it('names the phone-compact sizes and the original spacing steps', () => {
    expect(spacing.xs).toBe(4);
    expect(spacing.sm).toBe(8);
    expect(spacing.md).toBe(16);
    expect(spacing.lg).toBe(24);
    expect(spacing[6]).toBe(6);
    expect(spacing[14]).toBe(14);
    expect(typeRole.title.fontSize).toBe(26);
    expect(typeRole.titleCompact.fontSize).toBe(18);
    expect(typeRole.titleCompact.lineHeight).toBe(22);
    expect(typeRole.hero.fontSize).toBe(56);
    expect(typeRole.heroCompact.fontSize).toBe(36);
    expect(typeRole.bodyCompact.fontSize).toBe(13);
    expect(fontWeight.bold).toBe('700');
    expect(fontWeight.extraBold).toBe('800');
    expect(fontWeight.medium).toBe('500');
  });
});

describe('light palette', () => {
  const light = palettes.light;

  it('keeps text at WCAG AA on the page surfaces', () => {
    expect(contrast(light.text, light.background)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(light.text, light.surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(light.text, light.surfaceRaised)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(light.textMuted, light.background)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(light.textMuted, light.surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(light.textDim, light.background)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(light.textDim, light.surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(light.accent, light.background)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(light.accent, light.surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(light.accent, composite(light.accentSoft, light.surface))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(light.warning, light.background)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(light.warning, light.surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(light.accentText, light.accent)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(light.accentText, light.accentPressed)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(light.accentText, light.warning)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(light.onDanger, light.danger)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(light.onDanger, light.dangerPressed)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(light.onInfo, light.info)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(light.boardMeta, light.boardFrameBg)).toBeGreaterThanOrEqual(4.5);
  });

  it('keeps board coordinates readable and blunder red distinct from a save', () => {
    expect(contrast(light.boardLight, light.boardDark)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(composite(light.boardLegalOnDark, light.boardDark), light.boardDark)).toBeGreaterThanOrEqual(3);
    expect(contrast(composite(light.boardLegalOnLight, light.boardLight), light.boardLight)).toBeGreaterThanOrEqual(3);
    expect(isReddish(light.danger)).toBe(true);
    expect(isReddish(light.boardBlunder)).toBe(true);
    expect(isGreenish(light.success)).toBe(true);
    expect(isGreenish(light.boardSave)).toBe(true);
    expect(isReddish(marks.light.danger)).toBe(true);
    expect(isGreenish(marks.light.success)).toBe(true);
  });
});

describe('markColor', () => {
  it('uses the dark palette tokens unchanged', () => {
    const colors = palettes.dark;
    expect(markColor('danger', 'dark', colors)).toBe(colors.danger);
    expect(markColor('warning', 'dark', colors)).toBe(colors.warning);
    expect(markColor('info', 'dark', colors)).toBe(colors.info);
    expect(markColor('success', 'dark', colors)).toBe(colors.success);
    expect(marks.dark.danger).toBe(colors.danger);
  });

  it('uses brighter light-mode inks that still read on both squares', () => {
    const colors = palettes.light;
    for (const role of ['danger', 'warning', 'info', 'success'] as const) {
      const ink = markColor(role, 'light', colors);
      expect(ink).toBe(marks.light[role]);
      expect(Math.min(contrast(ink, colors.boardLight), contrast(ink, colors.boardDark))).toBeGreaterThanOrEqual(2);
    }
  });
});

function channel(value: number): number {
  const scaled = value / 255;
  return scaled <= 0.04045 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
}

function rgb(input: string): [number, number, number, number] {
  const hex = input.trim();
  if (hex.startsWith('#')) {
    const body = hex.slice(1);
    const full = body.length === 3 ? body.split('').map((part) => part + part).join('') : body;
    const alpha = full.length === 8 ? parseInt(full.slice(6, 8), 16) / 255 : 1;
    return [
      parseInt(full.slice(0, 2), 16),
      parseInt(full.slice(2, 4), 16),
      parseInt(full.slice(4, 6), 16),
      alpha,
    ];
  }
  const match = hex.match(/rgba?\(([^)]+)\)/);
  if (!match) throw new Error(`Unparsed color ${input}`);
  const parts = match[1].split(',').map((part) => part.trim());
  return [Number(parts[0]), Number(parts[1]), Number(parts[2]), parts[3] === undefined ? 1 : Number(parts[3])];
}

function composite(foreground: string, background: string): string {
  const [red, green, blue, alpha] = rgb(foreground);
  if (alpha >= 1) return foreground;
  const [baseRed, baseGreen, baseBlue] = rgb(background);
  const mix = (fg: number, bg: number) => Math.round(fg * alpha + bg * (1 - alpha));
  return `#${[mix(red, baseRed), mix(green, baseGreen), mix(blue, baseBlue)]
    .map((part) => part.toString(16).padStart(2, '0'))
    .join('')}`;
}

function luminance(input: string): number {
  const [red, green, blue] = rgb(composite(input, '#000000'));
  return 0.2126 * channel(red) + 0.7152 * channel(green) + 0.0722 * channel(blue);
}

function contrast(first: string, second: string): number {
  const lighter = Math.max(luminance(first), luminance(second));
  const darker = Math.min(luminance(first), luminance(second));
  return (lighter + 0.05) / (darker + 0.05);
}

function isReddish(input: string): boolean {
  const [red, green, blue] = rgb(input);
  return red > green + 30 && red > blue + 20;
}

function isGreenish(input: string): boolean {
  const [red, green, blue] = rgb(input);
  return green > red + 20 && green > blue;
}
