/**
 * The Worker: the server's front door.
 *
 * Mechanisms: Cloudflare serves the static browser app from `web/` directly; only `/api/*`
 * reaches this code (`run_worker_first` in `wrangler.jsonc`). Unknown paths outside the
 * API fall back to `index.html` (single-page app), which is what makes an invite link
 * `https://<domain>/<CODE>` open the game. Here, `POST /api/rooms` creates a room with a
 * fresh random code, and every known room route (`web/shared/api.js`) is forwarded
 * unchanged to that room's Durable Object (`src/room.js`), which owns all game state.
 *
 * Invariants: the Worker holds no state of its own, and a request reaches a Durable Object
 * only if its path and room code are well-formed. A room object writes storage only when
 * the Worker creates it, so probing codes never leaves anything behind.
 */

import { API, matchRoomRoute } from '../web/shared/api.js';
import { isRoomCode } from '../web/shared/config.js';
import { makeCode } from './game/state.js';
import { cryptoRandom, fail, json } from './http.js';

export { Room } from './room.js';

/** The creator's saved settings come along (invalid values become defaults in the room). */
async function createRoom(request, env) {
  let settings = {};
  try {
    const body = await request.json();
    if (body && typeof body.settings === 'object') settings = body.settings;
  } catch {}
  // 31^4 codes: a clash with a live room is rare, and the room answers 409 if it happens.
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = makeCode(cryptoRandom);
    const res = await env.ROOMS.getByName(code).fetch('https://room/create', { method: 'POST', body: JSON.stringify({ code, settings }) });
    if (res.status === 201) return json({ code }, 201);
  }
  return fail(503, 'busy');
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    if (url.pathname === API.rooms() && request.method === 'POST') return createRoom(request, env);
    const route = matchRoomRoute(request.method, url.pathname);
    if (!route || !isRoomCode(route.code)) return fail(404, 'not_found');
    return env.ROOMS.getByName(route.code).fetch(request);
  },
};
