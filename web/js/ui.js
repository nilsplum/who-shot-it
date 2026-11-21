/**
 * Shared UI building blocks: HTML escaping, avatars, the one toast, floating reactions and
 * the logo.
 *
 * Mechanisms: every view (`web/js/views/`) builds HTML strings with these helpers;
 * `web/js/main.js` paints them. All transient feedback goes through `toast`; confirmations
 * are sheets (`views/sheets.js`), never native `alert`/`confirm`.
 *
 * Invariants: every text from a player (names) passes through `esc` before it reaches
 * the DOM. Avatar colours come from the CSS tokens `--p0`..`--p11`, chosen by the emoji,
 * so a player looks the same on the home screen and in every room (the room keeps avatars
 * unique, so two players never look alike).
 */

import { EMOJIS } from '../shared/config.js';

const PLAYER_COLOURS = 12;

export const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const colourOf = (emoji) => `var(--p${Math.max(0, EMOJIS.indexOf(emoji)) % PLAYER_COLOURS})`;

/** A round avatar for a player (`{ avatar }`); `cls` adds classes like `on`. */
export const avatar = (player, cls = '') => `<span class="av ${cls}" style="--c:${colourOf(player.avatar)}">${esc(player.avatar)}</span>`;

let toastTimer = 0;
export function toast(text) {
  const el = document.getElementById('toast');
  el.textContent = text;
  el.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('on'), 2600);
}

export function floatEmoji(emoji) {
  const el = document.createElement('span');
  el.className = 'float';
  el.textContent = emoji;
  el.style.left = `${10 + Math.random() * 75}vw`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2500);
}

/** The logo: a photo wheel with a camera in the middle (also `web/icons/icon.svg`). */
export const LOGO = `<svg viewBox="0 0 100 100" aria-hidden="true">
<path d="M50 50L96 50A46 46 0 0 1 73 89.84Z" fill="var(--p0)"/><path d="M50 50L73 89.84A46 46 0 0 1 27 89.84Z" fill="var(--p1)"/>
<path d="M50 50L27 89.84A46 46 0 0 1 4 50Z" fill="var(--p2)"/><path d="M50 50L4 50A46 46 0 0 1 27 10.16Z" fill="var(--p3)"/>
<path d="M50 50L27 10.16A46 46 0 0 1 73 10.16Z" fill="var(--p4)"/><path d="M50 50L73 10.16A46 46 0 0 1 96 50Z" fill="var(--p5)"/>
<circle cx="50" cy="50" r="23" fill="var(--bg)"/><rect x="36" y="42" width="28" height="19" rx="4" fill="var(--white)"/>
<rect x="44" y="38" width="12" height="6" rx="2" fill="var(--white)"/><circle cx="50" cy="51.5" r="6" fill="var(--bg)"/><circle cx="50" cy="51.5" r="3" fill="var(--y)"/></svg>`;
