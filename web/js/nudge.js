/**
 * The last one: the one player whose "Yes" the group still waits for, and the comic bubble
 * that teases them on everyone else's phone (chosen from drafts/bubble_animations, "Comic
 * chorus").
 *
 * Mechanisms:
 * - `lastToSayYes(view)`: who it is, from the view the room sent (`src/game/view.js`): the
 *   room has at least two players, exactly one of them has not said Yes, and everyone else is
 *   connected and said Yes, so that player's Yes is the one the start waits for (the room's
 *   own rule, `everyoneSaidYes` in src/game/state.js).
 * - The bubble (the lobby's `nudge` part, `views/lobby.js`) comes and goes in a rhythm
 *   (`NUDGE`): the first appearance the moment the wait begins, on screen for 5 s, leaving
 *   for a moment, then away until the next one, 15 s after the last began. `nudgeTrack` keeps
 *   on this phone since when the wait goes on; `nudgeAt` says what the bubble shows at a moment
 *   (its line, the side it comes from, the small bubbles, whether it is leaving), or null.
 *   `main.js` asks at each of its four paints a second, so the bubble needs no timer of its
 *   own, and the markup it gets changes only when an appearance starts or begins to leave.
 * - The order of the lines, the sides and the small bubbles is a shuffle every phone makes
 *   alike (`seeded`, web/shared/random.js) from the room's code, the group's game count
 *   (`view.games`) and the waited-for player's id: the whole table reads the same joke at the
 *   same moment, and every game and every player get another order. When the same player is
 *   the last one again in the same lobby (someone tapped Change meanwhile), the order goes on
 *   where it stopped (`nudgeTrack` remembers how many appearances that player had) instead of
 *   repeating its first lines.
 * - The bulge (`bulgeRows`): the line is cut into rows here, not by the browser, because each
 *   character's size depends on its place in its row ("ss SS ss", as if printed on a ball).
 * - `fitNudge`, the one function here that touches the page: right after a paint of the
 *   bubble (in the same task, so no frame shows it unfitted) it sizes the line to the photo
 *   area, the way `ui.syncRow` brings a row's arrow up to date after a paint.
 *
 * Invariants:
 * - Everything but `fitNudge` is pure: the time comes in as an argument (`performance.now()`
 *   in main.js), so the unit tests drive the rhythm with plain numbers.
 * - The lines talk about the waited-for player, never to them (they never see the bubble),
 *   use no possessive of the name ("Chris's" breaks on names ending in s) and only emoji of
 *   Emoji 12.0 or older (Android 10 draws them, like `REACTIONS`). They are user-facing text
 *   kept here rather than in a view because they are data the view renders, as the settings'
 *   help texts in config.js are.
 */
import { LIMITS } from '../shared/config.js';
import { seeded, shuffle } from '../shared/random.js';

/**
 * The bubble's rhythm (ms): on screen, then leaving (its exit animation, `nudge-out` in
 * styles/app.css), then away until the next appearance, which comes `everyMs` after the
 * last one began (5 s on screen, about 10 s away).
 */
export const NUDGE = { showMs: 5000, leaveMs: 350, everyMs: 15000 };

/** The big bubble's lines, one per appearance in a shuffled order; `{name}` is the waited-for player. */
export const NUDGE_LINES = [
  'It’s always {name}…',
  'Everyone’s ready. Except {name}.',
  'Classic {name}.',
  'What is {name} hiding? 👀',
  '{name} is choosing VERY carefully 🧐',
  '{name} is skipping the embarrassing ones 🙈',
  'Breaking news: {name} is still choosing',
  'Loading {name}… 12%',
  '{name} is negotiating with the camera roll',
  '{name} needs a minute. Or ten.',
  'Grab a snack. {name} is choosing 🍿',
  'Shh… {name} is concentrating',
  '{name} is curating a masterpiece 🎨',
  '{name} takes this game very seriously',
];

/** What the small bubbles call, by their place: above the big one's right end, below its left end, below its right end. */
export const NUDGE_CALLS = ['{name}?', '{name}!!', '{name}…'];

/** The longest row of the big bubble's line, and of a small bubble's call, in characters. */
const ROW = { line: 13, call: 13 };

