/**
 * The lobby: the room code, the settings summary, who is here and ready, and the
 * player's own photos: n random ones from the phone, "Play with these?" No/Yes.
 *
 * Mechanisms: shown in the `lobby` and `countdown` phases. `main.js` deals the photos by
 * itself as soon as the app may read them (`photos.roll`); the first time, the player is
 * asked once ("Continue" shows the phone's own question), and if access is off, "Open
 * settings" leads to the switch. The game starts by itself when everyone is ready
 * (server rule `canStart`); the 3-2-1 is an overlay (`views/overlays.js`). Tapping the
 * code opens the invite sheet, tapping the settings summary opens the settings sheet
 * (read-only for everyone but the host), and the host taps a player to remove them.
 *
 * The photos: a square grid (2 x 2 to 5 x 5, by "Photos per player") as big as the room
 * between the players and the buttons allows; on a short screen (`short:`) the code and
 * the gaps above it are smaller to leave it more. Tapping a photo swaps it (`photos.swap`,
 * counted under the grid), holding one shows it big (`main.js`, hold to look); a refused
 * swap shows a cross on that photo, nothing else.
 */

import { SETTINGS, normalizeSettings } from '../../shared/config.js';
import { photos } from '../photos.js';
import { HELP_BUTTON, LEAVE_BUTTON, SPINNER, avatar, esc, topBar } from '../ui.js';

const label = (key, value) => {
  const setting = SETTINGS.find((s) => s.key === key);
  const option = setting.options.find(([v]) => v === value);
  return option ? option[1] : '';
};

export function settingsSummary(s) {
  return [`${s.photos} photos`, s.rounds ? `${s.rounds} rounds` : '', s.time ? `${s.time} s` : '∞', label('mode', s.mode)].filter(Boolean).join(' · ');
}

/** The grid's columns by its side (whole class names, so Tailwind builds them). */
const COLUMNS = { 2: 'grid-cols-2', 3: 'grid-cols-3', 4: 'grid-cols-4', 5: 'grid-cols-5' };

/**
 * The photos as a square grid of `size` places (the setting). Its box takes the free space
 * (a size container), and the grid is the largest square that fits in it, so "No" and
 * "Yes" stay on screen also on small phones (tiles get smaller; holding one still shows it
 * big). Only below 9rem, with many players on a small phone, does the page scroll instead.
 * Without container units (iOS 15) the grid takes the full width.
 */
function grid(tiles, size) {
  return `<div class="@container-size grid min-h-36 flex-1 place-items-center"><div class="grid w-full gap-1.5 supports-[width:1cqw]:w-[min(100cqw,100cqh)] ${COLUMNS[Math.ceil(Math.sqrt(size))]}">${tiles.join('')}</div></div>`;
}

const TILE = 'relative grid aspect-square place-items-center rounded-xl bg-card bg-cover bg-center bg-no-repeat text-4xl text-white';
/** How a photo enters the set: dealt in, or flipped in by a swap. */
const ENTRANCE = { in: 'animate-deal', flip: 'animate-flip' };

/** The set on screen as tiles: tap to swap (unless `fixed`), hold to see big. A refused swap rings the photo red with a cross. */
function chosenTiles(fixed) {
  return photos.chosen.map((c, i) => {
    const cls = `${TILE} ${ENTRANCE[c.anim] || ''} motion-reduce:animate-none ${c.refused ? 'inset-ring-3 inset-ring-red' : ''}`;
    const look = `data-hold="tile" data-v="${i}" style="background-image:url('${c.url}')"`;
    return fixed
      ? `<div class="${cls}" ${look} role="img" aria-label="Photo ${i + 1}"></div>`
      : `<button class="${cls}" data-act="swap" ${look} aria-label="Photo ${i + 1}: tap to swap it">${c.refused ? '<span class="animate-pop text-8xl font-extrabold [text-shadow:0_2px_8px_var(--color-stage)] motion-reduce:animate-none">✗</span>' : ''}</button>`;
  });
}

/** How many swaps are left in this set, under the grid. */
function swapsLine() {
  const n = photos.swaps;
  return `<div class="mt-2.5 text-center text-muted" aria-label="${n} swaps left">↻ ${n ? `Tap a photo to swap it: ${n} left` : 'No swaps left'}</div>`;
}

const withoutPhotos = '<button class="link" data-act="guess">Play without photos</button>';

/** The dashed card that stands in for the photos while there are none to show. */
const PICK = 'w-full rounded-3xl border-2 border-dashed border-line-strong px-4 py-6.5 text-center';

/** The card shown instead of photos: why, and the one thing to tap. */
function card(icon, title, text, button) {
  return `<div class="${PICK}"><div class="text-6xl">${icon}</div><b class="mt-2 block text-2xl">${title}</b><small class="mt-1 block text-sm text-muted">${text}</small>${button}</div>${withoutPhotos}`;
}

const mainButton = (act, text) => `<button class="btn mt-4 bg-coral text-white" data-act="${act}">${text}</button>`;

