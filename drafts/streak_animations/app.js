/**
 * The streak in the app: the reveal and the leaderboard exactly as the app plays them, beside
 * the draft they were chosen from (reveal.js, tower.js, badge.js). The app's own screens
 * (web/js/views/game.js `gameScreen`, web/js/views/board.js `boardScreen`, through the app's
 * painter) for the stand-in game (players.js) with the results the room would tell (round.js
 * `viewOf`), and on Play the app's own stories over them (web/js/reveal.js `playReveal`, which
 * tells the streak with web/js/streak.js, and web/js/board.js `playBoard`), as main.js
 * `startReveal` and `startBoard` play them. Where the app differs from the draft: it is
 * smaller and gentler (no jolts, fewer sparks), its steps are scaled to the bonus the room
 * said, and the reveal runs as long as the room gives it (`streakExtraMs`).
 *
 * Mechanisms: the app's screens read the view as the room sends it, so the stand-in game is
 * turned into one by round.js.
 */
import { REACTIONS, TIMING, streakExtraMs } from '/shared/config.js';
import { createPainter } from '/js/render.js';
import { playBoard } from '/js/board.js';
import { playReveal } from '/js/reveal.js';
import { boardScreen } from '/js/views/board.js';
import { gameScreen } from '/js/views/game.js';
import { buzz } from '/kit/screen.js';
import { runTimer } from './moves.js';
import { photo, viewOf } from './round.js';

/** Paints the app's reveal or leaderboard (`which`) into `root`, and with `play` plays the app's story over it. */
export function inApp(root, g, which, play) {
  const paint = createPainter(root);
  if (which === 'reveal') {
    paint(gameScreen({ view: viewOf(g, 'reveal') }, { picked: null, late: false, photo: 'ok', src: photo(), loading: null, reactions: REACTIONS }));
    if (!play) return;
    // The room's reveal time, as it tells it: longer for a streak that earned a bonus.
    runTimer(TIMING.revealMs + (g.bonus > 0 ? streakExtraMs(g.streak) : 0));
    playReveal(root.firstElementChild, { verdict: 'right', points: g.me.points, streak: g.streak, bonus: g.bonus }, buzz);
    return;
  }
  paint(boardScreen({ view: viewOf(g, 'board') }, { reactions: REACTIONS, loading: null }));
  if (play) {
    runTimer(TIMING.boardMs);
    playBoard(root.firstElementChild, buzz);
  }
}
