/**
 * Demo players: computer opponents that join a real game, so one person with one phone can
 * play, demonstrate or record the whole game (for example the screen recording App Review
 * asks for; step by step in docs/guides/demo-players.md). Usage, with the code the phone shows:
 *   node scripts/helpers/demo-players.mjs ABCD            two players, wherever the game is
 *   node scripts/helpers/demo-players.mjs ABCD 15         as many as the game still holds
 *   node scripts/helpers/demo-players.mjs ABCD 3 staging  three, only on staging (or production)
 *   node scripts/helpers/demo-players.mjs ABCD 3 http://localhost:8787   three, local server
 * Without a server they look for the game on each deployed environment in turn (ENVIRONMENTS:
 * a TestFlight build plays on staging, a store app on production), so they always join the
 * server the phone uses; the first one that knows the code is where all of them play.
 *
 * They join one after the other until as many as asked for are in, or until the room turns
 * one away. The room alone knows who else is in the game, so it alone decides: it holds
 * `LIMITS.maxPlayers` players, everyone counted (`rules.join`), and turns the next one away
 * with "This game is full." The first refusal (full, or no such game) ends the joining,
 * since every later player would hear the same. At most `LIMITS.maxPlayers - 1` can be asked
 * for: the game needs the person's phone too.
 *
 * Each player is the real app page in a headless browser with the end-to-end tests' fake
 * photo plugin (`test/e2e/fake-phone.js`) and drawn stand-in photos (`demo-photos.mjs`),
 * so they upload nobody's real photos. They accept the terms, join, wait half a minute
 * after the last of them joined before they say Yes to their photos (so the host has time
 * to show the lobby, for example removing a player), but never the Yes that would start the
 * game (stamped START): the start stays the person's, whose Yes then asks "Is everyone
 * here?" on their phone. They guess a random player a moment after each photo appears,
 * wait through each leaderboard, and stay on the end screen for two minutes (joining the
 * next game when anyone taps "Play again") before they leave. They also stop when the game is gone or the
 * host removed them. Ctrl+C ends them all.
 */
import { chromium } from '@playwright/test';
import { ENVIRONMENTS, LIMITS } from '../../web/shared/config.js';
import { installFakePhone } from '../../test/e2e/fake-phone.js';
import { drawLibrary } from './demo-photos.mjs';

const MOST = LIMITS.maxPlayers - 1;
const [code, count = '2', where] = process.argv.slice(2);
/** The servers to look for the game on, in turn: the one asked for, or staging (a TestFlight phone, the usual case) and then production. */
const servers = where ? [ENVIRONMENTS[where]?.origin || where] : [ENVIRONMENTS.staging.origin, ENVIRONMENTS.production.origin];
if (!/^[A-Z0-9]{4}$/.test(code || '') || !(Number(count) >= 1) || !/^https?:\/\//.test(servers[0])) {
  console.error(`Use: node scripts/helpers/demo-players.mjs <CODE> [players, 1 to ${MOST}] [${Object.keys(ENVIRONMENTS).join('|')}|<server address>]`);
  process.exit(1);
}
/** What the app says when a server has no game with that code (main.js, CLOSE.gone). */
const NO_SUCH_GAME = 'No game with this code.';
const wanted = Math.min(Math.floor(Number(count)), MOST);
if (wanted < Number(count)) console.log(`At most ${MOST}: a game holds ${LIMITS.maxPlayers} players, you included.`);

/**
 * Names and avatars in joining order, one per player the game can take next to the person.
 * The room gives a player whose avatar is taken a free one (`freeAvatar`); should the limit
 * ever outgrow the list, the names come round again with a number, so it never caps the count.
 */
const NAMES = [
  ['Leo', '🐼'], ['Zoe', '🦄'], ['Max', '🐸'], ['Ida', '🐙'], ['Ben', '🦊'], ['Mia', '🐨'], ['Tom', '🦁'], ['Ava', '🦋'],
  ['Sam', '🐢'], ['Lia', '🦩'], ['Kai', '🐳'], ['Eva', '🌻'], ['Jon', '🎸'], ['Uma', '🍉'], ['Noa', '🚀'],
];
const nameOf = (i) => {
  const [name, avatar] = NAMES[i % NAMES.length];
  const round = Math.floor(i / NAMES.length);
  return [round ? `${name} ${round + 1}` : name, avatar];
};
const READY_AFTER_MS = 30_000;
const END_STAY_MS = 120_000;
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Opens the app as a new phone at `server` and joins the game. Resolves with the page once it
 * is in the room (every room screen has the Leave button), or with the room's answer in the
 * toast once the app is back on its start screen (full, no such game).
 */
