/**
 * The Worker and the room's Durable Object together, over real HTTP and WebSocket requests
 * in the Workers runtime: creating and joining rooms, uploads, the game flow driven by
 * the alarm, photo access rules, the iPhone pool and deleting everything at the end.
 */
import { env, exports } from 'cloudflare:workers';
import { runDurableObjectAlarm, runInDurableObject } from 'cloudflare:test';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { API, CLOSE } from '../../web/shared/api.js';
import { LIMITS, TIMING } from '../../web/shared/config.js';
import { parsePool } from '../../web/js/api.js';
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

const stub = (code) => env.ROOMS.getByName(code);
const countRows = (code, table) => runInDurableObject(stub(code), (instance) => instance.sql.exec(`SELECT COUNT(*) AS n FROM ${table}`).one().n);

/** Moves the room's clock forward by running its alarm with a faked Date. */
async function advance(code, ms) {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(Date.now() + ms);
  await runDurableObjectAlarm(stub(code));
}

describe('rooms and players', () => {
  test('a new room greets its first player as host, with the creator\'s settings', async () => {
    const code = await createRoom({ photos: 3, mode: 'pixel', evil: 1 });
    const ann = await connect(code, 'Ann');
    const view = await ann.until((v) => v.me);
    expect(view).toMatchObject({ code, phase: 'lobby', hostId: view.me.id, settings: { photos: 3, mode: 'pixel' } });
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
    const code = await createRoom({ photos: 3 });
    const ann = await connect(code, 'Ann');
    await ann.until((v) => v.me);
    expect((await upload(code, keyFor('Nobody'), [JPEGS[0]])).status).toBe(401);
    expect((await upload(code, ann.key, [new TextEncoder().encode('not a photo')])).status).toBe(415);
    expect((await upload(code, ann.key, [JPEGS[0], JPEGS[1], JPEGS[0], JPEGS[1]])).status).toBe(400);
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

describe('a full game', () => {
  test('countdown, rounds, photo access, reveal, end, and every photo deleted', async () => {
    const code = await createRoom({ photos: 3, auto: false });
    const ann = await connect(code, 'Ann');
    const ben = await connect(code, 'Ben');
    await ann.until((v) => v.players.length === 2);
    expect((await upload(code, ann.key, JPEGS)).status).toBe(204);
    expect((await upload(code, ben.key, [JPEGS[0]])).status).toBe(204);
    await ann.until((v) => v.phase === 'countdown');

    await advance(code, TIMING.countdownMs);
    const load = await ann.until((v) => v.phase === 'load');
    expect(load.round).toMatchObject({ n: 1, total: 3, owner: null });
    expect(await countRows(code, 'photos')).toBe(3);

    // The photo on screen and the next one can be fetched, nothing else.
    const current = await call(load.round.photo);
    expect(current.status).toBe(200);
    expect(current.headers.get('Content-Type')).toBe('image/jpeg');
    expect((await call(load.round.next)).status).toBe(200);
    expect((await call(API.photo(code, 'nosuchphoto'))).status).toBe(404);

    for (let round = 1; round <= 3; round++) {
      for (const p of [ann, ben]) p.send({ type: 'loaded', round });
      const show = await ann.until((v) => v.phase === 'show' && v.round.n === round);
      expect(show.round.owner).toBeNull();
      for (const p of [ann, ben]) p.send({ type: 'answer', pick: show.round.options[0] });
      const reveal = await ann.until((v) => v.phase === 'reveal' && v.round.n === round);
      expect(reveal.round.owner).toBeTruthy();
      expect(Object.keys(reveal.round.results)).toHaveLength(2);
      ann.send({ type: 'next' });
      if (round < 3) {
        await ann.until((v) => v.phase === 'load' && v.round.n === round + 1);
        // The finished round's photo is gone, from storage and from the API.
        expect(await countRows(code, 'photos')).toBe(3 - round);
        expect((await call(reveal.round.photo)).status).toBe(404);
      }
    }
    const end = await ann.until((v) => v.phase === 'end');
    expect(end.stats).toBeTruthy();
    expect(await countRows(code, 'photos')).toBe(0);

    ann.send({ type: 'again' });
    await ben.until((v) => v.phase === 'lobby' && !v.me.ready);
  });

  test('the alarm runs the timers: answer time and automatic next round', async () => {
    const code = await createRoom({ photos: 3, time: 5 });
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
    await ann.until((v) => v.phase === 'load' && v.round.n === 2);
  });
});

describe('leaving and closing', () => {
  test('leaving deletes the player\'s photos; the last one out deletes the room', async () => {
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
    expect(await again.closedWith()).toBe(CLOSE.gone);
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

describe('the iPhone pool', () => {
  test('the shortcut uploads, finishes, and the browser picks the photos up once', async () => {
    const code = await createRoom();
    const ann = await connect(code, 'Ann');
    const view = await ann.until((v) => v.me);
    const token = view.me.pool.token;
    expect((await call(API.poolUpload(code, 'wrongtoken'), { method: 'POST', body: JPEGS[0] })).status).toBe(404);
    expect((await call(API.poolUpload(code, token), { method: 'POST', body: 'text' })).status).toBe(415);
    for (const jpeg of JPEGS) expect((await call(API.poolUpload(code, token), { method: 'POST', body: jpeg })).status).toBe(201);

    const done = await call(API.poolDone(code, token), { redirect: 'manual' });
    expect(done.status).toBe(302);
    expect(done.headers.get('Location')).toBe(`/${code}`);
    await ann.until((v) => v.me.pool.done && v.me.pool.count === 2);

    expect((await call(API.pool(code), { headers: { Authorization: `Bearer ${keyFor('Nobody')}` } })).status).toBe(401);
    const res = await call(API.pool(code), { headers: { Authorization: `Bearer ${ann.key}` } });
    const blobs = parsePool(await res.arrayBuffer());
    expect(blobs).toHaveLength(2);
    expect(new Uint8Array(await blobs[1].arrayBuffer())).toEqual(JPEGS[1]);

    const after = await ann.until((v) => v.me.pool.token !== token);
    expect(after.me.pool).toMatchObject({ count: 0, done: false });
    expect(await countRows(code, 'pool')).toBe(0);
    // The old link is dead.
    expect((await call(API.poolUpload(code, token), { method: 'POST', body: JPEGS[0] })).status).toBe(404);
  });
});

describe('static app', () => {
  test('invite links serve the app; the legal page is reachable', async () => {
    const invite = await call('/ABCD', { headers: { Accept: 'text/html', 'Sec-Fetch-Mode': 'navigate' } });
    expect(invite.status).toBe(200);
    expect(await invite.text()).toContain('<div id="app">');
    const legal = await call('/legal');
    expect(await legal.text()).toContain('Imprint (Impressum)');
  });
});
