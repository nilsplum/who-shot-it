/**
 * The app's HTTP calls to the server (everything that is not the room's WebSocket), and
 * the full addresses of server paths.
 *
 * Mechanisms: `main.js` creates rooms and uploads a player's chosen photos on "Yes"
 * through these functions; paths come from `web/shared/api.js`, the same module the
 * server routes with, prefixed with the server's origin (`phone.serverOrigin`), because
 * the app's own page is not served by the server.
 *
 * Invariants: the player's key travels only in the `Authorization` header, never in a
 * URL. Every call has a timeout, and a failed call throws, so the caller can show one
 * short message and let the player try again.
 */

import { API } from '../shared/api.js';
import { serverOrigin } from './phone.js';

/** The full address of a server path (a photo link from the view, the legal page, …). */
export const serverUrl = (path) => serverOrigin() + path;

/** The room's WebSocket address (wss:// for the https server). */
export const socketUrl = (code) => serverUrl(API.socket(code)).replace(/^http/, 'ws');

const auth = (key) => ({ Authorization: `Bearer ${key}` });

async function request(path, options, timeoutMs) {
  const res = await fetch(serverUrl(path), { ...options, cache: 'no-store', signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res;
}

/** Creates a room with the creator's chosen settings; returns its code. */
export async function createRoom(settings) {
  const res = await request(API.rooms(), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ settings }) }, 15000);
  return (await res.json()).code;
}

/** "Yes": the chosen JPEGs become the player's set and the player is ready (none = just guess). */
export async function uploadPhotos(code, key, blobs) {
  const form = new FormData();
  blobs.forEach((blob, i) => form.append('photo', blob, `${i + 1}.jpg`));
  await request(API.photos(code), { method: 'PUT', headers: auth(key), body: form }, 90000);
}
