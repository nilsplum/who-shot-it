/**
 * The single source of truth for everything the app and the server must agree on: the
 * brand and app identity, where the server lives, the game settings (options, defaults,
 * labels, help) and the two presets, the limits, the timings and the scoring.
 *
 * Mechanisms: the Worker and the room's Durable Object import this file (Wrangler bundles
 * it); the app loads it unchanged as an ES module from its bundle (`web/` is the app's
 * page inside both store apps, see `capacitor.config.json`). So a value changed here
 * changes both sides at once, and nothing else may hardcode one of these values.
 *
 * Invariants:
 * - Settings are always read through `normalizeSettings` / `normalizeSetting`: a value
 *   that is not one of a setting's options falls back to its default, so a stale or
 *   tampered app can never put an unknown value into a room.
 * - Values a setting stores are plain JSON (numbers, strings, booleans), because the room
 *   state is persisted and sent as JSON.
 * - Files that cannot import this module restate a few values, and
 *   `test/unit/config.test.js` pins each copy: the brand name (`index.html`, `legal.html`,
 *   `capacitor.config.json`, the native projects), the app id (`capacitor.config.json`,
 *   the native projects), the link scheme (the native projects), the server's address
 *   (`wrangler.jsonc` and the page's Content-Security-Policy in `index.html`) and the
 *   terms version and minimum age (`legal.html`).
 */

export const APP = {
  name: 'Who Shot It?',
  /** The store id of both apps: Android application id and iOS bundle id. */
  id: 'com.hivedone.whoshotit',
  /** Invite links of the form `whoshotit://join/ABCD` open the app straight in a game. */
  scheme: 'whoshotit',
  /**
   * The app's version, restated from `package.json` (the page cannot read it; a test keeps
   * both equal). Every new version asks for the terms once more (`termsToken`).
   */
  version: '1.0.8',
};

export const SERVER = {
  /**
   * Where the apps reach the server (API, room sockets, photos) and where the website
   * with the legal page and invite links lives. Changing it needs a new app release, so
   * an old address stays served until no installed app uses it any more (README, Deploy).
   */
  origin: 'https://who-shot-it.nils-plum.workers.dev',
  /**
   * The origins of the app's own page inside the store apps (Capacitor's defaults:
   * iOS serves the bundle from `capacitor://localhost`, Android from `https://localhost`).
   * The server allows cross-origin calls from exactly these (`src/http.js`).
   */
  appOrigins: ['capacitor://localhost', 'https://localhost'],
  /** Game rooms, and the photos in them, live only in data centres in the EU. */
  jurisdiction: 'eu',
};

/**
 * The legal texts (`web/legal.html`) as the app needs them: everyone accepts the terms
 * before playing (`views/welcome.js`), again after every install and every app update, and
 * again when `version` changes. The version is the "Last updated" date of the legal page
 * (pinned by a test). `minAge` is also the age set in both stores.
 */
export const LEGAL = {
  version: '2026-11-22',
  minAge: 16,
};

/**
 * What a phone stores when its player accepts the terms: the legal date and the app
 * version. A new install starts without it, and an update or a change of the legal page
 * no longer matches it, so the terms show once more and can never be forgotten.
 */
export const termsToken = () => `${LEGAL.version}+${APP.version}`;

/**
 * Words a nickname may not contain (insults, slurs, obscenities; English and German).
 * Such a name becomes "Player" (`cleanName` in `src/game/state.js`). Kept short and
 * unambiguous, so real names are never caught; photos are filtered by their owners (No /
 * Yes) and by the report button.
 */
export const BLOCKED_WORDS = [
  'fuck', 'shit', 'cunt', 'bitch', 'whore', 'slut', 'nigger', 'nigga', 'faggot', 'retard', 'hitler', 'porn',
  'fick', 'scheiss', 'fotze', 'nutte', 'schlampe', 'wichser', 'arschloch', 'missgeburt', 'schwuchtel', 'kanake', 'spast',
];

/**
 * Store pages, shown on the website's invite page (the shared links and the QR code), so a
 * friend without the app can get it. `null` hides a store until its page is public: a
 * button to a "not found" page would be a dead end. The iPhone link is the App Store
 * Connect record's Apple ID (it opens once a version is approved); the Android one is
 * `https://play.google.com/store/apps/details?id=${APP.id}` once Google Play publishes it.
 * The website shows a change only after `./scripts/deploy.sh`.
 */
export const STORES = {
  android: null,
  ios: 'https://apps.apple.com/app/id6837810354',
};

