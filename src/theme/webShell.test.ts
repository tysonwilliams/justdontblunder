import vm from 'node:vm';

import { describe, expect, it } from 'vitest';

import { themeBootScript, themeShellCss } from '@/src/theme/chrome';
import { THEME_STORAGE_KEY } from '@/src/theme/preference';
import { palettes } from '@/src/theme/tokens';

describe('web shell', () => {
  it('paints the dark shell before the saved choice is read', () => {
    const css = themeShellCss();
    expect(css).toContain(palettes.dark.background);
    expect(css).toContain(palettes.dark.text);
    expect(css).not.toContain('prefers-color-scheme');
    expect(css).toContain('#boot');
  });

  it('paints from the saved preference before the app bundle runs', () => {
    const script = themeBootScript();
    expect(script).toContain(THEME_STORAGE_KEY);
    expect(script).toContain(palettes.dark.background);
    expect(script).toContain(palettes.light.background);
  });

  it('paints dark before any saved choice, including on a light system', () => {
    expect(bootScheme(null, false)).toBe('dark');
    expect(bootScheme(null, true)).toBe('dark');
    expect(bootScheme(saved('light'), true)).toBe('light');
    expect(bootScheme(saved('dark'), false)).toBe('dark');
    expect(bootScheme(saved('system'), false)).toBe('light');
    expect(bootScheme(saved('system'), true)).toBe('dark');
  });
});

function saved(preference: 'light' | 'dark' | 'system'): string {
  return JSON.stringify({ state: { preference }, version: 0 });
}

function bootScheme(stored: string | null, prefersDark: boolean): string {
  const root = {
    dataset: {} as { colorScheme?: string },
    style: {
      colorScheme: '',
      backgroundColor: '',
      color: '',
      setProperty() {},
    },
  };
  vm.runInNewContext(themeBootScript(), {
    localStorage: {
      getItem: (key: string) => (key === THEME_STORAGE_KEY ? stored : null),
    },
    window: {
      matchMedia: () => ({ matches: prefersDark }),
    },
    document: {
      documentElement: root,
      querySelector: () => null,
      body: null,
    },
  });
  return root.dataset.colorScheme ?? '';
}
