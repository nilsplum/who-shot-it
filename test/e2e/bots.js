/**
 * Light players for the end-to-end tests: each is one WebSocket and one `fetch` from the test
 * itself (no browser), so a test can fill a room up to LIMITS.maxPlayers cheaply and look at
 * the real app on the phones around them.
 *
 * Mechanisms: a bot talks to the room exactly like the app does (`web/shared/api.js`): it
 * says `hello` with `ahead` (it counts as an app that loads the game's photos ahead), gets
 * ready without photos the way "Play without photos" does (an empty upload), and from then
 * on answers the room's views: it reports every photo of the game as loaded at once (it
 * never fetches one, so it never holds the room up), answers each photo with a random player
 * a moment after it appears, and pings like the app, so the room never drops it as stale.
 *
 * Invariants: bots never decide anything the room would not let a phone decide; they only
 * send the app's own messages. Their keys are made here and never leave the test.
 */
import { API } from '../../web/shared/api.js';
import { EMOJIS, TIMING } from '../../web/shared/config.js';

const NAMES = ['Ava', 'Bo', 'Charlotte', 'Dev', 'Eli', 'Frida', 'Gus', 'Hanna', 'Ivo', 'Jo', 'Kai', 'Lena', 'Maximilian', 'Nia', 'Ola'];

/** One bot in room `code` on the server at `base` (http://…); `close()` takes it away. */
function bot(base, code, name, avatar) {
  const key = crypto.randomUUID().replace(/-/g, '');
  const ws = new WebSocket(`${base.replace(/^http/, 'ws')}${API.socket(code)}`);
  let readying = false;
  let loadedFor = null;
  let answeredFor = null;
  let ping = 0;
  const send = (msg) => ws.readyState === WebSocket.OPEN && ws.send(JSON.stringify(msg));
  const joined = new Promise((resolve, reject) => {
    ws.onopen = () => {
      send({ type: 'hello', key, name, avatar, ahead: true });
      ping = setInterval(() => ws.readyState === WebSocket.OPEN && ws.send('ping'), TIMING.pingMs);
    };
    ws.onclose = (e) => reject(new Error(`${name} was closed out (${e.code})`));
    ws.onmessage = (e) => {
      if (e.data === 'pong') return;
      const msg = JSON.parse(e.data);
      if (msg.type !== 'state' || !msg.view || !msg.view.me) return;
      resolve();
      onView(msg.view);
    };
  });

  function onView(v) {
    if (v.phase === 'lobby' && !v.me.ready && !readying) {
      readying = true;
      fetch(`${base}${API.photos(code)}`, { method: 'PUT', headers: { Authorization: `Bearer ${key}` }, body: new FormData() })
        .finally(() => {
          readying = false;
        });
    }
    // Everything the room lists is reported as there, once per list: the room clamps the mark to the game's length.
    const first = v.upcoming && v.upcoming.find(Boolean);
    if (first && first !== loadedFor) {
      loadedFor = first;
      send({ type: 'loaded', round: 1000 });
    }
    if (v.phase === 'show' && !v.round.myPick && answeredFor !== v.round.n) {
      answeredFor = v.round.n;
      const pick = v.round.options[Math.floor(Math.random() * v.round.options.length)];
      setTimeout(() => send({ type: 'answer', pick }), 300 + Math.random() * 1700);
    }
  }

  return {
    joined,
    close() {
      clearInterval(ping);
      ws.onclose = null;
      ws.close();
    },
  };
}

/**
 * `count` bots join room `code` (names from a fixed list, one long one among them, so a name
 * that has to be cut short is on screen); resolves once every one is in.
 */
export async function addBots(base, code, count) {
  const bots = NAMES.slice(0, count).map((name, i) => bot(base, code, name, EMOJIS[(i * 7) % EMOJIS.length]));
  await Promise.all(bots.map((b) => b.joined));
  return { close: () => bots.forEach((b) => b.close()) };
}
