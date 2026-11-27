/**
 * Serves `dist` the way Vercel static hosting does with cleanUrls.
 * A real file wins. `/drills` serves `drills.html`. Anything else is `404.html`
 * with status 404.
 *
 *   npm run export:web && npm run preview:web
 */
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';

const root = path.resolve(process.env.PREVIEW_ROOT ?? 'dist');
const port = Number(process.env.PORT ?? 43127);
const host = '127.0.0.1';

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function insideRoot(file) {
  return file === root || file.startsWith(`${root}${path.sep}`);
}

function fileFor(urlPath) {
  let decoded = '/';
  try {
    decoded = decodeURIComponent((urlPath ?? '/').split('?')[0] ?? '/');
  } catch {
    return { status: 400, file: null };
  }
  const relative = path.posix.normalize(decoded).replace(/^(\.\.(\/|$))+/, '').replace(/^\/+/, '');
  const candidates = [];
  if (relative) candidates.push(relative);
  candidates.push(relative ? `${relative}.html` : 'index.html');
  if (relative) candidates.push(path.posix.join(relative, 'index.html'));
  for (const candidate of candidates) {
    const file = path.resolve(root, candidate);
    if (!insideRoot(file)) continue;
    if (existsSync(file) && statSync(file).isFile()) return { status: 200, file };
  }
  const missing = path.join(root, '404.html');
  if (existsSync(missing)) return { status: 404, file: missing };
  return { status: 404, file: null };
}

const server = createServer((request, response) => {
  const { status, file } = fileFor(request.url ?? '/');
  if (!file) {
    response.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end(status === 404 ? 'Not found' : 'Bad request');
    return;
  }
  const type = types[path.extname(file)] ?? 'application/octet-stream';
  response.writeHead(status, { 'Content-Type': type });
  if (request.method === 'HEAD') {
    response.end();
    return;
  }
  createReadStream(file).pipe(response);
});

server.listen(port, host, () => {
  console.log(`preview ${root} at http://${host}:${port}`);
});