/**
 * Avatars a player can pick: a curated set, so every group finds different ones (the picker
 * shows them in a new random order each time it opens, `views/sheets.js`). Every one is a
 * single emoji character of Unicode Emoji 12.0 or older, the newest that Android 10 (the
 * oldest Android the app supports) can draw; iOS 15.4 draws up to 14.0. Each looks clearly
 * different from the others. Left out on purpose: people and hands (skin tones, genders),
 * flags, anything religious, political, sexual, violent, alcohol or drug related, and the
 * emojis that already mean something in the app (the REACTIONS, 👑 the host, 📷 Show
 * again). The order sets each avatar's colour (`colourOf` in `web/js/ui.js`).
 */
export const EMOJIS = [
  '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐔', '🐧', '🐦', '🦆', '🦅',
  '🦉', '🦇', '🐺', '🐴', '🦄', '🐝', '🐛', '🦋', '🐌', '🐞', '🐢', '🐍', '🦎', '🦖', '🦕', '🐙', '🦞', '🦀', '🐠', '🐬',
  '🐳', '🦈', '🐊', '🦓', '🦍', '🐘', '🦛', '🦏', '🦒', '🦘', '🦙', '🦚', '🦜', '🦢', '🦩', '🦝', '🦦', '🦥', '🦔', '🐲',
  '👻', '👽', '👾', '🤖', '🎃', '😎', '🤓', '🤠', '🥳', '🍕', '🍔', '🍟', '🌭', '🌮', '🍩', '🍪', '🧁', '🍦', '🍭', '🍿',
  '🥨', '🥐', '🥑', '🍉', '🍓', '🍒', '🍍', '🥥', '🍄', '🧀', '🧇', '🍣', '🌵', '🌴', '🌲', '🌻', '🌸', '🍀', '🌈', '⭐',
  '🌙', '🌞', '⚡', '🌊', '🪐', '🌋', '⛄', '🎸', '🎺', '🥁', '🎹', '🎧', '🎮', '🎲', '🧩', '🎯', '⚽', '🏀', '🎾', '🏓',
  '🛹', '🚀', '🛸', '🚗', '⛵', '🎈', '🎁', '🏆', '💎', '🔮', '🎨', '💡', '🧲', '🪁', '🧸', '🧊', '🎪',
];

/**
 * Reactions everyone can send on the reveal, the leaderboard and the end screen, most used
 * first (the row pages to the rest). The room passes on only these. Like the avatars, each
 * is a single emoji of Emoji 12.0 or older, so every supported phone can draw it.
 */
export const REACTIONS = ['😂', '🙈', '🔥', '🤯', '👀', '😳', '😩', '🤭', '🧐', '🎉'];

/** The photo effects a round can use; "mix" draws one of these per round. */
export const EFFECTS = ['classic', 'blur', 'zoom', 'pixel'];

/**
 * The host's game settings, in the order the settings sheet shows them. `options` are
 * [value, label] pairs; `0` means "no limit" for rounds and time. `help` (for every
 * setting that is not obvious) is what the "?" next to it explains: short lines of
 * [which options, what they mean in practice], in words a grandma understands.
 */
