/**
 * The board stays responsive while a Chess.com scan is still finding blunders.
 *
 * Requires the web app (npm run web) and puppeteer-core.
 *   BOARD_URL=http://127.0.0.1:43127 node scripts/scan-smoothness.mjs
 */
import { appendFileSync } from 'node:fs';
import { createRequire } from 'node:module';

import puppeteer from 'puppeteer-core';

const require = createRequire(import.meta.url);
const { Chess } = require('chess.js');

const chrome = process.env.CHROME_PATH ?? '/usr/local/bin/google-chrome';
const base = process.env.BOARD_URL ?? 'http://127.0.0.1:43127';
const shotDir = process.env.BOARD_SHOTS ?? '/opt/cursor/artifacts';
const GAP_LIMIT_MS = 200;
const logPath = '/tmp/scan-smooth.log';

const newest = 'https://api.chess.com/pub/player/me/games/2026/11';
const middle = 'https://api.chess.com/pub/player/me/games/2026/10';
const oldest = 'https://api.chess.com/pub/player/me/games/2026/09';

function log(message) {
  appendFileSync(logPath, `${new Date().toISOString()} ${message}\n`);
  console.log(message);
}

function fail(message) {
  log(message);
  process.exitCode = 1;
}

function queenHang(second) {
  const game = new Chess();
  try {
    if (!game.move('e4') || !game.move('Nf6') || !game.move(second) || !game.move('a6')) return null;
    if (!game.move('Qh5') || !game.move('Nxh5')) return null;
  } catch {
    return null;
  }
  return game.pgn();
}

const seconds = [
  'a3', 'a4', 'b3', 'b4', 'c3', 'c4', 'd3', 'd4', 'e3', 'f4', 'g3', 'h3', 'h4',
  'Nc3', 'Na3', 'Nh3', 'Be2', 'Bd3', 'Bc4', 'Bb5', 'Qe2', 'Ke2',
];
const hangs = [...new Set(seconds)].map(queenHang).filter(Boolean);

function gamesFrom(pgns, endTime) {
  return pgns.map((pgn, index) => ({
    pgn,
    time_class: 'rapid',
    end_time: endTime - index,
    white: { username: 'Me' },
    black: { username: 'them' },
  }));
}

const earlyGames = gamesFrom(hangs.slice(0, 3), 5000);
const middleGames = gamesFrom([...hangs.slice(3), ...hangs.slice(3), ...hangs.slice(3)], 3000);
const oldestGames = gamesFrom(hangs.slice(0, 1), 1000);

let releaseMiddle = () => {};
let releaseOldest = () => {};
const middleGate = new Promise((resolve) => {
  releaseMiddle = resolve;
});
const oldestGate = new Promise((resolve) => {
  releaseOldest = resolve;
});

function jsonBody(body) {
  return {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
    body: JSON.stringify(body),
  };
}

function settle(request, action) {
  void action.catch((error) => {
    log(`request failed ${request.url()} ${error instanceof Error ? error.message : error}`);
  });
}

async function installScan(page, label) {
  const workers = [];
  page.on('workercreated', (worker) => {
    workers.push(worker.url());
    log(`worker ${label} ${worker.url()}`);
  });
  page.on('pageerror', (error) => {
    log(`pageerror ${label} ${error.message}`);
  });
  page.on('console', (message) => {
    const text = message.text();
    if (/error|worker|failed|scan/i.test(text)) log(`console ${label} ${text}`);
  });
  await page.setRequestInterception(true);
  // Never await inside this listener. Awaiting continue() deadlocks navigation.
  page.on('request', (request) => {
    const url = request.url();
    if (!url.includes('api.chess.com')) {
      settle(request, request.continue());
      return;
    }
    log(`chess.com ${label} ${url}`);
    if (url.includes('/games/archives')) {
      settle(request, request.respond(jsonBody({ archives: [oldest, middle, newest] })));
      return;
    }
    if (url === newest) {
      settle(request, request.respond(jsonBody({ games: earlyGames })));
      return;
    }
    if (url === middle) {
      settle(
        request,
        middleGate.then(() => request.respond(jsonBody({ games: middleGames }))),
      );
      return;
    }
    if (url === oldest) {
      settle(
        request,
        oldestGate.then(() => request.respond(jsonBody({ games: oldestGames }))),
      );
      return;
    }
    settle(request, request.respond({ status: 404, contentType: 'application/json', body: '{}' }));
  });
  return workers;
}

async function prepare(page, viewport) {
  await page.setViewport({ ...viewport, deviceScaleFactor: 2 });
  await page.evaluateOnNewDocument(() => {
    localStorage.setItem('jdb-theme-v1', JSON.stringify({ state: { preference: 'dark' }, version: 0 }));
    localStorage.setItem(
      'jdb-progress-v1',
      JSON.stringify({
        state: { welcomeSkipped: true, experience: 'basics', drillsPromptSkipped: false },
        version: 0,
      }),
    );
  });
}

