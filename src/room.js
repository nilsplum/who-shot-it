/**
 * One game room: a Cloudflare Durable Object, addressed by the room code.
 *
 * Mechanisms: the Worker (`src/worker.js`) forwards every request for `/api/rooms/<CODE>/*`
 * here. This class is a thin shell around the pure game logic in `src/game/`: it turns
 * WebSocket messages, uploads and its alarm into events, applies them with
 * `rules.apply`, and then `commit`s: persist the room, delete every photo the room no
 * longer references, send each player their view, and set the one alarm to
 * `rules.nextWake`. Photos and iPhone pool photos live in this object's SQLite storage.
 *
 * Invariants:
 * - A Durable Object handles one event at a time, but an `await` lets the next one in.
 *   So handlers read request bodies first and then read the room, apply and commit
 *   without any `await` in between; the room is never changed across a wait.
 * - Sockets use the Hibernation API: between messages the object may be evicted from
 *   memory, so everything needed later is in storage or in the socket's attachment
 *   (`{ playerId, openedAt, lastReact }`). Browser pings are answered by the runtime
 *   without waking the object.
 * - Deleting is declarative: blobs are kept only while `referencedPhotoIds` /
 *   `referencedPoolTokens` name them, so every rule that drops a photo from the state
 *   (round over, game over, unready, leave, settings change, expiry) deletes it here.
 * - A closed room deletes all of its storage and closes its sockets at once.
 */

import { DurableObject } from 'cloudflare:workers';
import { CLOSE, matchRoomRoute } from '../web/shared/api.js';
import { LIMITS, REACTIONS, TIMING } from '../web/shared/config.js';
import { apply, nextWake } from './game/rules.js';
import {
  canAddToPool, cleanName, isServablePhoto, makeId, newRoom, playerById, playerByKey, playerByPoolToken,
  referencedPhotoIds, referencedPoolTokens,
} from './game/state.js';
import { viewFor } from './game/view.js';
import { bearerKey, cryptoRandom, fail, isJpeg, isPlayerKey, json, tooLarge } from './http.js';

/** Browser messages that become events, each with exactly the fields the rules read. */
const CLIENT_EVENTS = {
  leave: () => ({}),
  unready: () => ({}),
  setting: (m) => ({ key: m.key, value: m.value }),
  loaded: (m) => ({ round: m.round }),
  answer: (m) => ({ pick: m.pick }),
  resolve: () => ({}),
  next: () => ({}),
  again: () => ({}),
};

const attachment = (ws) => {
  try {
    return ws.deserializeAttachment() || {};
  } catch {
    return {};
  }
};

