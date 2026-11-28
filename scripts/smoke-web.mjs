/**
 * Route smoke for the static preview. Expects `npm run preview:web`.
 *   BOARD_URL=http://127.0.0.1:43127 node scripts/smoke-web.mjs
 */
const base = (process.env.BOARD_URL ?? 'http://127.0.0.1:43127').replace(/\/$/, '');

const pages = [
  ['/', 'Just Don'],
  ['/drills', 'Drills'],
  ['/learn', 'Learn'],
  ['/practice', 'Practice'],
  ['/progress', 'Progress'],
  ['/account', 'Account'],
  ['/privacy', 'Privacy'],
  ['/terms', 'Terms'],
  ['/delete-account', 'Delete data'],
];

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

function visible(html) {
  return html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
}

for (const [page, title] of pages) {
  const response = await fetch(`${base}${page}`);
  const html = await response.text();
  const body = visible(html);
  if (response.status !== 200) fail(`${page} status ${response.status}`);
  if (!body.includes('<title>') || !body.includes(title)) fail(`${page} title missing ${title}`);
  if (!html.includes('name="description"')) fail(`${page} missing description`);
  if (!html.includes('property="og:image"')) fail(`${page} missing og:image`);
  if (!html.includes('name="twitter:card"')) fail(`${page} missing twitter card`);
  if (!html.includes('https://justdontblunder.com/og.png')) fail(`${page} share image is not absolute`);
  console.log(`${response.status} ${page}`);
}

const privacy = visible(await (await fetch(`${base}/privacy`)).text());
if (!privacy.includes("Just Don't Blunder is a chess trainer") && !privacy.includes('Just Don&#x27;t Blunder is a chess trainer')) {
  fail('privacy policy text is not in the initial HTML');
}
if (!privacy.includes('client_errors')) fail('privacy HTML does not name client_errors');

const terms = visible(await (await fetch(`${base}/terms`)).text());
if (!terms.includes('These terms cover') || !terms.includes('chess trainer')) {
  fail('terms text is not in the initial HTML');
}

const missing = await fetch(`${base}/this-page-is-not-on-the-board`);
const missingHtml = visible(await missing.text());
if (missing.status !== 404) fail(`unknown path status ${missing.status}`);
if (!missingHtml.includes("That page isn't on the board.") && !missingHtml.includes('That page isn&#x27;t on the board.')) {
  fail('unknown path did not render the not-found screen');
}
console.log(`${missing.status} /this-page-is-not-on-the-board`);

const files = [
  ['/robots.txt', 'text/plain', 'Sitemap: https://justdontblunder.com/sitemap.xml'],
  ['/sitemap.xml', 'xml', 'https://justdontblunder.com/drills'],
  ['/manifest.webmanifest', 'manifest', '"name": "Just Don\'t Blunder"'],
  ['/sw.js', 'javascript', 'CACHE_NAME'],
  ['/og.png', 'image/png', null],
  ['/apple-touch-icon.png', 'image/png', null],
  ['/favicon.png', 'image/png', null],
];

for (const [file, type, needle] of files) {
  const response = await fetch(`${base}${file}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  const contentType = response.headers.get('content-type') ?? '';
  if (response.status !== 200) fail(`${file} status ${response.status}`);
  if (!contentType.includes(type)) fail(`${file} content-type ${contentType}`);
  if (type === 'image/png') {
    if (bytes[0] !== 0x89 || bytes[1] !== 0x50) fail(`${file} is not a PNG`);
  } else {
    const text = bytes.toString('utf8');
    if (text.includes('<div id="root">')) fail(`${file} returned the app shell`);
    if (needle && !text.includes(needle)) fail(`${file} missing ${needle}`);
  }
  console.log(`${response.status} ${file} ${contentType}`);
}

if (process.exitCode) {
  console.error('route smoke failed');
} else {
  console.log('route smoke passed');
}
