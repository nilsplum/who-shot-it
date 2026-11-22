/**
 * Shared UI building blocks: HTML escaping, avatars, the one toast, the reaction row and
 * its floating emojis, and the logo.
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

/**
 * The reaction row, the same on every screen that has one: big emoji buttons in a row that
 * scrolls sideways (most used first), and a small arrow that pages through it
 * (`main.js`, action `reactmore`). Its markup never changes, so a repaint keeps the scroll.
 */
export function reactionsRow(reactions) {
  return `<div class="reacts"><div class="rrow">${reactions.map((e) => `<button data-act="react" data-v="${e}" aria-label="React ${e}">${e}</button>`).join('')}</div><button class="rmore" data-act="reactmore" aria-label="More reactions">›</button></div>`;
}

/**
 * Lets `emoji` rise up the screen: from its button in the reaction row when that button is
 * on screen (also for someone else's reaction), else from the bottom middle.
 */
export function floatEmoji(emoji) {
  const el = document.createElement('span');
  el.className = 'float';
  el.textContent = emoji;
  const button = [...document.querySelectorAll('.rrow [data-act="react"]')].find((b) => b.dataset.v === emoji);
  const row = button && button.parentElement.getBoundingClientRect();
  const box = button && button.getBoundingClientRect();
  const visible = box && box.width && box.left >= row.left - 1 && box.right <= row.right + 1;
  el.style.left = visible ? `${box.left + box.width / 2}px` : '50vw';
  el.style.top = visible ? `${box.top}px` : 'calc(100vh - 90px)';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2500);
}

/** The logo: the app's icon itself (`web/icons/icon.svg`, its one source), so the app, the website and the stores look the same. */
export const LOGO = '<img class="logo" src="/icons/icon.svg" alt="">';
