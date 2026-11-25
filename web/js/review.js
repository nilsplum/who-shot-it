/**
 * When the app asks the phone for the store's own rating window (Apple's "Enjoying Who Shot
 * It?", Google Play's rating card): at the end of a close game, from the group's 3rd game in
 * its room on, on every phone still on that game's results at the same moment, and at most
 * once while the app runs.
 *
 * Mechanisms: main.js `startPodium` waits for the podium's story to end (`podium.js`; at once
 * with Reduce Motion), then `RATING.afterMs` more, and asks `rateNow` with the view of that
 * moment, but only while the same end screen is still on (a phone that tapped "Play again" or
 * left does not ask); then `phone.askForRating` calls the native window. Every phone of the
 * table sees the same end at the same moment and plays the same story, so they ask
 * together.
 *
 * Invariants:
 * - The window is the store's own, never a prompt of ours: nothing is asked before it, it is
 *   never opened from a button, and nothing is offered for a rating (Apple's App Review
 *   guideline 5.6.1, Google Play's in-app review guidelines). Whether it really shows is the
 *   phone's decision (Apple at most three times a year per person and never in TestFlight,
 *   Google by its own quota), and the app is never told whether it did or whether the player
 *   rated.
 * - "Close" is the moment players are happiest and not busy: someone won, by less than one
 *   fast right answer (`SCORING.max`), so the last photo could have turned it; a tie counts.
 *   The group's 3rd game (`view.games`, the room's count, the same on every phone) keeps a
 *   group's first evening free of it.
 * - Nothing is saved on the phone and nothing is sent: the "once" is this page's memory, so a
 *   new app start may ask again (and the phone's own limit still applies).
 *
 * The quiet "⭐ Rate the game" link in "How to play" (`views/sheets.js`, `reviewLink` in
 * web/shared/config.js) is the player's own choice and needs none of this.
 */
import { SCORING } from '../shared/config.js';

/** From which of the group's games on (`view.games`), and how long after the podium's story (ms). */
export const RATING = { fromGame: 3, afterMs: 2000 };

/** Whether this phone already asked since the app started. */
let asked = false;

/**
 * Whether a game's final standings (`view.final`) were close: at least two players, the
 * winner with points, ahead of second place by less than one fast right answer (a tie counts).
 */
export function closeGame(final) {
  if (!final || !final.players || final.players.length < 2) return false;
  const [first, second] = final.players.map((p) => p.score).sort((a, b) => b - a);
  return first > 0 && first - second < SCORING.max;
}

/**
 * Whether this is the moment to ask, given the view on the end screen (`games`, `final`):
 * true at most once while the app runs, and remembered as soon as it is.
 */
export function rateNow({ games, final }) {
  if (asked || !(games >= RATING.fromGame) || !closeGame(final)) return false;
  asked = true;
  return true;
}
