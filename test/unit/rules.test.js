/**
 * The game's state machine (src/game/rules.js), event by event and timer by timer.
 */
import { describe, expect, test } from 'vitest';
import { LIMITS, SCORING, TIMING } from '../../web/shared/config.js';
import { apply, nextWake } from '../../src/game/rules.js';
import { referencedPhotoIds, referencedPoolTokens } from '../../src/game/state.js';
import { T0, idOf, roomWith, seededRandom } from '../helpers.js';

const rng = seededRandom(7);

/** A tiny driver: apply events and advance a clock. */
function driver(room, now = T0) {
  const d = {
    room,
    now,
    do(type, payload = {}) {
      d.room = apply(d.room, { type, ...payload }, d.now, rng);
      return d;
    },
    by(name, type, payload = {}) {
      return d.do(type, { playerId: idOf(d.room, name), ...payload });
    },
    wait(ms) {
      d.now += ms;
      return d.do('tick');
    },
  };
  return d;
}

/** Everyone ready with two photos each, the countdown run, the first round loaded. */
function started(names = ['Ann', 'Ben', 'Cleo'], settings = {}) {
  const d = driver(roomWith(names, { settings }));
  for (const name of names) d.by(name, 'ready', { photos: [`${name.toLowerCase()}1`, `${name.toLowerCase()}2`] });
  d.wait(TIMING.countdownMs);
  return d;
}

function loadAll(d) {
  for (const p of d.room.players) d.do('loaded', { playerId: p.id, round: d.room.game.round });
  return d;
}

const ownerOf = (d) => d.room.game.plan[d.room.game.round - 1].owner;

describe('joining', () => {
  test('the first player hosts; the same key resumes the same player', () => {
    let room = roomWith(['Ann', 'Ben']);
    expect(room.hostId).toBe(idOf(room, 'Ann'));
    const id = idOf(room, 'Ben');
    room = apply(room, { type: 'disconnect', playerId: id }, T0, rng);
    room = apply(room, { type: 'join', key: 'key-Ben-0000000000', name: 'Benny', avatar: '🐼' }, T0 + 1000, rng);
    expect(room.players).toHaveLength(2);
    const ben = room.players.find((p) => p.id === id);
    expect(ben).toMatchObject({ name: 'Benny', avatar: '🐼', connected: true });
  });

  test('avatars are unique in a room: a taken one is swapped for a free one', () => {
    const room = roomWith(['Ann', 'Ben', 'Cleo']);
    expect(room.players[0].avatar).toBe('🦊');
    expect(new Set(room.players.map((p) => p.avatar)).size).toBe(3);
    const renamed = apply(room, { type: 'join', key: 'key-Ben-0000000000', name: 'Ben', avatar: '🦊' }, T0, rng);
    expect(renamed.players[1].avatar).toBe(room.players[1].avatar);
    expect(roomWith(Array.from({ length: LIMITS.maxPlayers }, (_, i) => `P${i}`)).players.every((p, i, all) => all.findIndex((q) => q.avatar === p.avatar) === i)).toBe(true);
  });

  test('names are cleaned and required; the room has a size limit', () => {
    let room = roomWith(['  Ann\u0007  ']);
    expect(room.players[0].name).toBe('Ann');
    room = apply(room, { type: 'join', key: 'key-blank-00000000', name: '   ', avatar: '🦊' }, T0, rng);
    expect(room.players).toHaveLength(1);
    const names = Array.from({ length: LIMITS.maxPlayers + 2 }, (_, i) => `P${i}`);
    expect(roomWith(names).players).toHaveLength(LIMITS.maxPlayers);
  });
});

