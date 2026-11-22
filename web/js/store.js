/**
 * The app's state: what this phone remembers (`device`, in the app's local storage) and
 * what the app knows while it runs (`session`).
 *
 * Mechanisms: `main.js` reads and changes both and repaints; views only read them.
 * `session.view` is always the latest full snapshot the room sent (`src/game/view.js`).
 *
 * Invariants:
 * - Local storage holds only what the game needs on this phone (privacy policy, "On
 *   your phone"): name, avatar, the settings for the next game, which version of the
 *   terms was accepted, the current game with its player key (so the app lands back in
 *   the game after it was closed), and the code of the last game (it fills the code field,
 *   so joining the same group again is one tap). Nothing else; storage that fails is ignored,
 *   everything still works while the app runs, it is just not remembered.
 * - The player key is this phone's secret identity in one game (`keyFor`): made with the
 *   crypto random source when the phone joins a game, kept for that game only (also
 *   after leaving it, so a removed player stays removed), replaced by the next game's.
 *   It is only ever sent in `hello` and the `Authorization` header.
 */

import { EMOJIS, LIMITS, isRoomCode, normalizeSettings } from '../shared/config.js';

const STORAGE_KEY = 'whoshotit';
const KEY_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

const newKey = () => [...crypto.getRandomValues(new Uint8Array(24))].map((b) => KEY_CHARS[b & 63]).join('');
const isKey = (value) => typeof value === 'string' && /^[A-Za-z0-9_-]{16,64}$/.test(value);

function read() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') || {};
  } catch {
    return {};
  }
}

const saved = read();

export const device = {
  name: typeof saved.name === 'string' ? saved.name.slice(0, LIMITS.nameMax) : '',
  /**
   * A new phone starts with a random avatar, saved right away like the name (`saveDevice`
   * below), so it stays the same on every start; an avatar the app no longer offers becomes
   * a random one too.
   */
  avatar: EMOJIS.includes(saved.avatar) ? saved.avatar : EMOJIS[Math.floor(Math.random() * EMOJIS.length)],
  settings: normalizeSettings(saved.settings),
  /** The terms token (`termsToken()`: legal date and app version) this phone accepted, or null. */
  agreed: typeof saved.agreed === 'string' ? saved.agreed : null,
  /** The game this phone is in, or null. */
  room: isRoomCode(saved.room) ? saved.room : null,
  /** The code of the last game this phone was in (kept after leaving), or null. */
  lastRoom: isRoomCode(saved.lastRoom) ? saved.lastRoom : null,
  /** The player key, and the game it belongs to. */
  key: isKey(saved.key) && isRoomCode(saved.keyRoom) ? saved.key : null,
  keyRoom: isKey(saved.key) && isRoomCode(saved.keyRoom) ? saved.keyRoom : null,
};

export function saveDevice() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(device));
  } catch {}
}

/** The player key for game `code`: the one this phone already has there, else a new one. */
export function keyFor(code) {
  if (device.keyRoom !== code || !device.key) {
    device.key = newKey();
    device.keyRoom = code;
    saveDevice();
  }
  return device.key;
}

saveDevice();

export const session = {
  /** The room this app is in, or null outside a game. */
  code: null,
  /** A room code from an invite link, shown as "Join <CODE>" on the home screen. */
  invite: null,
  /** True on the "New game" step between the home screen and creating the room. */
  setup: false,
  /** The latest view the room sent, or null before the first one. */
  view: null,
  /** 'connecting' | 'open' | 'down' | 'replaced' */
  conn: 'connecting',
  downSince: 0,
  /** The open sheet: 'settings' | 'help' | 'avatar' | 'invite' | 'leave' | 'report' | 'remove' | null. */
  sheet: null,
  /** The avatars in the order the open avatar sheet shows them (shuffled when it opens, `main.js`). */
  avatarOrder: [],
  /** The setting whose "?" explanation is open in the settings sheet, or null. */
  helpKey: null,
  /** The player the host is about to remove ('remove' sheet). */
  target: null,
  /** The round whose photo this phone flagged, while its report sheet is open; else null. */
  flagged: null,
  /** Photo access as the phone last reported it ('full' | 'limited' | 'denied' | 'ask'), or null before asking. */
  access: null,
  /**
   * What a finger holds to see big (`main.js`, hold to look): `{ tile }` (a photo of the
   * choice, by its place) or `{ photo }` (the round's photo, "Show again"); else null.
   */
  look: null,
  /** The answer just tapped, shown before the room confirms it: { photo, id }. */
  pick: null,
  /** performance.now() when each photo was first shown, for effects without a timer. */
  shownAt: {},
  uploading: false,
  /** While "Yes" works: how far it is (`share`, 0 to 1) and at what (`label`), shown in place of No and Yes; else null. */
  progress: null,
  creating: false,
};
