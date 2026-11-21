/**
 * A round on screen: round counter and score, the timer bar, the photo, the answer
 * buttons (everyone answers, the owner included, and anyone may pick themselves), who
 * has answered, and the reveal.
 *
 * Mechanisms: shown in the `load`, `show` and `reveal` phases. `main.js` preloads the
 * photo (and the next one), tells the room once it is loaded, starts the effect when the
 * `stage` part changes and animates the timer bar (`#tbar`) every frame.
 *
 * Invariants: the reveal keeps the answer buttons in place, so the eye stays where it
 * was: the owner's turns green, a wrong own pick red; under each name are the avatars of
 * who picked it, plus each player's total and this round's points. Players who were not
 * among the answers ("Answers: Only 4") are added below, so every score is visible.
 */

import { avatar, esc } from '../ui.js';

function bar(view) {
  const r = view.round;
  const me = view.players.find((p) => p.id === view.me.id);
  const gained = view.phase === 'reveal' && r.results && r.results[view.me.id] ? r.results[view.me.id].points : 0;
  return `<button class="icon" data-act="leave" aria-label="Leave">✕</button>
    <span class="rnd">${r.n} / ${r.total}</span>
    <span class="pts">${me ? me.score : 0}${gained > 0 ? `<span class="gain">+${gained}</span>` : ''}</span>`;
}

/** The photo, or a spinner until it is loaded. Pixel mode draws on a canvas. */
function stage(view, loaded) {
  const r = view.round;
  if (view.phase === 'load' || !r.photo || !loaded) return '<div class="loader"><div class="spin"></div></div>';
  const media = view.phase === 'show' && r.mode === 'pixel' ? '<canvas></canvas>' : `<img alt="" src="${esc(r.photo)}">`;
  // Phase and round in the markup make the reveal repaint the plain photo, ending any effect.
  return `<div class="frame" data-round="${r.n}" data-phase="${view.phase}">${media}</div>`;
}

function optionButton(view, id, { picked, late }) {
  const me = id === view.me.id ? ' <i>(you)</i>' : '';
  const p = view.players.find((x) => x.id === id);
  const cls = picked ? (picked === id ? 'sel' : 'off') : late ? 'off' : '';
  return `<button class="opt ${cls}" data-act="answer" data-v="${esc(id)}" ${picked || late ? 'disabled' : ''}>${avatar(p)}<span class="nm">${esc(p.name)}${me}</span></button>`;
}

function revealTile(view, p) {
  const r = view.round;
  const res = r.results || {};
  const myPick = res[view.me.id] && res[view.me.id].pick;
  const voters = view.players.filter((q) => res[q.id] && res[q.id].pick === p.id);
  const cls = p.id === r.owner ? 'ok' : myPick === p.id ? 'bad' : 'rest';
  const gained = res[p.id] ? res[p.id].points : 0;
  const me = p.id === view.me.id ? ' <i>(you)</i>' : '';
  return `<div class="opt ${cls}">${avatar(p)}<div class="col"><div class="nm">${esc(p.name)}${me}</div><div class="vt">${voters.map((q) => avatar(q)).join('')}</div></div><span class="sc">${p.score}${gained ? `<b>+${gained}</b>` : ''}</span></div>`;
}

function options(view, { picked, late, loaded }) {
  const r = view.round;
  if (view.phase === 'load' || !loaded) return '';
  if (view.phase === 'show') return `<div class="opts">${r.options.map((id) => optionButton(view, id, { picked, late })).join('')}</div>`;
  const listed = r.options.map((id) => view.players.find((p) => p.id === id)).filter(Boolean);
  const others = view.players.filter((p) => !r.options.includes(p.id));
  return `<div class="opts">${[...listed, ...others].map((p) => revealTile(view, p)).join('')}</div>`;
}

function dots(view, host) {
  if (view.phase !== 'show') return '';
  const answered = new Set(view.round.answered);
  return `<div class="dots">${view.players.map((p) => avatar(p, answered.has(p.id) ? 'on' : '')).join('')}</div>
    ${host ? '<button class="link" data-act="resolve">Reveal now</button>' : ''}`;
}

function after(view, host, reactions) {
  if (view.phase !== 'reveal') return '';
  const next = host ? (view.settings.auto ? '<button class="link" data-act="next">Next ›</button>' : '<button class="btn main" data-act="next">Next</button>') : '';
  return `<div class="reacts">${reactions.map((e) => `<button data-act="react" data-v="${e}" aria-label="React ${e}">${e}</button>`).join('')}</div>${next}`;
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
      opts: options(view, state),
      dots: dots(view, host),
      after: after(view, host, state.reactions),
    },
  };
}
