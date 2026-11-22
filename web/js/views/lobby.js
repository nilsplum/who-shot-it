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
 * between the players and the buttons allows. Tapping a photo swaps it (`photos.swap`,
 * counted under the grid), holding one shows it big (`main.js`, hold to look); a refused
 * swap shows a cross on that photo, nothing else.
 */

import { SETTINGS, normalizeSettings } from '../../shared/config.js';
import { photos } from '../photos.js';
import { avatar, esc } from '../ui.js';

const label = (key, value) => {
  const setting = SETTINGS.find((s) => s.key === key);
  const option = setting.options.find(([v]) => v === value);
  return option ? option[1] : '';
};

export function settingsSummary(s) {
  return [`${s.photos} photos`, s.rounds ? `${s.rounds} rounds` : '', s.time ? `${s.time} s` : '∞', label('mode', s.mode)].filter(Boolean).join(' · ');
}

/** The photos as a square grid of `size` places (the setting), in a box that fills the free space. */
function grid(tiles, size) {
  return `<div class="gridbox"><div class="grid" style="--cols:${Math.ceil(Math.sqrt(size))}">${tiles.join('')}</div></div>`;
}

/** The set on screen as tiles: tap to swap (unless `fixed`), hold to see big. */
function chosenTiles(fixed) {
  return photos.chosen.map((c, i) => {
    const cls = `tile ${c.anim || ''} ${c.refused ? 'no' : ''}`;
    const look = `data-hold="tile" data-v="${i}" style="background-image:url('${c.url}')"`;
    return fixed
      ? `<div class="${cls}" ${look} role="img" aria-label="Photo ${i + 1}"></div>`
      : `<button class="${cls}" data-act="swap" ${look} aria-label="Photo ${i + 1}: tap to swap it">${c.refused ? '<span class="x">✗</span>' : ''}</button>`;
  });
}

/** How many swaps are left in this set, under the grid. */
function swapsLine() {
  const n = photos.swaps;
  return `<div class="swaps" aria-label="${n} swaps left">↻ ${n ? `Tap a photo to swap it: ${n} left` : 'No swaps left'}</div>`;
}

const withoutPhotos = '<button class="link" data-act="guess">Play without photos</button>';

/** The card shown instead of photos: why, and the one thing to tap. */
function card(icon, title, text, button) {
  return `<div class="pick"><div class="ic">${icon}</div><b>${title}</b><small>${text}</small>${button}</div>${withoutPhotos}`;
}

function mine({ view, session }) {
  const me = view.me;
  if (me.ready) {
    // Without the local previews (the app was closed meanwhile), neutral tiles stand in.
    const tiles = photos.chosen.length === me.photoCount && photos.chosen.every((c) => c.url)
      ? chosenTiles(true)
      : Array.from({ length: me.photoCount }, () => '<div class="tile">📷</div>');
    return `${me.photoCount ? grid(tiles, view.settings.photos) : ''}<div class="status"><b>✓ Ready</b></div><button class="link" data-act="unready">Change</button>`;
  }
  if (photos.chosen.length) {
    const busy = session.uploading;
    const limited = session.access === 'limited'
      ? '<button class="link" data-act="opensettings">Only some photos are shared. Share all ›</button>'
      : '';
    return `<div class="q">Play with these?</div>${grid(chosenTiles(false), view.settings.photos)}${swapsLine()}
      <div class="yn"><button class="btn" data-act="no" ${busy || photos.rolling ? 'disabled' : ''}>No</button><button class="btn yes ${busy ? 'busy' : ''}" data-act="yes" ${photos.rolling || busy ? 'disabled' : ''}>Yes</button></div>
      ${limited}${withoutPhotos}`;
  }
  if (session.access === 'ask') {
    return card('🖼️', 'Your photos', 'The game picks a few random photos from your phone. You see them first.', '<button class="btn main" data-act="allow">Continue</button>');
  }
  if (session.access === 'denied') {
    return card('🔒', 'Photos are turned off', 'Allow photos for this app in your phone’s settings.', '<button class="btn main" data-act="opensettings">Open settings</button>');
  }
  if (photos.empty) {
    const limited = session.access === 'limited';
    const filtered = normalizeSettings(view.settings).filter !== 'all';
    const why = limited ? 'Share more photos with this app in your phone’s settings.'
      : filtered ? 'None of the photos here fit “Which photos” in the game settings.'
        : 'This phone has no photos the game can use.';
    return card('🫥', 'No photos found', why, limited ? '<button class="btn main" data-act="opensettings">Open settings</button>' : '');
  }
  return '<div class="pick"><div class="spin"></div></div>';
}

/**
 * The quiet line at the bottom: who the game is waiting on (not ready, still on the last
 * game's results, or offline), whether or not this player is ready already.
 */
function status({ view }) {
  const ps = view.players;
  if (ps.length < 2) return '<div class="status">Waiting for friends…</div>';
  const waiting = ps.filter((p) => p.id !== view.me.id && (!p.ready || !p.connected));
  if (waiting.length) return `<div class="status quiet">Waiting on ${waiting.map((p) => esc(p.name)).join(', ')}</div>`;
  if (view.me.ready && !ps.some((p) => p.photoCount > 0)) return '<div class="status">Someone needs photos.</div>';
  return '';
}

/** A player in the lobby; the host can tap the others to remove them. */
function chip(view, p, host) {
  const inner = `${avatar(p)}<span class="nm">${esc(p.name)}</span>${p.id === view.hostId ? '<span aria-label="Host">👑</span>' : ''}${p.ready ? '<span class="ok">✓</span>' : ''}`;
  const cls = `chip ${p.ready ? 'rd' : ''} ${p.connected ? '' : 'off'}`;
  return host && p.id !== view.me.id
    ? `<button class="${cls}" data-act="remove" data-v="${esc(p.id)}" aria-label="${esc(p.name)}: remove from game">${inner}</button>`
    : `<div class="${cls}">${inner}</div>`;
}

export function lobbyScreen(c) {
  const { view } = c;
  const host = view.hostId === view.me.id;
  return {
    key: `lobby|${view.code}`,
    layout: `<div class="wrap fit">
      <div class="top"><button class="icon" data-act="leave" aria-label="Leave">✕</button><span></span><button class="icon qmark" data-act="help" aria-label="How to play">?</button></div>
      <button class="code" data-act="invite" aria-label="Invite friends">${[...view.code].map((ch) => `<span>${esc(ch)}</span>`).join('')}</button>
      <div data-part="cfg"></div>
      <div class="chips" data-part="chips"></div>
      <div class="mine" data-part="mine"></div>
      <div data-part="status"></div>
    </div>`,
    parts: {
      cfg: `<button class="cfg ${host ? 'host' : ''}" data-act="settings">${esc(settingsSummary(view.settings))}${host ? ' ⚙︎' : ''}</button>`,
      chips: view.players.map((p) => chip(view, p, host)).join(''),
      mine: mine(c),
      status: status(c),
    },
  };
}
