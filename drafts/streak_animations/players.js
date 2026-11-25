/**
 * A stand-in game for the streak (never real people): six players, each with an avatar of the
 * app's list, a score before this round, what they picked, the points it won and their streak
 * after this round. The round's photo is Ben's, and I am Ana: I guessed right, and my streak
 * is the page's "Streak". Whoever guessed right has a streak of their own (Ben 4, Max 2, Leo
 * 9, so every tier of the badge shows on the leaderboard), whoever guessed wrong has none.
 * My points are the answer's own plus the streak's bonus, as the room scores them.
 */
import { bonusOf } from './moves.js';

/** Name, avatar, score before this round, whether they were right, the points it won (without a streak bonus), their streak after it. */
const PLAYERS = [
  ['Lena', '🦊', 2140, false, 0, 0],
  ['Ben', '🐼', 1980, true, 410, 4],
  ['Ana', '🐸', 1890, true, 520, 1],
  ['Max', '🦄', 1460, true, 350, 2],
  ['Mia', '🐙', 1720, false, 0, 0],
  ['Leo', '🦁', 1300, true, 280, 9],
];

/** Whose photo it is, and who I am. */
export const OWNER = 'p1';
export const ME = 'p2';

/**
 * The game for my streak of `streak` right answers in a row (1: no streak): the players in
 * join order, each with `before`, `pick` (a player's id), `points`, `score` (after this round)
 * and `streak`; my `base` points and what the streak adds to them (`bonus`).
 */
export function game(streak) {
  const players = PLAYERS.map(([name, avatar, before, right, points, run], i) => ({ id: `p${i}`, name, avatar, before, right, points, streak: run }));
  const me = players.find((p) => p.id === ME);
  const base = me.points;
  me.streak = streak;
  me.points = base + (streak > 1 ? bonusOf(streak) : 0);
  for (const p of players) {
    p.pick = p.right ? OWNER : players.find((x) => x.id !== OWNER && x.id !== p.id).id;
    p.score = p.before + p.points;
  }
  return { players, me, base, bonus: me.points - base, streak, round: { n: 3, total: 10 } };
}
