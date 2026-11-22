/**
 * The one shuffle of the codebase, for the server and the app alike.
 *
 * Mechanisms: the game logic deals with it (the round plan in `src/game/plan.js`, the
 * answer cards in `src/game/rules.js`), always with the room's crypto-backed random source
 * passed in as `rng`, so a game's order cannot be guessed. The app shuffles the avatar
 * picker with it (`web/js/main.js`), where `Math.random` is enough: nothing depends on it.
 *
 * Invariant: pure; it never changes the array it gets and takes its randomness as an
 * argument, so the unit tests can replay a deal with a seeded source.
 */

/** Fisher-Yates shuffle into a new array: every order is equally likely. */
export function shuffle(items, rng = Math.random) {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
