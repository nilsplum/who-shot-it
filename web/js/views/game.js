/**
 * A round on screen: the round counter, the timer bar, the photo (with ⚑ to flag it), one
 * card per player to pick from (everyone answers, the owner included, and anyone may pick
 * themselves), who has answered, and the reveal.
 *
 * Mechanisms: shown in the `load`, `show` and `reveal` phases. The game's photos are
 * loaded ahead into memory (`upcoming.js`): the stage paints the round's photo from there
 * (`state.src`), and while the room waits for the phones to be ready for the round (`load`)
 * it shows how far the whole table is (`ui.progress`). `main.js` starts the effect when
 * the `stage` part changes, animates the timer bar (`#tbar`) every frame and vibrates when
 * the photo appears and on the reveal (`main.js` `moments`). The bar is a part of its own:
 * on the reveal it changes from the answer time's look to the look time's
 * (`ui.timerBar`). The host can tap a player in the "who has answered" row to remove them
 * (`views/sheets.js`). Scores live on the leaderboard between the rounds, not here. While
 * someone else flagged the photo (`round.flag`, not mine), the stage says so instead of
 * showing it and the cards wait; the flagger keeps the photo under the report sheet.
 *
 * Layout: the photo takes all the height the rest leaves free (the screen has its exact
 * height) and is the one thing that gives way, so the page never scrolls. The cards get
 * denser with more players (`DENSITIES`: two columns of big cards up to 4, three columns up
 * to 9, four columns of compact cards up to 16), and a card too narrow for avatar and name
 * side by side stacks them (a container query on the card), so 16 players fit the smallest
 * phone with the photo still a third of the screen. The photo never changes size within a
 * round, so an effect (the pixel canvas is drawn at the photo's size) and the cards stay
 * put: the cards hold their place, invisible, until the photo is there, and "who has
 * answered" (up to two rows of small avatars) and the reactions share one bottom area of
 * fixed height, aligned to the bottom edge like "Show again" and "Play again" on the other
 * screens.
 *
 * Invariants: a card shows only the avatar and the name, in the same place before and
 * after the reveal, so the eye stays where it was. On the reveal the owner's card turns
 * green with a ✓, my wrong pick red with a ✗ (colour never carries the meaning alone);
 * a right pick also makes the owner's card pop and throw a little confetti.
 */

import { LEAVE_BUTTON, SPINNER, avatar, barTitle, esc, progress, reactionsRow, timerBar, topBar } from '../ui.js';

function bar(view) {
  return topBar(LEAVE_BUTTON, barTitle(`${view.round.n} / ${view.round.total}`));
}

const CENTRED = 'absolute inset-0 grid place-items-center';

/** A short notice in the middle of the stage, in place of the photo. */
const notice = (icon, title, line = '') =>
  `<div class="${CENTRED} px-6 text-center"><div><div class="text-6xl leading-none">${icon}</div><b class="mt-3 block text-xl">${title}</b>${line ? `<span class="mt-1 block text-muted">${line}</span>` : ''}</div></div>`;

/**
 * The photo, or what the phone waits for. Pixel mode draws on a canvas. A photo gone during
 * the reveal (reported, or its owner left) leaves a plain sign behind; one flagged by
 * someone else is hidden while they decide; one that could not load says so. While the room
 * waits for the phones (`load`), the bar shows how far the whole table is.
 * @param state this phone's copy of the photo (`photo`: 'loading' | 'ok' | 'error', `src`:
 *              its object URL) and the table's loading share (`loading`, or null)
 */
