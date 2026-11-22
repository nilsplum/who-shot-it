/**
 * The HTTP and WebSocket surface of the server: every path the app calls and the one
 * parser that routes them.
 *
 * Mechanisms: the app builds its requests with `API.*` (prefixed with the server's
 * origin, `web/js/api.js`); the Worker (`src/worker.js`) forwards a request to a room's
 * Durable Object only if `matchRoomRoute` knows it, and the Durable Object
 * (`src/room.js`) dispatches on the same match. The view (`src/game/view.js`) builds
 * photo links with `API.photo`. So a path exists in exactly one place.
 *
 * Invariant: room codes in paths are upper case (the code alphabet), photo ids lower case
 * letters and digits (`makeId`); the patterns reject anything else before a Durable
 * Object is ever touched.
 */

export const API = {
  rooms: () => '/api/rooms',
  socket: (code) => `/api/rooms/${code}/socket`,
  photos: (code) => `/api/rooms/${code}/photos`,
  photo: (code, id) => `/api/rooms/${code}/photos/${id}`,
};

const ROOM_ROUTES = [
  { name: 'socket', method: 'GET', pattern: /^\/api\/rooms\/([A-Z0-9]+)\/socket$/ },
  { name: 'setPhotos', method: 'PUT', pattern: /^\/api\/rooms\/([A-Z0-9]+)\/photos$/ },
  { name: 'photo', method: 'GET', pattern: /^\/api\/rooms\/([A-Z0-9]+)\/photos\/([a-z0-9]+)$/ },
];

/**
 * WebSocket close codes the room uses, so the app knows whether to reconnect:
 * stale (no ping for too long: reconnect), replaced (the same player connected again
 * elsewhere: stop and offer "Play here"), full, gone (no room with this code), left
 * (after Leave) and removed (the host removed this player).
 *
 * Messages on the socket are JSON. App to room: `{ type: 'hello', key, name, avatar }`
 * first, then `leave`, `unready`, `setting {key, value}`, `loaded {round}`, `answer {pick}`,
 * `resolve`, `next`, `again`, `report`, `kick {target}`, `peek {on}` ("Show again" held or
 * let go; renewed while held), `react {emoji}`, plus the plain text `ping`. Room to app: `{ type: 'state', view }` (see `src/game/view.js`) and
 * `{ type: 'react', emoji, from }`.
 */
export const CLOSE = { stale: 4000, replaced: 4001, full: 4003, gone: 4004, left: 4005, removed: 4006 };

/** `{ name, code, id }` for a known room route (id = photo id), else null. */
export function matchRoomRoute(method, pathname) {
  for (const route of ROOM_ROUTES) {
    if (route.method !== method) continue;
    const m = pathname.match(route.pattern);
    if (m) return { name: route.name, code: m[1], id: m[2] || null };
  }
  return null;
}
