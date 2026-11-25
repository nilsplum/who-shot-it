/**
 * The leaderboard: who wears the gold medal (web/js/views/board.js) and that its story fits
 * the time the room gives it (web/js/board.js, TIMING.boardStoryMs). The motion itself only a
 * browser shows (the end-to-end tests play every board to its end and check where the rows
 * and the medal stand).
 */
import { expect, test } from 'vitest';
import { REACTIONS, TIMING } from '../../web/shared/config.js';
import { STORY_MS } from '../../web/js/board.js';
import { boardScreen } from '../../web/js/views/board.js';

/** The board after round 3 of 10 for `players`: [name, total after the round, points it won], me first. */
function boardOf(players, state = { loading: null }) {
  const view = {
    phase: 'board', code: 'DRFT', me: { id: 'p0' }, hostId: 'p0', settings: {},
    players: players.map(([name, score], i) => ({ id: `p${i}`, name, avatar: '🦊', score })),
    round: { n: 3, total: 10, photo: 'x', owner: 'p0', results: Object.fromEntries(players.map(([, , points], i) => [`p${i}`, { pick: points ? 'p0' : null, points }])) },
  };
  return boardScreen({ view }, { reactions: REACTIONS, ...state });
}

/** The names of the rows that wear the medal, in the order of the board. */
function medals(board) {
  return board.parts.board.split('data-rank=').slice(1).filter((row) => row.includes('data-medal')).map((row) => row.match(/<b class="truncate text-xl">([^<]*)<\/b>/)[1]);
}

test('the leader wears the medal, and so does everyone tied with them', () => {
  expect(medals(boardOf([['Ana', 2410, 520], ['Ben', 1980, 410], ['Lena', 2140, 0]]))).toEqual(['Ana']);
  expect(medals(boardOf([['Ana', 2410, 520], ['Ben', 2410, 410], ['Lena', 2140, 0]]))).toEqual(['Ana', 'Ben']);
});

test('nobody wears it before the first points are won, and nobody without points', () => {
  // Round 1 with nobody right: everyone is first with 0, and nobody leads.
  expect(medals(boardOf([['Ana', 0, 0], ['Ben', 0, 0], ['Lena', 0, 0]]))).toEqual([]);
  // The first points: only those who won them lead, not the ones tied for first before.
  expect(medals(boardOf([['Ana', 0, 0], ['Ben', 500, 500], ['Lena', 0, 0]]))).toEqual(['Ben']);
});

test('a medal stays hidden while the story plays, until it lands', () => {
  const html = boardOf([['Ana', 500, 500], ['Ben', 0, 0]]).parts.board;
  expect(html).toContain('in-data-playing:not-data-go:invisible');
  expect(html).toContain('data-go:animate-lb-medal');
});

test('there is no timer bar on the board, only an empty slot that holds the loading bar while the table waits', () => {
  const calm = boardOf([['Ana', 500, 500], ['Ben', 0, 0]]);
  expect(calm.layout).not.toContain('tbar');
  expect(calm.parts.loading).toBe('');
  expect(boardOf([['Ana', 500, 500], ['Ben', 0, 0]], { loading: 0.4 }).parts.loading).toContain('role="progressbar"');
});

test('the story fits its time, and the game goes on 1.5 s after it ends', () => {
  expect(STORY_MS).toBeLessThanOrEqual(TIMING.boardStoryMs);
  expect(TIMING.boardRestMs).toBe(1500);
  expect(TIMING.boardMs).toBe(TIMING.boardStoryMs + TIMING.boardRestMs);
});
