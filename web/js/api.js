/**
 * The app's HTTP calls to the server (everything that is not the room's WebSocket), and
 * the full addresses of server paths.
 *
 * Mechanisms: `main.js` creates rooms, uploads a player's chosen photos on "Yes" and asks
 * for the server's version gate through these functions; paths come from
 * `web/shared/api.js`, the same module the server routes with, prefixed with the server's
 * origin (`phone.serverOrigin`), because the app's own page is not served by the server.
 *
 * Invariants: the player's key travels only in the `Authorization` header, never in a
 * URL. Every call has a timeout, and a failed call throws (with the server's `status`), so
 * the caller can show one short message and let the player try again, or "Update to play". The upload goes through `XMLHttpRequest`,
 * the one way a page learns how much of a body is sent (`fetch` cannot tell), so the start
 * shows a real percentage while the group waits for this phone's photos.
 */

import { API } from '../shared/api.js';
import { APP, normalizeGate } from '../shared/config.js';
import { serverOrigin } from './phone.js';

/** The full address of a server path (a photo link from the view, the legal page, …). */
export const serverUrl = (path) => serverOrigin() + path;

/** The room's WebSocket address (wss:// for the https server). */
export const socketUrl = (code) => serverUrl(API.socket(code)).replace(/^http/, 'ws');

const auth = (key) => ({ Authorization: `Bearer ${key}` });

async function request(path, options, timeoutMs) {
  const res = await fetch(serverUrl(path), { ...options, cache: 'no-store', signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { status: res.status });
  return res;
}

/**
 * Creates a room with the creator's chosen settings; returns its code. It says this app's
 * version: an app too old for the server throws with `status` `STATUS.update`.
 */
export async function createRoom(settings) {
  const res = await request(API.rooms(), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ settings, version: APP.version }) }, 15000);
  return (await res.json()).code;
}

/**
 * The server's version gate (`normalizeGate`): the oldest version that may play there and the
 * newest one out per platform. Asked once per start; it never throws: a server out of reach,
 * or one deployed before the gate, gives the open gate, so the app plays on and offers nothing.
 */
export async function fetchGate() {
  try {
    return normalizeGate(await (await request(API.gate(), {}, 10000)).json());
  } catch {
    return normalizeGate(null);
  }
}

/**
 * The upload after "Yes": the chosen JPEGs become the player's set and the player is ready
 * (none = just guess), if `upload` is still the "Yes" the room knows (`sending`, see
 * `web/shared/api.js`). `onProgress` hears how much is sent, 0 to 1; `signal` cancels it
 * ("Change").
 */
export function uploadPhotos(code, key, blobs, { upload, signal, onProgress = () => {} }) {
  const form = new FormData();
  form.append('upload', upload);
  blobs.forEach((blob, i) => form.append('photo', blob, `${i + 1}.jpg`));
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', serverUrl(API.photos(code)));
    xhr.setRequestHeader('Authorization', auth(key).Authorization);
    xhr.timeout = 90000;
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded / e.total);
    };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`HTTP ${xhr.status}`)));
    xhr.onerror = () => reject(new Error('network'));
    xhr.ontimeout = () => reject(new Error('timeout'));
    xhr.onabort = () => reject(new Error('cancelled'));
    if (signal) signal.addEventListener('abort', () => xhr.abort(), { once: true });
    xhr.send(form);
  });
}
