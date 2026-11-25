/**
 * The two screens a streak shows on, as the app paints them: the reveal of a round
 * (web/js/views/game.js `gameScreen`) and the leaderboard after it (web/js/views/board.js
 * `boardScreen`), through the app's painter, for the stand-in game (players.js) and a drawn
 * stand-in photo, a pizza with a slice gone.
 *
 * Mechanisms: the app does not send streaks to the phones yet (the room counts them,
 * `src/game/rules.js`; their bonus is in the points), so this draft adds what a chosen design
 * would need, in the final state the app always paints: my streak's badge at the bottom middle
 * of the photo, and a small one on the avatar of every row of the leaderboard whose player has
 * a streak (badge.js). The stories play over these screens (reveal.js, and the app's own
 * web/js/board.js).
 *
 * The photo is an SVG image file made here and handed to the screen like the app hands it a
 * photo it holds (an object URL); an image file cannot read the page's CSS, so its colours are
 * the theme's, read when it is drawn, never written here.
 */
import { REACTIONS } from '/shared/config.js';
import { createPainter } from '/js/render.js';
import { boardScreen } from '/js/views/board.js';
import { gameScreen } from '/js/views/game.js';
import { badge } from './badge.js';
import { OWNER, ME } from './players.js';

/** The stand-in photo as an image file (an object URL), drawn in the theme's colours. */
export function photo() {
  const c = (name) => getComputedStyle(document.documentElement).getPropertyValue(`--color-${name}`).trim();
  const dot = (x, y, r) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c('p0')}"/>`;
  const leaf = (x, y, turn) => `<ellipse cx="${x}" cy="${y}" rx="9" ry="5" fill="${c('green')}" transform="rotate(${turn} ${x} ${y})"/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 400">
    <rect width="300" height="400" fill="${c('glow-violet')}"/>
    <circle cx="40" cy="40" r="150" fill="${c('white')}" opacity="0.05"/>
    <circle cx="150" cy="205" r="128" fill="${c('line-strong')}"/>
    <circle cx="150" cy="205" r="120" fill="${c('white')}"/>
    <circle cx="150" cy="205" r="104" fill="${c('p6')}"/>
    <circle cx="150" cy="205" r="90" fill="${c('p11')}"/>
    <path d="M150 205 L251.5 168.1 A108 108 0 0 1 243.5 259 Z" fill="${c('white')}"/>
    ${dot(112, 155, 13)}${dot(168, 133, 13)}${dot(92, 217, 13)}${dot(138, 257, 13)}${dot(182, 243, 12)}${dot(140, 197, 13)}${dot(128, 123, 11)}
    ${leaf(156, 166, 30)}${leaf(108, 245, -20)}${leaf(196, 268, 50)}
  </svg>`;
  return URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
}

/** The view of the room as the app gets it in `phase` (the shape of src/game/view.js that the two screens read), the results with each player's streak and its bonus as the room tells them. */
export function viewOf(g, phase) {
  const players = g.players.map(({ id, name, avatar, score }) => ({ id, name, avatar, score, connected: true }));
  const results = Object.fromEntries(g.players.map((p) => [p.id, { pick: p.pick, points: p.points, streak: p.streak, bonus: p.id === ME ? g.bonus : 0 }]));
  return {
    phase, code: 'DRFT', me: { id: ME }, hostId: 'p0', players, settings: { time: 20 },
    round: { n: g.round.n, total: g.round.total, photo: 'photo', mode: 'classic', options: players.map((p) => p.id), answered: [], flag: null, owner: OWNER, results },
  };
}

/** The place for my streak's badge: the bottom middle of the photo. */
export const badgeSlot = (screen) => screen.querySelector('[data-badge]');

/** Paints the reveal into `root`, my badge at the bottom of the photo when I have a streak; returns the screen element. */
export function paintReveal(root, g) {
  createPainter(root)(gameScreen({ view: viewOf(g, 'reveal') }, { picked: null, late: false, photo: 'ok', src: photo(), loading: null, reactions: REACTIONS }));
  const screen = root.firstElementChild;
  screen.querySelector('[data-part="stage"]').insertAdjacentHTML('beforeend', `<div class="absolute bottom-3 left-1/2 z-2 -translate-x-1/2" data-badge>${g.streak > 1 ? badge(g.streak) : ''}</div>`);
  return screen;
}

/** Paints the leaderboard into `root`, a small badge on the avatar of every player with a streak; returns the screen element. */
export function paintBoard(root, g) {
  createPainter(root)(boardScreen({ view: viewOf(g, 'board') }, { reactions: REACTIONS, loading: null }));
  const screen = root.firstElementChild;
  for (const row of screen.querySelectorAll('[data-rank]')) {
    const player = g.players.find((p) => p.name === row.querySelector('b').textContent);
    if (player.streak > 1) row.querySelector('[data-cell="who"]').insertAdjacentHTML('beforeend', `<span class="absolute -right-2 -bottom-1.5 z-2">${badge(player.streak, 'small')}</span>`);
  }
  return screen;
}
