/**
 * The leaderboard animations: ways to play the leaderboard between two rounds. "Leaderboard",
 * in the style of the podium's Supercharge and Jackpot (coins rolling up the totals, the
 * gold medal flying to the new leader), was chosen and replaced the board's entrance; the
 * app plays it (web/js/board.js over views/board.js), and "Leaderboard, in the app" shows
 * it beside the draft it came from.
 *
 * Mechanisms: the kit's page (drafts/kit/page.js) shows `screen.js` once per frame below;
 * the draft's frame paints the board in its final state (views.js) and, on Play, plays its
 * story over it (board.js); the app's frame does the same with the app's own code (app.js).
 * The controls reach the screen as `options.players` and `options.guess` (which decides who
 * takes the lead).
 *
 * Invariants: light enough for an old phone (transform and opacity only, the app's own
 * canvas for the light, a few dozen sparks and a handful of elements at most); it leaves
 * exactly the screen it was painted with.
 */
export default {
  title: 'Leaderboard animations',
  frames: [
    { id: 'board_app', title: 'Leaderboard, in the app' },
    { id: 'board', title: 'Leaderboard' },
  ],
  controls: [
    { key: 'players', label: 'Players', options: [['3', '3'], ['6', '6'], ['12', '12']], value: '6' },
    { key: 'guess', label: 'Your guess', options: [['right', 'Right'], ['wrong', 'Wrong']], value: 'right' },
  ],
};
