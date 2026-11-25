/**
 * The streak (right answers in a row): its bonus formula, that its story fits the time the
 * room gives the reveal, and the badge on the two screens it shows on (web/js/streak.js,
 * web/js/ui.js, web/js/views/game.js and board.js). The motion itself only a browser shows
 * (drafts/streak_animations has the app's own story beside its draft).
 */
import { expect, test } from 'vitest';
import { REACTIONS, SCORING, TIMING, streakBonus, streakExtraMs } from '../../web/shared/config.js';
import { POP_MS } from '../../web/js/reveal.js';
import { storyMs } from '../../web/js/streak.js';
import { streakBadge, streakLook } from '../../web/js/ui.js';
import { boardScreen } from '../../web/js/views/board.js';
import { gameScreen } from '../../web/js/views/game.js';

/** The story ends at least this long before the reveal does (ms). */
const REST = 300;

test('the bonus is the step for every answer beyond the first, up to the cap', () => {
  expect([1, 2, 3, 5, 6, 7, 40].map(streakBonus)).toEqual([0, 1, 2, 4, 5, 5, 5].map((k) => Math.min(SCORING.streakMax, k * SCORING.streakStep)));
});

test('the story of every streak fits the reveal, which is longer only from a streak of 4 on, by at most its cap', () => {
  expect(streakExtraMs(3)).toBe(0);
  expect(streakExtraMs(4)).toBeGreaterThan(0);
  for (let n = 2; n <= 40; n++) {
    expect(POP_MS + storyMs(n) + REST, `a streak of ${n}`).toBeLessThanOrEqual(TIMING.revealMs + streakExtraMs(n));
    expect(streakExtraMs(n)).toBeLessThanOrEqual(TIMING.streakExtraMaxMs);
  }
});

test('a streak looks warmer in five tiers, and its badge is one element with the number, readable by a screen reader', () => {
  expect([2, 3, 4, 6, 7, 9, 10, 14, 15, 99].map((n) => streakLook(n).level)).toEqual([1, 1, 2, 2, 3, 3, 4, 4, 5, 5]);
  const normal = streakBadge(5);
  expect(normal).toContain('data-streak="5"');
  expect(normal).toContain('aria-label="5 right answers in a row"');
  expect(normal).toContain('streak-halo');
  expect(streakBadge(5, 'small')).not.toContain('streak-halo');
});

/** A round after photo `n` of 10 as the room tells it: `players` are [name, streak after the round, bonus]. */
function viewOf(players, phase) {
  const list = players.map(([name], i) => ({ id: `p${i}`, name, avatar: '🦊', score: 1000, connected: true }));
  return {
    phase, code: 'DRFT', me: { id: 'p0' }, hostId: 'p0', settings: { time: 10 }, players: list,
    round: { n: 3, total: 10, photo: 'x', owner: 'p1', options: list.map((p) => p.id), flag: null, results: Object.fromEntries(players.map(([, streak, bonus], i) => [`p${i}`, { pick: 'p1', points: 1000 + bonus, streak, bonus }])) },
  };
}
const shown = { picked: null, late: false, photo: 'ok', src: 'blob:x', loading: null, reactions: REACTIONS };

test('the reveal shows my streak as a badge at the bottom middle of the photo, from a streak of 2, and no slot without one', () => {
  expect(gameScreen({ view: viewOf([['Ann', 4, 300], ['Ben', 2, 100]], 'reveal') }, shown).parts.stage).toMatch(/data-streak-slot[^>]*>.*data-streak="4"/s);
  expect(gameScreen({ view: viewOf([['Ann', 1, 0], ['Ben', 5, 400]], 'reveal') }, shown).parts.stage).not.toContain('data-streak');
  expect(gameScreen({ view: viewOf([['Ann', 0, 0], ['Ben', 5, 400]], 'reveal') }, shown).parts.stage).not.toContain('data-streak');
  // Only the reveal has it: the question before it does not.
  expect(gameScreen({ view: { ...viewOf([['Ann', 4, 300], ['Ben', 2, 100]], 'show'), left: 1000 } }, shown).parts.stage).not.toContain('data-streak');
});

test('the leaderboard shows every streak of 2 or more on its player\'s avatar, and says it in words', () => {
  const board = boardScreen({ view: viewOf([['Ann', 4, 300], ['Ben', 1, 0], ['Cleo', 2, 100], ['Dan', 0, 0]], 'board') }, { reactions: REACTIONS, loading: null });
  const rows = board.parts.board.split('data-rank=').slice(1);
  const badges = rows.map((row) => (row.match(/data-streak="(\d+)"/) || [])[1]);
  const names = rows.map((row) => row.match(/<b class="truncate text-xl">([^<]*)<\/b>/)[1]);
  expect(Object.fromEntries(names.map((name, i) => [name, badges[i]]))).toEqual({ Ann: '4', Ben: undefined, Cleo: '2', Dan: undefined });
  expect(board.parts.board).toContain('4 right in a row');
});
