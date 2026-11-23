/**
 * The Worker and the room's Durable Object together, over real HTTP and WebSocket requests
 * in the Workers runtime: who may call the API, creating and joining rooms, uploads, what
 * the room stores and sends (only real changes, only to phones that see them), the game
 * flow driven by the alarm, photo access rules, flags, reports and removed players, and
 * deleting everything at the end.
 */
import { env, exports } from 'cloudflare:workers';
import { runDurableObjectAlarm, runInDurableObject } from 'cloudflare:test';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { API, CLOSE } from '../../web/shared/api.js';
import { LIMITS, SERVER, TIMING } from '../../web/shared/config.js';
import { rooms } from '../../src/worker.js';
import photo1 from '../fixtures/photo-1.jpg?inline';
import photo2 from '../fixtures/photo-2.jpg?inline';

const ORIGIN = 'https://whoshot.test';
const JPEGS = [photo1, photo2].map((dataUrl) => Uint8Array.from(atob(dataUrl.split(',')[1]), (c) => c.charCodeAt(0)));
const call = (path, init) => exports.default.fetch(`${ORIGIN}${path}`, init);
const keyFor = (name) => `test-key-${name}-${'x'.repeat(16)}`;

afterEach(() => vi.useRealTimers());

async function createRoom(settings = {}) {
  const res = await call(API.rooms(), { method: 'POST', body: JSON.stringify({ settings }) });
  expect(res.status).toBe(201);
  return (await res.json()).code;
}

