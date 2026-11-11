/**
 * Phone board must stay at the same y after a move.
 *
 * Requires the web app (npm run web) and puppeteer-core, and uses the system Chrome.
 *   BOARD_URL=http://127.0.0.1:43127 node scripts/board-stability.mjs
 *
 * The username sheet sits over the board, so the fixture skips it. Otherwise the
 * script cannot play the move it measures.
 */
import puppeteer from 'puppeteer-core';

const chrome = process.env.CHROME_PATH ?? '/usr/local/bin/google-chrome';
const base = process.env.BOARD_URL ?? 'http://127.0.0.1:43127';
const shotDir = process.env.BOARD_SHOTS ?? '/opt/cursor/artifacts';

const viewports = [
  { width: 390, height: 844 },
  { width: 360, height: 740 },
];

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

async function measure(page) {
  return page.evaluate(() => {
    const board = document.querySelector('[data-testid="chess-board"]');
    const lead = document.querySelector('[data-testid="board-lead"]');
    const foot = document.querySelector('[data-testid="board-foot"]');
    const box = (node) => {
      if (!node) return null;
      const rect = node.getBoundingClientRect();
      return {
        x: Math.round(rect.x * 100) / 100,
        y: Math.round(rect.y * 100) / 100,
        width: Math.round(rect.width * 100) / 100,
        height: Math.round(rect.height * 100) / 100,
      };
    };
    return {
      board: box(board),
      lead: box(lead),
      foot: box(foot),
      scrollHeight: document.documentElement.scrollHeight,
      innerHeight: window.innerHeight,
      innerWidth: window.innerWidth,
    };
  });
}

async function clickSquare(page, square) {
  const handle = await page.$(`[aria-label^="${square},"]`);
  if (!handle) throw new Error(`missing square ${square}`);
  await handle.click();
}

async function waitForBoard(page) {
  await page.waitForSelector('[data-testid="chess-board"]', { timeout: 30000 });
  await page.evaluate(() => document.fonts?.ready);
  await new Promise((resolve) => setTimeout(resolve, 250));
}

async function open(page, path, theme) {
  await page.evaluateOnNewDocument((preference) => {
    localStorage.setItem(
      'jdb-theme-v1',
      JSON.stringify({ state: { preference }, version: 0 }),
    );
    localStorage.setItem(
      'jdb-progress-v1',
      JSON.stringify({
        state: { welcomeSkipped: true, experience: 'basics', drillsPromptSkipped: true },
        version: 0,
      }),
    );
  }, theme);
  await page.goto(`${base}${path}`, { waitUntil: 'networkidle0', timeout: 60000 });
  await waitForBoard(page);
}

async function checkDrill(browser, viewport) {
  const page = await browser.newPage();
  await page.setViewport({ ...viewport, deviceScaleFactor: 1 });
  await open(page, '/drills', 'dark');
  await page.waitForSelector('[data-testid="streak-toggle"]', { timeout: 30000 });
  const before = await measure(page);
  if (!before.board) throw new Error('board missing before the move');
  const playChecked = await page.$eval('[data-testid="streak-toggle"]', (node) => node.getAttribute('aria-checked'));
  const playCopy = await page.evaluate(() => document.body.innerText);

  await clickSquare(page, 'h5');
  await clickSquare(page, 'e5');
  await page.waitForFunction(
    () => /Nice save|Not quite|Here's the idea/.test(document.body.innerText),
    { timeout: 8000 },
  );
  await new Promise((resolve) => setTimeout(resolve, 300));
  const after = await measure(page);

  const next = await page.evaluateHandle(() => {
    const nodes = [...document.querySelectorAll('[role="button"], button')];
    return nodes.find((node) => (node.textContent ?? '').includes('Next')) ?? null;
  });
  const nextNode = next.asElement();
  let afterNext = null;
  if (nextNode) {
    await nextNode.click();
    await new Promise((resolve) => setTimeout(resolve, 400));
    afterNext = await measure(page);
  }

  await page.close();

  const streakPage = await browser.newPage();
  await streakPage.setViewport({ ...viewport, deviceScaleFactor: 1 });
  await open(streakPage, '/drills?streak=1', 'dark');
  await streakPage.waitForSelector('[data-testid="streak-toggle"]', { timeout: 30000 });
  const streak = await measure(streakPage);
  const streakChecked = await streakPage.$eval('[data-testid="streak-toggle"]', (node) =>
    node.getAttribute('aria-checked'),
  );
  const streakCopy = await streakPage.evaluate(() => document.body.innerText);
  await streakPage.close();

  return { before, after, afterNext, streak, playChecked, playCopy, streakChecked, streakCopy };
}

