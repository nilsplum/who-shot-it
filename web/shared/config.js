/**
 * The single source of truth for everything the browser and the server must agree on:
 * the brand, the iPhone shortcut, the game settings (options, defaults, labels, help),
 * the limits, the timings and the scoring.
 *
 * Mechanisms: the Worker and the room's Durable Object import this file (Wrangler bundles
 * it), and the browser loads it unchanged as an ES module from `/shared/config.js`. So a
 * value changed here changes both sides at once, and nothing else may hardcode one of
 * these values.
 *
 * Invariants:
 * - Settings are always read through `normalizeSettings` / `normalizeSetting`: a value
 *   that is not one of a setting's options falls back to its default, so a stale or
 *   tampered client can never put an unknown value into a room.
 * - Values a setting stores are plain JSON (numbers, strings, booleans), because the room
 *   state is persisted and sent as JSON.
 * - The static files that restate the brand name for crawlers and link previews
 *   (`index.html`, `legal.html`, `manifest.webmanifest`) are pinned to `APP.name` by
 *   `test/unit/config.test.js`.
 * - `TODO_OPERATOR` marks a value only the operator can provide; `scripts/deploy.sh`
 *   refuses to deploy while one is left anywhere in the shipped files.
 */

export const APP = {
  name: 'Who Shot It?',
};

/**
 * The iPhone "All photos" route. Browsers cannot read the iOS photo library, but an Apple
 * Shortcut can: the app opens it with an upload link, the shortcut sends random photos to
 * the player's private pool in the room and then returns to the browser. How to build and
 * share it: `docs/ios-shortcut.md`. `name` must match the shortcut's name exactly.
 */
export const SHORTCUT = {
  name: 'Who Shot It',
  // Apple hosts and signs the shared shortcut; players add it from this page with one tap.
  installUrl: 'https://www.icloud.com/shortcuts/ad91ab40f2904bb7b13a6502c52859de',
};

/** Avatars a player can pick (the picker shows them in this order). */
export const EMOJIS = ['😎', '🦊', '🐸', '🐼', '🦄', '🐙', '👻', '🤖', '🐯', '🍕', '🌵', '🔥', '🐳', '🦖', '🍩', '👽', '🐧', '🦁', '🍉', '⚡'];

/** Reactions everyone can send during the reveal and on the end screen. */
export const REACTIONS = ['😂', '😱', '🔥', '😍', '🙈', '💀'];

/** The photo effects a round can use; "mix" draws one of these per round. */
export const EFFECTS = ['classic', 'blur', 'zoom', 'pixel'];

/**
 * The host's game settings, in the order the settings sheet shows them. `options` are
 * [value, label] pairs; `help` (optional) is one short line per value, shown under the
 * row for the selected value. `0` means "no limit" for rounds and time.
 */
export const SETTINGS = [
  { key: 'photos', label: 'Photos per player', default: 5, options: [[3, '3'], [5, '5'], [10, '10']] },
  { key: 'rounds', label: 'Rounds', default: 0, options: [[5, '5'], [10, '10'], [15, '15'], [20, '20'], [30, '30'], [0, 'All']] },
  { key: 'time', label: 'Time per photo', default: 10, options: [[5, '5 s'], [10, '10 s'], [15, '15 s'], [20, '20 s'], [30, '30 s'], [0, '∞']] },
  {
    key: 'mode', label: 'Mode', default: 'classic',
    options: [['classic', 'Classic'], ['blur', 'Blur'], ['zoom', 'Zoom'], ['pixel', 'Pixel'], ['mix', 'Mix']],
    help: {
      classic: 'The photo shows right away.',
      blur: 'Starts blurry and gets sharp. Tap early for more points.',
      zoom: 'Starts close on a detail and zooms out.',
      pixel: 'Starts pixelated and gets clearer.',
      mix: 'A random mode every round.',
    },
  },
  { key: 'points', label: 'Points', default: 'speed', options: [['speed', 'Speed counts'], ['fixed', 'Fixed']] },
  { key: 'answers', label: 'Answers', default: 0, options: [[0, 'All players'], [4, 'Only 4']] },
  { key: 'streak', label: 'Streak bonus', default: true, options: [[true, 'On'], [false, 'Off']] },
  {
    key: 'fair', label: 'Photo picks', default: true, options: [[true, 'Fair'], [false, 'Random']],
    help: {
      true: 'Everyone’s photos come up equally often.',
      false: 'Any photo can come up.',
    },
  },
  { key: 'auto', label: 'Next round', default: true, options: [[true, 'Automatic'], [false, 'Host taps']] },
];

