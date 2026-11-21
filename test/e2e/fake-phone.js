/**
 * A stand-in for the store apps' native `Phone` plugin (web/js/phone.js), so the
 * end-to-end tests play the real app UI in a browser. Each test phone gets the fixture
 * photos as its "library"; photo access starts as "ask" and becomes "full" when the app
 * asks, like a player tapping "Allow all" on a real phone. Everything else of the app
 * (screens, sockets, uploads, server) is the real thing.
 */
import fs from 'node:fs';
import path from 'node:path';

const FIXTURES = path.join(import.meta.dirname, '..', 'fixtures');

/** The fixture JPEGs as base64, the way the native plugin hands photos over. */
export const library = [1, 2, 3, 4, 5, 6].map((i) => fs.readFileSync(path.join(FIXTURES, `photo-${i}.jpg`)).toString('base64'));

/** Runs in the page before the app (a Playwright init script): it must be self-contained. */
function installFakePhone(photos) {
  let access = 'ask';
  window.Capacitor = {
    Plugins: {
      Phone: {
        photoAccess: async () => ({ access }),
        requestPhotoAccess: async () => {
          access = 'full';
          return { access };
        },
        randomPhoto: async ({ exclude }) => {
          const free = photos.map((data, i) => ({ id: `photo-${i + 1}`, data })).filter((p) => !exclude.includes(p.id));
          return free.length ? free[Math.floor(Math.random() * free.length)] : {};
        },
        openSettings: async () => {},
        keepAwake: async () => {},
      },
    },
  };
}

/** A new phone: its own browser context (own storage), with the fake plugin installed. */
export async function newPhone(browser) {
  const context = await browser.newContext();
  await context.addInitScript(installFakePhone, library);
  return context.newPage();
}
