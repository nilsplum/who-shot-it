/**
 * Demo players: computer opponents that join a real game, so one person with one phone can
 * play, demonstrate or record the whole game (for example the screen recording App Review
 * asks for; step by step in docs/guides/demo-players.md). Usage, with the code the phone shows:
 *   node scripts/helpers/demo-players.mjs ABCD            two players on the live server
 *   node scripts/helpers/demo-players.mjs ABCD 3 http://localhost:8787   three, local server
 *
 * Each player is the real app page in a headless browser with the end-to-end tests' fake
 * photo plugin (`test/e2e/fake-phone.js`) and drawn stand-in photos (`demo-photos.mjs`),
 * so they upload nobody's real photos. They accept the terms, join, wait half a minute
 * before they say Yes to their photos (the game starts by itself once everyone is ready, so
 * the host has time to show the lobby, for example removing a player), guess a random
 * player a moment after each photo appears, wait through each leaderboard, and stay on the
 * end screen for two minutes (joining the next game when anyone taps "Play again") before
 * they leave. They also stop when the
 * game is gone or the host removed them. Ctrl+C ends them all.
 */
import { chromium } from '@playwright/test';
import { SERVER } from '../../web/shared/config.js';
import { installFakePhone } from '../../test/e2e/fake-phone.js';
import { drawLibrary } from './demo-photos.mjs';

const [code, count = '2', server = SERVER.origin] = process.argv.slice(2);
if (!/^[A-Z0-9]{4}$/.test(code || '')) {
  console.error('Use: node scripts/helpers/demo-players.mjs <CODE> [players] [server]');
  process.exit(1);
}
const NAMES = [['Leo', '🐼'], ['Zoe', '🦄'], ['Max', '🐸'], ['Ida', '🐙']];
const READY_AFTER_MS = 30_000;
const END_STAY_MS = 120_000;
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function player(browser, library, [name, avatar]) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await context.addInitScript(installFakePhone, library);
  await context.addInitScript(([n, a]) => localStorage.setItem('whoshotit', JSON.stringify({ name: n, avatar: a })), [name, avatar]);
  // Waits for the app's own screens are short, so a bot that cannot go on says so instead
  // of hanging (outside the test runner Playwright would wait forever).
  context.setDefaultTimeout(20000);
  const page = await context.newPage();
  await page.goto(server);
  await page.getByRole('button', { name: 'I agree, let’s play' }).click();
  await page.fill('#code', code);
  await page.getByRole('button', { name: 'Join', exact: true }).click();
  console.log(`${avatar} ${name} joined ${code}`);
  const joined = Date.now();
  let lastRound = null;
  let ended = null;
  // Plays along until the page is back on the start screen (room gone, removed), or until
  // the end screen has shown for a while: then it leaves the room properly, so a later
  // "Play again" does not wait for it. When someone opens the next game, it joins.
  let reason = '';
  for (;;) {
    await pause(400 + Math.random() * 400);
    if (await page.locator('#code').count()) {
      reason = (await page.locator('#toast').textContent()) || 'the game is gone';
      break;
    }
    const next = page.locator('[data-act="again"][data-next]');
    if (await next.count()) {
      await next.click();
      ended = null;
      continue;
    }
    ended = (await page.locator('.podium').count()) ? ended || Date.now() : null;
    if (ended && Date.now() - ended > END_STAY_MS) {
      await page.getByRole('button', { name: 'Leave' }).click();
      reason = 'after the game';
      break;
    }
    if (Date.now() - joined > READY_AFTER_MS) {
      const proceed = page.getByRole('button', { name: 'Continue' });
      if (await proceed.count()) await proceed.click();
      const yes = page.getByRole('button', { name: 'Yes' });
      if (await yes.count() && await yes.isEnabled()) await yes.click();
    }
    // Read without waiting: a locator would wait for a round number the lobby does not show.
    const round = await page.evaluate(() => document.querySelector('.rnd')?.textContent || null);
    const options = page.locator('button.opt:not([disabled])');
    if (round && round !== lastRound && await options.count()) {
      await pause(1500 + Math.random() * 3000);
      const n = await options.count();
      if (n) await options.nth(Math.floor(Math.random() * n)).click().catch(() => {});
      lastRound = round;
    }
  }
  console.log(`${avatar} ${name} left (${reason})`);
  await context.close();
}

const browser = await chromium.launch();
const library = await drawLibrary(browser);
await Promise.all(NAMES.slice(0, Number(count)).map((who) => player(browser, library, who)));
await browser.close();