export class Room extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    // Reading never writes: a code nobody created (a typo, a probe) leaves no storage behind.
    const exists = this.sql.exec("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'room'").toArray().length > 0;
    const row = exists ? this.sql.exec('SELECT state FROM room WHERE id = 1').toArray()[0] : null;
    this.room = row ? JSON.parse(row.state) : null;
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
  }

  /** Creates the tables; runs only when a room is created. */
  migrate() {
    this.sql.exec('CREATE TABLE IF NOT EXISTS room (id INTEGER PRIMARY KEY CHECK (id = 1), state TEXT NOT NULL)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS photos (id TEXT PRIMARY KEY, data BLOB NOT NULL)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS pool (token TEXT NOT NULL, seq INTEGER NOT NULL, data BLOB NOT NULL, PRIMARY KEY (token, seq))');
  }

  // ---------- State changes ----------

  dispatch(event) {
    const previous = this.room;
    this.room = apply(previous, event, Date.now(), cryptoRandom);
    this.commit(previous);
  }

  commit(previous) {
    const room = this.room;
    if (!room || room.closed) {
      this.destroy();
      return;
    }
    if (JSON.stringify(room) !== JSON.stringify(previous)) {
      this.sql.exec('INSERT OR REPLACE INTO room (id, state) VALUES (1, ?)', JSON.stringify(room));
      this.sql.exec('DELETE FROM photos WHERE id NOT IN (SELECT value FROM json_each(?))', JSON.stringify(referencedPhotoIds(room)));
      this.sql.exec('DELETE FROM pool WHERE token NOT IN (SELECT value FROM json_each(?))', JSON.stringify(referencedPoolTokens(room)));
      this.broadcast();
    }
    this.schedule();
  }

  /** One alarm per room: the next game timer, or a stale-socket check while sockets are open. */
  schedule() {
    const now = Date.now();
    let at = nextWake(this.room);
    if (at === null) return;
    if (this.ctx.getWebSockets().length) at = Math.min(at, now + TIMING.sweepMs);
    // Never schedule into the past: an alarm that fires at once would loop.
    this.ctx.storage.setAlarm(Math.max(at, now + 100));
  }

  destroy() {
    this.room = null;
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.close(CLOSE.gone, 'gone');
      } catch {}
    }
    // Block other events until the storage is wiped (tables included).
    this.ctx.blockConcurrencyWhile(async () => {
      await this.ctx.storage.deleteAlarm();
      await this.ctx.storage.deleteAll();
    });
  }

  broadcast() {
    for (const ws of this.ctx.getWebSockets()) {
      const { playerId } = attachment(ws);
      if (!playerId) continue;
      // A socket whose player is no longer in the room reconnects and says hello again.
      if (!playerById(this.room, playerId)) {
        ws.serializeAttachment({ ...attachment(ws), playerId: null });
        ws.close(CLOSE.stale, 'rejoin');
        continue;
      }
      this.sendView(ws, playerId);
    }
  }

  sendView(ws, playerId) {
    try {
      ws.send(JSON.stringify({ type: 'state', view: viewFor(this.room, playerId, Date.now()) }));
    } catch {}
  }

  // ---------- HTTP ----------

  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === '/create' && request.method === 'POST') return this.create(await request.json());
    const route = matchRoomRoute(request.method, url.pathname);
    if (!route) return fail(404, 'not_found');
    if (route.name === 'socket') return this.connect(request);
    if (!this.room) return fail(404, 'no_room');
    if (route.name === 'setPhotos') return this.setPhotos(request);
    if (route.name === 'photo') return this.photo(route.id);
    if (route.name === 'takePool') return this.takePool(request);
    if (route.name === 'poolUpload') return this.poolUpload(request, route.id);
    if (route.name === 'poolDone') return this.poolDone(route.id);
    return fail(404, 'not_found');
  }

  /** Called by the Worker with a fresh random code; 409 tells it to try another one. */
  create({ code, settings }) {
    if (this.room) return fail(409, 'taken');
    this.migrate();
    const previous = this.room;
    this.room = newRoom(code, Date.now(), settings);
    this.commit(previous);
    return json({ code }, 201);
  }

  connect(request) {
    if (request.headers.get('Upgrade') !== 'websocket') return fail(426, 'websocket_only');
    const [client, server] = Object.values(new WebSocketPair());
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ playerId: null, openedAt: Date.now(), lastReact: 0 });
    // A code without a room still gets a socket, so the browser can read the close code
    // (a refused upgrade looks like a network error and would be retried forever).
    if (!this.room) server.close(CLOSE.gone, 'gone');
    else this.schedule();
    return new Response(null, { status: 101, webSocket: client });
  }

  /** "Yes" in the lobby: the player's chosen JPEGs replace their set and make them ready. */
  async setPhotos(request) {
    const limit = this.room.settings.photos * LIMITS.photoMaxBytes + 64 * 1024;
    if (tooLarge(request, limit)) return fail(413, 'too_large');
    let files;
    try {
      files = (await request.formData()).getAll('photo');
    } catch {
      return fail(400, 'bad_form');
    }
    const blobs = [];
    for (const file of files) {
      if (typeof file === 'string' || file.size > LIMITS.photoMaxBytes) return fail(413, 'bad_photo');
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (!isJpeg(bytes)) return fail(415, 'not_jpeg');
      blobs.push(bytes);
    }
    // From here on no more awaits: read the room, apply, commit.
    if (!this.room) return fail(404, 'no_room');
    const player = playerByKey(this.room, bearerKey(request));
    if (!player) return fail(401, 'unknown_player');
    if (blobs.length > this.room.settings.photos) return fail(400, 'too_many');
    const ids = blobs.map((bytes) => {
      const id = makeId(cryptoRandom, 16);
      this.sql.exec('INSERT INTO photos (id, data) VALUES (?, ?)', id, bytes);
      return id;
    });
    this.dispatch({ type: 'ready', playerId: player.id, photos: ids });
    const after = playerByKey(this.room || { players: [] }, player.key);
    return after && after.ready ? new Response(null, { status: 204 }) : fail(409, 'not_in_lobby');
  }

  photo(id) {
    if (!isServablePhoto(this.room, id)) return fail(404, 'not_found');
    const row = this.sql.exec('SELECT data FROM photos WHERE id = ?', id).toArray()[0];
    if (!row) return fail(404, 'not_found');
    // Ids are random and single-use, so the browser may keep the photo for the round.
    return new Response(row.data, { headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'private, max-age=3600' } });
  }

  /** One photo from the iPhone shortcut, sent raw to the player's secret pool link. */
  async poolUpload(request, token) {
    if (!canAddToPool(this.room, token)) return fail(404, 'no_pool');
    if (tooLarge(request, LIMITS.photoMaxBytes)) return fail(413, 'too_large');
    const bytes = new Uint8Array(await request.arrayBuffer());
    if (bytes.length > LIMITS.photoMaxBytes) return fail(413, 'too_large');
    if (!isJpeg(bytes)) return fail(415, 'not_jpeg');
    if (!this.room || !canAddToPool(this.room, token)) return fail(404, 'no_pool');
    const player = playerByPoolToken(this.room, token);
    this.sql.exec('INSERT INTO pool (token, seq, data) VALUES (?, ?, ?)', token, player.pool.count, bytes);
    this.dispatch({ type: 'poolAdd', token });
    return json({ ok: true }, 201);
  }

  /** The shortcut's success callback: marks the pool complete and returns to the game. */
  poolDone(token) {
    const code = this.room.code;
    this.dispatch({ type: 'poolDone', token });
    return new Response(null, { status: 302, headers: { Location: `/${code}`, 'Cache-Control': 'no-store' } });
  }

  /**
   * The browser picks up its pool: all photos in one response (each as a 4-byte big-endian
   * length and the JPEG), then they are deleted and the upload link changes.
   */
  takePool(request) {
    const player = playerByKey(this.room, bearerKey(request));
    if (!player) return fail(401, 'unknown_player');
    const rows = this.sql.exec('SELECT data FROM pool WHERE token = ? ORDER BY seq', player.pool.token).toArray();
    const parts = rows.map((r) => new Uint8Array(r.data));
    const out = new Uint8Array(parts.reduce((n, p) => n + 4 + p.length, 0));
    const view = new DataView(out.buffer);
    let offset = 0;
    for (const p of parts) {
      view.setUint32(offset, p.length);
      out.set(p, offset + 4);
      offset += 4 + p.length;
    }
    this.dispatch({ type: 'poolTaken', playerId: player.id });
    return new Response(out, { headers: { 'Content-Type': 'application/octet-stream', 'Cache-Control': 'no-store' } });
  }

  // ---------- WebSocket ----------

  async webSocketMessage(ws, message) {
    if (!this.room) {
      ws.close(CLOSE.gone, 'gone');
      return;
    }
    if (typeof message !== 'string' || message.length > LIMITS.messageMaxBytes) return;
    let msg;
    try {
      msg = JSON.parse(message);
    } catch {
      return;
    }
    if (!msg || typeof msg.type !== 'string') return;
    if (msg.type === 'hello') {
      this.hello(ws, msg);
      return;
    }
    const att = attachment(ws);
    if (!att.playerId) return;
    if (msg.type === 'react') {
      this.react(ws, att, msg.emoji);
      return;
    }
    const build = CLIENT_EVENTS[msg.type];
    if (!build) return;
    // A leaving socket is detached first, so it ends as "left" (no reconnect), not "stale".
    if (msg.type === 'leave') ws.serializeAttachment({ ...att, playerId: null });
    this.dispatch({ type: msg.type, playerId: att.playerId, ...build(msg) });
    if (msg.type === 'leave') ws.close(CLOSE.left, 'left');
  }

  hello(ws, { key, name, avatar }) {
    if (!isPlayerKey(key) || !cleanName(name)) {
      ws.close(1008, 'bad_hello');
      return;
    }
    this.dispatch({ type: 'join', key, name, avatar });
    const player = this.room && playerByKey(this.room, key);
    if (!player) {
      ws.close(CLOSE.full, 'full');
      return;
    }
    // One socket per player: an older tab of the same player hands over to this one.
    for (const other of this.ctx.getWebSockets()) {
      if (other === ws || attachment(other).playerId !== player.id) continue;
      other.serializeAttachment({ ...attachment(other), playerId: null });
      other.close(CLOSE.replaced, 'replaced');
    }
    ws.serializeAttachment({ ...attachment(ws), playerId: player.id });
    this.sendView(ws, player.id);
  }

  /** Reactions are not game state: they are passed on to everyone else at once. */
  react(ws, att, emoji) {
    const now = Date.now();
    if (!REACTIONS.includes(emoji) || now - (att.lastReact || 0) < 300) return;
    ws.serializeAttachment({ ...att, lastReact: now });
    const message = JSON.stringify({ type: 'react', emoji, from: att.playerId });
    for (const other of this.ctx.getWebSockets()) {
      if (other === ws || !attachment(other).playerId) continue;
      try {
        other.send(message);
      } catch {}
    }
  }

  async webSocketClose(ws) {
    this.dropSocket(ws);
  }

  async webSocketError(ws) {
    this.dropSocket(ws);
  }

  /** A socket ended: its player counts as offline unless another socket of theirs is open. */
  dropSocket(ws) {
    const { playerId } = attachment(ws);
    if (!playerId || !this.room) return;
    try {
      ws.serializeAttachment({ ...attachment(ws), playerId: null });
    } catch {}
    const stillHere = this.ctx.getWebSockets().some((other) => other !== ws && attachment(other).playerId === playerId);
    if (!stillHere) this.dispatch({ type: 'disconnect', playerId });
  }

  // ---------- Alarm ----------

  async alarm() {
    if (!this.room) return;
    // A phone that vanished without closing its socket stops pinging; treat it as gone.
    const now = Date.now();
    for (const ws of this.ctx.getWebSockets()) {
      const att = attachment(ws);
      const lastPing = this.ctx.getWebSocketAutoResponseTimestamp(ws);
      const lastSign = lastPing ? lastPing.getTime() : att.openedAt || 0;
      if (now - lastSign <= TIMING.socketStaleMs) continue;
      this.dropSocket(ws);
      try {
        ws.close(CLOSE.stale, 'stale');
      } catch {}
      if (!this.room) return;
    }
    this.dispatch({ type: 'tick' });
  }
}
