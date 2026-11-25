/**
 * The bottom sheets: settings (with a "?" explanation per setting), how to play (with the
 * quiet "⭐ Rate the game" link: the player's own choice, so a plain link to the store's
 * review page, never a prompt), avatar picker, invite (QR and share), and the confirmations for leaving, reporting a photo
 * (opened by ⚑: the others wait while it is open, and Delete counts down to the room's own
 * deletion, `flagLeft` from `main.js`), removing a player, "Is everyone here?" on the
 * last player's phone before their Yes starts a group's first game, and "Update to play"
 * when this app is too old for its server.
 *
 * Mechanisms: `main.js` keeps the open sheet's name in `session.sheet` and paints the
 * result of `sheetScreen` into `#sheet` with the same part mechanism as the screens, so a
 * sheet slides in once and then only its content updates. Tapping the dimmed background
 * or a "Done"-type button closes it. A long sheet (settings, avatars) returns `{ list,
 * footer }`: its list scrolls under a footer that keeps "Done" in reach. The scrolling box
 * belongs to the sheet's layout and only its content is a part, so a tap that repaints the
 * list (an option, a "?") keeps the scroll position. Every other sheet scrolls as a whole.
 *
 * Invariants: these sheets are the app's only confirmations and dialogs (no native
 * `alert`/`confirm`). The settings sheet edits the room's settings in a game (only the
 * host may; the server ignores anyone else anyway) and this phone's own settings on the
 * "New game" step (`main.js`, action `set`). A chosen option, picked avatar or open
 * explanation is marked with `aria-pressed`/`aria-expanded`, which also gives it its look.
 */

import { APP, SETTINGS, TIMING } from '../../shared/config.js';
import { serverUrl } from '../api.js';
import { qrSvg } from '../qr.js';
import { canRemove, esc, steps } from '../ui.js';
import { legalLink } from './home.js';

/** The settings on screen: the room's in a game, else this phone's for the next game. */
export function shownSettings({ view, device }) {
  return view && view.me ? view.settings : device.settings;
}

const title = (text) => `<h2 class="mt-0.5 mb-3.5 text-center font-display text-3xl font-extrabold">${text}</h2>`;
const text = (html) => `<p class="mb-3.5 text-center leading-snug text-muted">${html}</p>`;
/** A sheet's buttons, one under the other. */
const buttons = (...html) => `<div class="flex flex-col gap-2.5">${html.join('')}</div>`;

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
  return { list: rows, footer: '<button class="btn bg-green text-navy" data-act="close">Done</button>' };
}

/**
 * "⭐ Rate the game" under "Got it", for whoever wants to rate on their own (`c.rateLink`,
 * `reviewLink` for this phone, or none: then nothing shows). A link, not a prompt: no
 * question, nothing offered, nothing about the player's mood, and it never shows by itself,
 * only in the sheet the player opened; its line says the one real reason a rating matters
 * for a free game without ads. It opens the store, like the legal link opens the browser.
 */
const rateLink = (link) => (link
  ? `<div class="link underline"><a href="${esc(link)}" target="_blank" rel="noopener">⭐ Rate the game</a></div><p class="-mt-2 text-center text-xs text-muted">It helps other groups find it.</p>`
  : '');

function helpBody(c) {
  return `${title('How to play')}
  ${steps([
    ['📱', `Everyone opens ${esc(APP.name)} on their phone.`],
    ['🔗', 'One person creates a game. The others join with the code.'],
    ['📷', 'Everyone gets a few random photos from their phone. Don’t like them? Tap No. Nothing is shared until you tap Yes.'],
    ['👆', 'Tap a photo to swap just that one. Hold it to see it big.'],
    ['🤔', 'A photo pops up: tap whose it is. Fast and right scores more.'],
    ['🗑️', 'Each photo is deleted right after its round.'],
  ])}
  <button class="btn bg-coral text-white" data-act="close">Got it</button>
  ${rateLink(c.rateLink)}
  <div class="link underline">${legalLink()}</div>`;
}

/** Every avatar, in the order shuffled when the sheet opened (`session.avatarOrder`); the chosen one is marked. */
function avatarBody({ device, session }) {
  const grid = `<div class="grid grid-cols-6 gap-1.5">${session.avatarOrder.map((e) => `<button class="aspect-square rounded-2xl border-2 border-transparent bg-raised text-3xl aria-pressed:border-yellow aria-pressed:bg-picked" data-act="pickavatar" data-v="${e}" aria-pressed="${e === device.avatar}" aria-label="Avatar ${e}">${e}</button>`).join('')}</div>`;
  return { list: grid, footer: '<button class="btn" data-act="close">Done</button>' };
}

/** The invite link opens the website's invite page (app install, or "Open in the app"). */
export const inviteLink = (code) => serverUrl(`/${code}`);

function inviteBody({ view }) {
  return `<div class="mx-auto mb-3.5 w-[min(15rem,70vw)] rounded-2xl bg-white p-2.5 *:h-auto *:w-full">${qrSvg(inviteLink(view.code))}</div>
    <div class="mb-4 text-center font-display text-6xl font-extrabold tracking-[.25em] text-yellow">${esc(view.code)}</div>
    <button class="btn bg-coral text-white" data-act="share">Share invite</button>`;
}

