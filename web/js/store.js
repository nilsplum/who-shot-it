/**
 * The browser's state: what this device remembers (`device`, in localStorage) and what
 * the current visit knows (`session`).
 *
 * Mechanisms: `main.js` reads and changes both and repaints; views only read them.
 * `session.view` is always the latest full snapshot the room sent (`src/game/view.js`).
 *
 * Invariants:
 * - localStorage holds only what the game needs on this device (privacy policy, "Your
 *   device"): the random player key, name, avatar, the room this device is in (so a
 *   reload or the iPhone shortcut's return lands back in the game), the host settings
 *   to start the next game with, and whether the shortcut has worked here once. No
 *   cookies, nothing else. Storage may be unavailable (private mode): everything still
 *   works for the visit, it is just not remembered.
 * - The player key is this device's secret identity in every room. It is made once with
 *   the crypto random source and only ever sent in `hello` and the `Authorization` header.
 */

import { EMOJIS, LIMITS, isRoomCode, normalizeSettings } from '../shared/config.js';

const STORAGE_KEY = 'whoshotit';
const KEY_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

const newKey = () => [...crypto.getRandomValues(new Uint8Array(24))].map((b) => KEY_CHARS[b & 63]).join('');

function read() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') || {};
  } catch {
    return {};
  }
}

const saved = read();

export const device = {
  key: typeof saved.key === 'string' && /^[A-Za-z0-9_-]{16,64}$/.test(saved.key) ? saved.key : newKey(),
  name: typeof saved.name === 'string' ? saved.name.slice(0, LIMITS.nameMax) : '',
  avatar: EMOJIS.includes(saved.avatar) ? saved.avatar : EMOJIS[Math.floor(Math.random() * EMOJIS.length)],
  room: isRoomCode(saved.room) ? saved.room : null,
  settings: normalizeSettings(saved.settings),
  shortcutOk: saved.shortcutOk === true,
};

export function saveDevice() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(device));
  } catch {}
}

saveDevice();

export const session = {
  /** The room this tab is in, or null on the home screen. */
  code: null,
  /** A room code from an invite link, shown as "Join <CODE>" on the home screen. */
  invite: null,
  /** The latest view the room sent, or null before the first one. */
  view: null,
  /** 'connecting' | 'open' | 'down' | 'replaced' */
  conn: 'connecting',
  downSince: 0,
  /** The open sheet: 'settings' | 'help' | 'avatar' | 'invite' | 'leave' | 'ios' | null. */
  sheet: null,
  /** The answer just tapped, shown before the room confirms it: { photo, id }. */
  pick: null,
  /** When the latest view arrived (performance.now()) and its `left`, for local timers. */
  clock: { at: 0, left: null },
  /** performance.now() when each photo was first shown, for effects without a timer. */
  shownAt: {},
  uploading: false,
  poolLoading: false,
  /** The pool token already picked up, so a late view never triggers a second pickup. */
  poolTaken: null,
};
