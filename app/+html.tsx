import { ScrollViewStyleReset, useServerDocumentContext } from 'expo-router/html';
import type { ReactNode } from 'react';

import { themeBootScript, themeShellCss } from '@/src/theme/chrome';
import { palettes } from '@/src/theme/tokens';

// Web-only root document for static rendering. This runs in Node and does not
// touch the DOM. headNodes carries the per-route title, description, and cards.
// bodyNodes carries the scripts that hydrate the page.
export default function Root({ children }: { children: ReactNode }) {
  const { bodyAttributes, bodyNodes, headNodes, htmlAttributes } = useServerDocumentContext();

  return (
    <html lang="en" {...htmlAttributes}>
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />
        <meta name="theme-color" content={palettes.dark.background} />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Don't Blunder" />
        <script dangerouslySetInnerHTML={{ __html: themeBootScript() }} />
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: themeShellCss() }} />
        {headNodes}
      </head>
      <body {...bodyAttributes}>
        {children}
        <div id="boot" aria-hidden="true">
          <div className="frame" />
        </div>
        {bodyNodes}
      </body>
    </html>
  );
}
