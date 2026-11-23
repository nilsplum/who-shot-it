/**
 * The reveal animations: ways to play the answer of a round (the reveal, when the owner's
 * card turns green). "Who shot it?", in the style of the podium's Supercharge and Jackpot,
 * was chosen: first the owner's card turns green, then my card red when I was wrong, then
 * my own card pops in the colour of my result (green, gold coins and my points; or red and
 * "Wrong"). The app plays it (web/js/reveal.js over views/game.js), and "Who shot it?, in
 * the app" shows it beside the draft it came from.
 *
 * Mechanisms: the kit's page (drafts/kit/page.js) shows `screen.js` once per frame below;
 * the draft paints its reveal in its final state (views.js) and, on Play, plays its story
 * over it (reveal.js); the app's frame does the same with the app's own code (app.js). The
 * controls reach the screen as `options.players` and `options.guess`.
 *
 * Invariants: light enough for an old phone (transform and opacity only, the app's own
 * canvas for the light, a few dozen sparks and a handful of elements at most); it leaves
 * exactly the screen it was painted with.
 */
export default {
  title: 'Reveal animations',
  frames: [
    { id: 'reveal_app', title: 'Who shot it?, in the app' },
    { id: 'reveal', title: 'Who shot it?' },
  ],
  controls: [
    { key: 'players', label: 'Players', options: [['3', '3'], ['6', '6'], ['12', '12']], value: '6' },
    { key: 'guess', label: 'Your guess', options: [['right', 'Right'], ['wrong', 'Wrong']], value: 'right' },
  ],
};
