/**
 * Who shot it?, in the app: the reveal exactly as the app plays it, beside the draft it was
 * chosen from (reveal.js). The app's own round screen in the reveal phase
 * (web/js/views/game.js `gameScreen`, through the app's painter) for the stand-in game
 * (players.js), and on Play the app's own story over it (web/js/reveal.js `playReveal`), as
 * main.js `startReveal` plays it, the verdict felt with the pop.
 *
 * Mechanisms: the app's screen shows a photo it holds as an image file (an object URL), so
 * the drawn stand-in photo is made one here; an image file cannot read the page's CSS, so its
 * colours are the theme's, read from the page when it is drawn, never written here.
 */
import { REACTIONS } from '/shared/config.js';
import { createPainter } from '/js/render.js';
import { playReveal } from '/js/reveal.js';
import { gameScreen } from '/js/views/game.js';
import { buzz } from '/kit/screen.js';
import { runTimer } from './moves.js';

/** The reveal's time (TIMING.revealMs): its timer bar runs down over it. */
const REVEAL_MS = 3500;

/** The stand-in photo (the pizza of views.js) as an image file, drawn in the theme's colours. */
function photo() {
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

/** The app's view of round `g.round.n`'s reveal, for me (the shape of src/game/view.js that the screen reads). */
function viewOf(g) {
  const players = g.players.map(({ id, name, avatar }) => ({ id, name, avatar, connected: true }));
  const results = Object.fromEntries(g.players.map((p) => [p.id, { pick: p.pick, points: p.points }]));
  return {
    phase: 'reveal', code: 'DRFT', me: { id: g.me }, hostId: 'p0', players, settings: { time: 20 },
    round: { n: g.round.n, total: g.round.total, photo: 'photo', mode: 'classic', options: players.map((p) => p.id), answered: [], flag: null, owner: g.owner, results },
  };
}

/** Paints the app's reveal into `root`, and with `play` plays the app's story over it. */
export function inApp(root, g, play) {
  createPainter(root)(gameScreen({ view: viewOf(g) }, { picked: null, late: false, photo: 'ok', src: photo(), loading: null, reactions: REACTIONS }));
  if (!play) return;
  const me = g.players.find((p) => p.id === g.me);
  runTimer(REVEAL_MS);
  playReveal(root.firstElementChild, { verdict: !me.pick ? 'none' : me.pick === g.owner ? 'right' : 'wrong', points: me.points }, buzz);
}
