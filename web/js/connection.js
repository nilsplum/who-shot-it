/**
 * The app's live connection to its room: one WebSocket that reconnects by itself.
 *
 * Mechanisms: `main.js` opens one `RoomSocket` per room. Each (re)connect starts with a
 * `hello` (the player key, name and avatar), and the room answers with a full snapshot of
 * the player's view, so nothing has to be replayed after a drop. The socket pings every
 * TIMING.pingMs; the room's runtime answers `pong` without waking the room.
 *
 * Invariants:
 * - Reconnects back off (0.5 s doubling to 5 s, with jitter) and happen at once when the
 *   app comes back to the front or the network returns, because phones kill sockets in
 *   the background (`checkNow`, also called by `main.js` when the app resumes).
 * - A missing pong means a dead connection: the socket is dropped and replaced at once,
 *   without waiting for the WebView's slow close.
 * - Close codes that end the session (`CLOSE.replaced/full/gone/left/removed/update`) stop
 *   reconnecting and are reported to `onEnd`; everything else is retried.
 * - Messages sent while disconnected are dropped (the banner tells the player).
 */

import { CLOSE } from '../shared/api.js';
import { TIMING } from '../shared/config.js';
import { socketUrl } from './api.js';

const FINAL = new Set([CLOSE.replaced, CLOSE.full, CLOSE.gone, CLOSE.left, CLOSE.removed, CLOSE.update]);

export class RoomSocket {
  /**
   * @param hello () => the hello message (read fresh on every connect)
   * @param handlers { onMessage(msg), onStatus('open' | 'down'), onEnd(closeCode) }
   */
  constructor(code, hello, handlers) {
    this.code = code;
    this.hello = hello;
    this.handlers = handlers;
    this.ws = null;
    this.ended = false;
    this.attempts = 0;
    this.retryTimer = 0;
    this.pingTimer = 0;
    this.lastPong = 0;
    this.wake = () => {
      if (document.visibilityState === 'visible') this.checkNow();
    };
    document.addEventListener('visibilitychange', this.wake);
    window.addEventListener('online', this.wake);
    this.connect();
  }

  connect() {
    clearTimeout(this.retryTimer);
    this.detach();
    const ws = new WebSocket(socketUrl(this.code));
    this.ws = ws;
    ws.onopen = () => {
      this.attempts = 0;
      this.lastPong = Date.now();
      ws.send(JSON.stringify(this.hello()));
      this.handlers.onStatus('open');
      this.pingTimer = setInterval(() => this.ping(), TIMING.pingMs);
    };
    ws.onmessage = (e) => {
      if (e.data === 'pong') {
        this.lastPong = Date.now();
        return;
      }
      let msg;
      try {
        msg = JSON.parse(e.data);
      } catch {
        return;
      }
      this.handlers.onMessage(msg);
    };
    ws.onclose = (e) => {
      if (ws !== this.ws) return;
      this.detach();
      if (this.ended) return;
      if (FINAL.has(e.code)) {
        this.end();
        this.handlers.onEnd(e.code);
        return;
      }
      this.handlers.onStatus('down');
      this.retry();
    };
  }

  /** Stops listening to the current socket and closes it. */
  detach() {
    clearInterval(this.pingTimer);
    const ws = this.ws;
    this.ws = null;
    if (!ws) return;
    ws.onopen = ws.onmessage = ws.onclose = null;
    try {
      ws.close(1000);
    } catch {}
  }

  retry() {
    const delay = Math.min(5000, 500 * 2 ** this.attempts) * (0.7 + Math.random() * 0.6);
    this.attempts += 1;
    clearTimeout(this.retryTimer);
    this.retryTimer = setTimeout(() => this.connect(), delay);
  }

  ping() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    if (Date.now() - this.lastPong > TIMING.pingMs * 2) {
      this.handlers.onStatus('down');
      this.connect();
      return;
    }
    this.ws.send('ping');
  }

  /** App in front again or network back: reconnect now instead of waiting for the backoff. */
  checkNow() {
    if (this.ended) return;
    if (!this.ws || this.ws.readyState === WebSocket.CLOSED || this.ws.readyState === WebSocket.CLOSING) {
      this.connect();
      return;
    }
    if (this.ws.readyState === WebSocket.OPEN) this.ws.send('ping');
  }

  send(message) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(message));
  }

  end() {
    this.ended = true;
    clearTimeout(this.retryTimer);
    document.removeEventListener('visibilitychange', this.wake);
    window.removeEventListener('online', this.wake);
    this.detach();
  }
}
