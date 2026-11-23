/**
 * A stand-in for the store apps' native `Phone` plugin (web/js/phone.js), so the
 * end-to-end tests play the real app UI in a browser. Each test phone gets the fixture
 * photos as its "library"; photo access starts as "ask" and becomes "full" when the app
 * asks, like a player tapping "Allow all" on a real phone. A stand-in for Capacitor's
 * Haptics plugin writes down what the phone would feel (`window.felt`: an impact's
 * strength, or a vibration as "120 ms"), and every big version the app asks for
 * (`window.pulled`, with its `download` switch) and how many previews it was handed
 * (`window.previewed`). Everything else of the app (screens, sockets, uploads, server) is
 * the real thing.
 *
 * By default the stand-in is instant and its photos are tiny, which keeps the game tests
 * quick. The speed test (`speed.spec.js`) makes it behave like a real phone instead
 * (`realPhone`): a library of hundreds of photos, previews and big versions of a real
 * phone's sizes, and the time a phone takes to make each one on its own threads.
 */
import fs from 'node:fs';
import path from 'node:path';
import jpeg from 'jpeg-js';
import { LIMITS } from '../../web/shared/config.js';

const FIXTURES = path.join(import.meta.dirname, '..', 'fixtures');

/** The fixture JPEGs as base64, the way the native plugin hands photos over. */
export const library = [1, 2, 3, 4, 5, 6].map((i) => fs.readFileSync(path.join(FIXTURES, `photo-${i}.jpg`)).toString('base64'));

/**
 * A photo-like JPEG (soft shapes and fine grain, so it compresses like a camera photo) of
 * `width` x `height` at `quality` (0 to 1), as base64.
 */
function photoLike(width, height, quality) {
  const data = Buffer.alloc(width * height * 4);
  let seed = 7;
  const grain = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return (seed % 41) - 20;
  };
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const wave = Math.sin(x / 37) * Math.cos(y / 53) * 60;
      data[i] = Math.max(0, Math.min(255, 120 + wave + (x / width) * 90 + grain()));
      data[i + 1] = Math.max(0, Math.min(255, 110 - wave + (y / height) * 80 + grain()));
      data[i + 2] = Math.max(0, Math.min(255, 140 + wave / 2 + grain()));
      data[i + 3] = 255;
    }
  }
  return jpeg.encode({ data, width, height }, Math.round(quality * 100)).data.toString('base64');
}

/**
 * How a mid-range phone with a full library behaves, for the speed test: `size` photos,
 * every preview and big version at the sizes the app asks the real plugin for
 * (LIMITS.previewSide and LIMITS.photoMaxSide, portrait), the time the phone takes per
 * preview and per big version on its own threads (decoding the original, shrinking,
 * encoding), access already given (a returning player), and every fourth photo kept only in
 * iCloud ("Optimize iPhone Storage"): its big version is not on the phone and takes seconds
 * to download. Magnitudes, not exact numbers: a real phone varies with the photo, its
 * storage and its connection.
 */
export function realPhone(size = 400) {
  const preview = photoLike(Math.round(LIMITS.previewSide * 0.75), LIMITS.previewSide, LIMITS.previewQuality);
  const big = photoLike(Math.round(LIMITS.photoMaxSide * 0.75), LIMITS.photoMaxSide, LIMITS.photoQuality);
  return { photos: [big], preview, size, previewMs: 40, photoMs: 200, access: 'full', cloud: { every: 4, ms: 3000 } };
}

/**
 * Runs in the page before the app (a Playwright init script): it must be self-contained.
 * Also used by the store images and the demo players (scripts/helpers/) with drawn photos.
 * `photos` are base64 JPEGs, or `{ data, screenshot }` for a photo the phone marks as a
 * screenshot; the library has `size` photos (the given ones repeat). A photo serves as its
 * own preview and upload unless `preview` is given (every preview then is that JPEG, as a
 * real phone hands over small ones). `previewMs` and `photoMs` are how long the phone takes
 * per preview and per big version; `access` is the photo access at the start; with `cloud`,
 * every `every`th photo is kept only in iCloud: its big version fails without the download
 * and takes `ms` longer with it, like the iPhone plugin's `photo`.
 */
export function installFakePhone({ photos, size = photos.length, preview = null, previewMs = 0, photoMs = 0, access: initial = 'ask', cloud = null }) {
  let access = initial;
  window.felt = [];
  /** Every big version the app asked for, and whether it allowed a download: { id, download }. */
  window.pulled = [];
  window.previewed = 0;
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const library = Array.from({ length: size }, (_, i) => {
    const p = photos[i % photos.length];
    return { id: `photo-${i + 1}`, data: typeof p === 'string' ? p : p.data, screenshot: Boolean(p.screenshot), inCloud: Boolean(cloud) && (i + 1) % cloud.every === 0 };
  });
  window.Capacitor = {
    Plugins: {
      Phone: {
        photoAccess: async () => ({ access }),
        requestPhotoAccess: async () => {
          access = 'full';
          return { access };
        },
        randomPhotos: async ({ count, exclude }) => {
          if (access === 'ask') return { photos: [] };
          const skip = new Set(exclude);
          const free = library.filter((p) => !skip.has(p.id)).sort(() => Math.random() - 0.5).slice(0, count);
          await wait(previewMs * free.length);
          window.previewed += free.length;
          return { photos: free.map((p) => ({ id: p.id, data: preview || p.data, screenshot: p.screenshot })) };
        },
        photo: async ({ id, download = true }) => {
          window.pulled.push({ id, download });
          const found = library.find((p) => p.id === id);
          if (found && found.inCloud && !download) throw new Error('unreadable');
          await wait(photoMs + (found && found.inCloud ? cloud.ms : 0));
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

/**
 * A new phone: its own browser context (own storage), with the fake plugin installed;
 * `phone` is its setup (`installFakePhone`: the photos, or a `realPhone`), `options` the
 * context's own (a `viewport` for another phone size).
 */
export async function newPhone(browser, phone = { photos: library }, options = {}) {
  const context = await browser.newContext(options);
  await context.addInitScript(installFakePhone, phone);
  return context.newPage();
}
