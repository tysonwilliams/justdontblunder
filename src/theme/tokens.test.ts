import { describe, expect, it } from 'vitest';

import { useTheme } from '@/src/theme';
import { fontWeight, palettes, spacing, typeRole } from '@/src/theme/tokens';

describe('useTheme', () => {
  it('returns the dark palette and the same object every time', () => {
    const first = useTheme();
    const second = useTheme();
    expect(first).toBe(second);
    expect(first.scheme).toBe('dark');
    expect(first.colors).toBe(palettes.dark);
    expect(palettes.light).toBeUndefined();
  });

  it('keeps the dark colors that were on screen before the token move', () => {
    const { colors } = useTheme();
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
