/**
 * The countdown animations: four ways to play the 3-2-1 before a game's first photo. Film
 * leader was chosen: the app plays it (views/overlays.js `startScreen`, kept on the room's
 * clock by web/js/countdown.js), and "Film leader, in the app" shows it beside the draft it
 * came from.
 *
 * Mechanisms: the kit's page (drafts/kit/page.js) shows `screen.js` once per frame below;
 * each frame paints the app's own first round under the 3-2-1 (round.js) and, on Play,
 * plays its countdown over it (lens.js, timer.js, leader.js, pulse.js, app.js), all on the
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
    { id: 'lens', title: 'Lens' },
    { id: 'timer', title: 'Self-timer' },
    { id: 'leader_app', title: 'Film leader, in the app' },
    { id: 'leader', title: 'Film leader' },
    { id: 'pulse', title: 'Pulse' },
  ],
};
