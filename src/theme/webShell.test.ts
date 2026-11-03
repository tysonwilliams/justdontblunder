import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { spaIndexHtml, themeBootScript, themeShellCss } from '@/src/theme/chrome';
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
});
