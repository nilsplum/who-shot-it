/**
 * A round on screen: the round counter, the timer bar, the photo (with a flag to report
 * it), one card per player to pick from (everyone answers, the owner included, and anyone
 * may pick themselves), who has answered, and the reveal.
 *
 * Mechanisms: shown in the `load`, `show` and `reveal` phases. `main.js` preloads the
 * photo (and the next one), tells the room once it is loaded, starts the effect when the
 * `stage` part changes, animates the timer bar (`#tbar`) every frame and vibrates on the
 * reveal (`phone.buzz`). Photo links in the view are server paths; `serverUrl` makes them
 * full addresses. The host can tap a player in the "who has answered" row to remove them
 * (`views/sheets.js`). Scores live on the leaderboard between the rounds, not here.
 *
 * Invariants: a card shows only the avatar and the name, in the same place before and
 * after the reveal, so the eye stays where it was. On the reveal the owner's card turns
 * green with a ✓, my wrong pick red with a ✗ (colour never carries the meaning alone);
 * a right pick also makes the owner's card pop and throw a little confetti.
 */

import { serverUrl } from '../api.js';
import { avatar, esc, reactionsRow } from '../ui.js';

function bar(view) {
  return `<button class="icon" data-act="leave" aria-label="Leave">✕</button>
    <span class="rnd">${view.round.n} / ${view.round.total}</span><span></span>`;
}

/**
 * The photo, or a spinner until it is loaded. Pixel mode draws on a canvas. A photo gone
 * during the reveal (reported, or its owner left) leaves a plain sign behind.
 */
function stage(view, loaded) {
  const r = view.round;
  if (view.phase === 'reveal' && !r.photo) return '<div class="loader gone">🚫</div>';
  if (view.phase === 'load' || !r.photo || !loaded) return '<div class="loader"><div class="spin"></div></div>';
  const src = esc(serverUrl(r.photo));
  const media = view.phase === 'show' && r.mode === 'pixel' ? '<canvas></canvas>' : `<img alt="" src="${src}">`;
  // Phase and round in the markup make the reveal repaint the plain photo, ending any effect.
  return `<div class="frame" data-round="${r.n}" data-phase="${view.phase}">${media}</div>
    <button class="flag" data-act="report" aria-label="Report this photo">⚑</button>`;
}

const player = (view, id) => view.players.find((p) => p.id === id);

function pickCard(view, id, { picked, late }) {
  const p = player(view, id);
  const cls = picked ? (picked === id ? 'sel' : 'off') : late ? 'off' : '';
  return `<button class="opt ${cls}" data-act="answer" data-v="${esc(id)}" ${picked || late ? 'disabled' : ''}>${avatar(p)}<span class="nm">${esc(p.name)}</span></button>`;
}

/** Ten confetti pieces flying out of a card, each its own direction and colour. */
const CONFETTI = Array.from({ length: 10 }, (_, i) => {
  const angle = (i / 10) * 2 * Math.PI;
  return `<i class="cf" style="--x:${Math.round(Math.cos(angle) * 90)}px;--y:${Math.round(Math.sin(angle) * 60)}px;--c:var(--p${i})"></i>`;
}).join('');

function revealCard(view, id) {
  const p = player(view, id);
  const r = view.round;
  const mine = r.results && r.results[view.me.id] ? r.results[view.me.id].pick : null;
  const name = esc(p.name);
  if (id === r.owner) {
    const won = mine === id;
    return `<div class="opt ok ${won ? 'win' : ''}" aria-label="${name}: their photo">${avatar(p)}<span class="nm">${name}</span><span class="badge">✓</span>${won ? CONFETTI : ''}</div>`;
  }
  if (id === mine) return `<div class="opt bad" aria-label="${name}: your pick, wrong">${avatar(p)}<span class="nm">${name}</span><span class="badge">✗</span></div>`;
  return `<div class="opt">${avatar(p)}<span class="nm">${name}</span></div>`;
}

function cards(view, { picked, late, loaded }) {
  if (view.phase === 'load' || !loaded) return '';
  const ids = view.round.options;
  const card = view.phase === 'show' ? (id) => pickCard(view, id, { picked, late }) : (id) => revealCard(view, id);
  return `<div class="opts">${ids.map(card).join('')}</div>`;
}

function dots(view, host) {
  if (view.phase !== 'show') return '';
  const answered = new Set(view.round.answered);
  const dot = (p) => {
    const a = avatar(p, answered.has(p.id) ? 'on' : '');
    return host && p.id !== view.me.id ? `<button class="bare" data-act="remove" data-v="${esc(p.id)}" aria-label="${esc(p.name)}: remove from game">${a}</button>` : a;
  };
  return `<div class="dots">${view.players.map(dot).join('')}</div>
    ${host ? '<button class="link" data-act="resolve">Reveal now</button>' : ''}`;
}

function after(view, reactions) {
  return view.phase === 'reveal' ? reactionsRow(reactions) : '';
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
    layout: `<div class="wrap">
      <div class="gbar" data-part="bar"></div>
      <div class="timer" id="timer"><i id="tbar"></i></div>
      <div class="stage" data-part="stage"></div>
      <div data-part="opts"></div>
      <div data-part="dots"></div>
      <div class="after" data-part="after"></div>
    </div>`,
    parts: {
      bar: bar(view),
      stage: stage(view, state.loaded),
      opts: cards(view, state),
      dots: dots(view, host),
      after: after(view, state.reactions),
    },
  };
}