function sameY(label, left, right) {
  if (!left?.board || !right?.board) {
    fail(`${label}: board rect missing`);
    return;
  }
  const delta = Math.abs(left.board.y - right.board.y);
  const widthDelta = Math.abs(left.board.width - right.board.width);
  console.log(
    `${label}: y ${left.board.y} -> ${right.board.y} (Δ ${delta}), width ${left.board.width}, lead ${left.lead?.height}, foot ${right.foot?.height}`,
  );
  if (delta > 0.5) fail(`${label}: board y moved by ${delta}px`);
  if (widthDelta > 0.5) fail(`${label}: board width changed by ${widthDelta}px`);
  if (left.lead && right.lead && Math.abs(left.lead.height - right.lead.height) > 0.5) {
    fail(`${label}: lead height changed`);
  }
  if (left.scrollHeight > left.innerHeight + 1) {
    fail(`${label}: page scrolls (${left.scrollHeight} > ${left.innerHeight})`);
  }
}

async function shot(browser, name, path, theme, viewport) {
  const page = await browser.newPage();
  await page.setViewport({ ...viewport, deviceScaleFactor: 2 });
  await open(page, path, theme);
  const file = `${shotDir}/${name}.png`;
  await page.screenshot({ path: file, fullPage: false });
  console.log(`shot ${file}`);
  await page.close();
}

async function shotMove(browser, theme, viewport) {
  const page = await browser.newPage();
  await page.setViewport({ ...viewport, deviceScaleFactor: 2 });
  await open(page, '/drills', theme);
  const tag = theme === 'light' ? 'light' : 'dark';
  await page.screenshot({ path: `${shotDir}/drill-before-${tag}.png`, fullPage: false });
  await clickSquare(page, 'h5');
  await clickSquare(page, 'g4');
  await page.waitForFunction(() => /Not quite|Nice save|Blunder|Streak/.test(document.body.innerText), {
    timeout: 8000,
  });
  await new Promise((resolve) => setTimeout(resolve, 350));
  const moved = await measure(page);
  await page.screenshot({ path: `${shotDir}/drill-after-${tag}.png`, fullPage: false });
  console.log(`shot drill before/after ${tag}; board y ${moved.board?.y}`);
  await page.close();
}

const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--hide-scrollbars'],
});

try {
  for (const viewport of viewports) {
    const result = await checkDrill(browser, viewport);
    const label = `${viewport.width}x${viewport.height}`;
    sameY(`${label} move`, result.before, result.after);
    if (result.afterNext) sameY(`${label} next`, result.before, result.afterNext);
    sameY(`${label} streak`, result.before, result.streak);
    if (Math.abs((result.before.board?.y ?? -1) - 128) > 0.5) {
      fail(`${label}: board y is ${result.before.board?.y}, expected 128`);
    }
    if (Math.abs((result.streak?.board?.y ?? -1) - 128) > 0.5) {
      fail(`${label}: streak board y is ${result.streak?.board?.y}, expected 128`);
    }
    if (result.streak?.scrollHeight > result.streak.innerHeight + 1) {
      fail(`${label}: streak page scrolls (${result.streak.scrollHeight} > ${result.streak.innerHeight})`);
    }
    if (result.playChecked !== 'false') fail(`${label}: Play opened with Streak on`);
    if (!result.playCopy.includes('Show the idea')) fail(`${label}: guided Play is missing Show the idea`);
    if (result.streakChecked !== 'true') fail(`${label}: streak=1 left the Streak toggle off`);
    if (!result.streakCopy.includes('Show the answer')) fail(`${label}: Streak is missing Show the answer`);
    if (!/White to move|Black to move/.test(result.streakCopy)) {
      fail(`${label}: Streak prompt should name whose turn it is`);
    }
    const full = result.before.board && result.before.innerWidth
      ? result.before.board.width >= result.before.innerWidth - 16
      : false;
    if (!full) fail(`${label}: board is not full width (${result.before.board?.width} of ${result.before.innerWidth})`);
  }

  const phone = { width: 390, height: 844 };
  for (const theme of ['dark', 'light']) {
    await shot(browser, `home-${theme}`, '/', theme, phone);
    await shot(browser, `learn-${theme}`, '/learn?lesson=blunder', theme, phone);
    await shot(browser, `practice-${theme}`, '/practice', theme, phone);
    await shotMove(browser, theme, phone);
  }
} finally {
  await browser.close();
}

if (process.exitCode) {
  console.error('board stability check failed');
} else {
  console.log('board stayed put');
}
