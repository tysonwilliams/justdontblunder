import type { Metadata } from 'expo-router/server';

import { palettes } from '@/src/theme/tokens';

export const SITE_ORIGIN = 'https://justdontblunder.com';

export const SITE_NAME = "Just Don't Blunder";

export const THEME_COLOR = palettes.dark.background;

export const BACKGROUND_COLOR = palettes.dark.background;

export const SHARE_IMAGE_PATH = '/og.png';

export const SHARE_IMAGE = {
  url: `${SITE_ORIGIN}${SHARE_IMAGE_PATH}`,
  width: 1200,
  height: 630,
  alt: "Just Don't Blunder, a chess trainer",
  type: 'image/png',
} as const;

export type PublicPage = {
  path: string;
  title: string;
  description: string;
};

export const PUBLIC_PAGES: readonly PublicPage[] = [
  {
    path: '/',
    title: SITE_NAME,
    description:
      'A chess trainer that marks a blunder in red and a save in green. Play, learn, and drill with no account.',
  },
  {
    path: '/drills',
    title: `Drills · ${SITE_NAME}`,
    description:
      'Drill a blunder before you play it. Any safe move passes. A blunder is mate in 1 or a net material loss.',
  },
  {
    path: '/learn',
    title: `Learn · ${SITE_NAME}`,
    description: 'Short lessons on hanging pieces, forks, pins, the back rank, and missed mate.',
  },
  {
    path: '/practice',
    title: `Practice · ${SITE_NAME}`,
    description: 'Play a move and see if it hangs a piece. The board stays still so you can look again.',
  },
  {
    path: '/progress',
    title: `Progress · ${SITE_NAME}`,
    description:
      'Streaks, lessons, and games you imported. Add a public Chess.com or Lichess username. No password.',
  },
  {
    path: '/account',
    title: `Account · ${SITE_NAME}`,
    description: 'Optional sign-in with an email magic link or email and password. Play stays open with no account.',
  },
  {
    path: '/privacy',
    title: `Privacy · ${SITE_NAME}`,
    description:
      "What Just Don't Blunder collects, why, who handles it, and how to delete it. Play does not require an account.",
  },
  {
    path: '/terms',
    title: `Terms · ${SITE_NAME}`,
    description: "Terms for the Just Don't Blunder chess trainer at justdontblunder.com.",
  },
  {
    path: '/delete-account',
    title: `Delete data · ${SITE_NAME}`,
    description: "Erase this device or delete an optional Just Don't Blunder account.",
  },
];

export function pageUrl(path: string): string {
  if (path === '/') return `${SITE_ORIGIN}/`;
  return `${SITE_ORIGIN}${path}`;
}

export function pageMetadata(page: PublicPage, index = true): Metadata {
  const url = pageUrl(page.path);
  return {
    title: page.title,
    description: page.description,
    applicationName: SITE_NAME,
    manifest: '/manifest.webmanifest',
    alternates: { canonical: url },
    robots: index ? { index: true, follow: true } : { index: false, follow: false },
    openGraph: {
      title: page.title,
      description: page.description,
      url,
      siteName: SITE_NAME,
      locale: 'en_US',
      type: 'website',
      images: SHARE_IMAGE,
    },
    twitter: {
      card: 'summary_large_image',
      title: page.title,
      description: page.description,
      images: { url: SHARE_IMAGE.url, alt: SHARE_IMAGE.alt },
    },
    icons: {
      icon: { url: '/favicon.png', type: 'image/png', sizes: '48x48' },
      apple: { url: '/apple-touch-icon.png', type: 'image/png', sizes: '180x180' },
    },
  };
}

export function metadataFor(path: string): Metadata {
  const page = PUBLIC_PAGES.find((entry) => entry.path === path);
  if (!page) {
    throw new Error(`No public metadata for ${path}`);
  }
  return pageMetadata(page);
}

export function privateMetadata(path: string, title: string, description: string): Metadata {
  return pageMetadata({ path, title, description }, false);
}

export function sitemapXml(): string {
  const body = PUBLIC_PAGES.map((page) => `  <url><loc>${pageUrl(page.path)}</loc></url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

export function robotsTxt(): string {
  return `User-agent: *\nAllow: /\n\nSitemap: ${SITE_ORIGIN}/sitemap.xml\n`;
}
