/**
 * Stand-in players for the end screen (never real people): a name, an avatar of the app's
 * list and a final score each, in the order they joined. The winner joined second and the
 * runner-up first, only a little behind, so where a player stands in a lineup or a race
 * gives nothing away and the fight for first place is close.
 */
const PLAYERS = [
  ['Lena', '🦊', 4710], ['Ben', '🐼', 4870], ['Ana', '🐸', 3920], ['Max', '🦄', 3310],
  ['Mia', '🐙', 3540], ['Leo', '🦁', 2980], ['Zoe', '🐨', 2700], ['Finn', '🐯', 2460],
  ['Ida', '🐧', 2210], ['Noah', '🦉', 1980], ['Emma', '🐢', 1720], ['Paul', '🐝', 1510],
  ['Sofia', '🦋', 1290], ['Jonas', '🐳', 1040], ['Lea', '🦒', 820], ['Tom', '🐌', 560],
];

/** The room's final standings as the end screen gets them (`view.final`, src/game/view.js), for the first `count` players. */
export function standings(count) {
  const players = PLAYERS.slice(0, count).map(([name, avatar, score], i) => ({ id: `p${i}`, name, avatar, score }));
  return { players, fastest: { id: players[Math.min(2, count - 1)].id, ms: 1430 }, fooler: { id: players[0].id, count: 3 } };
}
