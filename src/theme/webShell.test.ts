import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import vm from 'node:vm';

import { describe, expect, it } from 'vitest';

import { spaIndexHtml, themeBootScript, themeShellCss } from '@/src/theme/chrome';
import { THEME_STORAGE_KEY } from '@/src/theme/preference';
import { palettes } from '@/src/theme/tokens';

const indexHtml = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../public/index.html');

describe('web shell', () => {
  it('ships the single-page document generated from the theme', () => {
    expect(readFileSync(indexHtml, 'utf8')).toBe(spaIndexHtml());
  });

  it('paints from the saved preference before the app bundle runs', () => {
    const html = spaIndexHtml();
    expect(html).toContain(themeBootScript());
    expect(html).toContain(themeShellCss());
    expect(html).toContain(`<meta name="theme-color" content="${palettes.dark.background}" />`);
    expect(html).toContain('%LANG_ISO_CODE%');
    expect(html).toContain('%WEB_TITLE%');
    expect(html).toContain('<div id="root"></div>');
  });

  it('paints dark before any saved choice, including on a light system', () => {
    expect(themeShellCss()).not.toContain('prefers-color-scheme');
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