function stage(view, { photo, src: url, loading }) {
  const r = view.round;
  if (view.phase === 'reveal' && !r.photo) return `<div class="${CENTRED} text-8xl opacity-50">🚫</div>`;
  if (r.flag && !r.flag.mine) return notice('⚑', 'Someone flagged this photo', 'Waiting…');
  if (r.photo && photo === 'error') return notice('😕', 'This photo could not load');
  if (view.phase === 'load' && loading !== null) return `<div class="${CENTRED} px-10">${progress(loading, 'Loading photos')}</div>`;
  if (view.phase === 'load' || !r.photo || photo !== 'ok') return `<div class="${CENTRED}">${SPINNER}</div>`;
  const src = esc(url);
  const media = view.phase === 'show' && r.mode === 'pixel' ? '<canvas class="size-full object-contain"></canvas>' : `<img class="size-full object-contain" alt="" src="${src}">`;
  // Phase and round in the markup make the reveal repaint the plain photo, ending any effect.
  return `<div class="absolute inset-0 overflow-hidden" data-round="${r.n}" data-phase="${view.phase}">${media}</div>
    <button class="absolute top-2 right-2 size-8.5 rounded-full bg-stage/70 text-md text-white opacity-70" data-act="report" aria-label="Report this photo">⚑</button>`;
}

const player = (view, id) => view.players.find((p) => p.id === id);

/**
 * How the cards are laid out by how many there are: the grid's columns and gap, the card's
 * size (`card`), the avatar's (`ui.avatar`), the name's and the ✓/✗ badge's. Whole class
 * names, so Tailwind builds them.
 */
const DENSITIES = {
  roomy: { grid: 'grid-cols-2 gap-2', card: 'min-h-16 rounded-2xl border-3 px-3 py-2.5', avatar: 'lg', name: 'text-xl', badge: 'text-4xl' },
  medium: { grid: 'grid-cols-3 gap-1.5', card: 'min-h-16 rounded-2xl border-3 px-2 py-1.5', avatar: 'md', name: 'text-md', badge: 'text-2xl' },
  compact: { grid: 'grid-cols-4 gap-1.5', card: 'h-12 rounded-xl border-2 px-1.5', avatar: 'sm', name: 'text-sm', badge: 'text-xl' },
};
const densityOf = (count) => (count <= 4 ? DENSITIES.roomy : count <= 9 ? DENSITIES.medium : DENSITIES.compact);

/**
 * A card's inside: avatar, name and (on the reveal) the badge, side by side; when the card is
 * narrower than 7.5rem (a container query on the card, `@container`) they stack, the name
 * under the avatar and the badge in the top corner, so a name stays readable on a small
 * phone. The card is `relative`, which places the stacked badge and the confetti.
 */
function inside(p, d, badge = '') {
  return `<span class="grid grid-cols-[auto_1fr_auto] items-center gap-2 @max-[7.5rem]:grid-cols-1 @max-[7.5rem]:content-center @max-[7.5rem]:justify-items-center @max-[7.5rem]:gap-0">${avatar(p, d.avatar)}<span class="max-w-full min-w-0 truncate leading-tight ${d.name}">${esc(p.name)}</span>${badge}</span>`;
}

/** The ✓ or ✗ of the reveal, in the colour that says the same. */
const badge = (d, glyph, colour) =>
  `<span class="leading-none font-extrabold ${d.badge} ${colour} @max-[7.5rem]:absolute @max-[7.5rem]:top-0.5 @max-[7.5rem]:right-1 @max-[7.5rem]:text-md">${glyph}</span>`;

/**
 * A card: its size by the density, its look (border and background) one of the states below.
 * A grid, so its inside stretches over the card's whole height and centres there.
 */
const CARD = '@container relative grid text-left text-ink';
const LOOK = {
  open: 'border-transparent bg-card active:scale-97',
  chosen: 'border-yellow bg-picked',
  out: 'border-transparent bg-card opacity-35',
  plain: 'border-transparent bg-card',
  right: 'border-green bg-green-dark',
  wrong: 'border-red bg-red-dark',
};

/** A card to pick; `wait` while someone flagged the photo (nobody answers what they cannot see). */
function pickCard(view, d, id, { picked, late, hidden, wait }) {
  const p = player(view, id);
  const look = picked ? (picked === id ? LOOK.chosen : LOOK.out) : late || wait ? LOOK.out : LOOK.open;
  return `<button class="${CARD} ${d.card} ${look}" data-act="answer" data-v="${esc(id)}" ${picked || late || hidden || wait ? 'disabled' : ''}>${inside(p, d)}</button>`;
}

