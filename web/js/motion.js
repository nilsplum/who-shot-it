/**
 * The small moves the app's stories are made of: a pause, a frame loop over a fixed time, the
 * two easings of the design as the animation API takes them, and a pace for what is felt
 * (`atMostEvery`).
 *
 * Mechanisms: the stories that play over a screen in its final state import these
 * (`reveal.js`, `streak.js`, `board.js`, `podium.js`); the light they throw is the canvas of
 * `sparks.js`, their vibrations come from `phone.js`.
 *
 * Invariants: `EASE` repeats `--ease-bounce` of `styles/app.css` and the curve the theme's
 * `ease-out` animations use, so a scripted move and a class's animation feel alike; nothing
 * here touches the page.
 */

export const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** The design's quick start with a soft landing (`out`) and its overshoot (`bounce`, `--ease-bounce`), as the animation API takes them. */
export const EASE = { out: 'cubic-bezier(0.2, 0.8, 0.2, 1)', bounce: 'cubic-bezier(0.3, 1.6, 0.5, 1)' };

/** The same curves for scripted motion (`tween`): k from 0 to 1. */
export const outCubic = (k) => 1 - (1 - k) ** 3;
export const inOut = (k) => (k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2);

/**
 * `run` wrapped so that it runs at most once every `ms` milliseconds: a call closer than that
 * to the last one that ran is dropped. A story's vibrations use it where events can pile up (a
 * volley of fireworks bursting at once), so each is felt as its own tap instead of blurring
 * into one long buzz. `now` is the clock (performance.now; a test passes its own).
 */
export function atMostEvery(ms, run, now = () => performance.now()) {
  let last = -Infinity;
  return (...args) => {
    const t = now();
    if (t - last < ms) return;
    last = t;
    run(...args);
  };
}

/** Runs `each(k)` every frame for `ms` milliseconds, k from 0 to 1 along `curve`; resolves at the end. */
export function tween(ms, each, curve = (k) => k) {
  return new Promise((resolve) => {
    const start = performance.now();
    const frame = (now) => {
      const k = Math.min(1, Math.max(0, (now - start) / ms));
      each(curve(k));
      if (k < 1) requestAnimationFrame(frame);
      else resolve();
    };
    requestAnimationFrame(frame);
  });
}
