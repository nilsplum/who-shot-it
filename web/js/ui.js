/**
 * Shared UI building blocks: HTML escaping, avatars, the top bar and its buttons, the logo
 * with the big title, the two ways to show a wait (the spinner and the progress bar), the
 * timer bar, the list of rules or steps, the one toast, and the reaction row with its
 * floating emojis.
 *
 * Mechanisms: every view (`web/js/views/`) builds HTML strings with these helpers;
 * `web/js/main.js` paints them. All transient feedback goes through `toast`; confirmations
 * are sheets (`views/sheets.js`), never native `alert`/`confirm`. Styling is Tailwind
 * utility classes (`styles/app.css` holds the theme and the component classes `screen`,
 * `btn` and `link`); a piece of markup that more than one screen shows is built here, once.
 *
 * Invariants: every text from a player (names) passes through `esc` before it reaches
 * the DOM. A player's colour is one of the tokens `--color-p0`..`--color-p11`, chosen by
 * the emoji, so a player looks the same on the home screen and in every room (the room
 * keeps avatars unique, so two players never look alike); `--player` on an element hands it
 * to the classes `border-player`, `bg-player` and `bg-player-fill`. Class names are always
 * written out whole: Tailwind builds only the classes it finds as complete words here.
 */

import { EMOJIS } from '../shared/config.js';

const PLAYER_COLOURS = 12;

export const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** The player colour of an avatar emoji, as the value for `--player`. */
export const colourOf = (emoji) => `var(--color-p${Math.max(0, EMOJIS.indexOf(emoji)) % PLAYER_COLOURS})`;

/** Avatar sizes; the emoji grows with the circle. */
const AVATAR_SIZES = {
  sm: 'size-6 text-xs', // who has answered (16 fit in two rows on the smallest phone), the compact cards
  md: 'size-8 text-lg', // chips, the ranking under the podium, the cards for 5 to 9 players
  lg: 'size-10 text-3xl', // the cards for up to 4 players, the leaderboard
  xl: 'size-13 text-4xl', // the podium
};

/**
 * The avatar's ring and fill: the player's colour, or while the game waits for the player (in
 * "who has answered", not yet answered) a dashed grey ring on the plain card colour. Waiting is
 * never shown by fading: a faded avatar reads as "gone", a dashed one as "not yet".
 */
const AVATAR_RINGS = {
  on: 'border-solid border-player bg-player-fill',
  waiting: 'border-dashed border-line-strong bg-card',
};

/**
 * A round avatar for a player (`{ avatar }`) in their colour; `waiting` gives it the dashed
 * ring, `extra` adds classes (margin, animation).
 */
export const avatar = (player, size = 'md', { waiting = false, extra = '' } = {}) =>
  `<span class="inline-grid shrink-0 place-items-center rounded-full border-2 leading-none ${AVATAR_RINGS[waiting ? 'waiting' : 'on']} ${AVATAR_SIZES[size]} ${extra}" style="--player:${colourOf(player.avatar)}">${esc(player.avatar)}</span>`;

/**
 * The bar at the top of a screen: a button on the left (leave, back), a title in the middle
 * and a button on the right ("?"); each may be empty. The left glyph lines up with the
 * content's edge.
 */
export const topBar = (left = '', middle = '', right = '') =>
  `<div class="grid min-h-9 grid-cols-[1fr_auto_1fr] items-center"><div class="-ml-2 justify-self-start">${left}</div><div>${middle}</div><div class="justify-self-end">${right}</div></div>`;

/** The top bar's title. */
export const barTitle = (text) => `<span class="font-display text-xl font-extrabold">${text}</span>`;

/** A glyph button of the top bar: ✕ (leave), ‹ (back). */
export const iconButton = (act, label, glyph) =>
  `<button class="min-h-9 min-w-10 px-2 py-1 text-3xl leading-none text-muted" data-act="${act}" aria-label="${label}">${glyph}</button>`;

export const LEAVE_BUTTON = iconButton('leave', 'Leave', '✕');

/** The round "?" that opens "How to play". */
export const HELP_BUTTON = '<button class="size-8.5 rounded-full border-2 border-line text-lg leading-none font-extrabold text-muted" data-act="help" aria-label="How to play">?</button>';

/** The app's name as a title: "Who Shot It?" with its second half in yellow. */
export const NAME_TITLE = 'Who <span class="text-yellow">Shot It?</span>';

/**
 * The logo over a big title (start screen, website, terms). The logo is the app's icon
 * itself (`web/icons/icon.svg`, its one source), so the app, the website and the stores
 * look the same. `small` for the terms screen; `more` goes under the title.
 */
export const hero = (title, { small = false, more = '' } = {}) =>
  `<div class="text-center ${small ? 'mb-4.5' : 'mb-7'}"><img class="mx-auto animate-bob rounded-[22%] shadow-lift motion-reduce:animate-none ${small ? 'size-16' : 'size-21'}" src="/icons/icon.svg" alt="">
    <h1 class="mt-3.5 font-display text-7xl font-extrabold tracking-tight">${title}</h1>${more}</div>`;

