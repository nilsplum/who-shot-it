/**
 * A game at phone speed: what the players wait for, measured on every run.
 *
 * One phone ("Ann", the host) behaves like a real one (`realPhone` in `fake-phone.js`): a
 * library of 400 photos at real sizes, the time its plugin takes per photo, a quarter of the
 * photos kept only in iCloud, its processor slowed to a phone's (Chromium's CPU throttling)
 * and a phone network's delay. Two more app phones and five light bots (`bots.js`) fill the
 * table, so the room and the sockets carry what a real group causes. The test plays the
 * lobby (the first set, "No" tapped as fast as new sets come, holding a photo, "Yes") and a
 * short game, and prints what each step took: the lobby's waits, the 3-2-1 as it was painted,
 * how long the room waited for phones, when each photo appeared, how many messages went
 * each way and how long the page was blocked.
 *
 * The numbers come from the page itself (`measure`, an init script: arrival of every view,
 * the 3-2-1's numbers, each round's photo on screen, the page's long tasks) and from the
 * sockets as Playwright sees them.
 */
import { expect, test } from '@playwright/test';
import { addBots } from './bots.js';
import { library, newPhone, realPhone } from './fake-phone.js';

/** How much slower the measured phone's processor runs than this computer's. */
const CPU_SLOWDOWN = 4;
/** A phone network: delay each way and throughput (bytes per second). */
const NETWORK = { offline: false, latency: 60, downloadThroughput: 2_500_000, uploadThroughput: 700_000 };
const ROUNDS = 5;

/** Runs in the page before the app: notes what the player would wait for (`window.measure`). */
function measure() {
  const now = () => Math.round(performance.timeOrigin + performance.now());
  const m = { long: [], cover: [], views: [], painted: [] };
  window.measure = m;
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) m.long.push([Math.round(performance.timeOrigin + e.startTime), Math.round(e.duration)]);
    }).observe({ type: 'longtask', buffered: true });
  } catch {}
  // Every view as the page handles it: when, which phase and round, whether the room waits.
  const Native = window.WebSocket;
  window.WebSocket = class extends Native {
    constructor(...args) {
      super(...args);
      this.addEventListener('message', (e) => {
        if (e.data === 'pong') return;
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === 'state') m.views.push([now(), msg.view.phase, msg.view.round ? msg.view.round.n : 0, Boolean(msg.view.waiting)]);
        } catch {}
      });
    }
  };
  document.addEventListener('DOMContentLoaded', () => {
    const cover = document.getElementById('cover');
    new MutationObserver(() => {
      const n = cover.textContent.trim();
      if (n) m.cover.push([now(), n]);
    }).observe(cover, { childList: true, subtree: true, characterData: true });
    // Each round's photo, the moment it is on screen (`data-round` comes with the photo, views/game.js).
    let last = null;
    new MutationObserver(() => {
      const shown = document.querySelector('[data-part="stage"] [data-round]');
      if (shown && shown.dataset.round !== last) {
        last = shown.dataset.round;
        m.painted.push([now(), Number(last)]);
      }
    }).observe(document.getElementById('app'), { childList: true, subtree: true });
  });
}

