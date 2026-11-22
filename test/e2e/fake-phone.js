/**
 * A stand-in for the store apps' native `Phone` plugin (web/js/phone.js), so the
 * end-to-end tests play the real app UI in a browser. Each test phone gets the fixture
 * photos as its "library"; photo access starts as "ask" and becomes "full" when the app
 * asks, like a player tapping "Allow all" on a real phone. A stand-in for Capacitor's
 * Haptics plugin writes down what the phone would feel (`window.felt`: an impact's
 * strength, or a vibration as "120 ms"), and every big version the app asks for
 * (`window.pulled`, with its `download` switch). Everything else of the app (screens,
 * sockets, uploads, server) is the real thing.
 */
import fs from 'node:fs';
import path from 'node:path';

const FIXTURES = path.join(import.meta.dirname, '..', 'fixtures');

/** The fixture JPEGs as base64, the way the native plugin hands photos over. */
export const library = [1, 2, 3, 4, 5, 6].map((i) => fs.readFileSync(path.join(FIXTURES, `photo-${i}.jpg`)).toString('base64'));

/**
 * Runs in the page before the app (a Playwright init script): it must be self-contained.
 * Also used by the store images and the demo players (scripts/helpers/) with drawn photos.
 * `photos` are base64 JPEGs, or `{ data, screenshot }` for a photo the phone marks as a
 * screenshot. A photo serves as its own preview and upload.
 */
export function installFakePhone(photos) {
  let access = 'ask';
  window.felt = [];
  /** Every big version the app asked for, and whether it allowed a download: { id, download }. */
  window.pulled = [];
  const library = photos.map((p, i) => ({ id: `photo-${i + 1}`, data: typeof p === 'string' ? p : p.data, screenshot: Boolean(p.screenshot) }));
  window.Capacitor = {
    Plugins: {
      Phone: {
        photoAccess: async () => ({ access }),
        requestPhotoAccess: async () => {
          access = 'full';
          return { access };
        },
        randomPhotos: async ({ count, exclude }) => {
          const free = library.filter((p) => !exclude.includes(p.id)).sort(() => Math.random() - 0.5);
          return { photos: access === 'ask' ? [] : free.slice(0, count) };
        },
        photo: async ({ id, download }) => {
          window.pulled.push({ id, download });
          const found = library.find((p) => p.id === id);
          if (!found) throw new Error('unreadable');
          return { id, data: found.data };
        },
        openSettings: async () => {},
        keepAwake: async () => {},
      },
      Haptics: {
        impact: async ({ style }) => {
          window.felt.push(style);
        },
        vibrate: async ({ duration }) => {
          window.felt.push(`${duration} ms`);
        },
      },
    },
  };
}

/** A new phone: its own browser context (own storage), with the fake plugin and `photos` installed. */
export async function newPhone(browser, photos = library) {
  const context = await browser.newContext();
  await context.addInitScript(installFakePhone, photos);
  return context.newPage();
}