describe('lobby and countdown', () => {
  test('starts by itself when everyone is ready and someone has photos', () => {
    const d = driver(roomWith(['Ann', 'Ben']));
    d.by('Ann', 'ready', { photos: ['a1'] });
    expect(d.room.phase).toBe('lobby');
    d.by('Ben', 'ready', { photos: [] });
    expect(d.room.phase).toBe('countdown');
    d.wait(TIMING.countdownMs - 1);
    expect(d.room.phase).toBe('countdown');
    d.wait(1);
    expect(d.room.phase).toBe('load');
    expect(d.room.game.plan).toEqual([{ owner: idOf(d.room, 'Ann'), photo: 'a1' }]);
    // The photos now belong to the plan; readiness is spent.
    expect(d.room.players.every((p) => !p.ready && p.photos.length === 0)).toBe(true);
  });

  test('needs two players, and at least one photo in the game', () => {
    const solo = driver(roomWith(['Ann'])).by('Ann', 'ready', { photos: ['a1'] });
    expect(solo.room.phase).toBe('lobby');
    const noPhotos = driver(roomWith(['Ann', 'Ben'])).by('Ann', 'ready', { photos: [] }).by('Ben', 'ready', { photos: [] });
    expect(noPhotos.room.phase).toBe('lobby');
  });

  test('the countdown stops when someone unreadies, joins or goes offline', () => {
    const d = driver(roomWith(['Ann', 'Ben'])).by('Ann', 'ready', { photos: ['a1'] }).by('Ben', 'ready', { photos: [] });
    d.by('Ben', 'unready');
    expect(d.room.phase).toBe('lobby');
    d.by('Ben', 'ready', { photos: [] });
    d.do('join', { key: 'key-Cleo-0000000000', name: 'Cleo' });
    expect(d.room.phase).toBe('lobby');
    d.by('Cleo', 'ready', { photos: [] });
    expect(d.room.phase).toBe('countdown');
    d.by('Cleo', 'disconnect');
    expect(d.room.phase).toBe('lobby');
  });

  test('only the host changes settings; a new photo count asks everyone to choose again', () => {
    const d = driver(roomWith(['Ann', 'Ben'])).by('Ann', 'ready', { photos: ['a1'] }).by('Ben', 'ready', { photos: ['b1'] });
    d.by('Ben', 'setting', { key: 'time', value: 30 });
    expect(d.room.settings.time).toBe(10);
    d.by('Ann', 'setting', { key: 'time', value: 31 });
    expect(d.room.settings.time).toBe(10);
    // A valid change restarts the countdown from the top.
    d.wait(2000).by('Ann', 'setting', { key: 'time', value: 30 });
    expect(d.room).toMatchObject({ phase: 'countdown', deadline: d.now + TIMING.countdownMs });
    d.by('Ann', 'setting', { key: 'photos', value: 3 });
    expect(d.room.phase).toBe('lobby');
    expect(d.room.players.every((p) => !p.ready && p.photos.length === 0)).toBe(true);
  });

  test('a ready player keeps at most "Photos per player" photos', () => {
    const d = driver(roomWith(['Ann'], { settings: { photos: 3 } })).by('Ann', 'ready', { photos: ['1', '2', '3', '4', 5] });
    expect(d.room.players[0].photos).toEqual(['1', '2', '3']);
  });
});

describe('rounds', () => {
  test('the photo shows once every connected player has it, or after the load limit', () => {
    const d = started();
    expect(d.room.phase).toBe('load');
    d.by('Ann', 'loaded', { round: 1 }).by('Ben', 'loaded', { round: 1 });
    expect(d.room.phase).toBe('load');
    d.by('Cleo', 'loaded', { round: 2 });
    expect(d.room.phase).toBe('load');
    d.by('Cleo', 'loaded', { round: 1 });
    expect(d.room.phase).toBe('show');
    const late = started();
    late.wait(TIMING.loadMaxMs);
    expect(late.room.phase).toBe('show');
  });

  test('everyone answers, the owner too, and anyone may pick themselves', () => {
    const d = loadAll(started());
    const owner = ownerOf(d);
    for (const p of d.room.players) d.do('answer', { playerId: p.id, pick: p.id });
    expect(d.room.phase).toBe('reveal');
    for (const p of d.room.players) {
      expect(d.room.game.results[p.id].pick).toBe(p.id);
      expect(d.room.game.results[p.id].points > 0).toBe(p.id === owner);
    }
  });

  test('answers: one per player, only listed options, not after time is up', () => {
    const d = loadAll(started(['Ann', 'Ben', 'Cleo'], { time: 5 }));
    const ann = idOf(d.room, 'Ann');
    d.by('Ann', 'answer', { pick: 'nobody' });
    expect(d.room.game.answers[ann]).toBeUndefined();
    d.wait(1000).by('Ann', 'answer', { pick: idOf(d.room, 'Ben') });
    d.by('Ann', 'answer', { pick: idOf(d.room, 'Cleo') });
    expect(d.room.game.answers[ann]).toEqual({ pick: idOf(d.room, 'Ben'), ms: 1000 });
    d.now += 5000 + TIMING.answerGraceMs + 1;
    d.by('Ben', 'answer', { pick: ann });
    expect(d.room.game.answers[idOf(d.room, 'Ben')]).toBeUndefined();
  });

  test('time running out reveals, after the grace period', () => {
    const d = loadAll(started(['Ann', 'Ben'], { time: 5 }));
    d.wait(5000);
    expect(d.room.phase).toBe('show');
    d.wait(TIMING.answerGraceMs);
    expect(d.room.phase).toBe('reveal');
  });

  test('without a timer, only answers (or the host) end the round', () => {
    const d = loadAll(started(['Ann', 'Ben'], { time: 0 }));
    expect(d.room.deadline).toBeNull();
    d.by('Ben', 'resolve');
    expect(d.room.phase).toBe('show');
    d.by('Ann', 'resolve');
    expect(d.room.phase).toBe('reveal');
  });

  test('offline players do not hold up a round', () => {
    const d = loadAll(started());
    d.by('Cleo', 'disconnect');
    d.by('Ann', 'answer', { pick: idOf(d.room, 'Ann') }).by('Ben', 'answer', { pick: idOf(d.room, 'Ann') });
    expect(d.room.phase).toBe('reveal');
  });

  test('automatic next round after the reveal, or when the host taps', () => {
    const d = loadAll(started());
    d.by('Ann', 'resolve');
    d.wait(TIMING.revealMs);
    expect(d.room).toMatchObject({ phase: 'load', game: { round: 2 } });
    const manual = loadAll(started(['Ann', 'Ben', 'Cleo'], { auto: false }));
    manual.by('Ann', 'resolve').wait(TIMING.revealMs * 10);
    expect(manual.room.phase).toBe('reveal');
    manual.by('Ben', 'next');
    expect(manual.room.phase).toBe('reveal');
    manual.by('Ann', 'next');
    expect(manual.room.game.round).toBe(2);
  });

  test('effects: mix draws a real effect per round; zoom starts away from the edges', () => {
    const d = started(['Ann', 'Ben'], { mode: 'mix' });
    expect(['classic', 'blur', 'zoom', 'pixel']).toContain(d.room.game.mode);
    expect(d.room.game.zoom.x).toBeGreaterThanOrEqual(20);
    expect(d.room.game.zoom.x).toBeLessThanOrEqual(80);
  });

  test('"Answers: Only 4" lists the owner and three others', () => {
    const d = started(['A', 'B', 'C', 'D', 'E', 'F'], { answers: 4 });
    expect(d.room.game.options).toHaveLength(4);
    expect(d.room.game.options).toContain(ownerOf(d));
  });
});

