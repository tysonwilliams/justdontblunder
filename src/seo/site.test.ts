import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  BACKGROUND_COLOR,
  PUBLIC_PAGES,
  SHARE_IMAGE,
  SITE_NAME,
  THEME_COLOR,
  metadataFor,
  pageMetadata,
  privateMetadata,
  robotsTxt,
  sitemapXml,
} from '@/src/seo/site';

const publicDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../public');

function pngSize(file: string): { width: number; height: number } {
  const bytes = readFileSync(path.join(publicDir, file));
  expect(bytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

describe('site metadata', () => {
  it('gives every public route its own title, description, and share card', () => {
    expect(PUBLIC_PAGES.map((page) => page.path)).toEqual([
      '/',
      '/drills',
      '/learn',
      '/practice',
      '/progress',
      '/account',
      '/privacy',
      '/terms',
      '/delete-account',
    ]);
    for (const page of PUBLIC_PAGES) {
      const meta = metadataFor(page.path);
      expect(meta.title).toBe(page.title);
      expect(meta.description).toBe(page.description);
      expect(meta.openGraph?.url).toBe(
        page.path === '/' ? 'https://justdontblunder.com/' : `https://justdontblunder.com${page.path}`,
      );
      expect(meta.openGraph?.images).toEqual(SHARE_IMAGE);
      expect(meta.twitter?.card).toBe('summary_large_image');
      expect(meta.twitter?.images).toEqual({ url: SHARE_IMAGE.url, alt: SHARE_IMAGE.alt });
      expect(meta.manifest).toBe('/manifest.webmanifest');
    }
    expect(metadataFor('/').title).toBe(SITE_NAME);
    expect(metadataFor('/drills').title).toContain('Drills');
    expect(metadataFor('/privacy').title).toContain('Privacy');
    expect(metadataFor('/terms').title).toContain('Terms');
  });

  it('keeps sign-in pages out of the index', () => {
    const meta = privateMetadata('/auth/callback', 'Signing in', 'Finishing sign-in.');
    expect(meta.robots).toEqual({ index: false, follow: false });
    expect(pageMetadata(PUBLIC_PAGES[0]).robots).toEqual({ index: true, follow: true });
  });

  it('ships robots.txt and sitemap.xml for the public routes', () => {
    expect(readFileSync(path.join(publicDir, 'robots.txt'), 'utf8')).toBe(robotsTxt());
    expect(readFileSync(path.join(publicDir, 'sitemap.xml'), 'utf8')).toBe(sitemapXml());
    expect(sitemapXml()).toContain('https://justdontblunder.com/delete-account');
    expect(sitemapXml()).not.toContain('/auth/');
  });

  it('ships a manifest and on-brand icons', () => {
    const manifest = JSON.parse(readFileSync(path.join(publicDir, 'manifest.webmanifest'), 'utf8')) as {
      name: string;
      short_name: string;
      theme_color: string;
      background_color: string;
      icons: { src: string; sizes: string }[];
    };
    expect(manifest.name).toBe(SITE_NAME);
    expect(manifest.short_name).toBe("Don't Blunder");
    expect(manifest.theme_color).toBe(THEME_COLOR);
    expect(manifest.background_color).toBe(BACKGROUND_COLOR);
    expect(manifest.icons.map((icon) => icon.sizes)).toEqual(['192x192', '512x512', '512x512']);
    expect(pngSize('og.png')).toEqual({ width: 1200, height: 630 });
    expect(pngSize('apple-touch-icon.png')).toEqual({ width: 180, height: 180 });
    expect(pngSize('icon-192.png')).toEqual({ width: 192, height: 192 });
    expect(pngSize('icon-512.png')).toEqual({ width: 512, height: 512 });
    expect(pngSize('favicon.png').width).toBeGreaterThan(0);
  });
});
