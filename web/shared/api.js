/**
 * The HTTP and WebSocket surface of the server: every path the app calls, the answers and
 * close codes it reacts to, and the one parser that routes them.
 *
 * Mechanisms: the app builds its requests with `API.*` (prefixed with the server's
 * origin, `web/js/api.js`); the Worker (`src/worker.js`) answers `API.rooms` and `API.gate`
 * itself and forwards a request to a room's Durable Object only if `matchRoomRoute` knows
 * it, and the Durable Object (`src/room.js`) dispatches on the same match. The view
 * (`src/game/view.js`) builds photo links with `API.photo`. So a path exists in exactly one
 * place.
 *
 * - `POST API.rooms()` with `{ settings, version }` creates a room and answers `{ code }`
 *   (201); an app too old for this server's version gate gets `STATUS.update`.
 * - `GET API.gate()` answers the server's version gate, `{ min, newest: { ios, android } }`
 *   (`normalizeGate` in `web/shared/config.js`); the app asks once per start.
 *
 * Invariant: room codes in paths are upper case (the code alphabet), photo ids lower case
 * letters and digits (`makeId`); the patterns reject anything else before a Durable
 * Object is ever touched.
 */

export const API = {
  rooms: () => '/api/rooms',
  gate: () => '/api/gate',
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
 * The HTTP status of a refusal the app turns into a screen of its own: `update`, an app too
 * old for this server's version gate creating a game ("Update to play"; `{ error: 'update' }`).
 */
export const STATUS = { update: 426 };

/**
 * WebSocket close codes the room uses, so the app knows whether to reconnect:
 * stale (no ping for too long: reconnect), replaced (the same player connected again
 * elsewhere: stop and offer "Play here"), full, gone (no room with this code), left
 * (after Leave), removed (the host removed this player) and update (an app too old for this
 * server's version gate joining: "Update to play"; the apps up to `SILENT_VERSION` do not
 * know it and get full instead).
 *
 * Messages on the socket are JSON. App to room: `{ type: 'hello', key, name, avatar, ahead,
 * uploading, asks, version }` first (`ahead`: this app loads the game's photos ahead;
 * `uploading`: the id of its upload still on its way, or null; `asks`: it can ask "Is
 * everyone here?" and show "Start now"; `version`: `APP.version`, for the version gate;
 * apps up to `SILENT_VERSION` send none), then `leave`, `start {go}` (the answer to that question, or "Start
 * now"), `sending {upload, start}` ("Yes": the photos follow in the upload to `API.photos`,
 * whose form carries the same id as `upload` next to its `photo` files; ids as `isUploadId`
 * in src/game/state.js; `start`: the last Yes, its phone already asked "Is everyone here?",
 * so the game starts), `unready`,
 * `setting {key, value}`, `loaded {round}` (the round this phone is ready for: it holds
 * that round's photo; sent once per round, at most for the round after the one on screen;
 * apps without `ahead` send the round whose photo is on screen), `answer {pick}`,
 * `next`, `again`, `flag {round, on}` (⚑ on the photo of that round, or Cancel),
 * `report {round}` (Delete on it; apps before the flag send no round), `kick {target}`,
 * `peek {on}` ("Show again" held or let go; renewed while held), `react {emoji}`, plus the
 * plain text `ping`. Room to app: `{ type: 'state', view }` (see `src/game/view.js`), after
 * a hello and whenever what that player sees changed, and `{ type: 'react', emoji, from }`. The room ignores what no current app sends any more
 * (`resolve`, the host's former "Reveal now").
 */
export const CLOSE = { stale: 4000, replaced: 4001, full: 4003, gone: 4004, left: 4005, removed: 4006, update: 4007 };

/** `{ name, code, id }` for a known room route (id = photo id), else null. */
export function matchRoomRoute(method, pathname) {
  for (const route of ROOM_ROUTES) {
    if (route.method !== method) continue;
    const m = pathname.match(route.pattern);
    if (m) return { name: route.name, code: m[1], id: m[2] || null };
  }
  return null;
}
