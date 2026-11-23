/**
 * A game at phone speed: what the players wait for, measured on every run.
 *
 * One phone ("Ann", the host) behaves like a real one (`realPhone` in `fake-phone.js`): a
 * library of 400 photos at real sizes, the time its plugin takes per photo, a quarter of the
 * photos kept only in iCloud, its processor slowed to a phone's (Chromium's CPU throttling)
 * and a phone network's delay. Two more app phones and five light bots (`bots.js`) fill the
 * table, so the room and the sockets carry what a real group causes. The test plays the
 * lobby (the first set, "No" SKIPS times a glance apart, more sets than the bucket held at
 * first, holding a photo, "Yes") and a short game, and prints what each step took: the
 * lobby's waits, the 3-2-1 as it was painted,
 * how long the room waited for phones, when each photo appeared, how many messages went
 * each way and how long the page was blocked.
 *
 * The numbers come from the page itself (`measure`, an init script: arrival of every view,
 * the 3-2-1's numbers, each round's photo on screen, the page's long tasks) and from the
 * sockets as Playwright sees them.
 *
 * Then it holds them to `LIMITS`, each a promise to the players (nobody waits for photos,
 * the 3-2-1 counts cleanly, the room never waits for a phone that kept up, no phone floods
 * the others). The limits sit well above what a healthy run measures, so they catch a real
 * slowdown, not a busy computer.
 */
import { expect, test } from '@playwright/test';
import { addBots } from './bots.js';
import { library, newPhone, realPhone } from './fake-phone.js';

/** How much slower the measured phone's processor runs than this computer's. */
const CPU_SLOWDOWN = 4;
/** A phone network: delay each way and throughput (bytes per second). */
const NETWORK = { offline: false, latency: 60, downloadThroughput: 2_500_000, uploadThroughput: 700_000 };
const ROUNDS = 5;
/** How often Ann taps "No" in a row, and how long she glances at each set first. */
const SKIPS = 20;
const GLANCE_MS = 1000;

/** What the players may wait at most (ms), and how much the phones may send and do. */
const LIMITS = {
  firstSet: 2000,
  /** "No" is instant: the next set is already in the bucket (a wait would show it dimmed under a spinner). */
  no: 250,
  /** The preview shows at once; the sharp version follows (a photo kept only in iCloud downloads first). */
  heldPreview: 500,
  heldSharp: 5000,
  yes: 3000,
  /** How long the room may stand in `load` (or a leaderboard wait) for phones that all kept up. */
  roomWait: 1000,
  board: { min: 4900, max: 5600 },
  photoPainted: 300,
  /** Readiness reports per phone: one per round. */
  loaded: ROUNDS + 1,
  viewsInCountdown: 4,
  blockedInGame: 500,
};

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

test('a game at phone speed: what the players wait for stays within its limits', async ({ browser, baseURL }) => {
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
  // "No" again and again, right from the first set: a glance at each set, then "No". Far
  // more sets than the bucket held at the start, so nearly every one comes from the bucket
  // refilling while Ann looks, next to the big versions of the set on screen.
  report.no = [];
  for (let i = 0; i < SKIPS; i++) {
    await host.waitForTimeout(GLANCE_MS);
    const before = await firstTile(host);
    await host.getByRole('button', { name: 'No' }).click();
    report.no.push(await msUntil(host, ([sel, style]) => { const el = document.querySelector(sel); return Boolean(el) && el.getAttribute('style') !== style; }, [TILE, before]));
  }
  for (const name of ['Ben', 'Cleo']) {
    const phone = await openPhone(browser, name, { photos: library });
    await phone.page.fill('#code', code);
    await phone.page.getByRole('button', { name: 'Join', exact: true }).click();
    others.push(phone);
  }
  const bots = await addBots(baseURL, code, 5);
  try {
    for (const { page } of others) {
      await page.getByRole('button', { name: 'Continue' }).click();
      await page.getByRole('button', { name: 'Yes' }).click();
      await expect(page.getByText('✓ Ready')).toBeVisible();
    }
    // Holding a photo: its preview at once (the hold starts after 350 ms, `main.js` HOLDS),
    // then its sharp version above it.
    const box = await host.locator('[data-act="swap"]').nth(1).boundingBox();
    await host.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await host.mouse.down();
    report.preview = Math.max(0, (await msUntil(host, () => document.querySelectorAll('#look img').length >= 1)) - 350);
    report.sharp = report.preview + (await msUntil(host, () => document.querySelectorAll('#look img').length >= 2));
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
    roomWaits: game.filter((p) => p.label.startsWith('load') || p.label.includes('waiting')).map((p) => ({ label: p.label, ms: p.ms ?? 0 })),
    boards: game.filter((p) => p.label.startsWith('board') && !p.label.includes('waiting')).map((p) => p.ms),
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
    `  "No" ${SKIPS} times, a glance apart     ${report.no.join(', ')} ms`,
    `  holding a photo: preview, sharp     ${report.preview} ms, ${report.sharp} ms`,
    `  "Yes" until the 3-2-1               ${report.yes} ms`,
    `  the 3-2-1 as painted                ${report.countdown}`,
    `  the room waiting for phones         ${report.roomWaits.map((w) => `${w.label} ${w.ms} ms`).join(', ') || 'never'}`,
    `  leaderboards                        ${report.boards.join(', ')} ms`,
    `  photo on screen after its round     ${report.photoPainted.join(', ')} ms`,
    `  "loaded" sent (Ann, Ben, Cleo)      ${report.loadedSent.join(', ')}`,
    `  views Ann got (during the 3-2-1)    ${report.viewsAll} (${report.viewsInCountdown})`,
    `  page blocked during the game        ${report.blockedInGame} ms (longest task ${report.longestTask} ms)`,
    `  phone work                          ${report.phoneWork.previews} previews, ${report.phoneWork.bigVersions} big versions`,
  ].join('\n'));

  // The promises (`LIMITS`), checked after the report so a failure shows all the numbers.
  expect(report.firstSet, 'the first set').toBeLessThanOrEqual(LIMITS.firstSet);
  for (const ms of report.no) expect(ms, '"No"').toBeLessThanOrEqual(LIMITS.no);
  expect(report.preview, 'a held photo\'s preview').toBeLessThanOrEqual(LIMITS.heldPreview);
  expect(report.sharp, 'a held photo turning sharp').toBeLessThanOrEqual(LIMITS.heldSharp);
  expect(report.yes, '"Yes" until the 3-2-1').toBeLessThanOrEqual(LIMITS.yes);
  expect(report.countdown, 'the 3-2-1, each number once').toBe('3 2 1');
  for (const w of report.roomWaits) expect(w.ms, `the room waiting (${w.label})`).toBeLessThanOrEqual(LIMITS.roomWait);
  for (const ms of report.boards) {
    expect(ms, 'a leaderboard').toBeGreaterThanOrEqual(LIMITS.board.min);
    expect(ms, 'a leaderboard').toBeLessThanOrEqual(LIMITS.board.max);
  }
  for (const ms of report.photoPainted) expect(ms, 'a photo on screen after its round started').toBeLessThanOrEqual(LIMITS.photoPainted);
  for (const n of report.loadedSent) expect(n, '"loaded" reports of one phone').toBeLessThanOrEqual(LIMITS.loaded);
  expect(report.viewsInCountdown, 'views during the 3-2-1').toBeLessThanOrEqual(LIMITS.viewsInCountdown);
  expect(report.blockedInGame, 'the page blocked during the game').toBeLessThanOrEqual(LIMITS.blockedInGame);
});