/** A wait of unknown length (the photo being picked, joining); for a known amount, `progress`. */
export const SPINNER = '<div class="mx-auto size-10 animate-spin rounded-full border-4 border-line border-t-yellow"></div>';

/**
 * A wait whose amount is known: what it waits for, how far it is (`share`, 0 to 1, as a
 * percentage) and a bar filling up. It takes the timer bar's slot exactly (same height), so a
 * leaderboard that starts waiting for photos swaps one for the other without anything moving.
 */
export function progress(share, label) {
  const pct = Math.round(Math.max(0, Math.min(1, share)) * 100);
  return `<div class="flex h-7 w-full flex-col justify-center gap-1" role="progressbar" aria-label="${esc(label)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}">
    <div class="flex justify-between text-xs leading-none text-muted"><span>${esc(label)}</span><span class="tabular-nums">${pct}%</span></div>
    <div class="h-1.5 overflow-hidden rounded-full bg-raised"><i class="block h-full w-(--share) rounded-full bg-yellow" style="--share:${pct}%"></i></div></div>`;
}

/**
 * The timer bar's two looks, by what the time is for: `answer`, warm (coral to green), the
 * time to pick; `look`, cool (blue to violet), the time to look at the answer on the reveal
 * and the leaderboard, which runs on by itself.
 */
const TIMER_LOOKS = {
  answer: 'from-coral via-yellow to-green',
  look: 'from-blue to-violet',
};

/**
 * The timer bar under the top bar (game and leaderboard), in one of its looks, centred in a
 * slot as tall as `progress`; `data-kind` names it for the tests. `main.js` shrinks `#tbar`
 * every frame and sets `data-off` on it while no timer runs (the empty track stays).
 */
export const timerBar = (kind) =>
  `<div class="flex h-7 flex-col justify-center"><div class="h-1.5 overflow-hidden rounded-full bg-raised"><i id="tbar" class="block h-full origin-left bg-linear-to-r/srgb ${TIMER_LOOKS[kind]} data-off:opacity-0" data-kind="${kind}"></i></div></div>`;

/** A few rules or steps, each with an emoji in front (the terms, "How to play"); the texts are HTML. */
export const steps = (items) =>
  `<ul class="mb-4">${items.map(([icon, text]) => `<li class="flex items-start gap-3 py-2 leading-snug"><span class="text-3xl leading-none">${icon}</span>${text}</li>`).join('')}</ul>`;

let toastTimer = 0;
/** The one toast (`#toast` in index.html): `data-on` slides it in. */
export function toast(text) {
  const el = document.getElementById('toast');
  el.textContent = text;
  el.toggleAttribute('data-on', true);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.toggleAttribute('data-on', false), 2600);
}

/**
 * The reaction row, the same on every screen that has one: emoji buttons in a row that
 * scrolls sideways (most used first), and right after it a small arrow (`main.js`, action
 * `reactmore`, scrolls the element before the arrow) that goes to the end and from there
 * back to the start. Each button is exactly a fifth of the row (the round emoji in its
 * middle) and the row snaps to whole buttons, so it always shows five whole ones: never a
 * button cut off at the edge, and the ten reactions are two pages. Its markup never
 * changes, so a repaint keeps the scroll.
 */
export function reactionsRow(reactions) {
  const buttons = reactions.map((e) => `<button class="group grid w-1/5 shrink-0 snap-start place-items-center py-1" data-act="react" data-v="${e}" aria-label="React ${e}"><span class="grid aspect-square w-[calc(100%-4px)] max-w-13 place-items-center rounded-full bg-card text-4xl group-active:scale-85">${e}</span></button>`).join('');
  return `<div class="flex items-center gap-1.5"><div class="flex flex-1 snap-x snap-mandatory scroll-smooth overflow-x-auto scrollbar-none [&::-webkit-scrollbar]:hidden">${buttons}</div><button class="h-13 w-8 shrink-0 text-4xl text-muted" data-act="reactmore" aria-label="More reactions">›</button></div>`;
}

/**
 * Lets `emoji` rise up the screen from its button in the reaction row (also for someone
 * else's reaction): from the button's middle, kept inside the row's visible part, so a
 * button scrolled away (or half way while the row moves) sends it from the nearest edge.
 * Without a reaction row on screen it rises from the bottom middle.
 */
export function floatEmoji(emoji) {
  const el = document.createElement('span');
  el.className = 'pointer-events-none fixed z-60 animate-rise text-7xl leading-none';
  el.textContent = emoji;
  const button = [...document.querySelectorAll('[data-act="react"]')].find((b) => b.dataset.v === emoji);
  const box = button && button.getBoundingClientRect();
  if (box && box.width) {
    const row = button.parentElement.getBoundingClientRect();
    const half = box.width / 2;
    el.style.left = `${Math.min(Math.max(box.left + half, row.left + half), row.right - half)}px`;
    el.style.top = `${box.top}px`;
  } else {
    el.style.left = '50vw';
    el.style.top = 'calc(100vh - 90px)';
  }
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2500);
}