export const LIMITS = {
  minPlayers: 2,
  maxPlayers: 12,
  nameMax: 16,
  codeLength: 4,
  /** Room code characters: no 0/O, 1/I/L, so a code read aloud is never ambiguous. */
  codeAlphabet: 'ABCDEFGHJKMNPQRSTUVWXYZ23456789',
  /** Longest side of a photo after the browser shrinks it before upload. */
  photoMaxSide: 1080,
  /** Largest accepted JPEG. A Durable Object's SQLite row holds at most 2 MB. */
  photoMaxBytes: 1_500_000,
  /** Most photos one iPhone shortcut run may put into a player's pool. */
  poolMax: 30,
  /** Largest WebSocket message the room accepts from a browser (all of them are tiny). */
  messageMaxBytes: 2048,
};

/** All durations in milliseconds. The server owns every timer; browsers only display them. */
export const TIMING = {
  /** 3-2-1 before the first round once everyone is ready. */
  countdownMs: 3000,
  /** Longest wait for every browser to have the round's photo before the timer starts. */
  loadMaxMs: 6000,
  /** Extra time after the answer timer, for answers still on the wire. */
  answerGraceMs: 1500,
  /** How long the reveal stays when "Next round" is automatic. */
  revealMs: 6500,
  /** Speed points with an unlimited timer are measured against this time. */
  untimedReferenceMs: 20000,
  /** How long effects run with an unlimited timer. */
  untimedEffectMs: 15000,
  /** Effects finish at this share of the answer time. */
  effectShare: 0.85,
  /** During a game, a host offline this long hands the role to the next connected player. */
  hostGraceMs: 8000,
  /** A player offline this long in the lobby is removed, so the others can start. */
  lobbyDropMs: 60000,
  /** iPhone pool photos are deleted after this time if the browser never picks them up. */
  poolTtlMs: 15 * 60 * 1000,
  /** A room with no activity for this long is deleted with everything in it. */
  roomIdleMs: 2 * 60 * 60 * 1000,
  /** Browsers ping this often; the room answers without waking up. */
  pingMs: 15000,
  /** A socket without a ping for this long is treated as gone. */
  socketStaleMs: 45000,
  /** While sockets are open, the room checks for stale ones this often. */
  sweepMs: 30000,
};

/** Points: a right answer earns min..max by speed (or `fixed`), plus a streak bonus. */
export const SCORING = {
  min: 500,
  max: 1000,
  fixed: 1000,
  streakStep: 100,
  streakMax: 500,
};

export const SETTINGS_DEFAULTS = Object.freeze(Object.fromEntries(SETTINGS.map((s) => [s.key, s.default])));

/** Returns `value` if it is one of the setting's options, else `undefined`. */
export function normalizeSetting(key, value) {
  const setting = SETTINGS.find((s) => s.key === key);
  if (!setting) return undefined;
  return setting.options.some(([v]) => v === value) ? value : undefined;
}

/** Whether `value` is a well-formed room code (it may still name no running room). */
export function isRoomCode(value) {
  return typeof value === 'string' && value.length === LIMITS.codeLength && [...value].every((c) => LIMITS.codeAlphabet.includes(c));
}

/** A complete, valid settings object: every unknown or invalid value becomes the default. */
export function normalizeSettings(input) {
  const source = input && typeof input === 'object' ? input : {};
  const out = {};
  for (const s of SETTINGS) {
    const v = normalizeSetting(s.key, source[s.key]);
    out[s.key] = v === undefined ? s.default : v;
  }
  return out;
}