describe('scores and stats', () => {
  test('speed points, streak bonus, fastest hit (owner excluded), best fooler', () => {
    const d = loadAll(started(['Ann', 'Ben', 'Cleo'], { time: 10, streak: true }));
    const owner = ownerOf(d);
    const others = d.room.players.filter((p) => p.id !== owner);
    d.do('answer', { playerId: owner, pick: owner });
    d.wait(2000).do('answer', { playerId: others[0].id, pick: owner });
    d.do('answer', { playerId: others[1].id, pick: others[0].id });
    const res = d.room.game.results;
    expect(res[owner].points).toBe(SCORING.max);
    expect(res[others[0].id].points).toBe(Math.round(SCORING.min + (SCORING.max - SCORING.min) * 0.8));
    expect(res[others[1].id].points).toBe(0);
    expect(d.room.game.stats.fastest).toEqual({ id: others[0].id, ms: 2000 });
    expect(d.room.game.stats.fooled[owner]).toBe(1);
  });
});

describe('the end and again', () => {
  test('the game ends after the last round with every photo released; again returns to the lobby', () => {
    const d = loadAll(started(['Ann', 'Ben'], { rounds: 0 }));
    expect(d.room.game.plan).toHaveLength(4);
    expect(referencedPhotoIds(d.room)).toHaveLength(4);
    for (let round = 1; round <= 4; round++) {
      if (round > 1) loadAll(d);
      expect(referencedPhotoIds(d.room)).toHaveLength(5 - round);
      d.by('Ann', 'resolve').by('Ann', 'next');
    }
    expect(d.room.phase).toBe('end');
    expect(referencedPhotoIds(d.room)).toEqual([]);
    d.by('Ben', 'again');
    expect(d.room.phase).toBe('end');
    d.by('Ann', 'again');
    expect(d.room).toMatchObject({ phase: 'lobby', game: null });
    expect(d.room.players.every((p) => p.score === 0 && !p.ready)).toBe(true);
  });
});

