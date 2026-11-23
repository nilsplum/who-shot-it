/**
 * The reveal animations: ways to play the answer of a round (the reveal, when the owner's
 * card turns green), to choose one for the app; it would replace the entrances of the
 * reveal's cards (web/js/views/game.js `revealCard`). One so far, in the style of the
 * podium's Supercharge and Jackpot: the result lands at once, and my own card pops in the
 * colour of my result (green, gold coins and my points; or red and +0).
 *
 * Mechanisms: the kit's page (drafts/kit/page.js) shows `screen.js` once per frame below;
 * each frame paints the reveal in its final state (views.js) and, on Play, plays its story
 * over it (reveal.js). The controls reach the screen as `options.players` and
 * `options.guess`.
 *
 * Invariants: light enough for an old phone (transform and opacity only, the app's own
 * canvas for the light, a few dozen sparks and a handful of elements at most); it leaves
 * exactly the screen it was painted with.
 */
export default {
  title: 'Reveal animations',
  frames: [{ id: 'reveal', title: 'Who shot it?' }],
  controls: [
    { key: 'players', label: 'Players', options: [['3', '3'], ['6', '6'], ['12', '12']], value: '6' },
    { key: 'guess', label: 'Your guess', options: [['right', 'Right'], ['wrong', 'Wrong']], value: 'right' },
  ],
};
