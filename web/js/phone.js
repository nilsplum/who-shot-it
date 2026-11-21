/**
 * Everything the app needs from the phone, in one place: photo access and random photos,
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
 * - Photos are picked, shrunk and re-encoded on the phone (JPEG at most LIMITS.photoMaxSide
 *   on the longest side, location data dropped); a photo only becomes a Blob here, it
 *   leaves the phone only through `uploadPhotos` after the player taps "Yes".
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

function jpegBlob(base64) {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  return new Blob([bytes], { type: 'image/jpeg' });
}

/**
 * One random photo from the phone that is not in `exclude` (ids from earlier calls):
 * `{ id, blob }`, or null when every photo the app may see is excluded. Screenshots are
 * never picked. Throws if the phone needs longer than TIMING.photoPickMs (for example an
 * iCloud original that does not download), so the caller can draw another one.
 */
export async function randomPhoto(exclude) {
  const call = plugin('Phone').randomPhoto({ exclude, maxSide: LIMITS.photoMaxSide, quality: LIMITS.photoQuality });
  const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), TIMING.photoPickMs));
  const photo = await Promise.race([call, timeout]);
  return photo && photo.id && photo.data ? { id: photo.id, blob: jpegBlob(photo.data) } : null;
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
