/**
 * The game's state machine (src/game/rules.js), event by event and timer by timer.
 */
import { describe, expect, test } from 'vitest';
import { LIMITS, SCORING, TIMING } from '../../web/shared/config.js';
import { apply, nextWake } from '../../src/game/rules.js';
import { isServablePhoto, referencedPhotoIds } from '../../src/game/state.js';
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
    /** Ends the guessing the way a round really ends early: everyone answers (each picks themselves). */
    reveal() {
      for (const p of d.room.players) d.do('answer', { playerId: p.id, pick: p.id });
      return d;
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
    // Blocked words become "Player", also when disguised; real names stay.
    expect(roomWith(['B1TCH', 'Dick', 'Arsch loch', 'Hitchcock']).players.map((p) => p.name)).toEqual(['Player', 'Dick', 'Player', 'Hitchcock']);
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
    d.by('Ann', 'setting', { key: 'photos', value: 4 });
    expect(d.room.phase).toBe('lobby');
    expect(d.room.players.every((p) => !p.ready && p.photos.length === 0)).toBe(true);
  });

  test('a ready player keeps at most "Photos per player" photos', () => {
    const d = driver(roomWith(['Ann'], { settings: { photos: 4 } })).by('Ann', 'ready', { photos: ['1', '2', '3', '4', '5', 6] });
    expect(d.room.players[0].photos).toEqual(['1', '2', '3', '4']);
  });
});

