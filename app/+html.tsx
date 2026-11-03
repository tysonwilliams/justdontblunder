import { ScrollViewStyleReset } from 'expo-router/html';
import type { ReactNode } from 'react';

import { themeBootScript, themeShellCss } from '@/src/theme/chrome';
import { palettes } from '@/src/theme/tokens';

// This file is web-only and used to configure the root HTML for every
// web page during static rendering.
// The contents of this function only run in Node.js environments and
// do not have access to the DOM or browser APIs.
export default function Root({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />
        <meta name="theme-color" content={palettes.dark.background} />
        <script dangerouslySetInnerHTML={{ __html: themeBootScript() }} />

        {/*
          Disable body scrolling on web. This makes ScrollView components work closer to how they do on native.
          However, body scrolling is often nice to have for mobile web. If you want to enable it, remove this line.
        */}
        <ScrollViewStyleReset />

        {/* Paint the page before React so the saved scheme does not flash. */}
        <style dangerouslySetInnerHTML={{ __html: themeShellCss() }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
