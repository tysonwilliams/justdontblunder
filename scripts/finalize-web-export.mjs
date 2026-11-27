/**
 * After `expo export -p web`, copy the not-found page to 404.html so a static
 * host can answer unknown paths with status 404. Also check the public files
 * and the legal pages made it into the export.
 */
import { copyFileSync, existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const dist = path.resolve('dist');

function fail(message) {
  console.error(message);
  process.exit(1);
}

const notFound = path.join(dist, '+not-found.html');
if (!existsSync(notFound)) fail('missing dist/+not-found.html');
copyFileSync(notFound, path.join(dist, '404.html'));

const required = [
  'index.html',
  'drills.html',
  'learn.html',
  'practice.html',
  'progress.html',
  'account.html',
  'privacy.html',
  'terms.html',
  'delete-account.html',
  '404.html',
  'robots.txt',
  'sitemap.xml',
  'manifest.webmanifest',
  'og.png',
  'apple-touch-icon.png',
  'favicon.png',
  'icon-192.png',
  'icon-512.png',
];

for (const file of required) {
  if (!existsSync(path.join(dist, file))) fail(`missing dist/${file}`);
}

function visible(html) {
  return html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
}

function plain(html) {
  return visible(html).replaceAll('&#x27;', "'").replaceAll('&apos;', "'");
}

const privacy = plain(readFileSync(path.join(dist, 'privacy.html'), 'utf8'));
if (!privacy.includes('<title>Privacy · Just Don')) fail('privacy title missing from the static HTML');
if (!privacy.includes("Just Don't Blunder is a chess trainer")) {
  fail('privacy policy text is not in the initial HTML');
}
if (!privacy.includes('client_errors')) fail('privacy page does not disclose client_errors');

const terms = plain(readFileSync(path.join(dist, 'terms.html'), 'utf8'));
if (!terms.includes('<title>Terms · Just Don')) fail('terms title missing from the static HTML');
if (!terms.includes("These terms cover the Just Don't Blunder chess trainer")) {
  fail('terms text is not in the initial HTML');
}

const missing = plain(readFileSync(path.join(dist, '404.html'), 'utf8'));
if (!missing.includes('<title>Page not found · Just Don')) fail('404 title missing from the static HTML');
if (!missing.includes('noindex')) fail('404 page is missing noindex');

const robots = readFileSync(path.join(dist, 'robots.txt'), 'utf8');
if (robots.includes('<div id="root">')) fail('robots.txt is the app shell');
if (!robots.includes('Sitemap: https://justdontblunder.com/sitemap.xml')) fail('robots.txt missing sitemap');

console.log('static export includes 404.html, legal HTML, and the public files');