async function join(browser, library, [name, avatar], server) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await context.addInitScript(installFakePhone, { photos: library });
  await context.addInitScript(([n, a]) => localStorage.setItem('whoshotit', JSON.stringify({ name: n, avatar: a })), [name, avatar]);
  // Waits for the app's own screens are short, so a bot that cannot go on says so instead
  // of hanging (outside the test runner Playwright would wait forever).
  context.setDefaultTimeout(20000);
  const page = await context.newPage();
  await page.goto(server);
  await page.getByRole('button', { name: 'I agree, let’s play' }).click();
  await page.fill('#code', code);
  await page.getByRole('button', { name: 'Join', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('[data-act="leave"]') || (document.querySelector('#code') && document.querySelector('#toast')?.textContent));
  if (await page.locator('[data-act="leave"]').count()) {
    console.log(`${avatar} ${name} joined ${code}`);
    return page;
  }
  const answer = await page.locator('#toast').textContent();
  await context.close();
  return answer;
}

/**
 * Plays along until the page is back on the start screen (room gone, removed), or until
 * the end screen has shown for a while: then it leaves the room properly, so a later
 * "Play again" does not wait for it. When someone opens the next game, it joins. `since`:
 * when the last player joined, from which the half minute before "Yes" counts.
 */
async function play(page, [name, avatar], since) {
  let lastRound = null;
  let ended = null;
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
    ended = (await page.locator('[data-act="again"]').count()) ? ended || Date.now() : null;
    if (ended && Date.now() - ended > END_STAY_MS) {
      await page.getByRole('button', { name: 'Leave' }).click();
      reason = 'after the game';
      break;
    }
    if (Date.now() - since > READY_AFTER_MS) {
      const proceed = page.getByRole('button', { name: 'Continue' });
      if (await proceed.count()) await proceed.click();
      // Never the Yes stamped START (the one that would start the game): the start, and in a
      // first game "Is everyone here?", stay the person's.
      const yes = page.locator('[data-act="yes"]:not([data-start])');
      if (await yes.count() && await yes.isEnabled()) await yes.click();
    }
    // Read without waiting: a locator would wait for a photo the lobby does not show. The
    // round on screen is the one its photo carries (`data-round`, views/game.js).
    const round = await page.evaluate(() => document.querySelector('[data-round]')?.dataset.round || null);
    const options = page.locator('[data-act="answer"]:not([disabled])');
    if (round && round !== lastRound && await options.count()) {
      await pause(1500 + Math.random() * 3000);
      const n = await options.count();
      if (n) await options.nth(Math.floor(Math.random() * n)).click().catch(() => {});
      lastRound = round;
    }
  }
  console.log(`${avatar} ${name} left (${reason})`);
  await page.context().close();
}

const browser = await chromium.launch();
const library = await drawLibrary(browser);
const players = [];
// The first player looks for the game on each server in turn; the rest follow it there.
let server = null;
for (const candidate of servers) {
  const first = await join(browser, library, nameOf(0), candidate);
  if (typeof first !== 'string') {
    server = candidate;
    players.push([first, nameOf(0)]);
    console.log(`${code} is on ${candidate}`);
    break;
  }
  console.log(`${candidate}: ${first}`);
  if (first !== NO_SUCH_GAME) break;
}
for (let i = 1; server && i < wanted; i++) {
  const page = await join(browser, library, nameOf(i), server);
  if (typeof page === 'string') {
    console.log(`${nameOf(i).join(' ')} could not join: ${page}`);
    break;
  }
  players.push([page, nameOf(i)]);
}
if (players.length) console.log(`${players.length} in ${code}; they say Yes to their photos in half a minute.`);
const since = Date.now();
await Promise.all(players.map(([page, who]) => play(page, who, since)));
await browser.close();
