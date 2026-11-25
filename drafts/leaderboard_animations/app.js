/**
 * Leaderboard, in the app: the leaderboard exactly as the app plays it, beside the draft it
 * was chosen from (board.js). The app's own board screen (web/js/views/board.js
 * `boardScreen`, through the app's painter) for the stand-in game (players.js), and on Play
 * the app's own story over it (web/js/board.js `playBoard`), as main.js `startBoard` plays
 * it. Where the app differs from the draft: no timer bar (the board lasts its story and a
 * rest, TIMING.boardMs), the coins are thrown closer together at a big table so the last
 * total settles before the rows move, the medal goes only to a leader with points (every
 * tied leader wears one, none before the first points), and the list has room at its sides.
 *
 * Mechanisms: the app's screen reads a view as the room sends it (the shape of
 * src/game/view.js), so the stand-in game is turned into one here.
 */
import { REACTIONS } from '/shared/config.js';
import { createPainter } from '/js/render.js';
import { playBoard } from '/js/board.js';
import { boardScreen } from '/js/views/board.js';
import { buzz } from '/kit/screen.js';

/** The app's view of the board after round `g.round.n`, for me (the shape of src/game/view.js that the screen reads). */
function viewOf(g) {
  const players = g.players.map(({ id, name, avatar, score }) => ({ id, name, avatar, score, connected: true }));
  const results = Object.fromEntries(g.players.map((p) => [p.id, { pick: p.pick, points: p.points }]));
  return {
    phase: 'board', code: 'DRFT', me: { id: g.me }, hostId: 'p0', players, settings: { time: 20 },
    round: { n: g.round.n, total: g.round.total, photo: 'photo', mode: 'classic', owner: g.owner, results },
  };
}

/** Paints the app's board into `root`, and with `play` plays the app's entrance over it. */
export function inApp(root, g, play) {
  createPainter(root)(boardScreen({ view: viewOf(g) }, { reactions: REACTIONS, loading: null }));
  if (play) playBoard(root.firstElementChild, buzz);
}
