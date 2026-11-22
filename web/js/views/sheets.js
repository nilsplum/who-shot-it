/**
 * The bottom sheets: settings (with a "?" explanation per setting), how to play, avatar
 * picker, invite (QR and share), and the confirmations for leaving, reporting a photo
 * and removing a player.
 *
 * Mechanisms: `main.js` keeps the open sheet's name in `session.sheet` and paints the
 * result of `sheetScreen` into `#sheet` with the same part mechanism as the screens, so a
 * sheet slides in once and then only its content updates. Tapping the dimmed background
 * or a "Done"-type button closes it. The settings sheet scrolls under a footer that keeps
 * its green "Done" in reach (the sheet carries its name as a class, `sheet-settings`).
 *
 * Invariants: these sheets are the app's only confirmations and dialogs (no native
 * `alert`/`confirm`). The settings sheet edits the room's settings in a game (only the
 * host may; the server ignores anyone else anyway) and this phone's own settings on the
 * "New game" step (`main.js`, action `set`).
 */

import { APP, SETTINGS } from '../../shared/config.js';
import { serverUrl } from '../api.js';
import { qrSvg } from '../qr.js';
import { esc } from '../ui.js';
import { legalLink } from './home.js';

/** The settings on screen: the room's in a game, else this phone's for the next game. */
export function shownSettings({ view, device }) {
  return view && view.me ? view.settings : device.settings;
}

function settingsBody(c) {
  const inRoom = Boolean(c.view && c.view.me);
  const editable = !inRoom || c.view.hostId === c.view.me.id;
  const s = shownSettings(c);
  const rows = SETTINGS.map((d) => {
    const buttons = d.options.map(([v, text]) =>
      `<button class="${s[d.key] === v ? 'on' : ''}" data-act="set" data-k="${d.key}" data-v="${esc(JSON.stringify(v))}" ${editable ? '' : 'disabled'}>${esc(text)}</button>`).join('');
    const open = c.session.helpKey === d.key;
    const ask = d.help ? `<button class="hq ${open ? 'on' : ''}" data-act="explain" data-v="${d.key}" aria-label="What does ${esc(d.label)} mean?" aria-expanded="${open}">?</button>` : '';
    const help = open ? `<ul class="help">${d.help.map(([which, text]) => `<li><b>${esc(which)}:</b> ${esc(text)}</li>`).join('')}</ul>` : '';
    return `<div class="set"><div class="sl">${esc(d.label)}${ask}</div><div class="seg">${buttons}</div>${help}</div>`;
  }).join('');
  return `<div class="sheet-scroll">${rows}</div><div class="sheet-foot"><button class="btn done" data-act="close">Done</button></div>`;
}

function helpBody() {
  return `<h2>How to play</h2>
  <ul class="steps">
    <li><span>📱</span>Everyone opens ${esc(APP.name)} on their phone.</li>
    <li><span>🔗</span>One person creates a game. The others join with the code.</li>
    <li><span>📷</span>Everyone gets a few random photos from their phone. Don’t like them? Tap No. Nothing is shared until you tap Yes.</li>
    <li><span>🤔</span>A photo pops up: tap whose it is. Fast and right scores more.</li>
    <li><span>🗑️</span>Each photo is deleted right after its round.</li>
  </ul>
  <button class="btn main" data-act="close">Got it</button>
  <div class="link">${legalLink()}</div>`;
}

function avatarBody({ device, emojis }) {
  return `<div class="emojis">${emojis.map((e) => `<button class="${e === device.avatar ? 'on' : ''}" data-act="pickavatar" data-v="${e}" aria-label="Avatar ${e}">${e}</button>`).join('')}</div>
    <button class="btn" data-act="close">Done</button>`;
}

/** The invite link opens the website's invite page (app install, or "Open in the app"). */
export const inviteLink = (code) => serverUrl(`/${code}`);

function inviteBody({ view }) {
  return `<div class="qr">${qrSvg(inviteLink(view.code))}</div>
    <div class="big-code">${esc(view.code)}</div>
    <button class="btn main" data-act="share">Share invite</button>`;
}

const LEAVE = `<h2>Leave the game?</h2>
  <button class="btn danger" data-act="leavenow">Leave</button>
  <button class="btn" data-act="close">Stay</button>`;

const REPORT = `<h2>Report this photo?</h2>
  <p class="center">It is deleted for everyone right away.</p>
  <button class="btn danger" data-act="reportnow">Delete photo</button>
  <button class="btn" data-act="close">Cancel</button>`;

function removeBody({ view, session }) {
  const p = view.players.find((x) => x.id === session.target);
  if (!p) return '';
  return `<h2>Remove ${esc(p.name)}?</h2>
    <p class="center">${esc(p.name)} and their photos leave this game and can’t join it again.</p>
    <button class="btn danger" data-act="removenow">Remove</button>
    <button class="btn" data-act="close">Cancel</button>`;
}

/** `{ key, layout, parts }` for the open sheet, or null. */
export function sheetScreen(c) {
  const name = c.session.sheet;
  if (!name) return null;
  const inRoom = Boolean(c.view && c.view.me);
  const bodies = {
    settings: () => settingsBody(c),
    help: helpBody,
    avatar: () => avatarBody(c),
    invite: () => (inRoom ? inviteBody(c) : ''),
    leave: () => LEAVE,
    report: () => (inRoom ? REPORT : ''),
    remove: () => (inRoom ? removeBody(c) : ''),
  };
  const body = bodies[name] ? bodies[name]() : '';
  if (!body) return null;
  return {
    key: `sheet|${name}`,
    layout: `<div class="dim" data-act="close"></div><div class="sheet sheet-${name}" role="dialog" aria-label="${esc(APP.name)}" data-part="body"></div>`,
    parts: { body },
  };
}