function mine({ view, session }) {
  const me = view.me;
  if (me.ready) {
    // Without the local previews (the app was closed meanwhile), neutral tiles stand in.
    const tiles = photos.chosen.length === me.photoCount && photos.chosen.every((c) => c.url)
      ? chosenTiles(true)
      : Array.from({ length: me.photoCount }, () => `<div class="${TILE}">📷</div>`);
    return `${me.photoCount ? grid(tiles, view.settings.photos) : ''}<div class="mt-4 text-center"><b class="text-green">✓ Ready</b></div><button class="link" data-act="unready">Change</button>`;
  }
  if (photos.chosen.length) {
    const busy = session.uploading;
    const limited = session.access === 'limited'
      ? '<button class="link" data-act="opensettings">Only some photos are shared. Share all ›</button>'
      : '';
    return `<h2 class="mb-3 text-center font-display text-2xl font-extrabold">Play with these?</h2>${grid(chosenTiles(false), view.settings.photos)}${swapsLine()}
      <div class="mt-3.5 grid grid-cols-2 gap-2.5"><button class="btn" data-act="no" ${busy || photos.rolling ? 'disabled' : ''}>No</button><button class="btn bg-green text-navy" data-act="yes" ${photos.rolling || busy ? 'disabled' : ''}>Yes</button></div>
      ${limited}${withoutPhotos}`;
  }
  if (session.access === 'ask') {
    return card('🖼️', 'Your photos', 'The game picks a few random photos from your phone. You see them first.', mainButton('allow', 'Continue'));
  }
  if (session.access === 'denied') {
    return card('🔒', 'Photos are turned off', 'Allow photos for this app in your phone’s settings.', mainButton('opensettings', 'Open settings'));
  }
  if (photos.empty) {
    const limited = session.access === 'limited';
    const filtered = normalizeSettings(view.settings).filter !== 'all';
    const why = limited ? 'Share more photos with this app in your phone’s settings.'
      : filtered ? 'None of the photos here fit “Which photos” in the game settings.'
        : 'This phone has no photos the game can use.';
    return card('🔍', 'No photos found', why, limited ? mainButton('opensettings', 'Open settings') : '');
  }
  return `<div class="${PICK}">${SPINNER}</div>`;
}

/**
 * The quiet line at the bottom: who the game is waiting on (not ready, still on the last
 * game's results, or offline), whether or not this player is ready already.
 */
function status({ view }) {
  const ps = view.players;
  const line = (text) => `<div class="mt-4 text-center text-muted">${text}</div>`;
  if (ps.length < 2) return line('Waiting for friends…');
  const waiting = ps.filter((p) => p.id !== view.me.id && (!p.ready || !p.connected));
  if (waiting.length) return `<div class="mt-2.5 text-center text-xs text-muted">Waiting on ${waiting.map((p) => esc(p.name)).join(', ')}</div>`;
  if (view.me.ready && !ps.some((p) => p.photoCount > 0)) return line('Someone needs photos.');
  return '';
}

/** A player in the lobby: green ring when ready, faded while offline; the host can tap the others to remove them. */
function chip(view, p, host) {
  const inner = `${avatar(p)}<span class="truncate">${esc(p.name)}</span>${p.id === view.hostId ? '<span aria-label="Host">👑</span>' : ''}${p.ready ? '<span class="text-green">✓</span>' : ''}`;
  const cls = `flex max-w-[46%] items-center gap-1.75 rounded-full bg-card py-1 pr-3 pl-1 text-sm ${p.ready ? 'inset-ring-2 inset-ring-green' : ''} ${p.connected ? '' : 'opacity-40'}`;
  return host && p.id !== view.me.id
    ? `<button class="${cls}" data-act="remove" data-v="${esc(p.id)}" aria-label="${esc(p.name)}: remove from game">${inner}</button>`
    : `<div class="${cls}">${inner}</div>`;
}

export function lobbyScreen(c) {
  const { view } = c;
  const host = view.hostId === view.me.id;
  return {
    key: `lobby|${view.code}`,
    layout: `<div class="screen h-dvh">
      ${topBar(LEAVE_BUTTON, '', HELP_BUTTON)}
      <button class="mx-auto mt-1.5 mb-2 flex justify-center gap-2 active:scale-97" data-act="invite" aria-label="Invite friends">${[...view.code].map((ch) => `<span class="grid h-16 w-13.5 place-items-center rounded-2xl bg-yellow font-display text-6xl font-extrabold text-navy short:h-12 short:w-10.5 short:text-4xl">${esc(ch)}</span>`).join('')}</button>
      <div data-part="cfg"></div>
      <div class="mt-4.5 mb-1.5 flex flex-wrap justify-center gap-2 short:mt-2.5" data-part="chips"></div>
      <div class="mt-4.5 flex flex-1 flex-col short:mt-2.5" data-part="mine"></div>
      <div data-part="status"></div>
    </div>`,
    parts: {
      cfg: `<button class="mx-auto block rounded-full border border-line bg-card px-3.5 py-1.75 text-xs ${host ? 'text-ink' : 'text-muted'}" data-act="settings">${esc(settingsSummary(view.settings))}${host ? ' ⚙︎' : ''}</button>`,
      chips: view.players.map((p) => chip(view, p, host)).join(''),
      mine: mine(c),
      status: status(c),
    },
  };
}
