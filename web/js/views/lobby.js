/**
 * The lobby: the room code, the settings summary, who is here and ready, and the
 * player's own photos: n random ones from the phone, "Play with these?" No/Yes.
 *
 * Mechanisms: shown in the `lobby` and `countdown` phases. `main.js` deals the photos by
 * itself as soon as the app may read them (`photos.roll`); the first time, the player is
 * asked once ("Continue" shows the phone's own question), and if access is off, "Open
 * settings" leads to the switch. The game starts by itself when everyone said "Yes"
 * (server rule `everyoneSaidYes`); a group's first game asks "Is everyone here?" first,
 * and after a No it starts with "Start now" at the bottom (`startNow`). The start ("Get
 * ready", the 3-2-1) is an overlay (`views/overlays.js`). Tapping the code opens the invite sheet, tapping the settings
 * summary opens the settings sheet (read-only for everyone but the host), and tapping a
 * player opens "Remove?" (the host may remove anyone, everyone a player who is offline;
 * nobody is removed for being offline).
 *
 * The players: a pill each, its border always 2 px (so nothing shifts): green when ready,
 * dashed grey while the game waits for them to be ready, red and glowing slowly with
 * "Offline, tap to remove" while they are offline, never faded. From PILLS_COMPACT_FROM
 * players on the pills are compact, so 16 fit above the photos on a small phone.
 *
 * The photos: a grid of 2 x 2 to 5 x 5 places (by "Photos per player") filling the room
 * between the players and the buttons, exactly as wide as No and Yes; on a short screen
 * (`short:`) the code and the gaps above it are smaller to leave it more. Tapping a photo
 * swaps it (`photos.swap`): the tile turns over like a card, the old photo away and the new
 * one in. The line under the grid counts the swaps left ("(3 left)" in green, bumping as it
 * goes down, red and shaking at 0 and again on every refused tap); holding a photo shows it
 * big (`main.js`, hold to look). "Yes" makes the player ready at once: the set stays with
 * "✓ Ready" while its photos go in the background (`session.sending`; only if the group
 * waits for them does the start show how far they are, `views/overlays.js`). Every wait
 * shows itself: "Picking photos…" under a spinner before the first set, and the set dimmed
 * under a spinner while No waits for new photos.
 *
 * The photo area is five parts (`title`, `pick`, `note`, `actions`, `links`), so what
 * changes often (the swap counter) never repaints the grid and its photos.
 */

import { SETTINGS, normalizeSettings } from '../../shared/config.js';
import { photos } from '../photos.js';
import { HELP_BUTTON, LEAVE_BUTTON, OFFLINE_LOOK, SPINNER, avatar, canRemove, esc, topBar } from '../ui.js';

const label = (key, value) => {
  const setting = SETTINGS.find((s) => s.key === key);
  const option = setting.options.find(([v]) => v === value);
  return option ? option[1] : '';
};

export function settingsSummary(s) {
  return [`${s.photos} photos`, s.rounds ? `${s.rounds} rounds` : '', s.time ? `${s.time} s` : '∞', label('mode', s.mode)].filter(Boolean).join(' · ');
}

/** The grid's columns and rows by its side (whole class names, so Tailwind builds them). */
const SIDES = { 2: 'grid-cols-2 grid-rows-2', 3: 'grid-cols-3 grid-rows-3', 4: 'grid-cols-4 grid-rows-4', 5: 'grid-cols-5 grid-rows-5' };

/**
 * The photos as a grid of `size` places (the setting), filling its box: the box takes the
 * free space (a size container), the grid its full width (as wide as No and Yes) and as much
 * of its height as keeps a tile at most 3:4 portrait (`100cqw * 4/3`, the gaps aside); in a
 * taller box it sits in the middle. Its rows and columns stretch, so the tiles take the free
 * space's shape. Only below 9rem of free height (7rem on a short screen, where 16 players
 * leave no more) does the page scroll instead. Without container units (iOS 15) the tiles are square and the grid
 * takes the full width. `busy` dims it under a spinner while "No" waits for new photos.
 */
function grid(tiles, size, busy = false) {
  const wait = busy ? `<div class="absolute inset-0 grid place-items-center">${SPINNER}</div>` : '';
  return `<div class="@container-size relative flex min-h-36 flex-1 flex-col justify-center short:min-h-28"><div class="grid w-full gap-1 supports-[width:1cqw]:h-[min(100cqh,calc(100cqw*4/3))] ${SIDES[Math.ceil(Math.sqrt(size))]} ${busy ? 'opacity-40' : ''}">${tiles.join('')}</div>${wait}</div>`;
}