/** Ten confetti pieces flying out of a card, each its own direction and colour. */
const CONFETTI = Array.from({ length: 10 }, (_, i) => {
  const angle = (i / 10) * 2 * Math.PI;
  return `<i class="pointer-events-none absolute top-1/2 left-1/2 size-2.25 animate-burst rounded-xs bg-player motion-reduce:hidden" style="--x:${Math.round(Math.cos(angle) * 90)}px;--y:${Math.round(Math.sin(angle) * 60)}px;--player:var(--color-p${i})"></i>`;
}).join('');

function revealCard(view, d, id) {
  const p = player(view, id);
  const r = view.round;
  const mine = r.results && r.results[view.me.id] ? r.results[view.me.id].pick : null;
  const name = esc(p.name);
  if (id === r.owner) {
    const won = mine === id;
    return `<div class="${CARD} ${d.card} ${LOOK.right} ${won ? 'z-1 animate-win' : 'animate-reveal'} motion-reduce:animate-none" aria-label="${name}: their photo">${inside(p, d, badge(d, '✓', 'text-green'))}${won ? CONFETTI : ''}</div>`;
  }
  if (id === mine) return `<div class="${CARD} ${d.card} ${LOOK.wrong}" aria-label="${name}: your pick, wrong">${inside(p, d, badge(d, '✗', 'text-red'))}</div>`;
  return `<div class="${CARD} ${d.card} ${LOOK.plain}">${inside(p, d)}</div>`;
}

/** The cards, as dense as their number needs; until the photo is there (or could not load) they hold their place, invisible and disabled. */
function cards(view, { picked, late, photo }) {
  const ids = view.round.options;
  const d = densityOf(ids.length);
  const hidden = view.phase === 'load' || photo === 'loading';
  const wait = Boolean(view.round.flag);
  const card = view.phase === 'reveal' ? (id) => revealCard(view, d, id) : (id) => pickCard(view, d, id, { picked, late, hidden, wait });
  return `<div class="mt-3 grid ${d.grid} ${hidden ? 'invisible' : ''}">${ids.map(card).join('')}</div>`;
}

/**
 * Who has answered: a small avatar per player, with the dashed ring while the round waits
 * for them (`ui.avatar`). The host can tap one to remove that player.
 */
function dots(view, host) {
  if (view.phase !== 'show') return '';
  const answered = new Set(view.round.answered);
  const dot = (p) => {
    const a = avatar(p, 'sm', { waiting: !answered.has(p.id) });
    return host && p.id !== view.me.id ? `<button data-act="remove" data-v="${esc(p.id)}" aria-label="${esc(p.name)}: remove from game">${a}</button>` : a;
  };
  return `<div class="flex flex-wrap justify-center gap-1">${view.players.map(dot).join('')}</div>`;
}

function after(view, reactions) {
  return view.phase === 'reveal' ? reactionsRow(reactions) : '';
}

/**
 * @param state { picked: my pick or null, late: time is up, photo: this phone's copy of the
 *                photo ('loading' | 'ok' | 'error'), src: its object URL, loading: how far
 *                the table is while the room waits for the photos (0 to 1) or null,
 *                reactions: the reaction emojis }
 */
export function gameScreen(c, state) {
  const { view } = c;
  const host = view.hostId === view.me.id;
  return {
    key: `game|${view.code}`,
    layout: `<div class="screen h-dvh">
      <div data-part="bar"></div>
      <div data-part="timer"></div>
      <div class="relative min-h-0 flex-1 overflow-hidden rounded-3xl bg-stage" data-part="stage"></div>
      <div data-part="opts"></div>
      <div class="mt-3 flex h-15 flex-col justify-end"><div data-part="dots"></div><div data-part="after"></div></div>
    </div>`,
    parts: {
      bar: bar(view),
      timer: timerBar(view.phase === 'reveal' ? 'look' : 'answer'),
      stage: stage(view, state),
      opts: cards(view, state),
      dots: dots(view, host),
      after: after(view, state.reactions),
    },
  };
}
