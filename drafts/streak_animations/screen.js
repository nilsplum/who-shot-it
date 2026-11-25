/**
 * The streak animation's screen: the app's own reveal or leaderboard in its final state, my
 * streak shown by its badge (round.js), and on Play the story over it: the draft's reveal with
 * the tower of the streak (reveal.js), or the leaderboard's own (the app's web/js/board.js),
 * where the badges on the avatars simply sit. The frames "in the app" show the app's own
 * code instead (app.js).
 *
 * Mechanisms: the frame names the screen (`reveal`, `board`, or `reveal_app`, `board_app`);
 * the page's "Streak" is my streak. The reveal's timer bar runs down over the reveal's time (TIMING.revealMs), as the
 * app's does, so a long streak visibly needs more than it.
 *
 * Invariant: until the page's Play (`play`), and always with Reduce Motion, the final screen
 * simply stays, as in the app with Reduce Motion. A streak of 1 is no streak: no badge, and
 * the points simply settle and fade.
 */
import { TIMING } from '/shared/config.js';
import { playBoard } from '/js/board.js';
import { options, play } from '/kit/screen.js';
import { inApp } from './app.js';
import { buzz, runTimer } from './moves.js';
import { game } from './players.js';
import { playReveal } from './reveal.js';
import { paintBoard, paintReveal } from './round.js';

const g = game(Number(options.streak) || 1);
const root = document.getElementById('app');

if (options.frame === 'reveal_app' || options.frame === 'board_app') {
  inApp(root, g, options.frame.split('_')[0], play);
} else if (options.frame === 'reveal') {
  const screen = paintReveal(root, g);
  if (play) {
    runTimer(TIMING.revealMs);
    playReveal(screen, g);
  }
} else {
  const screen = paintBoard(root, g);
  if (play) {
    runTimer(TIMING.boardMs);
    playBoard(screen, buzz);
  }
}
