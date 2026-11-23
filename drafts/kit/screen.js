/**
 * What a draft's screen gets from the kit: the choices made on the draft's page, Reduce
 * Motion, the app's vibrations, and a pause to write timelines with.
 *
 * Mechanisms: a draft's `screen.js` runs inside a phone frame of the draft's page
 * (kit/page.js), which hands it every choice in the frame's address: `frame` (which of the
 * draft's frames this is), the draft's own controls, `phone` and `reduce`. `buzz` sends a
 * vibration to the page, which shows it under the phone (a browser cannot vibrate).
 *
 * Invariants: a screen starts from the beginning whenever its frame loads (a choice,
 * Replay, the reload after a change), so nothing here keeps state between runs. The
 * vibrations are the app's five (`HAPTICS` in web/js/phone.js), so what a draft plays can
 * move into the app as it is.
 */

/** The page's choices for this frame, as strings: `frame`, the draft's own controls, `phone`, `reduce`. */
export const options = Object.fromEntries(new URLSearchParams(location.search));

/** Reduce Motion, chosen on the page or set on this computer: a screen then shows its final state at once. */
export const reduceMotion = options.reduce === '1' || matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Plays one of the app's vibrations: `tap` (a light tap), `yes` (one firm pulse), `no`
 * (two firm pulses), `count` (a short buzz), `land` (a heavy thud).
 */
export function buzz(kind) {
  parent.postMessage({ draft: 'buzz', kind }, location.origin);
}

/** Waits `ms` milliseconds: a timeline is a row of awaits. */
export const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
