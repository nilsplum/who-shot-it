/**
 * A round on screen: the round counter, the timer bar, the photo (with a flag to report
 * it), one card per player to pick from (everyone answers, the owner included, and anyone
 * may pick themselves), who has answered, and the reveal.
 *
 * Mechanisms: shown in the `load`, `show` and `reveal` phases. `main.js` preloads the
 * photo (and the next one), tells the room once it is loaded, starts the effect when the
 * `stage` part changes, animates the timer bar (`#tbar`) every frame and vibrates on the
 * reveal (`phone.buzz`). The bar is a part of its own: on the reveal it changes from the
 * answer time's look to the look time's (`ui.timerBar`). Photo links in the view are server paths; `serverUrl` makes them
 * full addresses. The host can tap a player in the "who has answered" row to remove them
 * (`views/sheets.js`). Scores live on the leaderboard between the rounds, not here.
 *
 * Layout: the photo takes all the height the rest leaves free (the screen has its exact
 * height), down to 30% of the screen; with more players than fit, the page scrolls. The
 * photo never changes size within a round, so an effect (the pixel canvas is drawn at the
 * photo's size) and the cards stay put: the cards hold their place, invisible, until the
 * photo is there, and "who has answered" and the reactions share one bottom area of
 * fixed height.
 *
 * Invariants: a card shows only the avatar and the name, in the same place before and
 * after the reveal, so the eye stays where it was. On the reveal the owner's card turns
 * green with a ✓, my wrong pick red with a ✗ (colour never carries the meaning alone);
 * a right pick also makes the owner's card pop and throw a little confetti.
 */

import { serverUrl } from '../api.js';
import { LEAVE_BUTTON, SPINNER, avatar, barTitle, esc, reactionsRow, timerBar, topBar } from '../ui.js';

function bar(view) {
  return topBar(LEAVE_BUTTON, barTitle(`${view.round.n} / ${view.round.total}`));
}

const CENTRED = 'absolute inset-0 grid place-items-center';

/**
 * The photo, or a spinner until it is loaded. Pixel mode draws on a canvas. A photo gone
 * during the reveal (reported, or its owner left) leaves a plain sign behind.
 */
function stage(view, loaded) {
  const r = view.round;
  if (view.phase === 'reveal' && !r.photo) return `<div class="${CENTRED} text-8xl opacity-50">🚫</div>`;
  if (view.phase === 'load' || !r.photo || !loaded) return `<div class="${CENTRED}">${SPINNER}</div>`;
  const src = esc(serverUrl(r.photo));
  const media = view.phase === 'show' && r.mode === 'pixel' ? '<canvas class="size-full object-contain"></canvas>' : `<img class="size-full object-contain" alt="" src="${src}">`;
  // Phase and round in the markup make the reveal repaint the plain photo, ending any effect.
  return `<div class="absolute inset-0 overflow-hidden" data-round="${r.n}" data-phase="${view.phase}">${media}</div>
    <button class="absolute top-2 right-2 size-8.5 rounded-full bg-stage/70 text-md text-white opacity-70" data-act="report" aria-label="Report this photo">⚑</button>`;
}

const player = (view, id) => view.players.find((p) => p.id === id);

/** A card: avatar and name. Its look (border and background) is one of the states below. */
const CARD = 'relative flex min-h-16 items-center gap-2.5 rounded-2xl border-3 px-3 py-2.5 text-left text-ink';
const NAME = 'min-w-0 flex-1 truncate text-xl';
const BADGE = 'text-4xl leading-none font-extrabold';
const LOOK = {
  open: 'border-transparent bg-card active:scale-97',
  chosen: 'border-yellow bg-picked',
  out: 'border-transparent bg-card opacity-35',
  plain: 'border-transparent bg-card',
  right: 'border-green bg-green-dark',
  wrong: 'border-red bg-red-dark',
};

