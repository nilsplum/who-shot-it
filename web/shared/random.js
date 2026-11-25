/**
 * The one shuffle and the one id maker of the codebase, for the server and the app alike.
 *
 * Mechanisms: the game logic deals with `shuffle` (the round plan in `src/game/plan.js`, the
 * answer cards in `src/game/rules.js`) and names players and stored photos with `makeId`
 * (`src/game/rules.js`, `src/room.js`), always with the room's crypto-backed random source
 * passed in as `rng`, so a game's order and its photo links cannot be guessed. The app
 * shuffles the avatar picker and names its uploads with them (`web/js/main.js`), where
 * `Math.random` is enough: nothing depends on guessing those. Where every phone must make the
 * same random choice without talking to the others (the lobby's bubble, `web/js/nudge.js`),
 * `seeded` gives them the same numbers from the same text.
 *
 * Invariant: pure; nothing here changes what it gets, and the randomness always comes in as
 * an argument, so the unit tests can replay a deal with a seeded source.
 */

const ID_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

/** A random id of lower case letters and digits (what the server's routes accept, `web/shared/api.js`). */
export function makeId(rng, length = 12) {
  let id = '';
  for (let i = 0; i < length; i++) id += ID_ALPHABET[Math.floor(rng() * ID_ALPHABET.length)];
  return id;
}

/**
 * A random source (numbers from 0 to 1, like `Math.random`) that gives the same numbers for
 * the same `text` on every phone: the text is hashed (FNV-1a) into the seed of a small
 * generator (mulberry32). For choices the phones must make alike, such as the order of the
 * bubble's lines; never for anything that must not be guessed (anyone who knows the text
 * knows the numbers).
 */
export function seeded(text) {
  let a = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) a = Math.imul(a ^ text.charCodeAt(i), 0x01000193);
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher-Yates shuffle into a new array: every order is equally likely. */
export function shuffle(items, rng = Math.random) {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
