/**
 * The streak animation: how a streak, the right answers in a row, shows on the reveal and the
 * leaderboard. "Tower" was chosen and is built into the app (web/js/streak.js over views/game.js
 * and views/board.js), smaller and gentler than this draft; the frames "in the app" show the
 * app's own reveal and leaderboard beside the draft they came from. On the reveal my points stay above the badge at the bottom of the photo, slide
 * aside, and a second number appears next to them, the streak's bonus, under a tower of blocks.
 * A block drops in for every number of the streak, 2, 3, 4 and on, each a little later and a
 * little more dramatic than the one before, and shows what it adds (+100, as `SCORING` in
 * web/shared/config.js has it, "MAX" once the bonus is capped at +500); the bonus counts up
 * with every block. When the tower is done the bonus slides into my points, which count up
 * with a pop, and the badge ticks to the new number; then the total fades out where it stands.
 * The leaderboard only shows the streaks, a small badge on the avatar of every player who has
 * one; nothing there is animated beyond the app's own story.
 *
 * Mechanisms: the kit's page (drafts/kit/page.js) shows `screen.js` once per frame below, the
 * app's own reveal and leaderboard (round.js) under it. The control reaches the screen as
 * `options.streak`: my streak (the leaderboard also shows streaks of 4, 2 and 9 of others).
 *
 * Invariants: light enough for an old phone (transform and opacity only, the app's own canvas
 * for the light, a handful of elements). The app does not send streaks to the phones yet
 * (`src/game/view.js`): a chosen design needs them there. The reveal needs more time than its
 * 3.5 s (TIMING.revealMs) for a longer streak (about 1.5 s more for a streak of 3, up to about
 * 4 s more for the longest), as the leaderboard's time was made to fit its story.
 */
export default {
  title: 'Streak animation',
  frames: [
    { id: 'reveal_app', title: 'Reveal, in the app' },
    { id: 'board_app', title: 'Leaderboard, in the app' },
    { id: 'reveal', title: 'Reveal' },
    { id: 'board', title: 'Leaderboard streaks' },
  ],
  controls: [
    { key: 'streak', label: 'Streak', options: [['1', 'None'], ['2', '2'], ['3', '3'], ['5', '5'], ['9', '9'], ['15', '15']], value: '5' },
  ],
};