async function setUsername(page) {
  return page.evaluate(() => {
    const node = document.querySelector('[data-testid="drills-username"]');
    if (!(node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement)) return 'missing';
    const proto = Object.getPrototypeOf(node);
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    setter?.call(node, 'Me');
    node.dispatchEvent(new Event('input', { bubbles: true }));
    node.dispatchEvent(new Event('change', { bubbles: true }));
    return node.value;
  });
}

async function press(page, testId) {
  return page.evaluate((id) => {
    const node = document.querySelector(`[data-testid="${id}"]`);
    if (!node) return 'missing';
    node.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    return 'clicked';
  }, testId);
}

async function openDrills(page, label) {
  log(`open ${label}`);
  await page.goto(`${base}/drills`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('[data-testid="drills-username"]', { timeout: 30000 });
  const typed = await setUsername(page);
  log(`typed ${label} ${typed}`);
  log(`find ${label} ${await press(page, 'drills-find')}`);
  await page.waitForSelector('[data-testid="drills-play"]', { timeout: 30000 });
  log(`play ${label} ${await press(page, 'drills-play')}`);
  await page.waitForSelector('[data-testid="chess-board"]', { timeout: 30000 });
  await page.waitForFunction(() => {
    const queen = document.querySelector('[aria-label^="d1,"]');
    const count = document.querySelector('[data-testid="scan-count"]');
    return Boolean(queen?.getAttribute('aria-label')?.includes('white queen') && count?.textContent?.includes('found'));
  }, { timeout: 25000 });
  log(`unlocked ${label} ${await countText(page)}`);
}

async function foundCount(page) {
  return page.evaluate(() => {
    const text = document.querySelector('[data-testid="scan-count"]')?.textContent ?? '';
    const match = text.match(/(\d+)\s+found/);
    return match ? Number(match[1]) : null;
  });
}

async function countText(page) {
  return page.evaluate(() => document.querySelector('[data-testid="scan-count"]')?.textContent ?? '');
}

async function fingerprint(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll('[aria-label]')]
      .map((node) => node.getAttribute('aria-label') ?? '')
      .filter((label) => /^[a-h][1-8],/.test(label))
      .map((label) => label.split(', ').slice(0, 2).join(', '))
      .sort()
      .join('|'),
  );
}

async function boardBox(page) {
  return page.evaluate(() => {
    const board = document.querySelector('[data-testid="chess-board"]');
    if (!board) return null;
    const rect = board.getBoundingClientRect();
    return {
      x: Math.round(rect.x * 100) / 100,
      y: Math.round(rect.y * 100) / 100,
      width: Math.round(rect.width * 100) / 100,
      height: Math.round(rect.height * 100) / 100,
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      scrollHeight: document.documentElement.scrollHeight,
    };
  });
}

async function armFrameWatch(page) {
  await page.evaluate(() => {
    const watch = { gaps: [], tasks: [] };
    let last = performance.now();
    const tick = (now) => {
      watch.gaps.push(now - last);
      last = now;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) watch.tasks.push(entry.duration);
    });
    try {
      observer.observe({ entryTypes: ['longtask'] });
    } catch {
      // longtask is unavailable in some headless builds; rAF gaps still cover stalls.
    }
    window.__scanWatch = watch;
  });
}

async function frameStats(page) {
  return page.evaluate(() => {
    const watch = window.__scanWatch ?? { gaps: [], tasks: [] };
    const gaps = watch.gaps.slice();
    const tasks = watch.tasks.slice();
    return {
      maxGap: gaps.reduce((max, gap) => Math.max(max, gap), 0),
      maxTask: tasks.reduce((max, task) => Math.max(max, task), 0),
      samples: gaps.length,
      taskCount: tasks.length,
    };
  });
}

async function waitForGrowth(page, start) {
  const deadline = Date.now() + 25000;
  while (Date.now() < deadline) {
    const found = await foundCount(page);
    if (found != null && found > start) return found;
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
  throw new Error(`found count stayed at ${start}`);
}

async function squarePoint(page, square) {
  const handle = await page.$(`[aria-label^="${square},"]`);
  if (!handle) throw new Error(`missing square ${square}`);
  const box = await handle.boundingBox();
  if (!box) throw new Error(`no box for ${square}`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

async function dragPiece(page, square) {
  const { x, y } = await squarePoint(page, square);
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let step = 1; step <= 8; step += 1) {
    await page.mouse.move(x + step * 8, y - step * 6);
    await new Promise((resolve) => setTimeout(resolve, 32));
  }
  for (let step = 8; step >= 0; step -= 1) {
    await page.mouse.move(x + step * 8, y - step * 6);
    await new Promise((resolve) => setTimeout(resolve, 24));
  }
  await page.mouse.up();
}

async function clickSquare(page, square) {
  const { x, y } = await squarePoint(page, square);
  await page.mouse.click(x, y);
}

const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--hide-scrollbars'],
});