/** A phone that has accepted the terms and typed its name, with the network delay and, if asked, the slow processor. */
async function openPhone(browser, name, setup, { cpu = 1 } = {}) {
  const page = await newPhone(browser, setup, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await page.context().addInitScript(measure);
  const cdp = await page.context().newCDPSession(page);
  if (cpu > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', NETWORK);
  const sent = [];
  page.on('websocket', (ws) => ws.on('framesent', (f) => {
    try {
      sent.push(JSON.parse(f.payload).type);
    } catch {}
  }));
  await page.goto('/');
  await page.getByRole('button', { name: 'I agree, let’s play' }).click();
  await page.fill('#name', name);
  return { page, sent };
}

/** Milliseconds until `check` (run in the page) holds, or the limit if it never does. */
async function msUntil(page, check, arg, limit = 30_000) {
  const start = Date.now();
  await page.waitForFunction(check, arg, { polling: 50, timeout: limit }).catch(() => {});
  return Date.now() - start;
}

const TILE = '[data-act="swap"] [style*="background-image"]';
const firstTile = (page) => page.locator(TILE).first().getAttribute('style');

test('a game at phone speed: what the players wait for', async ({ browser, baseURL }) => {
  const report = {};
  const ann = await openPhone(browser, 'Ann', realPhone(), { cpu: CPU_SLOWDOWN });
  const host = ann.page;
  const others = [];
  await host.getByRole('button', { name: 'Create game' }).click();
  await host.getByRole('button', { name: 'Custom' }).click();
  await host.locator('[data-k="photos"][data-v="9"]').click();
  await host.locator(`[data-k="rounds"][data-v="${ROUNDS}"]`).click();
  await host.locator('[data-k="time"][data-v="5"]').click();
  await host.getByRole('button', { name: 'Done' }).click();
  await host.getByRole('button', { name: 'Start game' }).click();
  const code = (await host.locator('[data-act="invite"]').innerText()).replace(/\s/g, '');
  // Ann's phone may read photos already, so the lobby deals her set at once.
  report.firstSet = await msUntil(host, (sel) => Boolean(document.querySelector(sel)), TILE);
  for (const name of ['Ben', 'Cleo']) {
    const phone = await openPhone(browser, name, { photos: library });
    await phone.page.fill('#code', code);
    await phone.page.getByRole('button', { name: 'Join', exact: true }).click();
    others.push(phone);
  }
  const bots = await addBots(baseURL, code, 5);
  try {
    // "No", tapped again as soon as each new set is there.
    report.no = [];
    for (let i = 0; i < 3; i++) {
      const before = await firstTile(host);
      await host.getByRole('button', { name: 'No' }).click();
      report.no.push(await msUntil(host, ([sel, style]) => { const el = document.querySelector(sel); return Boolean(el) && el.getAttribute('style') !== style; }, [TILE, before]));
    }
    for (const { page } of others) {
      await page.getByRole('button', { name: 'Continue' }).click();
      await page.getByRole('button', { name: 'Yes' }).click();
      await expect(page.getByText('✓ Ready')).toBeVisible();
    }
    // Holding a photo: until its sharp version is above the preview.
    const box = await host.locator('[data-act="swap"]').nth(1).boundingBox();
    await host.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await host.mouse.down();
    report.sharp = await msUntil(host, () => document.querySelectorAll('#look img').length >= 2);
    await host.mouse.up();
    // Yes: Ann is the last one, so her photos being sent starts the 3-2-1.
    await host.getByRole('button', { name: 'Yes' }).click();
    report.yes = await msUntil(host, () => document.getElementById('cover').textContent.trim() !== '', null, 60_000);
    // The game: everyone answers each photo at once, so the rounds run on the room's own timers.
    for (let round = 1; round <= ROUNDS; round++) {
      await expect(host.getByText(`${round} / ${ROUNDS}`, { exact: true })).toBeVisible({ timeout: 60_000 });
      // A phone that is too late for a round (its time ran out) simply misses it; the room goes on.
      for (const { page } of [ann, ...others]) await page.locator('[data-act="answer"]:not([disabled])').first().click({ timeout: 10_000 }).catch(() => {});
    }
    await expect(host.getByRole('list', { name: 'Podium' })).toBeVisible({ timeout: 60_000 });
  } finally {
    bots.close();
  }

  const m = await host.evaluate(() => window.measure);
  // The room's phases as Ann's phone got them, and how long each lasted.
  const phases = [];
  for (const [at, phase, n, waiting] of m.views) {
    const label = `${phase}${n ? ` ${n}` : ''}${waiting ? ' (waiting)' : ''}`;
    if (!phases.length || phases[phases.length - 1].label !== label) phases.push({ label, at });
  }
  phases.forEach((p, i) => {
    p.ms = phases[i + 1] ? phases[i + 1].at - p.at : null;
  });
  const countdown = phases.find((p) => p.label === 'countdown');
  const game = phases.filter((p) => countdown && p.at >= countdown.at);
  const showAt = new Map(game.filter((p) => p.label.startsWith('show ')).map((p) => [Number(p.label.split(' ')[1]), p.at]));
  const blocked = (from) => m.long.filter(([at]) => at >= from).reduce((sum, [, ms]) => sum + Math.max(0, ms - 50), 0);
  Object.assign(report, {
    countdown: m.cover.filter(([at]) => countdown && at >= countdown.at - 300).map(([, n]) => n).join(' '),
    roomWaits: game.filter((p) => p.label.startsWith('load') || p.label.includes('waiting')).map((p) => `${p.label} ${p.ms ?? '?'} ms`),
    boards: game.filter((p) => p.label.startsWith('board')).map((p) => p.ms),
    photoPainted: m.painted.filter(([, n]) => showAt.has(n)).map(([at, n]) => at - showAt.get(n)),
    loadedSent: [ann, ...others].map((p) => p.sent.filter((type) => type === 'loaded').length),
    viewsInCountdown: m.views.filter(([, phase]) => phase === 'countdown').length,
    viewsAll: m.views.length,
    blockedInGame: countdown ? blocked(countdown.at) : null,
    longestTask: Math.max(0, ...m.long.map(([, ms]) => ms)),
    phoneWork: await host.evaluate(() => ({ previews: window.previewed, bigVersions: window.pulled.length })),
  });
  console.log([
    'A game at phone speed (Ann: CPU / 4, 60 ms network, 400 photos, a quarter only in iCloud):',
    `  first set after entering the lobby  ${report.firstSet} ms`,
    `  each "No", tapped right away        ${report.no.join(', ')} ms`,
    `  holding a photo until it is sharp   ${report.sharp} ms`,
    `  "Yes" until the 3-2-1               ${report.yes} ms`,
    `  the 3-2-1 as painted                ${report.countdown}`,
    `  the room waiting for phones         ${report.roomWaits.join(', ') || 'never'}`,
    `  leaderboards                        ${report.boards.join(', ')} ms`,
    `  photo on screen after its round     ${report.photoPainted.join(', ')} ms`,
    `  "loaded" sent (Ann, Ben, Cleo)      ${report.loadedSent.join(', ')}`,
    `  views Ann got (during the 3-2-1)    ${report.viewsAll} (${report.viewsInCountdown})`,
    `  page blocked during the game        ${report.blockedInGame} ms (longest task ${report.longestTask} ms)`,
    `  phone work                          ${report.phoneWork.previews} previews, ${report.phoneWork.bigVersions} big versions`,
  ].join('\n'));
});
