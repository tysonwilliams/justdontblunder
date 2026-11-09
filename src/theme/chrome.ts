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
 * Runs from the web shell before paint. Reads the same persisted preference
 * the Zustand store writes, then the system scheme.
 */
export function themeBootScript(): string {
  const light = palettes.light;
  const dark = palettes.dark;
  return `(function(){try{var key=${JSON.stringify(THEME_STORAGE_KEY)};var pref='system';var raw=localStorage.getItem(key);if(raw){var parsed=JSON.parse(raw);var stored=parsed&&parsed.state&&parsed.state.preference;if(stored==='light'||stored==='dark'||stored==='system')pref=stored;}var darkMq=window.matchMedia('(prefers-color-scheme: dark)').matches;var scheme=pref==='light'||pref==='dark'?pref:(darkMq?'dark':'light');var bg=scheme==='light'?${JSON.stringify(light.background)}:${JSON.stringify(dark.background)};var fg=scheme==='light'?${JSON.stringify(light.text)}:${JSON.stringify(dark.text)};var root=document.documentElement;root.dataset.colorScheme=scheme;root.style.colorScheme=scheme;root.style.setProperty('--jdb-bg',bg);root.style.setProperty('--jdb-fg',fg);root.style.backgroundColor=bg;root.style.color=fg;var meta=document.querySelector('meta[name="theme-color"]');if(meta)meta.setAttribute('content',bg);}catch(e){}})();`;
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
@media (prefers-color-scheme: light) {
  html, body {
    background-color: var(--jdb-bg, ${light.background});
    color: var(--jdb-fg, ${light.text});
  }
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

/**
 * Document for `web.output: "single"`. Expo reads `public/index.html` in dev
 * and on export. `app/+html.tsx` is the static-rendering shell and uses the
 * same boot script and CSS. `%LANG_ISO_CODE%` and `%WEB_TITLE%` are Expo tokens.
 */
export function spaIndexHtml(): string {
  return `<!doctype html>
<html lang="%LANG_ISO_CODE%">
  <head>
    <meta charset="utf-8" />
    <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
    />
    <meta name="theme-color" content="${palettes.dark.background}" />
    <title>%WEB_TITLE%</title>
    <script>${themeBootScript()}</script>
    <!-- The react-native-web recommended style reset. -->
    <style id="expo-reset">
      html,
      body {
        height: 100%;
      }
      body {
        overflow: hidden;
      }
      #root {
        display: flex;
        height: 100%;
        flex: 1;
      }
    </style>
    <style id="jdb-theme">
${themeShellCss()}
    </style>
  </head>
  <body>
    <noscript>You need to enable JavaScript to run this app.</noscript>
    <div id="root"></div>
    <div id="boot" aria-hidden="true"><div class="frame"></div></div>
  </body>
</html>
`;
}

