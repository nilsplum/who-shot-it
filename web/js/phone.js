/**
 * Everything the app needs from the phone, in one place: photo access, random previews
 * and the chosen photos,
 * keeping the screen on and opening the app's settings (the app's own native plugin
 * `Phone`, `docs/apps.md`), the share sheet, invite links and the Android back button
 * (Capacitor's official App and Share plugins), and where the server is.
 *
 * Mechanisms: inside the store apps Capacitor injects `window.Capacitor` with a proxy per
 * native plugin. The same page opened in a plain browser has no `Phone` plugin: it is the
 * website then, and `main.js` shows the invite page instead of the game (`inApp`). The
 * end-to-end tests inject a fake `Phone` plugin, so they play the real UI in a browser.
 *
 * Invariants:
 * - Photos are picked, shrunk and re-encoded on the phone (JPEG, location and all other
 *   data dropped): small previews (LIMITS.previewSide) to choose from, which never leave
 *   the phone, and the chosen photos (LIMITS.photoMaxSide), which leave it only through
 *   `uploadPhotos` after the player taps "Yes".
 * - The app's own page runs at one of `SERVER.appOrigins` and talks to `SERVER.origin`;
 *   anywhere else (the website, local development, the tests) it talks to the origin it
 *   came from. `serverOrigin` and `codeFromLink` are pure, so they are unit-tested.
 */

import { APP, LIMITS, SERVER, TIMING, isRoomCode } from '../shared/config.js';

const plugin = (name) => (typeof window !== 'undefined' && window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins[name]) || null;

/** True inside the store apps (and the tests' fake of them): this page can play. */
export const inApp = () => Boolean(plugin('Phone'));

/** Where the API, the room sockets and the photos are, seen from a page at `origin`. */
export function serverOrigin(origin = location.origin) {
  return SERVER.appOrigins.includes(origin) ? SERVER.origin : origin;
}

/**
 * The room code in an invite link: `whoshotit://join/ABCD` (opens the app) or the
 * website's `https://<server>/ABCD` (opens the invite page). Null for anything else.
 */
export function codeFromLink(link) {
  const m = String(link || '').match(new RegExp(`^(?:${APP.scheme}://join/|https?://[^/]+/)([A-Za-z0-9]{${LIMITS.codeLength}})/?$`));
  const code = m ? m[1].toUpperCase() : null;
  return isRoomCode(code) ? code : null;
}

// ---------- Photos ----------

/** 'full', 'limited' (the player shared only some photos), 'denied' or 'ask' (never asked). */
export async function photoAccess() {
  return (await plugin('Phone').photoAccess()).access;
}

/** Shows the phone's own permission question (only possible while the answer is 'ask'). */
export async function askPhotoAccess() {
  return (await plugin('Phone').requestPhotoAccess()).access;
}

/** The plugin's base64 JPEG as a Blob. A plain loop: it runs for every preview and photo, and
 * a mapping callback per byte would keep the page busy right when "No" is tapped. */
function jpegBlob(base64) {
  const text = atob(base64);
  const bytes = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) bytes[i] = text.charCodeAt(i);
  return new Blob([bytes], { type: 'image/jpeg' });
}

/** The phone's answer, or an error after `ms` (the caller then tries other photos). */
function within(ms, call) {
  const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms));
  return Promise.race([call, timeout]);
}

/**
 * Up to `count` random photos that are not in `exclude` (ids from earlier calls), as
 * previews to choose from: `[{ id, blob, screenshot }]`. Fewer when the phone has no more
 * (an empty array: every photo the app may see is excluded). Quick: previews come from
 * what the phone keeps on the device.
 */
export async function randomPhotos(count, exclude) {
  const answer = await within(TIMING.previewMs, plugin('Phone').randomPhotos({ count, exclude, side: LIMITS.previewSide, quality: LIMITS.previewQuality }));
  return (answer.photos || []).filter((p) => p.id && p.data).map((p) => ({ id: p.id, blob: jpegBlob(p.data), screenshot: Boolean(p.screenshot) }));
}

/**
 * The photo `id` as it is uploaded: a JPEG Blob at most LIMITS.photoMaxSide. Throws if the
 * phone cannot read it or needs longer than TIMING.photoPickMs (an iCloud original that
 * does not download).
 */
export async function photo(id) {
  const answer = await within(TIMING.photoPickMs, plugin('Phone').photo({ id, maxSide: LIMITS.photoMaxSide, quality: LIMITS.photoQuality }));
  if (!answer || !answer.data) throw new Error('unreadable');
  return jpegBlob(answer.data);
}

/** Opens this app's page in the phone's settings (to turn photo access on). */
export function openSettings() {
  plugin('Phone').openSettings().catch(() => {});
}

/** Keeps the screen on while in a game, so phones on the table do not drop out. */
export function keepAwake(on) {
  const phone = plugin('Phone');
  if (phone) phone.keepAwake({ on }).catch(() => {});
}

// ---------- Sharing, invite links, back button ----------

/** The phone's share sheet; false when there is none (the caller copies instead). */
export async function share({ text, url }) {
  const sheet = plugin('Share');
  if (!sheet) return false;
  try {
    await sheet.share({ title: APP.name, text, url, dialogTitle: APP.name });
  } catch {
    // Closing the share sheet without sharing also lands here; nothing to tell the player.
  }
  return true;
}

/**
 * Calls `onCode(code)` for an invite link that opened the app: the one it was started
 * with, and every one that arrives while it runs.
 */
export async function onInvite(onCode) {
  const app = plugin('App');
  if (!app) return;
  app.addListener('appUrlOpen', ({ url }) => {
    const code = codeFromLink(url);
    if (code) onCode(code);
  });
  try {
    const launch = await app.getLaunchUrl();
    const code = launch && codeFromLink(launch.url);
    if (code) onCode(code);
  } catch {}
}

/** The Android back button: `handle()` returns false when there is nothing to go back to. */
export function onBack(handle) {
  const app = plugin('App');
  if (!app) return;
  app.addListener('backButton', () => {
    if (!handle()) app.minimizeApp().catch(() => {});
  });
}

/** The app comes back to the front (for example from the phone's settings). */
export function onResume(callback) {
  const app = plugin('App');
  if (app) app.addListener('resume', callback);
}