export const SETTINGS = [
  // Square numbers only: the photo choice shows them as a square grid (2 x 2 to 5 x 5).
  { key: 'photos', label: 'Photos per player', default: 16, options: [[4, '4'], [9, '9'], [16, '16'], [25, '25']] },
  {
    // Applied on each player's phone while it picks (`web/js/photos.js`); the server only
    // keeps the value. "Full of text" is LIMITS.textLines lines or more (`web/js/textcheck.js`).
    key: 'filter', label: 'Which photos', default: 'little-text',
    options: [['all', 'All'], ['little-text', 'Little text'], ['no-screenshots', 'No screenshots']],
    help: [
      ['All', 'Any photo, screenshots too.'],
      ['Little text', 'No photos full of text, like chats or emails.'],
      ['No screenshots', 'No screenshots, and no photos full of text.'],
    ],
  },
  {
    key: 'rounds', label: 'Rounds', default: 15,
    options: [[5, '5'], [10, '10'], [15, '15'], [20, '20'], [30, '30'], [0, 'All']],
    help: [['5 to 30', 'The game ends after this many photos.'], ['All', 'Every photo in the game is shown once.']],
  },
  {
    key: 'time', label: 'Time per photo', default: 10,
    options: [[5, '5 s'], [10, '10 s'], [15, '15 s'], [20, '20 s'], [30, '30 s'], [0, '∞']],
    help: [['5 s to 30 s', 'How long everyone has to answer.'], ['∞', 'No clock. The photo stays until everyone has answered.']],
  },
  {
    key: 'mode', label: 'Mode', default: 'classic',
    options: [['classic', 'Classic'], ['blur', 'Blur'], ['zoom', 'Zoom'], ['pixel', 'Pixel'], ['mix', 'Mix']],
    help: [
      ['Classic', 'The photo shows right away.'],
      ['Blur', 'It starts blurry and gets sharp.'],
      ['Zoom', 'It starts very close and zooms out.'],
      ['Pixel', 'It starts in big blocks and gets clear.'],
      ['Mix', 'A different one for every photo.'],
    ],
  },
  {
    key: 'points', label: 'Points', default: 'speed', options: [['speed', 'Speed bonus'], ['fixed', 'Fixed']],
    help: [['Speed bonus', 'Right and fast gets the most points.'], ['Fixed', 'Every right answer gets the same points.']],
  },
  {
    key: 'answers', label: 'Answers', default: 0, options: [[0, 'All players'], [4, 'Only 4']],
    help: [['All players', 'You can pick anyone in the game.'], ['Only 4', 'You pick from 4 names. Easier in big groups.']],
  },
  {
    key: 'streak', label: 'Streak bonus', default: true, options: [[true, 'On'], [false, 'Off']],
    help: [['On', 'Right several times in a row? You get extra points.'], ['Off', 'No extra points.']],
  },
  {
    // The share of the points a right guess on one's own photo earns (the owner always
    // knows it). The answer still counts as right for the streak and the reveal.
    key: 'own', label: 'Own photo', default: 80, options: [[80, 'Fewer points'], [0, 'No points'], [100, 'Full points']],
    help: [
      ['Fewer points', 'Right on your own photo: 20% fewer points.'],
      ['No points', 'Your own photo never gives points.'],
      ['Full points', 'Your own photo counts like any other.'],
    ],
  },
  {
    // How many of each player's photos come up when not every photo is played (`src/game/plan.js`).
    // The key stays `fair` (true: Balanced), so stored settings and older apps keep working.
    key: 'fair', label: 'Photo mix', default: true, options: [[true, 'Balanced'], [false, 'Random']],
    help: [['Balanced', 'Everyone’s photos come up, some a bit more than others.'], ['Random', 'Pure chance: some come up a lot, others hardly.']],
  },
  {
    key: 'auto', label: 'Next round', default: true, options: [[true, 'Automatic'], [false, 'Host taps']],
    help: [['Automatic', 'The next photo comes by itself.'], ['Host taps', 'The host decides when the next photo comes.']],
  },
];

export const LIMITS = {
  minPlayers: 2,
  /**
   * The most players a game takes; the room refuses anyone beyond (`CLOSE.full`). The
   * guessing screen's cards, the lobby's pills and the leaderboard are laid out for up to
   * this many on a 360 px phone, and a full room's photos stay small for the free plan's
   * storage. The store description is built from it and `minPlayers`; the README says
   * "2 to 16 players", and the test players' guide (docs/guides/demo-players.md) 16 and
   * "1 to 15" (the test players fill a game up to it, `scripts/helpers/demo-players.mjs`).
   */
  maxPlayers: 16,
  nameMax: 16,
  codeLength: 4,
  /** Room code characters: no 0/O, 1/I/L, so a code read aloud is never ambiguous. */
  codeAlphabet: 'ABCDEFGHJKMNPQRSTUVWXYZ23456789',
  /** Longest side of a photo after the phone shrinks it, before it may be uploaded. */
  photoMaxSide: 1080,
  /** JPEG quality the phone encodes with (0 to 1). */
  photoQuality: 0.75,
  /**
   * Longest side of the previews the phone hands over for choosing (they never leave the
   * phone). The text check's limits and its test images are made for exactly this size.
   */
  previewSide: 480,
  previewQuality: 0.7,
  /** A photo with this many lines of text or more counts as full of text ("Which photos"). */
  textLines: 6,
  /**
   * The phone's bucket of checked previews, filled in the background whenever the app may
   * read photos and no game runs, so a set, "No" and a swap never wait (`web/js/photos.js`):
   * about 10 MB of small JPEGs. Only the next set (the front of the bucket) also gets its
   * big versions ahead, so holding a photo is sharp at once and "Yes" sends at once.
   */
  bucketPreviews: 250,
  /**
   * How many sets of previews the bucket keeps ready beyond the one on screen, refilled at
   * once after every "No" (next to the big versions of the set on screen, never behind
   * them), so "No" is instant even when tapped again and again.
   */
  readySets: 2,
  /**
   * "Photo mix: Balanced": each player's photos come up between 60% and 140% of an equal
   * share of the rounds (rounded; 15 rounds and 4 players: 2 to 5 each), so counting whose
   * photos were shown never tells whose comes next (`balancedRange`).
   */
  balancedSpread: 0.4,
  /** How many single photos a player may swap in one set (tap a photo: its tile shows how many are left as it turns); a new set starts over. */
  swapsPerSet: 3,
  /** Largest accepted JPEG. A Durable Object's SQLite row holds at most 2 MB. */
  photoMaxBytes: 1_500_000,
  /** Largest WebSocket message the room accepts from an app (all of them are tiny). */
  messageMaxBytes: 2048,
};

