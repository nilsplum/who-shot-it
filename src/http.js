/**
 * Small HTTP helpers shared by the Worker and the room's Durable Object: JSON responses,
 * the player key from the request, JPEG checks, which web origins may call the API, and
 * the server's random source.
 *
 * Invariants:
 * - API responses are never cached (`no-store`); photos set their own caching.
 * - Errors answer with a short machine code (`{ error: 'not_found' }`) and never echo
 *   request content back.
 * - `cryptoRandom` is the only randomness the server uses, so ids and room codes are
 *   unguessable; the pure game logic receives it as its `rng`.
 * - Web pages may call the API only from the store apps (`SERVER.appOrigins`, the only
 *   origins that get CORS headers) or from the server's own origin (local development
 *   and the end-to-end tests). Any other web page is refused, room sockets included
 *   (browsers apply no CORS to WebSockets), so no third-party site can use the game's
 *   free-plan quota through its visitors. Requests without an Origin (not from a web
 *   page) pass: they could claim any origin anyway, and they are not the risk here.
 */

import { SERVER } from '../web/shared/config.js';

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
  });
}

export const fail = (status, error) => json({ error }, status);

/** The player key from `Authorization: Bearer <key>`, or null. */
export function bearerKey(request) {
  const m = (request.headers.get('Authorization') || '').match(/^Bearer ([A-Za-z0-9_-]+)$/);
  return m ? m[1] : null;
}

/** Player keys are random strings the app makes once (see `web/js/store.js`). */
export function isPlayerKey(value) {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{16,64}$/.test(value);
}

/** A JPEG starts with FF D8 FF; the apps re-encode every photo as JPEG before upload. */
export function isJpeg(bytes) {
  return bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

/** A request body larger than this is rejected before it is read. */
export function tooLarge(request, maxBytes) {
  const length = Number(request.headers.get('Content-Length'));
  return Number.isFinite(length) && length > maxBytes;
}

export function cryptoRandom() {
  return crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;
}

/** The request's Origin when it is one of the store apps (they get CORS headers), else null. */
export function appOrigin(request) {
  const origin = request.headers.get('Origin');
  return origin && SERVER.appOrigins.includes(origin) ? origin : null;
}

/** No Origin, the server's own origin, or a store app: see the header for why. */
export function isAllowedOrigin(request) {
  const origin = request.headers.get('Origin');
  return !origin || origin === new URL(request.url).origin || SERVER.appOrigins.includes(origin);
}

/** The answer to a CORS preflight from a store app (its calls send `Authorization`). */
export function preflight(origin) {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, PUT',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      'Access-Control-Max-Age': '86400',
      Vary: 'Origin',
    },
  });
}

/** `response` readable by the store app at `origin` (a socket upgrade needs no CORS). */
export function withCors(response, origin) {
  if (!origin || response.status === 101) return response;
  const out = new Response(response.body, response);
  out.headers.set('Access-Control-Allow-Origin', origin);
  out.headers.append('Vary', 'Origin');
  return out;
}