describe('leaving and connections', () => {
  test("the owner leaving mid-round deletes their photos and moves on", () => {
    const d = loadAll(started());
    const owner = ownerOf(d);
    const name = d.room.players.find((p) => p.id === owner).name;
    d.by(name, 'leave');
    expect(d.room.players.find((p) => p.id === owner)).toBeUndefined();
    expect(d.room.phase).toBe('load');
    expect(d.room.game.plan.slice(d.room.game.round - 1).some((e) => e.owner === owner)).toBe(false);
  });

  test('the host role moves on when the host leaves, or stays offline during a game', () => {
    const lobby = driver(roomWith(['Ann', 'Ben', 'Cleo']));
    lobby.by('Ann', 'leave');
    expect(lobby.room.hostId).toBe(idOf(lobby.room, 'Ben'));
    // In the lobby an offline host keeps the role (for example while fetching photos).
    lobby.by('Ben', 'disconnect').wait(TIMING.hostGraceMs * 2);
    expect(lobby.room.hostId).toBe(idOf(lobby.room, 'Ben'));
    const game = started(['Ann', 'Ben', 'Cleo'], { time: 0 });
    game.by('Ann', 'disconnect').wait(TIMING.hostGraceMs - 1);
    expect(game.room.hostId).toBe(idOf(game.room, 'Ann'));
    game.wait(1);
    expect(game.room.hostId).toBe(idOf(game.room, 'Ben'));
  });

  test('shortcut uploads keep a player who is away in the Shortcuts app in the lobby', () => {
    const d = driver(roomWith(['Ann', 'Ben']));
    const token = d.room.players[1].pool.token;
    d.by('Ben', 'disconnect');
    for (let i = 0; i < 5; i++) d.wait(TIMING.lobbyDropMs / 2).do('poolAdd', { token });
    d.wait(TIMING.lobbyDropMs / 2).do('poolDone', { token });
    d.wait(TIMING.lobbyDropMs - 1);
    expect(d.room.players).toHaveLength(2);
    d.wait(1);
    expect(d.room.players).toHaveLength(1);
  });

  test('offline players leave the lobby after a while, but stay in a running game', () => {
    const lobby = driver(roomWith(['Ann', 'Ben'])).by('Ben', 'disconnect').wait(TIMING.lobbyDropMs);
    expect(lobby.room.players.map((p) => p.name)).toEqual(['Ann']);
    const game = started().by('Cleo', 'disconnect').wait(TIMING.lobbyDropMs * 3);
    expect(game.room.players).toHaveLength(3);
  });

  test('a game with fewer than two players left ends; an empty room closes', () => {
    const d = started(['Ann', 'Ben']);
    d.by('Ben', 'leave');
    expect(d.room.phase).toBe('end');
    d.by('Ann', 'leave');
    expect(d.room.closed).toBe(true);
  });

  test('a room with no activity closes after the idle time', () => {
    const d = driver(roomWith(['Ann']));
    d.wait(TIMING.roomIdleMs - 1);
    expect(d.room.closed).toBe(false);
    d.wait(1);
    expect(d.room.closed).toBe(true);
    expect(nextWake(d.room)).toBeNull();
  });
});

describe('the iPhone pool', () => {
  test('photos count up to the limit, then the browser takes them and the link changes', () => {
    const d = driver(roomWith(['Ann']));
    const token = d.room.players[0].pool.token;
    for (let i = 0; i < LIMITS.poolMax + 3; i++) d.do('poolAdd', { token });
    expect(d.room.players[0].pool.count).toBe(LIMITS.poolMax);
    expect(referencedPoolTokens(d.room)).toEqual([token]);
    d.do('poolDone', { token });
    expect(d.room.players[0].pool.done).toBe(true);
    d.by('Ann', 'poolTaken');
    expect(d.room.players[0].pool).toMatchObject({ count: 0, done: false });
    expect(d.room.players[0].pool.token).not.toBe(token);
    expect(referencedPoolTokens(d.room)).toEqual([]);
  });

  test('an uncollected pool expires', () => {
    const d = driver(roomWith(['Ann']));
    d.do('poolAdd', { token: d.room.players[0].pool.token });
    d.wait(TIMING.poolTtlMs);
    expect(d.room.players[0].pool.count).toBe(0);
  });
});

describe('timers', () => {
  test('nextWake is never in the past after an event', () => {
    const d = started();
    const check = () => expect(nextWake(d.room)).toBeGreaterThan(d.now);
    check();
    loadAll(d);
    check();
    d.by('Ben', 'disconnect');
    check();
    d.by('Ann', 'resolve');
    check();
  });

  test('a host offline with nobody else here sets no host timer (no alarm loop)', () => {
    const d = started(['Ann', 'Ben'], { time: 0 }).by('Ann', 'disconnect').by('Ben', 'disconnect').wait(TIMING.hostGraceMs * 2);
    expect(nextWake(d.room)).toBeGreaterThan(d.now);
  });

  test('apply never mutates the room it is given', () => {
    const room = roomWith(['Ann', 'Ben']);
    const before = JSON.stringify(room);
    apply(room, { type: 'ready', playerId: idOf(room, 'Ann'), photos: ['x'] }, T0, rng);
    expect(JSON.stringify(room)).toBe(before);
  });
});