/**
 * "Photo mix: Balanced": how many of one owner's photos a game of `count` rounds with
 * `owners` players who brought photos plays, at least and at most (LIMITS.balancedSpread).
 * The one formula both sides use: the room picks each player's photos within it
 * (`src/game/plan.js`), and on "Yes" a phone sends no more than the most (`web/js/main.js`).
 */
export function balancedRange(count, owners) {
  const share = count / owners;
  return { low: Math.round(share * (1 - LIMITS.balancedSpread)), high: Math.round(share * (1 + LIMITS.balancedSpread)) };
}

/** All durations in milliseconds. The server owns every timer; apps only display them. */
export const TIMING = {
  /** The 3-2-1 before the first round, once every phone holds its photo (`src/game/rules.js`, the start). */
  countdownMs: 3000,
  /**
   * Longest wait for every phone to hold the photo of the round about to start: before the
   * 3-2-1 (the start), when round 1 shows, and after a leaderboard's time is up. Every phone
   * loads the whole game's photos from the deal on, in play order (`web/js/upcoming.js`), so
   * the room only waits for a phone far behind; that one catches up while the others play.
   */
  loadMaxMs: 6000,
  /** Extra time after the answer timer, for answers still on the wire. */
  answerGraceMs: 1500,
  /** How long the reveal (green and red cards) stays before the leaderboard. */
  revealMs: 3500,
  /** How long the leaderboard stays when "Next round" is automatic (paused while someone holds "Show again"). */
  boardMs: 5000,
  /** A "Show again" hold ends by itself this long after the app last renewed it (a lost connection). */
  peekHoldMs: 2500,
  /**
   * A flagged photo is hidden from the others and the round waits while its flagger decides
   * (Delete or Cancel), at most this long: then it is deleted, as if Delete was tapped. So
   * nobody can stop a game, and a flagged photo never comes back by itself.
   */
  flagMs: 15000,
  /** How often an app renews a "Show again" hold while the finger stays down. */
  peekRenewMs: 1000,
  /** Speed points with an unlimited timer are measured against this time. */
  untimedReferenceMs: 20000,
  /** How long effects run with an unlimited timer. */
  untimedEffectMs: 15000,
  /** Effects finish at this share of the answer time. */
  effectShare: 0.85,
  /** During a game, a host offline this long hands the role to the next connected player. */
  hostGraceMs: 8000,
  /**
   * A room with no activity for this long is deleted with everything in it. Until then its
   * code keeps working, even when everyone left, so the same group can play again the next
   * morning (the privacy policy promises this upper limit).
   */
  roomIdleMs: 24 * 60 * 60 * 1000,
  /** Apps ping this often; the room answers without waking up. */
  pingMs: 15000,
  /** A socket without a ping for this long is treated as gone. */
  socketStaleMs: 45000,
  /** While sockets are open, the room checks for stale ones this often. */
  sweepMs: 30000,
  /** Longest wait for one game photo from the server, before the phone counts it as failed. */
  photoFetchMs: 20000,
  /** Longest wait for the phone to hand over one photo (an iCloud original may download). */
  photoPickMs: 20000,
  /**
   * Longest wait for the phone to hand over a batch of previews: a few seconds of work on
   * the phone, plus up to two previews fetched from iCloud (`previewCloudMs` each).
   */
  previewMs: 15000,
  /** Longest wait for one preview the iPhone keeps only in iCloud, so every photo can come up. */
  previewCloudMs: 4000,
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

/**
 * The two ways most groups play, offered when a game is created. A preset is a complete
 * set of settings: picking one replaces them all, and the settings sheet fine-tunes from
 * there. The first one is the defaults.
 */
export const PRESETS = [
  { key: 'classic', icon: '📸', label: 'Classic', text: 'See the photo, guess whose it is.', settings: {} },
  { key: 'tricky', icon: '🌀', label: 'Tricky', text: 'Photos start blurry, zoomed or pixelated.', settings: { mode: 'mix', time: 15 } },
].map((p) => Object.freeze({ ...p, settings: Object.freeze(normalizeSettings({ ...SETTINGS_DEFAULTS, ...p.settings })) }));

/** The preset these settings are exactly, or null when they are custom. */
export function presetOf(settings) {
  return PRESETS.find((p) => SETTINGS.every((s) => p.settings[s.key] === settings[s.key])) || null;
}
