/**
 * The first round as the app paints it, under the 3-2-1: the app's own round screen
 * (web/js/views/game.js `gameScreen`, through the app's painter) with stand-in players
 * (never real people) and a drawn stand-in photo, a pizza with a slice gone.
 *
 * Mechanisms: the photo is an SVG image file made here and handed to the screen like the
 * app hands it a photo it holds (an object URL). An image file cannot read the page's CSS,
 * so its colours are the theme's, read from the page when it is drawn (`--color-…`), never
 * written here.
 */
import { REACTIONS } from '/shared/config.js';
import { createPainter } from '/js/render.js';
import { gameScreen } from '/js/views/game.js';

const PLAYERS = [['Lena', '🦊'], ['Ben', '🐼'], ['Ana', '🐸'], ['Max', '🦄'], ['Mia', '🐙'], ['Leo', '🦁']];

/** The stand-in photo as an image file (an object URL), drawn in the theme's colours. */
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

/** Paints round 1 of 10 into `root` as the app shows it when its photo appears; returns the screen element. */
export function paintRound(root) {
  const players = PLAYERS.map(([name, avatar], i) => ({ id: `p${i}`, name, avatar, connected: true }));
  const view = {
    phase: 'show', code: 'DRFT', me: { id: 'p2' }, hostId: 'p0', players, settings: { time: 20 },
    round: { n: 1, total: 10, photo: 'first', mode: 'classic', options: players.map((p) => p.id), answered: [], flag: null },
  };
  createPainter(root)(gameScreen({ view }, { picked: null, late: false, photo: 'ok', src: photo(), loading: null, reactions: REACTIONS }));
  return root.firstElementChild;
}
