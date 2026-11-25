/**
 * The Worker: the server's front door.
 *
 * Mechanisms: Cloudflare serves the static files from `web/` directly; only `/api/*`
 * reaches this code (`run_worker_first` in `wrangler.jsonc`). Outside the store apps,
 * `web/` is the website: opened in a browser, the app's page shows the invite page
 * (`web/js/views/landing.js`) and `/legal` the legal texts. Unknown paths fall back to
 * `index.html`, which is what makes an invite link `https://<server>/<CODE>` work.
 * Here, `POST /api/rooms` creates a room with a fresh random code (unless the app is too old
 * for this deployment's version gate, `gateOf`), `GET /api/gate` answers that gate, and every
 * known room route (`web/shared/api.js`) is forwarded unchanged to that room's Durable
 * Object (`src/room.js`), which owns all game state.
 *
 * Invariants:
 * - The Worker holds no state of its own, and a request reaches a Durable Object only if
 *   its path and room code are well-formed.
 * - Rooms are created and found only in the EU jurisdiction (`SERVER.jurisdiction`), so a
 *   room, its game and its photos are stored and processed in EU data centres only.
 * - A room object writes storage only when the Worker creates it, so probing codes never
 *   leaves anything behind.
 * - Only the store apps and the server's own pages may call the API (`src/http.js`).
 */

import { API, STATUS, matchRoomRoute } from '../web/shared/api.js';
import { SERVER, isRoomCode, mayPlay } from '../web/shared/config.js';
import { makeCode } from './game/state.js';
import { appOrigin, cryptoRandom, fail, gateOf, isAllowedOrigin, json, preflight, withCors } from './http.js';

export { Room } from './room.js';

/**
 * The room namespace, restricted to the EU jurisdiction. Cloudflare's local runtime
 * (`wrangler dev` and the tests) cannot emulate jurisdictions and throws exactly this
 * "not implemented in workerd" error; only then does the plain namespace stand in. Any
 * other error is raised, so a deployed Worker never stores a room outside the EU.
 */
export function rooms(env) {
  try {
    return env.ROOMS.jurisdiction(SERVER.jurisdiction);
  } catch (error) {
    if (/not implemented in workerd/.test(String(error && error.message))) return env.ROOMS;
    throw error;
  }
}

/**
 * The creator's chosen settings come along (invalid values become defaults in the room), and
 * the app's version: an app too old for this deployment's version gate gets "Update to play"
 * (`STATUS.update`) and no room.
 */
async function createRoom(request, env) {
  let settings = {};
  let version;
  try {
    const body = await request.json();
    if (body && typeof body.settings === 'object') settings = body.settings;
    if (body) version = body.version;
  } catch {}
  if (!mayPlay(version, gateOf(env))) return fail(STATUS.update, 'update');
  // 31^4 codes: a clash with a live room is rare, and the room answers 409 if it happens.
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = makeCode(cryptoRandom);
    const res = await rooms(env).getByName(code).fetch('https://room/create', { method: 'POST', body: JSON.stringify({ code, settings }) });
    if (res.status === 201) return json({ code }, 201);
  }
  return fail(503, 'busy');
}

function route(request, env, url) {
  if (url.pathname === API.rooms() && request.method === 'POST') return createRoom(request, env);
  if (url.pathname === API.gate() && request.method === 'GET') return json(gateOf(env));
  const match = matchRoomRoute(request.method, url.pathname);
  if (!match || !isRoomCode(match.code)) return fail(404, 'not_found');
  return rooms(env).getByName(match.code).fetch(request);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    if (!isAllowedOrigin(request)) return fail(403, 'origin');
    const origin = appOrigin(request);
    if (request.method === 'OPTIONS') return origin ? preflight(origin) : new Response(null, { status: 204 });
    return withCors(await route(request, env, url), origin);
  },
};
