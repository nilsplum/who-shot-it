/**
 * A stand-in game for the leaderboard (never real people): up to twelve players, each with
 * an avatar of the app's list, a score before this round, what they picked and the
 * points it won. The round's photo is Ben's, and I am Ana. "Your guess" decides my pick:
 * right (Ben, the most points of the round) or wrong (Lena). Either way the lead changes
 * hands on the leaderboard, so the medal always has somewhere to fly: to me when I was
 * right, to Ben when I was not. Lena, Ben and Ana come first, so every number of players
 * has them.
 */

/** Name, avatar, score before this round, whether they picked the owner (`null`: no answer), the points it won. Ana's are set by "Your guess". */
const PLAYERS = [
  ['Lena', '🦊', 2140, false, 0],
  ['Ben', '🐼', 1980, true, 410],
  ['Ana', '🐸', 1890, true, 520],
  ['Max', '🦄', 1460, true, 350],
  ['Mia', '🐙', 1720, false, 0],
  ['Leo', '🦁', 1300, true, 280],
  ['Zoe', '🐨', 1150, null, 0],
  ['Finn', '🐯', 1040, true, 230],
  ['Ida', '🐧', 980, false, 0],
  ['Noah', '🦉', 760, true, 190],
  ['Emma', '🐢', 610, false, 0],
  ['Paul', '🐝', 420, true, 150],
];

/** Whose photo it is, and who I am. */
const OWNER = 'p1';
const ME = 'p2';

/**
 * The game for `count` players and my guess ('right' or 'wrong'): the players in join
 * order, each with `before`, `pick` (a player's id or null), `points` and `score` (after
 * this round); who owns the photo, who I am, and the round's number.
 */
export function game(count, guess) {
  const players = PLAYERS.slice(0, count).map(([name, avatar, before, right, points], i) => ({ id: `p${i}`, name, avatar, before, right, points }));
  const me = players.find((p) => p.id === ME);
  me.right = guess !== 'wrong';
  for (const [i, p] of players.entries()) {
    // A wrong pick is the next player who is not the owner (mine: Lena, the leader).
    const wrong = p === me ? players[0] : players.slice(i + 1).concat(players.slice(0, i)).find((x) => x.id !== OWNER);
    p.pick = p.right === null ? null : p.right ? OWNER : wrong.id;
    if (!p.right) p.points = 0;
    p.score = p.before + p.points;
  }
  return { players, owner: OWNER, me: ME, round: { n: 3, total: 10 } };
}
