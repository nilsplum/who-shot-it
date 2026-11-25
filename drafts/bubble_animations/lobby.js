/**
 * The lobby under the bubbles, as a ready player sees it while the group waits for one
 * last player: the app's own lobby view (web/js/views/lobby.js `lobbyScreen`, through the
 * app's painter) with stand-in players (never real people) and nine drawn stand-in photos,
 * "✓ Ready" under them and "Waiting on …" at the bottom.
 *
 * Mechanisms: the photos are SVG image files made here and handed to the view the way the
 * app hands it the previews it holds (object URLs in `photos.chosen`). An image file cannot
 * read the page's CSS, so its colours are the theme's, read from the page when it is drawn
 * (`--color-…`), never written here. `paintLobby` returns the photo area, which the
 * bubbles are laid over, and the players the bubbles name.
 */
import { normalizeSettings } from '/shared/config.js';
import { photos } from '/js/photos.js';
import { createPainter } from '/js/render.js';
import { syncRow } from '/js/ui.js';
import { lobbyScreen } from '/js/views/lobby.js';

/** Name, avatar, whether they said Yes. I am Ana; Mia is the last one (her name follows the draft's "Name"). */
const PLAYERS = [['Lena', '🦊', true], ['Ben', '🐼', true], ['Ana', '🐸', true], ['Max', '🐙', true], ['Mia', '🦄', false], ['Leo', '🦁', true]];
const ME = 'p2';
const LAST = 'p4';

const c = (name) => getComputedStyle(document.documentElement).getPropertyValue(`--color-${name}`).trim();
const image = (body, defs = '') => URL.createObjectURL(new Blob([`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300"><defs>${defs}</defs>${body}</svg>`], { type: 'image/svg+xml' }));
const fade = (id, top, bottom) => `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/></linearGradient>`;