const SEGMENTER = new Intl.Segmenter('en', { granularity: 'grapheme' });
const graphemes = (text) => [...SEGMENTER.segment(text)].map((s) => s.segment);
/** An emoji keeps its own colours in the bubble (no outline, no shadow: `bulge` in styles/app.css). */
const EMOJI = /\p{Extended_Pictographic}/u;

/** The player whose Yes would start the game, or null (see the header). */
export function lastToSayYes(view) {
  if (!view || view.phase !== 'lobby' || view.players.length < LIMITS.minPlayers) return null;
  const waiting = view.players.filter((p) => !p.ready);
  if (waiting.length !== 1) return null;
  return view.players.every((p) => p === waiting[0] || p.connected) ? waiting[0] : null;
}

/**
 * The player this phone's bubble is about, or null: the last one, while they are connected
 * (an offline player already glows red with "Offline, tap to remove"; a joke would not help),
 * not on their own phone, and while this phone is in the lobby, not on the last game's results.
 */
function teased(view) {
  const last = lastToSayYes(view);
  return last && last.connected && view.me && last.id !== view.me.id && !view.me.onResults ? last : null;
}

/** The wait's name: the same player in the same room's same lobby is the same wait. */
const waitOf = (view, player) => `${view.code}|${view.games || 0}|${player.id}`;

/**
 * Brings this phone's memory of the wait (`track`, null at first) up to date with `view` at
 * `now`; returns it unchanged while the same wait goes on. `{ key, since, base, seen }`: the
 * wait going on (null for none), when it began on this phone, how many appearances its player
 * had before in this lobby, and per wait how many appearances it began (so an interrupted
 * wait goes on with its order).
 */
export function nudgeTrack(track, view, now) {
  const player = view ? teased(view) : null;
  const key = player ? waitOf(view, player) : null;
  if (track && track.key === key) return track;
  const seen = { ...(track ? track.seen : {}) };
  if (track && track.key) seen[track.key] = track.base + Math.floor((now - track.since) / NUDGE.everyMs) + 1;
  return { key, since: now, base: key ? seen[key] || 0 : 0, seen };
}

/**
 * A name over 10 characters by its first part (before a space or a hyphen), when that part
 * has 3 characters or more: "Maximilian" for "Maximilian-Alexa". The small bubbles call it so,
 * big enough to read; the big bubble always says the whole name.
 */
export function shortName(name) {
  const first = name.split(/[\s-]/)[0];
  return graphemes(name).length > 10 && graphemes(first).length >= 3 ? first : name;
}

/**
 * What the bubble shows on this phone at `now`, or null: `{ line, name, avatar, from,
 * leaving, calls: [{ text, avatar }] }`, the line with the name put in, the waited-for
 * player's name and avatar (their colour), the side it slides in from (-1 left, 1 right),
 * whether it is leaving, and the small bubbles (one per other player, three at most, each in
 * that player's colour).
 */
export function nudgeAt(view, track, now) {
  const player = view ? teased(view) : null;
  if (!player || !track || track.key !== waitOf(view, player)) return null;
  const turn = Math.floor((now - track.since) / NUDGE.everyMs);
  const into = now - track.since - turn * NUDGE.everyMs;
  if (into >= NUDGE.showMs + NUDGE.leaveMs) return null;
  // The appearance's number for this player in this lobby; each run through all the lines
  // has its own order, and each appearance its own side and its own small bubbles.
  const n = track.base + turn;
  const order = shuffle(NUDGE_LINES, seeded(`${track.key}|${Math.floor(n / NUDGE_LINES.length)}`));
  const pick = seeded(`${track.key}|${n}`);
  const from = pick() < 0.5 ? -1 : 1;
  const callers = shuffle(view.players.filter((p) => p.id !== player.id), pick).slice(0, NUDGE_CALLS.length);
  const call = shortName(player.name);
  return {
    line: order[n % NUDGE_LINES.length].replace('{name}', player.name),
    name: player.name,
    avatar: player.avatar,
    from,
    leaving: into >= NUDGE.showMs,
    calls: callers.map((p, i) => ({ text: NUDGE_CALLS[i].replace('{name}', call), avatar: p.avatar })),
  };
}

