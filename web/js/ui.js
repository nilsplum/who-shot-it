/**
 * Shared UI building blocks: HTML escaping, avatars, the top bar and its buttons, the logo
 * with the big title, the spinner, the list of rules or steps, the one toast, and the
 * reaction row with its floating emojis.
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
  sm: 'size-6.5 text-xs', // who has answered
  md: 'size-8 text-lg', // chips, the ranking under the podium
  lg: 'size-10 text-3xl', // the cards to pick from, the leaderboard
  xl: 'size-13 text-4xl', // the podium
};

/** A round avatar for a player (`{ avatar }`) in their colour; `extra` adds classes (opacity, animation). */
export const avatar = (player, size = 'md', extra = '') =>
  `<span class="inline-grid shrink-0 place-items-center rounded-full border-2 border-player bg-player-fill leading-none ${AVATAR_SIZES[size]} ${extra}" style="--player:${colourOf(player.avatar)}">${esc(player.avatar)}</span>`;

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

export const SPINNER = '<div class="mx-auto size-10 animate-spin rounded-full border-4 border-line border-t-yellow"></div>';

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
 * The timer bar under the top bar (game and leaderboard), in one of its looks; `data-kind`
 * names it for the tests. `main.js` shrinks `#tbar` every frame and sets `data-off` on it
 * while no timer runs (the empty track stays).
 */
export const timerBar = (kind) =>
  `<div class="mt-2.5 mb-3 h-1.5 overflow-hidden rounded-full bg-raised"><i id="tbar" class="block h-full origin-left bg-linear-to-r/srgb ${TIMER_LOOKS[kind]} data-off:opacity-0" data-kind="${kind}"></i></div>`;

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
 * The reaction row, the same on every screen that has one: big emoji buttons in a row that
 * scrolls sideways (most used first), and right after it a small arrow that pages through it
 * (`main.js`, action `reactmore`, scrolls the element before the arrow). Its markup never
 * changes, so a repaint keeps the scroll.
 */
export function reactionsRow(reactions) {
  const buttons = reactions.map((e) => `<button class="size-13 shrink-0 rounded-full bg-card text-4xl active:scale-85" data-act="react" data-v="${e}" aria-label="React ${e}">${e}</button>`).join('');
  return `<div class="flex items-center gap-1.5"><div class="flex flex-1 scroll-smooth gap-2 overflow-x-auto px-0.5 py-1 scrollbar-none [&::-webkit-scrollbar]:hidden">${buttons}</div><button class="h-13 w-8 shrink-0 text-4xl text-muted" data-act="reactmore" aria-label="More reactions">›</button></div>`;
}

/**
 * Lets `emoji` rise up the screen: from its button in the reaction row when that button is
 * on screen (also for someone else's reaction), else from the bottom middle.
 */
export function floatEmoji(emoji) {
  const el = document.createElement('span');
  el.className = 'pointer-events-none fixed z-60 animate-rise text-7xl leading-none';
  el.textContent = emoji;
  const button = [...document.querySelectorAll('[data-act="react"]')].find((b) => b.dataset.v === emoji);
  const row = button && button.parentElement.getBoundingClientRect();
  const box = button && button.getBoundingClientRect();
  const visible = box && box.width && box.left >= row.left - 1 && box.right <= row.right + 1;
  el.style.left = visible ? `${box.left + box.width / 2}px` : '50vw';
  el.style.top = visible ? `${box.top}px` : 'calc(100vh - 90px)';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2500);
}