describe('rounds', () => {
  test('the photo shows once every connected phone is ready for the round, or after the load limit', () => {
    const d = started();
    expect(d.room.phase).toBe('load');
    d.by('Ann', 'loaded', { round: 1 }).by('Ben', 'loaded', { round: 1 });
    expect(d.room.phase).toBe('load');
    // A report that names no round of the plan counts for nothing.
    d.by('Cleo', 'loaded', { round: 0 }).by('Cleo', 'loaded', { round: '1' });
    expect(d.room.phase).toBe('load');
    // Ready for a later round means ready for this one too (it holds every photo up to it).
    d.by('Cleo', 'loaded', { round: 2 });
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

  test('without a timer, only answers end the round (nobody can cut it short)', () => {
    const d = loadAll(started(['Ann', 'Ben'], { time: 0 }));
    expect(d.room.deadline).toBeNull();
    d.by('Ann', 'resolve').wait(TIMING.untimedReferenceMs * 10);
    expect(d.room.phase).toBe('show');
    d.by('Ann', 'answer', { pick: idOf(d.room, 'Ben') });
    expect(d.room.phase).toBe('show');
    d.by('Ben', 'answer', { pick: idOf(d.room, 'Ben') });
    expect(d.room.phase).toBe('reveal');
  });

  test('offline players do not hold up a round', () => {
    const d = loadAll(started());
    d.by('Cleo', 'disconnect');
    d.by('Ann', 'answer', { pick: idOf(d.room, 'Ann') }).by('Ben', 'answer', { pick: idOf(d.room, 'Ann') });
    expect(d.room.phase).toBe('reveal');
  });

  test('the reveal is timed, then the leaderboard; the next round comes after it, or when the host taps', () => {
    const d = loadAll(started()).reveal();
    d.wait(TIMING.revealMs - 1);
    expect(d.room.phase).toBe('reveal');
    d.wait(1);
    expect(d.room).toMatchObject({ phase: 'board', deadline: d.now + TIMING.boardMs });
    d.wait(TIMING.boardMs);
    expect(d.room).toMatchObject({ phase: 'load', game: { round: 2 } });
    const manual = loadAll(started(['Ann', 'Ben', 'Cleo'], { auto: false }));
    manual.reveal().by('Ann', 'next');
    expect(manual.room.phase).toBe('reveal');
    manual.wait(TIMING.revealMs).wait(TIMING.boardMs * 10);
    expect(manual.room).toMatchObject({ phase: 'board', deadline: null });
    manual.by('Ben', 'next');
    expect(manual.room.phase).toBe('board');
    manual.by('Ann', 'next');
    expect(manual.room.game.round).toBe(2);
  });

  test('"Show again" stops the board\'s clock while anyone holds it, then it runs on from where it stood', () => {
    const d = loadAll(started()).reveal().wait(TIMING.revealMs).wait(1000);
    expect(d.room.phase).toBe('board');
    d.by('Ben', 'peek', { on: true });
    expect(d.room.game.pausedAt).toBe(d.now);
    // While held, the deadline is no reason to wake up: only the hold's own end is.
    expect(nextWake(d.room)).toBe(d.now + TIMING.peekHoldMs);
    // Held for 10 s, renewed every second, by two players for a while: the board stays.
    for (let i = 0; i < 10; i++) d.wait(TIMING.peekRenewMs).by('Ben', 'peek', { on: true });
    d.by('Cleo', 'peek', { on: true }).by('Ben', 'peek', { on: false });
    expect(d.room.phase).toBe('board');
    d.by('Cleo', 'peek', { on: false });
    expect(d.room.game.pausedAt).toBeNull();
    expect(d.room.deadline).toBe(d.now + TIMING.boardMs - 1000);
    d.wait(TIMING.boardMs - 1001);
    expect(d.room.phase).toBe('board');
    d.wait(1);
    expect(d.room.phase).toBe('load');
  });

  test('a hold nobody renews ends by itself (a lost connection never stops the game)', () => {
    const d = loadAll(started()).reveal().wait(TIMING.revealMs);
    d.by('Ben', 'peek', { on: true });
    expect(nextWake(d.room)).toBe(d.now + TIMING.peekHoldMs);
    d.wait(TIMING.peekHoldMs);
    expect(d.room).toMatchObject({ phase: 'board', deadline: d.now + TIMING.boardMs, game: { peeks: {}, pausedAt: null } });
  });

  test('"Show again" only on the board, only by players, only while the photo exists', () => {
    const d = loadAll(started());
    d.by('Ben', 'peek', { on: true });
    expect(d.room.game.peeks).toEqual({});
    d.reveal().wait(TIMING.revealMs);
    d.do('peek', { playerId: 'nobody', on: true });
    expect(d.room.game.peeks).toEqual({});
    d.by('Ben', 'peek', { on: true }).by('Cleo', 'report');
    expect(d.room).toMatchObject({ phase: 'board', game: { peeks: {}, pausedAt: null } });
    expect(d.room.game.plan[0].photo).toBeNull();
    d.by('Ben', 'peek', { on: true });
    expect(d.room.game.peeks).toEqual({});
  });

  test('a held board saved by the previous server version runs on with the time it had left', () => {
    const d = loadAll(started()).reveal().wait(TIMING.revealMs).wait(1000);
    // The previous version kept the remaining time in `paused` and no deadline.
    const g = d.room.game;
    delete g.pausedAt;
    d.room = { ...d.room, deadline: null, game: { ...g, paused: 3000, peeks: { [idOf(d.room, 'Ben')]: d.now + 1000 } } };
    d.wait(1);
    expect(d.room).toMatchObject({ phase: 'board', game: { pausedAt: d.now } });
    expect(d.room.game.paused).toBeUndefined();
    d.wait(TIMING.peekHoldMs);
    expect(d.room).toMatchObject({ phase: 'board', deadline: d.now + 3000, game: { pausedAt: null } });
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

describe('the deal at the 3-2-1, and the photos ahead', () => {
  test('the game is dealt when the 3-2-1 starts, and dealt afresh whenever the deal stops holding', () => {
    const d = driver(roomWith(['Ann', 'Ben', 'Cleo']));
    d.by('Ann', 'ready', { photos: ['a1', 'a2'] }).by('Ben', 'ready', { photos: ['b1'] }).by('Cleo', 'ready', { photos: [] });
    expect(d.room).toMatchObject({ phase: 'countdown', game: { round: 0 } });
    expect(d.room.game.plan.map((e) => e.photo).sort()).toEqual(['a1', 'a2', 'b1']);
    // The photos are the players' until the game starts, but every phone may load them now.
    expect(referencedPhotoIds(d.room).sort()).toEqual(['a1', 'a2', 'b1']);
    expect(['a1', 'a2', 'b1'].every((id) => isServablePhoto(d.room, id))).toBe(true);
    // Ben says Yes to other photos: the deal no longer holds, a new 3-2-1 deals them.
    d.wait(1000).by('Ben', 'ready', { photos: ['b9'] });
    expect(d.room).toMatchObject({ phase: 'countdown', deadline: d.now + TIMING.countdownMs });
    expect(d.room.game.plan.map((e) => e.photo)).toContain('b9');
    // Cleo (no photos) is removed: the deal still holds, the 3-2-1 runs on.
    const deadline = d.room.deadline;
    d.wait(1000).by('Ann', 'kick', { target: idOf(d.room, 'Cleo') });
    expect(d.room).toMatchObject({ phase: 'countdown', deadline });
    // Ben unreadies: back to the lobby, the deal and its photo links are gone.
    d.by('Ben', 'unready');
    expect(d.room).toMatchObject({ phase: 'lobby', game: null });
    expect(isServablePhoto(d.room, 'a1')).toBe(false);
  });

  test('phones that load ahead: round 1 starts when all are ready, a leaderboard waits for the next round, at most the load limit', () => {
    const d = driver(roomWith(['Ann', 'Ben'], { ahead: true }));
    d.by('Ann', 'ready', { photos: ['a1', 'a2', 'a3'] }).by('Ben', 'ready', { photos: ['b1', 'b2', 'b3'] });
    // Both loaded what round 1 needs during the 3-2-1: it shows at once.
    d.by('Ann', 'loaded', { round: 1 }).by('Ben', 'loaded', { round: 1 }).wait(TIMING.countdownMs);
    expect(d.room).toMatchObject({ phase: 'show', game: { round: 1 } });
    // The leaderboard's time is up and Ben is not ready for round 2: it waits, without a timer.
    d.reveal().wait(TIMING.revealMs).by('Ann', 'loaded', { round: 2 }).wait(TIMING.boardMs);
    expect(d.room).toMatchObject({ phase: 'board', game: { waiting: true }, deadline: d.now + TIMING.loadMaxMs });
    expect(nextWake(d.room)).toBe(d.now + TIMING.loadMaxMs);
    d.by('Ben', 'loaded', { round: 2 });
    expect(d.room).toMatchObject({ phase: 'show', game: { round: 2, waiting: false } });
    // Ben never gets ready for round 3: the wait ends after the load limit.
    d.reveal().wait(TIMING.revealMs).by('Ann', 'loaded', { round: 3 }).wait(TIMING.boardMs);
    expect(d.room.game.waiting).toBe(true);
    d.wait(TIMING.loadMaxMs);
    expect(d.room).toMatchObject({ phase: 'load', game: { round: 3 } });
    // An offline phone never holds anyone up.
    d.by('Ben', 'disconnect');
    expect(d.room.phase).toBe('show');
  });

  test('when a player leaves, their later photos leave the plan and every phone reports again', () => {
    const d = driver(roomWith(['Ann', 'Ben', 'Cleo'], { ahead: true }));
    for (const name of ['Ann', 'Ben', 'Cleo']) d.by(name, 'ready', { photos: [`${name}1`, `${name}2`] });
    for (const p of d.room.players) d.do('loaded', { playerId: p.id, round: 3 });
    d.wait(TIMING.countdownMs);
    const leaving = d.room.game.plan.slice(1).find((e) => e.owner !== d.room.game.plan[0].owner).owner;
    d.do('leave', { playerId: leaving });
    expect(d.room.game.plan.slice(1).some((e) => e.owner === leaving)).toBe(false);
    expect(d.room.game.loaded).toEqual({});
  });
});

describe('scores and stats', () => {
  test('speed points, the owner\'s share on their own photo, fastest hit (owner excluded), best fooler', () => {
    const d = loadAll(started(['Ann', 'Ben', 'Cleo'], { time: 10, streak: true }));
    const owner = ownerOf(d);
    const others = d.room.players.filter((p) => p.id !== owner);
    d.do('answer', { playerId: owner, pick: owner });
    d.wait(2000).do('answer', { playerId: others[0].id, pick: owner });
    d.do('answer', { playerId: others[1].id, pick: others[0].id });
    const res = d.room.game.results;
    // "Own photo: Fewer points" (the default): right, at once, but 20% fewer points.
    expect(res[owner].points).toBe(SCORING.max * 0.8);
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
      // The round's photo stays through its reveal and leaderboard ("Show again").
      d.reveal().wait(TIMING.revealMs);
      expect(referencedPhotoIds(d.room)).toHaveLength(5 - round);
      d.by('Ann', 'next');
    }
    expect(d.room.phase).toBe('end');
    expect(referencedPhotoIds(d.room)).toEqual([]);
    expect(d.room.final.players.map((p) => p.score)).toEqual(d.room.players.map((p) => p.score));
    // Anyone opens the next game; the others stay on their results until they tap too.
    d.by('Ben', 'again');
    expect(d.room).toMatchObject({ phase: 'lobby', game: null });
    expect(d.room.players.every((p) => p.score === 0 && !p.ready)).toBe(true);
    expect(d.room.players.map((p) => [p.name, p.onResults])).toEqual([['Ann', true], ['Ben', false]]);
    expect(d.room.final).toBeTruthy();
    d.by('Ben', 'again');
    expect(d.room.players.map((p) => p.onResults)).toEqual([true, false]);
    // The next game waits for whoever is still on the results.
    d.by('Ben', 'ready', { photos: ['b9'] });
    expect(d.room.phase).toBe('lobby');
    d.by('Ann', 'again');
    expect(d.room.players.every((p) => !p.onResults)).toBe(true);
    expect(d.room.final).toBeNull();
    d.by('Ann', 'ready', { photos: [] });
    expect(d.room.phase).toBe('countdown');
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
    // In the lobby an offline host keeps the role (for example while in the phone's settings).
    lobby.by('Ben', 'disconnect').wait(TIMING.hostGraceMs * 2);
    expect(lobby.room.hostId).toBe(idOf(lobby.room, 'Ben'));
    const game = started(['Ann', 'Ben', 'Cleo'], { time: 0 });
    game.by('Ann', 'disconnect').wait(TIMING.hostGraceMs - 1);
    expect(game.room.hostId).toBe(idOf(game.room, 'Ann'));
    game.wait(1);
    expect(game.room.hostId).toBe(idOf(game.room, 'Ben'));
  });

  test('offline players leave the lobby after a while, but stay in a running game', () => {
    const lobby = driver(roomWith(['Ann', 'Ben'])).by('Ben', 'disconnect').wait(TIMING.lobbyDropMs);
    expect(lobby.room.players.map((p) => p.name)).toEqual(['Ann']);
    const game = started().by('Cleo', 'disconnect').wait(TIMING.lobbyDropMs * 3);
    expect(game.room.players).toHaveLength(3);
  });

  test('a game with fewer than two players left ends; an empty room keeps its code as an empty lobby', () => {
    const d = started(['Ann', 'Ben']);
    d.by('Ben', 'leave');
    expect(d.room.phase).toBe('end');
    d.by('Ann', 'leave');
    expect(d.room).toMatchObject({ closed: false, phase: 'lobby', hostId: null, game: null, final: null, players: [] });
    // The next morning: the same code, a fresh lobby, the first one back hosts.
    d.wait(TIMING.roomIdleMs - 1000).do('join', { key: 'key-Ann-0000000000', name: 'Ann', avatar: '🦊' });
    expect(d.room).toMatchObject({ closed: false, phase: 'lobby', hostId: idOf(d.room, 'Ann') });
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

describe('reports and removed players', () => {
  test('a reported photo is deleted at once: mid-guess the game moves on, in the reveal it just goes', () => {
    const d = loadAll(started());
    const photo = d.room.game.plan[0].photo;
    d.by('Ben', 'report');
    expect(d.room).toMatchObject({ phase: 'load', game: { round: 2 } });
    expect(referencedPhotoIds(d.room)).not.toContain(photo);
    expect(Object.values(d.room.game.results || {})).toEqual([]);
    loadAll(d).reveal();
    const revealed = d.room.game.plan[1].photo;
    d.by('Cleo', 'report');
    expect(d.room.phase).toBe('reveal');
    expect(d.room.game.plan[1].photo).toBeNull();
    expect(referencedPhotoIds(d.room)).not.toContain(revealed);
  });

  test('a flag holds the round: answers keep their time, Cancel lets it run on from where it stood', () => {
    const d = loadAll(started(['Ann', 'Ben', 'Cleo'], { time: 10 }));
    const round = d.room.game.round;
    d.wait(2000).by('Ben', 'flag', { round, on: true });
    expect(d.room.game.flag).toEqual({ by: idOf(d.room, 'Ben'), until: d.now + TIMING.flagMs });
    expect(d.room.game.pausedAt).toBe(d.now);
    // Held for 8 s, longer than the time left: the round does not move on, and an answer
    // (from an app that still shows the photo) counts as given when the clock stopped.
    d.wait(8000).by('Ann', 'answer', { pick: idOf(d.room, 'Cleo') });
    expect(d.room.phase).toBe('show');
    expect(d.room.game.answers[idOf(d.room, 'Ann')].ms).toBe(2000);
    // Only the flagger can cancel; then the clock runs on with the 8 s it had left.
    d.by('Cleo', 'flag', { round, on: false });
    expect(d.room.game.flag).not.toBeNull();
    d.by('Ben', 'flag', { round, on: false });
    expect(d.room.game).toMatchObject({ flag: null, pausedAt: null });
    expect(d.room.deadline).toBe(d.now + 8000 + TIMING.answerGraceMs);
    expect(d.room.game.plan[0].photo).toBeTruthy();
  });

  test('a flag is deleted by Delete, after its time, or when its flagger is gone; one flag at a time', () => {
    const d = loadAll(started());
    const first = d.room.game.plan[0].photo;
    d.by('Ben', 'flag', { round: 1, on: true }).by('Cleo', 'flag', { round: 1, on: true });
    expect(d.room.game.flag.by).toBe(idOf(d.room, 'Ben'));
    // A Delete meant for another round (a late tap) changes nothing.
    d.by('Ben', 'report', { round: 2 });
    expect(d.room.game.plan[0].photo).toBe(first);
    d.by('Ben', 'report', { round: 1 });
    expect(d.room).toMatchObject({ phase: 'load', game: { round: 2, flag: null } });
    expect(referencedPhotoIds(d.room)).not.toContain(first);
    // Nobody decides: after TIMING.flagMs it is deleted like a Delete.
    loadAll(d).by('Cleo', 'flag', { round: 2, on: true });
    expect(nextWake(d.room)).toBe(d.room.game.flag.until);
    d.wait(TIMING.flagMs - 1);
    expect(d.room.game.round).toBe(2);
    d.wait(1);
    expect(d.room.game).toMatchObject({ round: 3, flag: null });
    // On the reveal a flag holds it too; the flagger leaving deletes the photo, the reveal goes on.
    loadAll(d).reveal().by('Ann', 'flag', { round: 3, on: true });
    d.wait(TIMING.revealMs * 2);
    expect(d.room.phase).toBe('reveal');
    d.by('Ann', 'leave');
    expect(d.room).toMatchObject({ phase: 'reveal', game: { flag: null, pausedAt: null } });
    expect(d.room.game.plan[2].photo).toBeNull();
  });

  test('a flag only on the photo on screen while it is guessed or revealed', () => {
    const d = started();
    d.by('Ben', 'flag', { round: 1, on: true });
    expect(d.room.game.flag).toBeNull();
    loadAll(d).by('Ben', 'flag', { round: 2, on: true }).do('flag', { playerId: 'nobody', round: 1, on: true });
    expect(d.room.game.flag).toBeNull();
    d.reveal().wait(TIMING.revealMs).by('Ben', 'flag', { round: 1, on: true });
    expect(d.room).toMatchObject({ phase: 'board', game: { flag: null } });
  });

  test('only the host removes a player; their photos go and their key cannot rejoin', () => {
    const d = driver(roomWith(['Ann', 'Ben', 'Cleo'])).by('Ben', 'ready', { photos: ['b1'] });
    d.by('Cleo', 'kick', { target: idOf(d.room, 'Ben') });
    expect(d.room.players).toHaveLength(3);
    d.by('Ann', 'kick', { target: idOf(d.room, 'Ann') });
    expect(d.room.players).toHaveLength(3);
    d.by('Ann', 'kick', { target: idOf(d.room, 'Ben') });
    expect(d.room.players.map((p) => p.name)).toEqual(['Ann', 'Cleo']);
    expect(referencedPhotoIds(d.room)).toEqual([]);
    d.do('join', { key: 'key-Ben-0000000000', name: 'Ben', avatar: '🐼' });
    expect(d.room.players).toHaveLength(2);
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
    d.reveal();
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
