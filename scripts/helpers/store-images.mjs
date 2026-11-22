/**
 * Draws the store screenshots into `store/images/app-store/` and `store/images/google-play/`:
 * each one a short headline, one plain sentence and the matching app screen in a phone
 * frame, in the order a new player needs to understand the game (store/listing.md). Run by
 * `./scripts/release-apps.sh --store-images` when the app's look changes; uploaded by hand.
 *
 * The app screens are real: three phones play a game against a local server (its own
 * `wrangler dev` on a free port), using the end-to-end tests' fake photo plugin
 * (`test/e2e/fake-phone.js`) with drawn stand-in photos (`demo-photos.mjs`), so the
 * images show nobody's private pictures and need no image licence.
 * Colours come from the icon and the app's theme (`colours.mjs`); the headline font is the app's own.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { installFakePhone } from '../../test/e2e/fake-phone.js';
import { colour } from './colours.mjs';
import { drawLibrary } from './demo-photos.mjs';

const ROOT = path.join(import.meta.dirname, '..', '..');
const OUT = path.join(ROOT, 'store', 'images');
const PORT = 8797;
const BASE = `http://localhost:${PORT}`;

/**
 * The captions, in order: what the game is, where the photos come from, the fun part,
 * the options, and the answer to "who sees my photos?". Short, plain, no dashes.
 */
const SLIDES = [
  { screen: 'guess', title: 'Whose photo is it?', text: 'Random photos from everyone’s phone. Tap who took it.' },
  { screen: 'photos', title: 'Bring your photos', text: 'The app picks a few at random. Tap No for new ones, Yes when you like them.' },
  { screen: 'board', title: 'Fast and right wins', text: 'See who guessed what. Then laugh about it.' },
  { screen: 'newgame', title: 'Play it your way', text: 'Classic, or photos that start blurry, zoomed in or pixelated.' },
  { screen: 'yours', title: 'Your photos stay yours', text: 'Nothing is shared until you tap Yes. Each photo is deleted after its round.' },
];

/** The stores' sizes: App Store 6.9 inch iPhone (1290 x 2796), Google Play phone (1080 x 2160). */
const STORES = [
  { dir: 'app-store', width: 430, height: 932 },
  { dir: 'google-play', width: 360, height: 720 },
];
const SCALE = 3;
/** The app screens are taken at this phone size, then shown in the frame. */
const PHONE = { width: 390, height: 844 };

const icon = fs.readFileSync(path.join(ROOT, 'web/icons/icon.svg'), 'utf8');
const [from, to] = [...icon.matchAll(/stop-color="(#[0-9a-fA-F]{6})"/g)].map((m) => m[1]);
const fontData = (file) => fs.readFileSync(path.join(ROOT, 'web/fonts', file)).toString('base64');