/** Nine stand-in photos: little scenes in the theme's colours. */
function scenes() {
  return [
    // A sunset over the sea.
    image(`<rect width="300" height="300" fill="url(#s)"/><circle cx="150" cy="178" r="58" fill="${c('yellow')}"/><rect y="182" width="300" height="118" fill="${c('p10')}"/><rect x="40" y="206" width="220" height="5" rx="2.5" fill="${c('white')}" opacity="0.5"/><rect x="80" y="228" width="140" height="5" rx="2.5" fill="${c('white')}" opacity="0.35"/>`, fade('s', c('p0'), c('p6'))),
    // Mountains under the moon.
    image(`<rect width="300" height="300" fill="url(#m)"/><circle cx="222" cy="72" r="26" fill="${c('ink')}"/><path d="M-10 300 L95 128 L170 230 L215 168 L320 300 Z" fill="${c('p4')}"/><path d="M95 128 L122 172 L104 166 L88 178 L76 160 Z" fill="${c('white')}"/><path d="M-10 300 L60 210 L140 300 Z" fill="${c('violet')}"/>`, fade('m', c('navy'), c('glow-blue'))),
    // A pizza with a slice gone.
    image(`<rect width="300" height="300" fill="${c('glow-violet')}"/><circle cx="150" cy="150" r="118" fill="${c('white')}"/><circle cx="150" cy="150" r="102" fill="${c('p6')}"/><circle cx="150" cy="150" r="88" fill="${c('p11')}"/><path d="M150 150 L252 112 A108 108 0 0 1 244 204 Z" fill="${c('white')}"/><circle cx="114" cy="104" r="13" fill="${c('p0')}"/><circle cx="170" cy="92" r="13" fill="${c('p0')}"/><circle cx="96" cy="166" r="13" fill="${c('p0')}"/><circle cx="142" cy="200" r="12" fill="${c('p0')}"/><circle cx="146" cy="146" r="12" fill="${c('p0')}"/>`),
    // Balloons.
    image(`<rect width="300" height="300" fill="${c('p3')}"/><path d="M110 150 Q120 220 150 290 M190 140 Q180 220 150 290 M150 120 Q150 200 150 290" stroke="${c('navy')}" stroke-width="2" fill="none" opacity="0.5"/><ellipse cx="110" cy="112" rx="40" ry="48" fill="${c('p0')}"/><ellipse cx="190" cy="104" rx="38" ry="46" fill="${c('yellow')}"/><ellipse cx="150" cy="78" rx="40" ry="48" fill="${c('p5')}"/><ellipse cx="136" cy="60" rx="9" ry="14" fill="${c('white')}" opacity="0.5"/>`),
    // A birthday cake.
    image(`<rect width="300" height="300" fill="${c('p5')}"/><rect x="70" y="150" width="160" height="96" rx="14" fill="${c('white')}"/><rect x="70" y="190" width="160" height="22" fill="${c('p8')}"/><rect x="144" y="104" width="12" height="46" rx="5" fill="${c('p3')}"/><ellipse cx="150" cy="92" rx="10" ry="16" fill="${c('yellow')}"/><rect x="40" y="244" width="220" height="14" rx="7" fill="${c('raised')}"/>`),
    // A beach with a palm.
    image(`<rect width="300" height="300" fill="url(#b)"/><rect y="200" width="300" height="40" fill="${c('p10')}"/><rect y="236" width="300" height="64" fill="${c('p11')}"/><path d="M196 250 Q206 170 186 100" stroke="${c('bronze')}" stroke-width="12" fill="none" stroke-linecap="round"/><path d="M186 100 Q140 80 112 118 M186 100 Q230 70 262 108 M186 100 Q170 54 132 52 M186 100 Q214 56 248 60" stroke="${c('green')}" stroke-width="14" fill="none" stroke-linecap="round"/>`, fade('b', c('p3'), c('white'))),
    // A city at night.
    image(`<rect width="300" height="300" fill="${c('stage')}"/><rect x="20" y="120" width="70" height="180" fill="${c('card')}"/><rect x="100" y="70" width="80" height="230" fill="${c('raised')}"/><rect x="192" y="140" width="88" height="160" fill="${c('line')}"/>${[[34, 140], [60, 170], [34, 210], [116, 92], [150, 120], [116, 160], [150, 200], [206, 160], [244, 196], [206, 236]].map(([x, y]) => `<rect x="${x}" y="${y}" width="14" height="18" fill="${c('yellow')}"/>`).join('')}`),
    // A cat.
    image(`<rect width="300" height="300" fill="${c('p7')}"/><path d="M84 120 L96 50 L140 96 Z M216 120 L204 50 L160 96 Z" fill="${c('p6')}"/><circle cx="150" cy="160" r="84" fill="${c('p6')}"/><circle cx="120" cy="150" r="12" fill="${c('navy')}"/><circle cx="180" cy="150" r="12" fill="${c('navy')}"/><path d="M140 182 L160 182 L150 194 Z" fill="${c('p5')}"/>`),
    // A flower.
    image(`<rect width="300" height="300" fill="${c('green-dark')}"/><path d="M150 170 Q146 240 150 300" stroke="${c('green')}" stroke-width="10" fill="none"/>${[0, 60, 120, 180, 240, 300].map((a) => `<ellipse cx="150" cy="96" rx="26" ry="44" fill="${c('p5')}" transform="rotate(${a} 150 140)"/>`).join('')}<circle cx="150" cy="140" r="26" fill="${c('yellow')}"/>`),
  ];
}

/**
 * Paints the lobby into `root` and returns `{ area, last, others }`: the photos the bubbles
 * lie over (not "✓ Ready" and "Change" under them, which stay clear), the last player
 * (named `name`), and the others who already said Yes.
 */
export function paintLobby(root, name) {
  const players = PLAYERS.map(([n, avatar, ready], i) => ({
    id: `p${i}`, name: i === 4 ? name : n, avatar, connected: true, ready, sending: false, photoCount: ready ? 9 : 0, score: 0,
  }));
  const view = {
    code: 'PZKW', phase: 'lobby', hostId: 'p0', settings: normalizeSettings({ photos: 9 }), start: null,
    me: { id: ME, ready: true, sending: false, photoCount: 9, onResults: false, loaded: 0 }, players,
  };
  photos.chosen = scenes().map((url) => ({ url, anim: null, from: null }));
  createPainter(root)(lobbyScreen({ view, session: { sending: null, access: 'full' }, device: {} }));
  for (const row of root.querySelectorAll('[data-sideways]')) syncRow(row);
  return {
    area: root.querySelector('[data-part="pick"]'),
    last: players.find((p) => p.id === LAST),
    others: players.filter((p) => p.id !== LAST && p.id !== ME),
  };
}