/**
 * "Is everyone here?", on the phone whose Yes would start a group's first game (`main.js`
 * `sayYes`): "Yes, start" says that Yes, confirmed, so the game starts at once on every
 * phone; "No, wait" (like the backdrop and the back button) closes it and changes nothing,
 * so the player stays not ready and taps Yes again once their friend is there. It closes by
 * itself once that Yes would no longer start the game (`main.js` `onMessage`).
 */
const START = `${title('Is everyone here?')}
  ${text('Anyone who joins later plays without photos.')}
  ${buttons('<button class="btn bg-green text-navy" data-act="yesstart">Yes, start</button>', '<button class="btn" data-act="close">No, wait</button>')}`;

const LEAVE = `${title('Leave the game?')}
  ${buttons('<button class="btn bg-red text-white" data-act="leavenow">Leave</button>', '<button class="btn" data-act="close">Stay</button>')}`;

/**
 * The flagged photo: Delete deletes it for everyone, Cancel lets the round go on. Under
 * "Delete photo" the seconds until the room deletes it by itself (until the room's view
 * confirms the flag, its full length).
 */
function reportBody({ flagLeft }) {
  const seconds = Math.ceil((flagLeft ?? TIMING.flagMs) / 1000);
  return `${title('Report this photo?')}
  ${text('Everyone waits while you decide.')}
  ${buttons(`<button class="btn bg-red text-white" data-act="reportnow">Delete photo<small class="mt-0.5 block text-xs font-semibold text-white/75">Automatic deletion in ${seconds} s</small></button>`, '<button class="btn" data-act="close">Cancel</button>')}`;
}

/**
 * "Remove?": the host's removal is for good, anyone else's (of a player who is offline) lets
 * them join again with the code (`kick` in src/game/rules.js). Once this phone may no longer
 * remove them (they came back online, `ui.canRemove`), the sheet closes by itself.
 */
function removeBody({ view, session }) {
  const p = view.players.find((x) => x.id === session.target);
  if (!p || !canRemove(view, p)) return '';
  const after = view.hostId === view.me.id ? 'They can’t join it again.' : 'They can join again with the code.';
  return `${title(`Remove ${esc(p.name)}?`)}
    ${text(`${esc(p.name)} and their photos leave this game. ${after}`)}
    ${buttons('<button class="btn bg-red text-white" data-act="removenow">Remove</button>', '<button class="btn" data-act="close">Cancel</button>')}`;
}

/**
 * "Update to play": this app is too old for its server, found when the player taps "Create
 * game" or "Join" (`main.js` `askUpdate`). As little as possible between them and the store:
 * what it is for, how long it takes (an honest estimate for an app of a few megabytes, which
 * keeps people going), one big button straight to this build's store page (`c.updateLink`),
 * and "Not now" small, so the button stands alone. The code they typed stays, so after the
 * update the game is one tap away.
 */
const updateBody = ({ updateLink }) => `<div class="mb-1 text-center text-6xl leading-none">✨</div>
  ${title('Update to play')}
  ${text('It takes about a minute.')}
  ${buttons(updateLink ? `<a class="btn bg-yellow text-navy" href="${esc(updateLink)}" target="_blank" rel="noopener">Update</a>` : '', '<button class="link" data-act="close">Not now</button>')}`;

/** `{ key, layout, parts }` for the open sheet, or null. */
export function sheetScreen(c) {
  const name = c.session.sheet;
  if (!name) return null;
  const inRoom = Boolean(c.view && c.view.me);
  const bodies = {
    settings: () => settingsBody(c),
    help: () => helpBody(c),
    avatar: () => avatarBody(c),
    invite: () => (inRoom ? inviteBody(c) : ''),
    leave: () => LEAVE,
    report: () => (inRoom ? reportBody(c) : ''),
    remove: () => (inRoom ? removeBody(c) : ''),
    start: () => (inRoom ? START : ''),
    update: () => updateBody(c),
  };
  const body = bodies[name] ? bodies[name]() : '';
  if (!body) return null;
  const long = typeof body === 'object';
  // A long sheet is a column: its scrolling box stays (layout), only the list in it is repainted.
  const inner = long
    ? `<div class="-mx-4 min-h-0 flex-1 overflow-auto px-4 pb-2" data-part="list"></div>
      <div class="pt-3 pb-safe shadow-[0_-14px_14px_-10px_var(--color-sheet)]" data-part="footer"></div>`
    : '';
  return {
    key: `sheet|${name}`,
    layout: `<div class="fixed inset-0 z-40 animate-fade bg-stage/70" data-act="close"></div>
      <div class="fixed inset-x-0 bottom-0 z-41 mx-auto max-h-[88dvh] max-w-120 animate-slide-up rounded-t-3xl bg-sheet px-4 pt-4.5 ${long ? 'flex flex-col' : 'overflow-auto pb-safe'}" role="dialog" aria-label="${esc(APP.name)}" ${long ? '' : 'data-part="body"'}>${inner}</div>`,
    parts: long ? body : { body },
  };
}
