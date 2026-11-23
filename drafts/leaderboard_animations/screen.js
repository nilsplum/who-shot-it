/**
 * The leaderboard animations' screen: the leaderboard after round 3 in its final state, and
 * on Play its story over it (board.js).
 *
 * Mechanisms: the stand-in game (players.js) for the chosen number of players and guess;
 * the screen (views.js) painted with the app's own painter (web/js/render.js), as the app
 * paints it. The story starts in the same task as the paint, so no frame shows the end
 * first.
 *
 * Invariant: until the page's Play (`play`), and always with Reduce Motion, the final
 * screen simply stays, as in the app with Reduce Motion.
 */
import { createPainter } from '/js/render.js';
import { options, play } from '/kit/screen.js';
import { board } from './board.js';
import { game } from './players.js';
import { boardScreen } from './views.js';

const g = game(Number(options.players) || 6, options.guess);
const root = document.getElementById('app');
createPainter(root)(boardScreen(g));
if (play) board(root.firstElementChild, g);