/** A place in the grid; it takes the shape the grid gives it (square without container units, see `grid`). */
const TILE = 'relative grid place-items-center rounded-lg bg-card text-4xl text-white not-supports-[width:1cqw]:aspect-square';
/** How a photo enters the set: dealt in (a fade), or turned over by a swap (`transform-3d` keeps its two faces in 3D). */
const ENTRANCE = { in: 'animate-deal', flip: 'animate-flip transform-3d' };

/**
 * One face of a tile: the photo filling it. The back face (the photo a swap replaced) is
 * turned away from the start (`rotate-y-180`), and a face never shows its back, so the turn
 * shows the old photo until half way, then the new one.
 */
const face = (url, back = false) =>
  `<span class="absolute inset-0 rounded-lg bg-cover bg-center bg-no-repeat backface-hidden ${back ? 'rotate-y-180' : ''}" style="background-image:url('${url}')"></span>`;

/** The set on screen as tiles: tap to swap (unless `fixed`), hold to see big. */
function chosenTiles(fixed) {
  return photos.chosen.map((c, i) => {
    const cls = `${TILE} ${ENTRANCE[c.anim] || ''} motion-reduce:animate-none`;
    const faces = `${face(c.url)}${c.from ? face(c.from, true) : ''}`;
    const hold = `data-hold="tile" data-v="${i}"`;
    return fixed
      ? `<div class="${cls}" ${hold} role="img" aria-label="Photo ${i + 1}">${faces}</div>`
      : `<button class="${cls}" data-act="swap" ${hold} aria-label="Photo ${i + 1}: tap to swap it">${faces}</button>`;
  });
}

/**
 * The line under the grid: "Tap to swap (2 left), hold to preview". The count is green and
 * bumps each time it goes down; at 0 it is red and shakes, again on every refused tap. Its
 * markup carries the number and, at 0, the refusals so far (`photos.refusals`), so every
 * change is a new element whose animation plays once, and a repaint with the same markup
 * changes nothing.
 */
function swapsLine() {
  const n = photos.swaps;
  const count = n
    ? `<span class="inline-block animate-bump text-green motion-reduce:animate-none" data-n="${n}">(${n} left)</span>`
    : `<span class="inline-block animate-jiggle text-red motion-reduce:animate-none" data-n="0" data-try="${photos.refusals}">(0 left)</span>`;
  return `<p class="mt-2 text-center text-xs text-muted">Tap to swap ${count}, hold to preview</p>`;
}

const withoutPhotos = '<button class="link" data-act="guess">Play without photos</button>';

/** The dashed card that stands in for the photos while there are none to show. */
const PICK = 'w-full rounded-3xl border-2 border-dashed border-line-strong px-4 py-6.5 text-center';

/** The card shown instead of photos: why, and the one thing to tap. */
function card(icon, title, text, button) {
  return `<div class="${PICK}"><div class="text-6xl">${icon}</div><b class="mt-2 block text-2xl">${title}</b><small class="mt-1 block text-sm text-muted">${text}</small>${button}</div>${withoutPhotos}`;
}

const mainButton = (act, text) => `<button class="btn mt-4 bg-coral text-white" data-act="${act}">${text}</button>`;

/** No and Yes. */
function actions() {
  const off = photos.rolling ? 'disabled' : '';
  return `<div class="mt-3.5 grid grid-cols-2 gap-2.5"><button class="btn" data-act="no" ${off}>No</button><button class="btn bg-green text-navy" data-act="yes" ${off}>Yes</button></div>`;
}

/** The player's photo area as its five parts: `{ title, pick, note, actions, links }` (empty ones are ''). */
function mine({ view, session }) {
  const me = view.me;
  const parts = { title: '', pick: '', note: '', actions: '', links: '' };
  const ready = '<div class="mt-4 text-center"><b class="text-green">✓ Ready</b></div><button class="link" data-act="unready">Change</button>';
  // Ready from the moment "Yes" is tapped: the photos go in the background (`session.sending`).
  if (me.ready || session.sending) {
    const count = me.photoCount || (session.sending ? session.sending.count : 0);
    if (!count) return { ...parts, pick: ready };
    // The set as it was chosen ("Yes" sends no more of it than the game can show); without
    // the local previews (the app was closed meanwhile), neutral tiles stand in.
    const tiles = photos.chosen.length >= count && photos.chosen.every((c) => c.url)
      ? chosenTiles(true)
      : Array.from({ length: count }, () => `<div class="${TILE}">📷</div>`);
    return { ...parts, pick: grid(tiles, view.settings.photos), note: ready };
  }
  if (photos.chosen.length) {
    const limited = session.access === 'limited'
      ? '<button class="link" data-act="opensettings">Only some photos are shared. Share all ›</button>'
      : '';
    return {
      title: '<h2 class="mb-3 text-center font-display text-2xl font-extrabold short:mb-2 short:text-xl">Play with these?</h2>',
      pick: grid(chosenTiles(false), view.settings.photos, photos.rolling),
      note: swapsLine(),
      actions: actions(),
      links: `${limited}${withoutPhotos}`,
    };
  }
  if (session.access === 'ask') {
    return { ...parts, pick: card('🖼️', 'Your photos', 'The game picks a few random photos from your phone. You see them first.', mainButton('allow', 'Continue')) };
  }
  if (session.access === 'denied') {
    return { ...parts, pick: card('🔒', 'Photos are turned off', 'Allow photos for this app in your phone’s settings.', mainButton('opensettings', 'Open settings')) };
  }
  if (photos.empty) {
    const limited = session.access === 'limited';
    const filtered = normalizeSettings(view.settings).filter !== 'all';
    const why = limited ? 'Share more photos with this app in your phone’s settings.'
      : filtered ? 'None of the photos here fit “Which photos” in the game settings.'
        : 'This phone has no photos the game can use.';
    return { ...parts, pick: card('🔍', 'No photos found', why, limited ? mainButton('opensettings', 'Open settings') : '') };
  }
  return { ...parts, pick: `<div class="${PICK}">${SPINNER}<p class="mt-3 text-sm text-muted">Picking photos…</p></div>` };
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
  if (view.me.ready && !ps.some((p) => p.photoCount > 0 || p.sending)) return line('Someone needs photos.');
  return '';
}

