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

/** The logo: the app's icon itself (`web/icons/icon.svg`, its one source), so the app, the website and the stores look the same. */
export const LOGO = '<img class="logo" src="/icons/icon.svg" alt="">';