try {
  log(`hangs ${hangs.length} middle ${middleGames.length}`);
  const phone = await browser.newPage();
  const desk = await browser.newPage();
  const phoneWorkers = await installScan(phone, 'phone');
  const deskWorkers = await installScan(desk, 'desk');
  await prepare(phone, { width: 390, height: 844 });
  await prepare(desk, { width: 1280, height: 800 });
  await openDrills(phone, 'phone');
  await openDrills(desk, 'desk');

  await phone.bringToFront();
  const phoneStart = await fingerprint(phone);
  const deskStart = await fingerprint(desk);
  const phoneFound = await foundCount(phone);
  const deskFound = await foundCount(desk);
  const phoneBefore = await boardBox(phone);
  await armFrameWatch(phone);
  await armFrameWatch(desk);
  log(`ready phone ${await countText(phone)} y=${phoneBefore?.y} desk ${await countText(desk)}`);
  releaseMiddle();

  const phoneNext = await waitForGrowth(phone, phoneFound ?? 0);
  const deskNext = await waitForGrowth(desk, deskFound ?? 0);
  const phoneMid = await fingerprint(phone);
  const deskMid = await fingerprint(desk);
  const phoneBox = await boardBox(phone);
  const deskBox = await boardBox(desk);
  const phoneLabel = (await countText(phone)).replace(/\s+/g, ' ').trim();
  const deskLabel = (await countText(desk)).replace(/\s+/g, ' ').trim();

  if (phoneMid !== phoneStart) fail('phone position changed when the found count grew');
  if (deskMid !== deskStart) fail('desktop position changed when the found count grew');
  if (!phoneLabel.includes('found') || !deskLabel.includes('found')) fail('scan counter was not still growing');
  if (phoneNext <= (phoneFound ?? 0) || deskNext <= (deskFound ?? 0)) fail('found count did not increase');
  if (!phoneBox || Math.abs(phoneBox.y - 128) > 0.5) fail(`phone board y is ${phoneBox?.y}, expected 128`);
  if (phoneBox && phoneBox.scrollHeight > phoneBox.innerHeight + 1) fail('phone page scrolls during the scan');
  if (phoneBox && phoneBox.width < phoneBox.innerWidth - 16) {
    fail(`phone board is not full width (${phoneBox.width} of ${phoneBox.innerWidth})`);
  }
  if (deskBox && deskBox.width < 480) fail(`desktop board stayed small (${deskBox.width})`);

  await phone.screenshot({ path: `${shotDir}/scan_play_phone.png` });
  await desk.screenshot({ path: `${shotDir}/scan_play_desktop.png` });
  log(`shot ${shotDir}/scan_play_phone.png (${phoneLabel})`);
  log(`shot ${shotDir}/scan_play_desktop.png (${deskLabel})`);

  await dragPiece(phone, 'd1');
  const afterDrag = await frameStats(phone);
  const stillThere = await fingerprint(phone);
  if (stillThere !== phoneStart) fail('drag during the scan changed the puzzle position');
  const moveStarted = Date.now();
  await clickSquare(phone, 'd1');
  await clickSquare(phone, 'h5');
  await phone.waitForFunction(() => /Not quite|Nice save|Here's the idea|Blunder/.test(document.body.innerText), {
    timeout: 8000,
  });
  const moveMs = Date.now() - moveStarted;
  await desk.bringToFront();
  const deskStats = await frameStats(desk);
  log(
    `phone gaps ${afterDrag.maxGap.toFixed(0)}ms tasks ${afterDrag.maxTask.toFixed(0)}ms samples ${afterDrag.samples}; move ${moveMs}ms; desk gaps ${deskStats.maxGap.toFixed(0)}ms tasks ${deskStats.maxTask.toFixed(0)}ms`,
  );
  log(`workers phone ${phoneWorkers.length} desk ${deskWorkers.length}`);
  if (afterDrag.maxGap > GAP_LIMIT_MS) fail(`main thread stalled ${afterDrag.maxGap.toFixed(0)}ms during the scan`);
  if (afterDrag.maxTask > GAP_LIMIT_MS) fail(`long task ${afterDrag.maxTask.toFixed(0)}ms during the scan`);
  if (deskStats.maxTask > GAP_LIMIT_MS) fail(`desktop long task ${deskStats.maxTask.toFixed(0)}ms during the scan`);
  if (moveMs > 1500) fail(`the move took ${moveMs}ms while the scan was running`);
  if ((await foundCount(phone)) == null) fail('scan counter disappeared before the move');
} catch (error) {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  log(`ERR ${message}`);
  process.exitCode = 1;
  try {
    const pages = await browser.pages();
    for (const [index, page] of pages.entries()) {
      const text = await page.evaluate(() => document.body?.innerText?.slice(0, 600) ?? '').catch(() => '');
      log(`page ${index} ${JSON.stringify(text)}`);
      await page.screenshot({ path: `${shotDir}/scan_debug_${index}.png` }).catch(() => {});
    }
  } catch (dumpError) {
    log(`dump failed ${dumpError instanceof Error ? dumpError.message : dumpError}`);
  }
} finally {
  releaseMiddle();
  releaseOldest();
  await browser.close();
}

if (process.exitCode) {
  console.error('scan smoothness check failed');
} else {
  console.log('board stayed responsive during the scan');
}
