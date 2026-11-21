/**
 * The browser's HTTP calls to the server (everything that is not the room's WebSocket).
 *
 * Mechanisms: `main.js` creates rooms, uploads a player's chosen photos on "Yes" and
 * picks up the iPhone shortcut's pool through these functions; paths come from
 * `web/shared/api.js`, the same module the server routes with.
 *
 * Invariants: the player's key travels only in the `Authorization` header, never in a
 * URL. Every call has a timeout, and a failed call throws, so the caller can show one
 * short message and let the player try again.
 */

import { API } from '../shared/api.js';

const auth = (key) => ({ Authorization: `Bearer ${key}` });

async function request(path, options, timeoutMs) {
  const res = await fetch(path, { ...options, cache: 'no-store', signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res;
}

/** Creates a room with the creator's saved settings; returns its code. */
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

/** Splits the pool response: each photo is a 4-byte big-endian length, then the JPEG. */
export function parsePool(buffer) {
  const view = new DataView(buffer);
  const blobs = [];
  for (let offset = 0; offset + 4 <= buffer.byteLength;) {
    const length = view.getUint32(offset);
    blobs.push(new Blob([buffer.slice(offset + 4, offset + 4 + length)], { type: 'image/jpeg' }));
    offset += 4 + length;
  }
  return blobs;
}

/** The photos the iPhone shortcut sent; the server deletes them as it answers. */
export async function takePool(code, key) {
  const res = await request(API.pool(code), { headers: auth(key) }, 90000);
  return parsePool(await res.arrayBuffer());
}