async function waitForServer() {
  for (let i = 0; i < 120; i++) {
    try {
      if ((await fetch(BASE)).ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error('the local server did not start');
}

async function phone(browser, library, name, avatar) {
  const context = await browser.newContext({ viewport: PHONE, deviceScaleFactor: SCALE, isMobile: true, hasTouch: true });
  await context.addInitScript(installFakePhone, library);
  await context.addInitScript(([n, a]) => localStorage.setItem('whoshotit', JSON.stringify({ name: n, avatar: a })), [name, avatar]);
  const page = await context.newPage();
  await page.goto(BASE);
  await page.getByRole('button', { name: 'I agree, let’s play' }).click();
  return page;
}

/** Plays a short game and takes one screen per slide (PNG buffers by screen name). */
async function takeScreens(browser, library) {
  const screens = {};
  const snap = async (page, name) => {
    await page.waitForTimeout(500);
    screens[name] = await page.screenshot();
  };
  const host = await phone(browser, library, 'Mia', '🦊');
  await host.getByRole('button', { name: 'Create game' }).click();
  await host.getByRole('button', { name: /Tricky/ }).click();
  await snap(host, 'newgame');
  await host.getByRole('button', { name: /Classic/ }).click();
  // Four photos each: the drawn library fills a 2 x 2 choice with big tiles.
  await host.getByRole('button', { name: 'Custom' }).click();
  await host.locator('[data-k="photos"][data-v="4"]').click();
  await host.getByRole('button', { name: 'Done' }).click();
  await host.getByRole('button', { name: 'Start game' }).click();
  await snap(host, 'yours');
  const code = (await host.locator('[data-act="invite"]').innerText()).replace(/\s/g, '');
  const guests = [];
  for (const [name, avatar] of [['Leo', '🐼'], ['Zoe', '🦄']]) {
    const page = await phone(browser, library, name, avatar);
    await page.fill('#code', code);
    await page.getByRole('button', { name: 'Join', exact: true }).click();
    guests.push(page);
  }
  const everyone = [host, ...guests];
  for (const page of everyone) {
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.locator('[data-act="swap"]').nth(3).waitFor();
  }
  await snap(host, 'photos');
  for (const page of everyone) await page.getByRole('button', { name: 'Yes' }).click();
  await host.locator('[data-part="stage"] img').waitFor({ timeout: 30000 });
  await guests[0].locator('[data-act="answer"]').first().click();
  await snap(host, 'guess');
  // Everyone picks a different player (Leo already took the first), so exactly one guess
  // is right and the leaderboard shows both a ✓ with points and a ✗.
  await host.locator('[data-act="answer"]').nth(1).click();
  await guests[1].locator('[data-act="answer"]').nth(2).click();
  await host.locator('[data-part="board"] > *').first().waitFor({ timeout: 20000 });
  await host.waitForTimeout(1500);
  await snap(host, 'board');
  for (const page of everyone) await page.context().close();
  return screens;
}

/** One store image: headline, sentence, and the screen in a phone frame. */
function slideHtml(slide, screen, store) {
  const frameWidth = Math.round(store.width * 0.74);
  return `<style>
    @font-face { font-family: B; src: url(data:font/woff2;base64,${fontData('bricolage-grotesque-800.woff2')}); }
    @font-face { font-family: I; src: url(data:font/woff2;base64,${fontData('inter-variable.woff2')}); font-weight: 100 900; }
    body { margin: 0; width: ${store.width}px; height: ${store.height}px; overflow: hidden; background: linear-gradient(160deg, ${from}, ${to});
      display: flex; flex-direction: column; align-items: center; color: ${colour('white')}; font-family: I; }
    h1 { font: 800 ${Math.round(store.width * 0.095)}px/1.05 B; letter-spacing: -1px; margin: ${Math.round(store.height * 0.06)}px 24px 0; text-align: center; text-wrap: balance; }
    p { font-weight: 600; font-size: ${Math.round(store.width * 0.047)}px; line-height: 1.35; margin: 14px 32px 0; text-align: center; text-wrap: balance; opacity: .92; }
    .phone { margin-top: ${Math.round(store.height * 0.04)}px; width: ${frameWidth}px; border-radius: ${Math.round(frameWidth * 0.12)}px; padding: ${Math.round(frameWidth * 0.03)}px;
      background: ${colour('navy')}; box-shadow: 0 24px 60px color-mix(in srgb, ${colour('stage')} 35%, transparent); }
    .phone img { display: block; width: 100%; border-radius: ${Math.round(frameWidth * 0.095)}px; }
  </style><h1>${slide.title}</h1><p>${slide.text}</p>
  <div class="phone"><img src="data:image/png;base64,${screen.toString('base64')}"></div>`;
}

const state = path.join(ROOT, '.wrangler', 'store-images');
fs.rmSync(state, { recursive: true, force: true });
const server = spawn('npx', ['wrangler', 'dev', '--port', String(PORT), '--persist-to', state], { cwd: ROOT, stdio: 'ignore' });
try {
  await waitForServer();
  const browser = await chromium.launch();
  const screens = await takeScreens(browser, await drawLibrary(browser));
  for (const store of STORES) {
    const dir = path.join(OUT, store.dir);
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
    const page = await browser.newPage({ viewport: { width: store.width, height: store.height }, deviceScaleFactor: SCALE });
    for (const [i, slide] of SLIDES.entries()) {
      await page.setContent(slideHtml(slide, screens[slide.screen], store));
      await page.waitForTimeout(200);
      await page.screenshot({ path: path.join(dir, `${i + 1}-${slide.screen}.png`) });
    }
    await page.close();
  }
  await browser.close();
  console.log(`✓ Store screenshots in store/images/ (${STORES.map((s) => s.dir).join(', ')})`);
} finally {
  server.kill();
}