function pickCard(view, id, { picked, late, hidden }) {
  const p = player(view, id);
  const look = picked ? (picked === id ? LOOK.chosen : LOOK.out) : late ? LOOK.out : LOOK.open;
  return `<button class="${CARD} ${look}" data-act="answer" data-v="${esc(id)}" ${picked || late || hidden ? 'disabled' : ''}>${avatar(p, 'lg')}<span class="${NAME}">${esc(p.name)}</span></button>`;
}

/** Ten confetti pieces flying out of a card, each its own direction and colour. */
const CONFETTI = Array.from({ length: 10 }, (_, i) => {
  const angle = (i / 10) * 2 * Math.PI;
  return `<i class="pointer-events-none absolute top-1/2 left-1/2 size-2.25 animate-burst rounded-xs bg-player motion-reduce:hidden" style="--x:${Math.round(Math.cos(angle) * 90)}px;--y:${Math.round(Math.sin(angle) * 60)}px;--player:var(--color-p${i})"></i>`;
}).join('');

function revealCard(view, id) {
  const p = player(view, id);
  const r = view.round;
  const mine = r.results && r.results[view.me.id] ? r.results[view.me.id].pick : null;
  const name = esc(p.name);
  if (id === r.owner) {
    const won = mine === id;
    return `<div class="${CARD} ${LOOK.right} ${won ? 'z-1 animate-win' : 'animate-reveal'} motion-reduce:animate-none" aria-label="${name}: their photo">${avatar(p, 'lg')}<span class="${NAME}">${name}</span><span class="${BADGE} text-green">✓</span>${won ? CONFETTI : ''}</div>`;
  }
  if (id === mine) return `<div class="${CARD} ${LOOK.wrong}" aria-label="${name}: your pick, wrong">${avatar(p, 'lg')}<span class="${NAME}">${name}</span><span class="${BADGE} text-red">✗</span></div>`;
  return `<div class="${CARD} ${LOOK.plain}">${avatar(p, 'lg')}<span class="${NAME}">${name}</span></div>`;
}

/** The cards; until the photo is there they hold their place, invisible and disabled. */
function cards(view, { picked, late, loaded }) {
  const ids = view.round.options;
  const hidden = view.phase === 'load' || !loaded;
  const card = view.phase === 'reveal' ? (id) => revealCard(view, id) : (id) => pickCard(view, id, { picked, late, hidden });
  return `<div class="mt-3 grid grid-cols-2 gap-2 ${hidden ? 'invisible' : ''}">${ids.map(card).join('')}</div>`;
}

function dots(view, host) {
  if (view.phase !== 'show') return '';
  const answered = new Set(view.round.answered);
  const dot = (p) => {
    const a = avatar(p, 'sm', answered.has(p.id) ? '' : 'opacity-25');
    return host && p.id !== view.me.id ? `<button data-act="remove" data-v="${esc(p.id)}" aria-label="${esc(p.name)}: remove from game">${a}</button>` : a;
  };
  return `<div class="mt-3 flex min-h-6.5 flex-wrap justify-center gap-1.25">${view.players.map(dot).join('')}</div>
    ${host ? '<button class="link" data-act="resolve">Reveal now</button>' : ''}`;
}

function after(view, reactions) {
  return view.phase === 'reveal' ? `<div class="mt-3">${reactionsRow(reactions)}</div>` : '';
}

/**
 * @param state { picked: my pick or null, late: time is up, loaded: photo is loaded,
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
      <div class="relative min-h-[30dvh] flex-1 overflow-hidden rounded-3xl bg-stage" data-part="stage"></div>
      <div data-part="opts"></div>
      <div class="min-h-21"><div data-part="dots"></div><div data-part="after"></div></div>
    </div>`,
    parts: {
      bar: bar(view),
      timer: timerBar(view.phase === 'reveal' ? 'look' : 'answer'),
      stage: stage(view, state.loaded),
      opts: cards(view, state),
      dots: dots(view, host),
      after: after(view, state.reactions),
    },
  };
}