/** A word as pieces of at most `max` characters, broken after its last hyphen that fits, else hard. */
function pieces(word, max) {
  const rest = graphemes(word);
  const out = [];
  while (rest.length > max) {
    const hyphen = rest.slice(0, max).lastIndexOf('-');
    out.push(rest.splice(0, hyphen > 0 ? hyphen + 1 : max));
  }
  out.push(rest);
  return out;
}

/** The tokens filled into rows of at most `limit` characters, each row as full as it gets. */
function fill(tokens, limit) {
  const out = [];
  let row = [];
  for (const t of tokens) {
    const gap = row.length && !t.glued ? [' '] : [];
    if (row.length && row.length + gap.length + t.g.length > limit) {
      out.push(row);
      row = [...t.g];
    } else row.push(...gap, ...t.g);
  }
  if (row.length) out.push(row);
  return out;
}

/**
 * `text` as rows of at most `max` characters, as even as they can be: the fewest rows it fits
 * in, then the narrowest width that still gives that many, so no word is left alone on the
 * last row when it need not be (the pieces of a broken word follow each other without a
 * space). A line has a few dozen characters, so trying the widths is cheap.
 */
function rows(text, max) {
  const tokens = text.split(' ').filter(Boolean).flatMap((word) => pieces(word, max).map((g, i) => ({ g, glued: i > 0 })));
  const total = tokens.reduce((n, t, i) => n + t.g.length + (i && !t.glued ? 1 : 0), 0);
  for (let count = Math.ceil(total / max); count <= tokens.length; count += 1) {
    for (let limit = Math.ceil(total / count); limit <= max; limit += 1) {
      const out = fill(tokens, limit);
      if (out.length <= count) return out;
    }
  }
  return fill(tokens, max);
}

/** A smooth hump from `lo` at both ends (x 0 and 1) to `hi` in the middle. */
const hump = ([lo, hi], x) => lo + (hi - lo) * Math.sin(Math.PI * x);

/**
 * `text` as rows of characters, each `{ ch, k, emoji }`: `k` its size, the product of its
 * place in its row (`across`, from the ends to the middle) and its row's place among the
 * rows (`down`, a single row stays at 1), rounded so the same line always gives the same
 * markup. `call` gives a small bubble's milder bulge and rows.
 */
export function bulgeRows(text, { call = false } = {}) {
  // Strong enough to see the ball, mild enough that a capital at a row's end still looks like one.
  const across = call ? [0.88, 1.12] : [0.82, 1.18];
  const down = [0.92, 1.07];
  const lines = rows(text, call ? ROW.call : ROW.line);
  return lines.map((row, r) => {
    const v = lines.length === 1 ? 1 : hump(down, (r + 0.5) / lines.length);
    return row.map((ch, i) => ({ ch, k: Number((hump(across, (i + 0.5) / row.length) * v).toFixed(2)), emoji: EMOJI.test(ch) }));
  });
}

/**
 * How big the line may be: as wide as 78% of the photo area (the bubble's padding takes the
 * rest of a bubble at most about 86% wide, so its rock and its shadow stay inside), as tall
 * as 36% of it (the small bubbles above and below need the rest), and at most 2rem.
 */
const FIT = { width: 0.78, height: 0.36, maxRem: 2 };
/** The size the line is measured at before it is scaled to fit (px). */
const PROBE = 20;

/**
 * Sizes the big bubble's line in `part` (the lobby's `nudge` part over the photo area) so it
 * fits (`FIT`): measured once at a known size, then scaled. Called by main.js right after a
 * paint that changed the part; nothing to do without a bubble.
 */
export function fitNudge(part) {
  const line = part && part.querySelector('[data-cell="line"]');
  if (!line) return;
  const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
  line.style.fontSize = `${PROBE}px`;
  const scale = Math.min((part.clientWidth * FIT.width) / line.offsetWidth, (part.clientHeight * FIT.height) / line.offsetHeight);
  line.style.fontSize = `${Math.min(FIT.maxRem * rem, PROBE * scale).toFixed(1)}px`;
}