/** A WebSocket player: collects messages and close events, and waits for views. */
async function connect(code, name) {
  const res = await call(API.socket(code), { headers: { Upgrade: 'websocket' } });
  const ws = res.webSocket;
  const player = { ws, key: keyFor(name), messages: [], closed: null, waiters: [] };
  ws.accept();
  const notify = () => {
    player.waiters = player.waiters.filter((w) => !w());
  };
  ws.addEventListener('message', (e) => {
    player.messages.push(JSON.parse(e.data));
    notify();
  });
  ws.addEventListener('close', (e) => {
    player.closed = e.code;
    notify();
  });
  player.send = (msg) => ws.send(JSON.stringify(msg));
  player.view = () => [...player.messages].reverse().find((m) => m.type === 'state')?.view;
  /** Resolves with the first (latest) view matching `check`. */
  player.until = (check) => new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timed out; last view: ${JSON.stringify(player.view())}`)), 3000);
    const test = () => {
      const v = player.view();
      if (v && check(v)) {
        clearTimeout(timer);
        resolve(v);
        return true;
      }
      return false;
    };
    if (!test()) player.waiters.push(test);
  });
  player.closedWith = () => new Promise((resolve) => {
    const test = () => (player.closed !== null ? (resolve(player.closed), true) : false);
    if (!test()) player.waiters.push(test);
  });
  if (name) player.send({ type: 'hello', key: player.key, name, avatar: '🦊' });
  return player;
}

function upload(code, key, blobs) {
  const form = new FormData();
  blobs.forEach((b, i) => form.append('photo', new Blob([b], { type: 'image/jpeg' }), `${i}.jpg`));
  return call(API.photos(code), { method: 'PUT', headers: { Authorization: `Bearer ${key}` }, body: form });
}

const stub = (code) => rooms(env).getByName(code);
const countRows = (code, table) => runInDurableObject(stub(code), (instance) => instance.sql.exec(`SELECT COUNT(*) AS n FROM ${table}`).one().n);

/** Moves the room's clock forward by running its alarm with a faked Date. */
async function advance(code, ms) {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(Date.now() + ms);
  await runDurableObjectAlarm(stub(code));
}

describe('who may call the API', () => {
  test('the store apps get CORS headers, including the preflight for their Authorization header', async () => {
    for (const origin of SERVER.appOrigins) {
      const pre = await call(API.photos('ABCD'), { method: 'OPTIONS', headers: { Origin: origin, 'Access-Control-Request-Method': 'PUT' } });
      expect(pre.status).toBe(204);
      expect(pre.headers.get('Access-Control-Allow-Origin')).toBe(origin);
      expect(pre.headers.get('Access-Control-Allow-Headers')).toContain('Authorization');
      const res = await call(API.rooms(), { method: 'POST', headers: { Origin: origin }, body: '{}' });
      expect(res.status).toBe(201);
      expect(res.headers.get('Access-Control-Allow-Origin')).toBe(origin);
    }
  });

  test('other web pages are refused, sockets included; the server\'s own pages are not', async () => {
    const evil = { Origin: 'https://evil.example' };
    expect((await call(API.rooms(), { method: 'POST', headers: evil, body: '{}' })).status).toBe(403);
    const code = await createRoom();
    expect((await call(API.socket(code), { headers: { ...evil, Upgrade: 'websocket' } })).status).toBe(403);
    const own = await call(API.rooms(), { method: 'POST', headers: { Origin: ORIGIN }, body: '{}' });
    expect(own.status).toBe(201);
    expect(own.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });
});

describe('rooms and players', () => {
  test('a new room greets its first player as host, with the creator\'s settings', async () => {
    const code = await createRoom({ photos: 4, mode: 'pixel', evil: 1 });
    const ann = await connect(code, 'Ann');
    const view = await ann.until((v) => v.me);
    expect(view).toMatchObject({ code, phase: 'lobby', hostId: view.me.id, settings: { photos: 4, mode: 'pixel' } });
    expect(view.settings.evil).toBeUndefined();
  });

  test('an unknown code ends the socket with "gone" and leaves no storage behind', async () => {
    const ghost = await connect('ZZZZ', 'Ann');
    expect(await ghost.closedWith()).toBe(CLOSE.gone);
    const tables = await runInDurableObject(stub('ZZZZ'), (i) => i.sql.exec("SELECT name FROM sqlite_master WHERE type = 'table'").toArray());
    expect(tables).toEqual([]);
  });

  test('malformed paths and codes never reach a room', async () => {
    expect((await call('/api/rooms/abcd/socket')).status).toBe(404);
    expect((await call('/api/rooms/AB0D/photos/x')).status).toBe(404);
    expect((await call('/api/whatever')).status).toBe(404);
  });

  test('a second tab of the same player takes over; the first is told so', async () => {
    const code = await createRoom();
    const first = await connect(code, 'Ann');
    await first.until((v) => v.me);
    const second = await connect(code, 'Ann');
    await second.until((v) => v.me);
    expect(await first.closedWith()).toBe(CLOSE.replaced);
    expect(second.view().players).toHaveLength(1);
    expect(second.view().players[0].connected).toBe(true);
  });

  test('a full room refuses new players', async () => {
    const code = await createRoom();
    for (let i = 0; i < LIMITS.maxPlayers; i++) await (await connect(code, `P${i}`)).until((v) => v.me);
    const late = await connect(code, 'Late');
    expect(await late.closedWith()).toBe(CLOSE.full);
  });
});

describe('uploads', () => {
  test('only JPEGs from a known player, at most "Photos per player"', async () => {
    const code = await createRoom({ photos: 4 });
    const ann = await connect(code, 'Ann');
    await ann.until((v) => v.me);
    expect((await upload(code, keyFor('Nobody'), [JPEGS[0]])).status).toBe(401);
    expect((await upload(code, ann.key, [new TextEncoder().encode('not a photo')])).status).toBe(415);
    expect((await upload(code, ann.key, [JPEGS[0], JPEGS[1], JPEGS[0], JPEGS[1], JPEGS[0]])).status).toBe(400);
    expect(await countRows(code, 'photos')).toBe(0);
    expect((await upload(code, ann.key, JPEGS)).status).toBe(204);
    await ann.until((v) => v.me.ready && v.me.photoCount === 2);
    expect(await countRows(code, 'photos')).toBe(2);
    // Unready deletes them at once.
    ann.send({ type: 'unready' });
    await ann.until((v) => !v.me.ready);
    expect(await countRows(code, 'photos')).toBe(0);
  });
});

describe('what the room stores and sends', () => {
  test('a message that changes nothing costs nothing, and a phone gets a view only when what it shows changed', async () => {
    const code = await createRoom({ photos: 4 });
    const ann = await connect(code, 'Ann');
    const ben = await connect(code, 'Ben');
    await ann.until((v) => v.players.length === 2);
    await ben.until((v) => v.players.length === 2);
    const stored = () => runInDurableObject(stub(code), (i) => i.sql.exec('SELECT state FROM room WHERE id = 1').one().state);
    const views = (p) => p.messages.filter((m) => m.type === 'state').length;
    // Messages that change nothing (no game to be ready for, no leaderboard to move on from):
    // nothing is stored and nobody gets a view. A hello is always answered, and on the same
    // socket it comes after them, so its answer shows that both were handled.
    const before = { state: await stored(), ann: views(ann), ben: views(ben) };
    ann.send({ type: 'loaded', round: 1 });
    ann.send({ type: 'next' });
    ann.send({ type: 'hello', key: ann.key, name: 'Ann', avatar: '🦊' });
    await new Promise((resolve) => {
      const check = () => (views(ann) > before.ann ? (resolve(), true) : false);
      if (!check()) ann.waiters.push(check);
    });
    expect(await stored()).toBe(before.state);
    expect(views(ann)).toBe(before.ann + 1);
    expect(views(ben)).toBe(before.ben);
    // In a dealt game, Ann's readiness changes only what Ann sees: only she gets a view.
    await upload(code, ann.key, JPEGS);
    await upload(code, ben.key, []);
    await ann.until((v) => v.phase === 'countdown');
    await ben.until((v) => v.phase === 'countdown');
    const dealt = { ann: views(ann), ben: views(ben) };
    ann.send({ type: 'loaded', round: 1 });
    await ann.until((v) => v.me.loaded === 1);
    // A change both see (the host's setting, which also starts the 3-2-1 over): one view each.
    ann.send({ type: 'setting', key: 'rounds', value: 5 });
    await ben.until((v) => v.settings.rounds === 5);
    await ann.until((v) => v.settings.rounds === 5);
    expect(views(ben)).toBe(dealt.ben + 1);
    expect(views(ann)).toBe(dealt.ann + 2);
  });
});

describe('a full game', () => {
  test('countdown, rounds, photo access, reveal, end, and every photo deleted', async () => {
    const code = await createRoom({ photos: 4, auto: false });
    const ann = await connect(code, 'Ann');
    const ben = await connect(code, 'Ben');
    await ann.until((v) => v.players.length === 2);
    expect((await upload(code, ann.key, JPEGS)).status).toBe(204);
    expect((await upload(code, ben.key, [JPEGS[0]])).status).toBe(204);
    // The 3-2-1 deals the game: from now on every phone may load all of its photos, and
    // nothing on the way may store them.
    const dealt = await ann.until((v) => v.phase === 'countdown');
    expect(dealt.upcoming).toHaveLength(3);
    for (const link of dealt.upcoming) {
      const res = await call(link);
      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Type')).toBe('image/jpeg');
      expect(res.headers.get('Cache-Control')).toBe('no-store');
    }
    expect((await call(API.photo(code, 'nosuchphoto'))).status).toBe(404);

    await advance(code, TIMING.countdownMs);
    const load = await ann.until((v) => v.phase === 'load');
    expect(load.round).toMatchObject({ n: 1, total: 3, owner: null });
    expect(load.upcoming).toEqual(dealt.upcoming);
    expect(await countRows(code, 'photos')).toBe(3);

    for (let round = 1; round <= 3; round++) {
      for (const p of [ann, ben]) p.send({ type: 'loaded', round });
      const show = await ann.until((v) => v.phase === 'show' && v.round.n === round);
      expect(show.round.owner).toBeNull();
      for (const p of [ann, ben]) p.send({ type: 'answer', pick: show.round.options[0] });
      const reveal = await ann.until((v) => v.phase === 'reveal' && v.round.n === round);
      expect(reveal.round.owner).toBeTruthy();
      expect(Object.keys(reveal.round.results)).toHaveLength(2);
      expect((await call(reveal.round.photo)).status).toBe(200);
      await advance(code, TIMING.revealMs);
      // The last photo's reveal ends the game (no leaderboard gives the standings away).
      if (round === 3) break;
      // The leaderboard: the photo can still be shown again until the host moves on.
      await ann.until((v) => v.phase === 'board' && v.round.n === round);
      expect((await call(reveal.round.photo)).status).toBe(200);
      ann.send({ type: 'next' });
      await ann.until((v) => v.phase === 'load' && v.round.n === round + 1);
      // The finished round's photo is gone, from storage and from the API.
      expect(await countRows(code, 'photos')).toBe(3 - round);
      expect((await call(reveal.round.photo)).status).toBe(404);
    }
    const end = await ann.until((v) => v.phase === 'end');
    expect(end.final.players).toHaveLength(2);
    expect(await countRows(code, 'photos')).toBe(0);

    // Play again: Ann opens the next game, Ben keeps his results until he joins it.
    ann.send({ type: 'again' });
    const waiting = await ben.until((v) => v.phase === 'lobby' && v.me.onResults);
    expect(waiting.final.players).toHaveLength(2);
    ben.send({ type: 'again' });
    await ben.until((v) => v.phase === 'lobby' && !v.me.onResults && !v.final);
  });

  test('the alarm runs the timers: answer time and automatic next round', async () => {
    const code = await createRoom({ photos: 4, time: 5 });
    const ann = await connect(code, 'Ann');
    const ben = await connect(code, 'Ben');
    await ann.until((v) => v.players.length === 2);
    await upload(code, ann.key, JPEGS);
    await upload(code, ben.key, []);
    await ann.until((v) => v.phase === 'countdown');
    await advance(code, TIMING.countdownMs);
    await ann.until((v) => v.phase === 'load');
    await advance(code, TIMING.loadMaxMs);
    await ann.until((v) => v.phase === 'show');
    await advance(code, 5000 + TIMING.answerGraceMs);
    const reveal = await ann.until((v) => v.phase === 'reveal');
    expect(Object.values(reveal.round.results).every((r) => r.pick === null)).toBe(true);
    await advance(code, TIMING.revealMs);
    await ann.until((v) => v.phase === 'board');
    // Holding "Show again" stops the clock: the board stays, for everyone.
    ben.send({ type: 'peek', on: true });
    await ann.until((v) => v.phase === 'board' && v.round.peek && v.paused);
    await advance(code, TIMING.boardMs);
    expect(ann.view().phase).toBe('board');
    ben.send({ type: 'peek', on: false });
    await ann.until((v) => v.phase === 'board' && !v.round.peek && !v.paused);
    await advance(code, TIMING.boardMs);
    await ann.until((v) => v.phase === 'load' && v.round.n === 2);
  });
});

describe('reactions', () => {
  test('a reaction from the list reaches the others; anything else (an old app\'s emoji) does not', async () => {
    const code = await createRoom();
    const ann = await connect(code, 'Ann');
    const ben = await connect(code, 'Ben');
    await ann.until((v) => v.players.length === 2);
    ann.send({ type: 'react', emoji: '😱' });
    await new Promise((resolve) => setTimeout(resolve, 400));
    ann.send({ type: 'react', emoji: '🔥' });
    await new Promise((resolve) => {
      const check = () => (ben.messages.some((m) => m.type === 'react') ? (resolve(), true) : false);
      if (!check()) ben.waiters.push(check);
    });
    expect(ben.messages.filter((m) => m.type === 'react').map((m) => m.emoji)).toEqual(['🔥']);
  });
});

describe('leaving and closing', () => {
  test('leaving deletes the player\'s photos; the last one out leaves the code open for coming back', async () => {
    const code = await createRoom();
    const ann = await connect(code, 'Ann');
    const ben = await connect(code, 'Ben');
    await ann.until((v) => v.players.length === 2);
    await upload(code, ben.key, JPEGS);
    await ann.until((v) => v.players.some((p) => p.photoCount === 2));
    ben.send({ type: 'leave' });
    expect(await ben.closedWith()).toBe(CLOSE.left);
    await ann.until((v) => v.players.length === 1);
    expect(await countRows(code, 'photos')).toBe(0);
    ann.send({ type: 'leave' });
    await ann.closedWith();
    const again = await connect(code, 'Ann');
    const view = await again.until((v) => v.me);
    expect(view).toMatchObject({ phase: 'lobby', hostId: view.me.id });
    expect(view.players).toHaveLength(1);
  });

  test('a room nobody uses is deleted after the idle time', async () => {
    const code = await createRoom();
    const ann = await connect(code, 'Ann');
    await ann.until((v) => v.me);
    await advance(code, TIMING.roomIdleMs);
    expect(await ann.closedWith()).toBe(CLOSE.gone);
    const tables = await runInDurableObject(stub(code), (i) => i.sql.exec("SELECT name FROM sqlite_master WHERE type = 'table'").toArray());
    expect(tables).toEqual([]);
  });
});

describe('reports and removed players', () => {
  test('a reported photo is deleted from storage at once; a removed player cannot come back', async () => {
    const code = await createRoom({ photos: 4 });
    const ann = await connect(code, 'Ann');
    const ben = await connect(code, 'Ben');
    await ann.until((v) => v.players.length === 2);
    await upload(code, ann.key, JPEGS);
    await upload(code, ben.key, []);
    await advance(code, TIMING.countdownMs);
    const load = await ben.until((v) => v.phase === 'load');
    ben.send({ type: 'report' });
    await ben.until((v) => v.phase === 'load' && v.round.n === 2);
    expect(await countRows(code, 'photos')).toBe(1);
    expect((await call(load.round.photo)).status).toBe(404);

    ann.send({ type: 'kick', target: load.me.id });
    expect(await ben.closedWith()).toBe(CLOSE.stale);
    const back = await connect(code, 'Ben');
    expect(await back.closedWith()).toBe(CLOSE.removed);
    await ann.until((v) => v.players.length === 1);
  });
});

describe('flags', () => {
  test('a flag holds the round for everyone; without a decision the alarm deletes the photo', async () => {
    const code = await createRoom({ photos: 4, time: 5 });
    const ann = await connect(code, 'Ann');
    const ben = await connect(code, 'Ben');
    await ann.until((v) => v.players.length === 2);
    await upload(code, ann.key, JPEGS);
    await upload(code, ben.key, []);
    await advance(code, TIMING.countdownMs);
    await ann.until((v) => v.phase === 'load');
    for (const p of [ann, ben]) p.send({ type: 'loaded', round: 1 });
    const show = await ann.until((v) => v.phase === 'show');
    ben.send({ type: 'flag', round: 1, on: true });
    // Ann learns only that it is flagged, and her clock stands still; Ben sees it is his.
    const held = await ann.until((v) => v.paused && v.round.flag);
    expect(held.round.flag.mine).toBe(false);
    expect((await ben.until((v) => v.round.flag)).round.flag.mine).toBe(true);
    // Far past the answer time, the round is still on: only the flag's own end moves it.
    await advance(code, TIMING.flagMs);
    await ann.until((v) => v.round.n === 2 && !v.round.flag && !v.paused);
    expect(await countRows(code, 'photos')).toBe(1);
    expect((await call(show.round.photo)).status).toBe(404);
  });
});

describe('the website', () => {
  test("invite links serve the app's page (it shows the invite in a browser); the legal page is reachable", async () => {
    const invite = await call('/ABCD', { headers: { Accept: 'text/html', 'Sec-Fetch-Mode': 'navigate' } });
    expect(invite.status).toBe(200);
    expect(await invite.text()).toContain('<div id="app"');
    const legal = await call('/legal');
    expect(await legal.text()).toContain('Imprint (Impressum)');
  });
});
