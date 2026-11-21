/**
 * What the phone can do, and the links that leave the browser: which "All photos" route
 * fits this device, the Apple Shortcut link, and keeping the screen awake.
 *
 * Mechanisms: the lobby (`views/lobby.js`, `views/sheets.js`) asks `photoRoute` which
 * "All photos" button to show; `shortcutLink` builds the iPhone link with the player's
 * secret pool token; `main.js` keeps the screen awake while the player is in a room.
 *
 * Invariants:
 * - Browsers cannot read a photo library. Android and computers can hand over a whole
 *   folder (`webkitdirectory`: the player picks DCIM > Camera). iPhones cannot (Photos is
 *   not a folder), so they go through the shortcut (`docs/ios-shortcut.md`).
 * - The shortcut's callbacks return to the browser the player is using: Safari takes the
 *   https link, other iOS browsers need their own scheme, or iOS would open Safari with a
 *   different player identity. `browserLink` and `shortcutLink` are pure (the user agent
 *   is a parameter), so they are unit-tested.
 */

import { SHORTCUT } from '../shared/config.js';

export const isIOS = (ua = navigator.userAgent, touchMac = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) =>
  /iPad|iPhone|iPod/.test(ua) || touchMac;

export const isAndroid = (ua = navigator.userAgent) => /Android/i.test(ua);

/** 'shortcut' (iPhone), 'folder' (Android and computers) or null (no whole-library route). */
export function photoRoute() {
  if (isIOS()) return SHORTCUT.installUrl.startsWith('https://') ? 'shortcut' : null;
  return 'webkitdirectory' in document.createElement('input') ? 'folder' : null;
}

/** The https `url` rewritten so iOS opens it in the browser `ua` belongs to. */
export function browserLink(url, ua) {
  if (/CriOS/.test(ua)) return url.replace(/^https:/, 'googlechromes:').replace(/^http:/, 'googlechrome:');
  if (/FxiOS/.test(ua)) return `firefox://open-url?url=${encodeURIComponent(url)}`;
  if (/EdgiOS/.test(ua)) return url.replace(/^https:/, 'microsoft-edge-https:').replace(/^http:/, 'microsoft-edge-http:');
  return url;
}

/**
 * Runs the shortcut with the upload link as its input; when it finishes, iOS opens
 * `doneUrl` (which marks the pool complete and redirects into the room). On cancel it
 * opens `backUrl`; on an error (for example the shortcut is not installed any more) it
 * opens `backUrl?setup=1`, which shows the setup sheet again (`main.js`).
 */
export function shortcutLink({ uploadUrl, doneUrl, backUrl, ua }) {
  const q = new URLSearchParams({
    name: SHORTCUT.name,
    input: 'text',
    text: uploadUrl,
    'x-success': browserLink(doneUrl, ua),
    'x-cancel': browserLink(backUrl, ua),
    'x-error': browserLink(`${backUrl}?setup=1`, ua),
  });
  // Shortcuts decodes %20 but not "+" as a space.
  return `shortcuts://x-callback-url/run-shortcut?${q.toString().replace(/\+/g, '%20')}`;
}

let wakeLock = null;
let wantAwake = false;

/** Keeps the screen on while in a room, so phones on the table do not drop out of the game. */
export async function keepAwake(on) {
  wantAwake = on;
  try {
    if (on && !wakeLock && 'wakeLock' in navigator && document.visibilityState === 'visible') {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    } else if (!on && wakeLock) {
      await wakeLock.release();
      wakeLock = null;
    }
  } catch {
    wakeLock = null;
  }
}

// The browser releases the lock whenever the page is hidden; take it again on return.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (wantAwake && document.visibilityState === 'visible') keepAwake(true);
  });
}
