/**
 * Small HTTP helpers shared by the Worker and the room's Durable Object: JSON responses,
 * the player key from the request, JPEG checks and the server's random source.
 *
 * Invariants:
 * - API responses are never cached (`no-store`); photos set their own caching.
 * - Errors answer with a short machine code (`{ error: 'not_found' }`) and never echo
 *   request content back.
 * - `cryptoRandom` is the only randomness the server uses, so ids, tokens and room codes
 *   are unguessable; the pure game logic receives it as its `rng`.
 */

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

/** Player keys are random strings the browser makes once (see `web/js/store.js`). */
export function isPlayerKey(value) {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{16,64}$/.test(value);
}

/** A JPEG starts with FF D8 FF; browsers and the iPhone shortcut both send JPEG only. */
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
