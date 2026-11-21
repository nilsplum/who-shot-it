/**
 * The bottom sheets: settings, how to play, avatar picker, invite (QR and link), leave
 * confirmation and the one-time iPhone shortcut setup.
 *
 * Mechanisms: `main.js` keeps the open sheet's name in `session.sheet` and paints the
 * result of `sheetScreen` into `#sheet` with the same part mechanism as the screens, so a
 * sheet slides in once and then only its content updates. Tapping the dimmed background
 * or a "Done"-type button closes it.
 *
 * Invariants: these sheets are the app's only confirmations and dialogs (no native
 * `alert`/`confirm`). Settings are read-only for everyone but the host; the server
 * ignores setting changes from anyone else anyway.
 */

import { APP, SETTINGS, SHORTCUT } from '../../shared/config.js';
import { qrSvg } from '../qr.js';
import { esc } from '../ui.js';
import { shortcutHref } from './lobby.js';

function settingsBody({ view }) {
  const host = view.hostId === view.me.id;
  const s = view.settings;
  const rows = SETTINGS.map((d) => {
    const buttons = d.options.map(([v, text]) =>
      `<button class="${s[d.key] === v ? 'on' : ''}" data-act="set" data-k="${d.key}" data-v="${esc(JSON.stringify(v))}" ${host ? '' : 'disabled'}>${esc(text)}</button>`).join('');
    const help = d.help ? `<div class="help">${esc(d.help[String(s[d.key])])}</div>` : '';
    return `<div class="set"><div class="sl">${esc(d.label)}</div><div class="seg">${buttons}</div>${help}</div>`;
  }).join('');
  return `${rows}<button class="btn main" data-act="close">Done</button>`;
}

const HELP = `<h2>How to play</h2>
  <ul class="steps">
    <li><span>📱</span>Everyone opens this page on their phone.</li>
    <li><span>🔗</span>One person creates a game. The others join with the code or the link.</li>
    <li><span>📷</span>Everyone gets random photos from their phone. They stay on your phone until you tap Yes.</li>
    <li><span>🤔</span>A photo pops up: tap whose it is. Fast and right scores more.</li>
    <li><span>🗑️</span>All photos are deleted after the game.</li>
  </ul>
  <button class="btn main" data-act="close">Got it</button>
  <a class="link" href="/legal">Legal &amp; privacy</a>`;

function avatarBody({ device, emojis }) {
  return `<div class="emojis">${emojis.map((e) => `<button class="${e === device.avatar ? 'on' : ''}" data-act="pickavatar" data-v="${e}" aria-label="Avatar ${e}">${e}</button>`).join('')}</div>
    <button class="btn" data-act="close">Done</button>`;
}

function inviteBody({ view }) {
  const link = `${location.origin}/${view.code}`;
  const action = navigator.share ? 'Share link' : 'Copy link';
  return `<div class="qr">${qrSvg(link)}</div>
    <div class="big-code">${esc(view.code)}</div>
    <button class="btn main" data-act="share">${action}</button>`;
}

const LEAVE = `<h2>Leave the game?</h2>
  <button class="btn danger" data-act="leavenow">Leave</button>
  <button class="btn" data-act="close">Stay</button>`;

function iosBody({ view }) {
  return `<h2>All photos</h2>
    <div class="num"><b>1</b><a class="btn" href="${esc(SHORTCUT.installUrl)}" target="_blank" rel="noopener">Add shortcut</a></div>
    <div class="num"><b>2</b><a class="btn main" href="${esc(shortcutHref(view))}">Load photos</a></div>
    <p class="center">Tap “Allow” when asked.</p>`;
}

/** `{ key, layout, parts }` for the open sheet, or null. */
export function sheetScreen(c) {
  const name = c.session.sheet;
  if (!name) return null;
  const inRoom = Boolean(c.view && c.view.me);
  const bodies = {
    settings: () => (inRoom ? settingsBody(c) : ''),
    help: () => HELP,
    avatar: () => avatarBody(c),
    invite: () => (inRoom ? inviteBody(c) : ''),
    leave: () => LEAVE,
    ios: () => (inRoom ? iosBody(c) : ''),
  };
  const body = bodies[name] ? bodies[name]() : '';
  if (!body) return null;
  return {
    key: `sheet|${name}`,
    layout: `<div class="dim" data-act="close"></div><div class="sheet" role="dialog" aria-label="${esc(APP.name)}" data-part="body"></div>`,
    parts: { body },
  };
}
