/**
 * The bottom sheets: settings (with a "?" explanation per setting), how to play, avatar
 * picker, invite (QR and share), and the confirmations for leaving, reporting a photo
 * and removing a player.
 *
 * Mechanisms: `main.js` keeps the open sheet's name in `session.sheet` and paints the
 * result of `sheetScreen` into `#sheet` with the same part mechanism as the screens, so a
 * sheet slides in once and then only its content updates. Tapping the dimmed background
 * or a "Done"-type button closes it. The settings sheet scrolls under a footer that keeps
 * its green "Done" in reach (the sheet is a column that does not scroll itself).
 *
 * Invariants: these sheets are the app's only confirmations and dialogs (no native
 * `alert`/`confirm`). The settings sheet edits the room's settings in a game (only the
 * host may; the server ignores anyone else anyway) and this phone's own settings on the
 * "New game" step (`main.js`, action `set`). A chosen option, picked avatar or open
 * explanation is marked with `aria-pressed`/`aria-expanded`, which also gives it its look.
 */

import { APP, SETTINGS } from '../../shared/config.js';
import { serverUrl } from '../api.js';
import { qrSvg } from '../qr.js';
import { esc, steps } from '../ui.js';
import { legalLink } from './home.js';

/** The settings on screen: the room's in a game, else this phone's for the next game. */
export function shownSettings({ view, device }) {
  return view && view.me ? view.settings : device.settings;
}

const title = (text) => `<h2 class="mt-0.5 mb-3.5 text-center font-display text-3xl font-extrabold">${text}</h2>`;
const text = (html) => `<p class="mb-3.5 text-center leading-snug text-muted">${html}</p>`;
/** A sheet's buttons, one under the other. */
const buttons = (...html) => `<div class="flex flex-col gap-2.5">${html.join('')}</div>`;
const SAFE_BOTTOM = 'pb-[calc(--spacing(5.5)+env(safe-area-inset-bottom))]';

function settingsBody(c) {
  const inRoom = Boolean(c.view && c.view.me);
  const editable = !inRoom || c.view.hostId === c.view.me.id;
  const s = shownSettings(c);
  const rows = SETTINGS.map((d) => {
    const options = d.options.map(([v, label]) =>
      `<button class="flex-1 rounded-xl bg-raised px-1 py-2.75 text-sm text-muted aria-pressed:bg-yellow aria-pressed:text-navy disabled:not-aria-pressed:opacity-50" data-act="set" data-k="${d.key}" data-v="${esc(JSON.stringify(v))}" aria-pressed="${s[d.key] === v}" ${editable ? '' : 'disabled'}>${esc(label)}</button>`).join('');
    const open = c.session.helpKey === d.key;
    const ask = d.help ? `<button class="size-5.5 rounded-full border-[1.5px] border-line text-xs leading-none font-extrabold text-muted aria-expanded:border-yellow aria-expanded:text-yellow" data-act="explain" data-v="${d.key}" aria-label="What does ${esc(d.label)} mean?" aria-expanded="${open}">?</button>` : '';
    const help = open ? `<ul class="mt-2 space-y-1 rounded-xl bg-card px-3 py-2.5 text-xs leading-snug font-medium text-muted">${d.help.map(([which, line]) => `<li><b class="font-bold text-ink">${esc(which)}:</b> ${esc(line)}</li>`).join('')}</ul>` : '';
    return `<div class="mb-3.5"><div class="mb-1.5 flex items-center gap-2 text-xs text-muted">${esc(d.label)}${ask}</div><div class="flex gap-1.5">${options}</div>${help}</div>`;
  }).join('');
  return `<div class="-mx-4 min-h-0 flex-1 overflow-auto px-4 pb-2">${rows}</div>
    <div class="pt-3 shadow-[0_-14px_14px_-10px_var(--color-sheet)] ${SAFE_BOTTOM}"><button class="btn bg-green text-navy" data-act="close">Done</button></div>`;
}

function helpBody() {
  return `${title('How to play')}
  ${steps([
    ['📱', `Everyone opens ${esc(APP.name)} on their phone.`],
    ['🔗', 'One person creates a game. The others join with the code.'],
    ['📷', 'Everyone gets a few random photos from their phone. Don’t like them? Tap No. Nothing is shared until you tap Yes.'],
    ['🤔', 'A photo pops up: tap whose it is. Fast and right scores more.'],
    ['🗑️', 'Each photo is deleted right after its round.'],
  ])}
  <button class="btn bg-coral text-white" data-act="close">Got it</button>
  <div class="link underline">${legalLink()}</div>`;
}

function avatarBody({ device, emojis }) {
  return `<div class="mb-3.5 grid grid-cols-5 gap-2">${emojis.map((e) => `<button class="aspect-square rounded-2xl border-2 border-transparent bg-raised text-4xl aria-pressed:border-yellow aria-pressed:bg-picked" data-act="pickavatar" data-v="${e}" aria-pressed="${e === device.avatar}" aria-label="Avatar ${e}">${e}</button>`).join('')}</div>
    <button class="btn" data-act="close">Done</button>`;
}

/** The invite link opens the website's invite page (app install, or "Open in the app"). */
export const inviteLink = (code) => serverUrl(`/${code}`);

function inviteBody({ view }) {
  return `<div class="mx-auto mb-3.5 w-[min(15rem,70vw)] rounded-2xl bg-white p-2.5 *:h-auto *:w-full">${qrSvg(inviteLink(view.code))}</div>
    <div class="mb-4 text-center font-display text-6xl font-extrabold tracking-[.25em] text-yellow">${esc(view.code)}</div>
    <button class="btn bg-coral text-white" data-act="share">Share invite</button>`;
}

const LEAVE = `${title('Leave the game?')}
  ${buttons('<button class="btn bg-red text-white" data-act="leavenow">Leave</button>', '<button class="btn" data-act="close">Stay</button>')}`;

const REPORT = `${title('Report this photo?')}
  ${text('It is deleted for everyone right away.')}
  ${buttons('<button class="btn bg-red text-white" data-act="reportnow">Delete photo</button>', '<button class="btn" data-act="close">Cancel</button>')}`;

function removeBody({ view, session }) {
  const p = view.players.find((x) => x.id === session.target);
  if (!p) return '';
  return `${title(`Remove ${esc(p.name)}?`)}
    ${text(`${esc(p.name)} and their photos leave this game and can’t join it again.`)}
    ${buttons('<button class="btn bg-red text-white" data-act="removenow">Remove</button>', '<button class="btn" data-act="close">Cancel</button>')}`;
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
  // The settings sheet is a column whose list scrolls above its footer; every other sheet scrolls as a whole.
  const shape = name === 'settings' ? 'flex flex-col' : `overflow-auto ${SAFE_BOTTOM}`;
  return {
    key: `sheet|${name}`,
    layout: `<div class="fixed inset-0 z-40 animate-fade bg-stage/70" data-act="close"></div>
      <div class="fixed inset-x-0 bottom-0 z-41 mx-auto max-h-[88dvh] max-w-120 animate-slide-up rounded-t-3xl bg-sheet px-4 pt-4.5 ${shape}" role="dialog" aria-label="${esc(APP.name)}" data-part="body"></div>`,
    parts: { body },
  };
}
