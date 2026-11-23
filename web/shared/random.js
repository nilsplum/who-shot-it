/**
 * The one shuffle and the one id maker of the codebase, for the server and the app alike.
 *
 * Mechanisms: the game logic deals with `shuffle` (the round plan in `src/game/plan.js`, the
 * answer cards in `src/game/rules.js`) and names players and stored photos with `makeId`
 * (`src/game/rules.js`, `src/room.js`), always with the room's crypto-backed random source
 * passed in as `rng`, so a game's order and its photo links cannot be guessed. The app
 * shuffles the avatar picker and names its uploads with them (`web/js/main.js`), where
 * `Math.random` is enough: nothing depends on guessing those.
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

/** Fisher-Yates shuffle into a new array: every order is equally likely. */
export function shuffle(items, rng = Math.random) {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
