/**
 * The countdown animations: four ways to play the 3-2-1 before a game's first photo, beside
 * the app's own as it is today, to choose one for the app (it would replace the number's
 * entrance in views/overlays.js `startScreen`).
 *
 * Mechanisms: the kit's page (drafts/kit/page.js) shows `screen.js` once per frame below;
 * each frame paints the app's own first round under the 3-2-1 (round.js) and, on Play,
 * plays its countdown over it (now.js, lens.js, timer.js, leader.js, pulse.js), all on the
 * same clock (stage.js).
 *
 * Invariants, the same for all four:
 * - It is a clock: the numbers land exactly on the room's seconds (TIMING.countdownMs, 3 s),
 *   and the last moment, the release, falls exactly on the start of the round, so the photo
 *   is there on time; what builds up to it happens inside the last second.
 * - The number stands where the photo is about to appear (the middle of the round's photo),
 *   so every eye is already there when it does.
 * - One main movement per second, a little stronger each time; no sparks: a few elements,
 *   moved with transform and opacity, SVG lines and one round mask, so an old phone keeps up.
 */
export default {
  title: 'Countdown animations',
  frames: [
    { id: 'now', title: 'Now, in the app' },
    { id: 'lens', title: 'Lens' },
    { id: 'timer', title: 'Self-timer' },
    { id: 'leader', title: 'Film leader' },
    { id: 'pulse', title: 'Pulse' },
  ],
};
