import { THEME_STORAGE_KEY } from '@/src/theme/preference';
import { palettes, type ColorScheme, type Palette } from '@/src/theme/tokens';

/** Paint the document shell to match the active scheme. No-op off web. */
export function applyDocumentTheme(scheme: ColorScheme, colors: Palette): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.dataset.colorScheme = scheme;
  root.style.colorScheme = scheme;
  root.style.setProperty('--jdb-bg', colors.background);
  root.style.setProperty('--jdb-fg', colors.text);
  root.style.backgroundColor = colors.background;
  root.style.color = colors.text;
  if (document.body) {
    document.body.style.backgroundColor = colors.background;
    document.body.style.color = colors.text;
  }
  let meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('name', 'theme-color');
    document.head.appendChild(meta);
  }
  meta.setAttribute('content', colors.background);
}

/**
 * Runs from the web shell before paint. Nothing stored paints dark.
 * A saved light, dark, or system preference still wins. System follows the OS.
 */
export function themeBootScript(): string {
  const light = palettes.light;
  const dark = palettes.dark;
  return `(function(){try{var key=${JSON.stringify(THEME_STORAGE_KEY)};var pref='dark';var raw=localStorage.getItem(key);if(raw){var parsed=JSON.parse(raw);var stored=parsed&&parsed.state&&parsed.state.preference;if(stored==='light'||stored==='dark'||stored==='system')pref=stored;}var darkMq=window.matchMedia('(prefers-color-scheme: dark)').matches;var scheme=pref==='light'||pref==='dark'?pref:(darkMq?'dark':'light');var bg=scheme==='light'?${JSON.stringify(light.background)}:${JSON.stringify(dark.background)};var fg=scheme==='light'?${JSON.stringify(light.text)}:${JSON.stringify(dark.text)};var root=document.documentElement;root.dataset.colorScheme=scheme;root.style.colorScheme=scheme;root.style.setProperty('--jdb-bg',bg);root.style.setProperty('--jdb-fg',fg);root.style.backgroundColor=bg;root.style.color=fg;var meta=document.querySelector('meta[name="theme-color"]');if(meta)meta.setAttribute('content',bg);}catch(e){}})();`;
}

export function themeShellCss(): string {
  const light = palettes.light;
  const dark = palettes.dark;
  return `html, body {
  background-color: var(--jdb-bg, ${dark.background});
  color: var(--jdb-fg, ${dark.text});
  height: 100dvh;
  max-height: 100dvh;
  overflow: hidden;
}
body > div:first-child {
  height: 100dvh;
  max-height: 100dvh;
  overflow: hidden;
}
#boot {
  position: fixed;
  inset: 0;
  z-index: 5;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--jdb-bg, ${dark.background});
  pointer-events: none;
}
#boot .frame {
  width: min(72vw, 64dvh);
  aspect-ratio: 1;
  border-radius: 8px;
  background: repeating-conic-gradient(${light.boardLight} 0% 25%, ${light.boardDark} 0% 50%) 0 0 / 25% 25%;
}
#root:not(:empty) + #boot {
  display: none;
}
`;
}