/**
 * "Start now", on every phone once someone answered "Is everyone here?" with No
 * (`view.start.mode` 'button', `views/overlays.js`): big and pulsing at the bottom, greyed
 * (and still) until everyone said "Yes". Anyone may tap it.
 */
function startNow({ view }) {
  if (!view.start || view.start.mode !== 'button') return '';
  return `<button class="btn mt-3 animate-breathe bg-coral text-white disabled:animate-none motion-reduce:animate-none" data-act="go" ${view.start.everyone ? '' : 'disabled'}>Start now</button>`;
}

/** From this many players on, the pills are compact: smaller avatar, text and padding. */
const PILLS_COMPACT_FROM = 7;
const PILLS = {
  roomy: { cls: 'gap-1.75 py-0.5 pr-3 pl-0.5 text-sm', avatar: 'md' },
  compact: { cls: 'gap-1 pr-2 text-xs', avatar: 'sm' },
};

/**
 * A player's pill, its look by how the game stands with them: ready (green), not ready
 * (dashed grey), offline (the red warning light, `ui.OFFLINE_LOOK`, with "Offline, tap to
 * remove" under the name). A player this phone may remove (`ui.canRemove`: the host anyone
 * else, everyone an offline player) is a button that opens the "Remove?" sheet.
 */
function chip(view, p) {
  const size = view.players.length >= PILLS_COMPACT_FROM ? PILLS.compact : PILLS.roomy;
  const offline = !p.connected;
  const look = offline ? OFFLINE_LOOK : p.ready ? 'border-green bg-card' : 'border-dashed border-line-strong bg-card';
  const name = offline
    ? `<span class="flex min-w-0 flex-col leading-tight"><span class="truncate">${esc(p.name)}</span><small class="truncate text-2xs text-red">Offline, tap to remove</small></span>`
    : `<span class="truncate">${esc(p.name)}</span>`;
  const inner = `${avatar(p, size.avatar)}${name}${p.id === view.hostId ? '<span aria-label="Host">👑</span>' : ''}${p.ready && !offline ? '<span class="text-green">✓</span>' : ''}`;
  const cls = `flex max-w-[46%] items-center rounded-full border-2 ${size.cls} ${look}`;
  const label = offline ? `${esc(p.name)} is offline: remove from game` : `${esc(p.name)}: remove from game`;
  return canRemove(view, p)
    ? `<button class="${cls}" data-act="remove" data-v="${esc(p.id)}" aria-label="${label}">${inner}</button>`
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
      <div class="mt-4.5 mb-1.5 flex flex-wrap justify-center gap-1.5 short:mt-2.5" data-part="chips"></div>
      <div class="mt-4.5 flex flex-1 flex-col short:mt-2.5">
        <div data-part="title"></div>
        <div class="flex flex-1 flex-col" data-part="pick"></div>
        <div data-part="note"></div>
        <div data-part="actions"></div>
        <div data-part="links"></div>
      </div>
      <div data-part="status"></div>
      <div data-part="go"></div>
    </div>`,
    parts: {
      cfg: `<button class="mx-auto block rounded-full border border-line bg-card px-3.5 py-1.75 text-xs ${host ? 'text-ink' : 'text-muted'}" data-act="settings">${esc(settingsSummary(view.settings))}${host ? ' ⚙︎' : ''}</button>`,
      chips: view.players.map((p) => chip(view, p)).join(''),
      ...mine(c),
      status: status(c),
      go: startNow(c),
    },
  };
}
