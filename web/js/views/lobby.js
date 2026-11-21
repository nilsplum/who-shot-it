/**
 * The lobby: the room code, the settings summary, who is here and ready, and the
 * player's own photo choice (All photos / Choose photos / Play without photos, then
 * "Play with these?" No/Yes).
 *
 * Mechanisms: shown in the `lobby` and `countdown` phases. The game starts by itself
 * when everyone is ready (server rule `canStart`); the 3-2-1 is an overlay
 * (`views/overlays.js`). Tapping the code opens the invite sheet, tapping the settings
 * summary opens the settings sheet (read-only for everyone but the host).
 */

import { API } from '../../shared/api.js';
import { SETTINGS } from '../../shared/config.js';
import { isAndroid, photoRoute, shortcutLink } from '../device.js';
import { isRolling, photos } from '../photos.js';
import { avatar, esc } from '../ui.js';

const label = (key, value) => {
  const setting = SETTINGS.find((s) => s.key === key);
  const option = setting.options.find(([v]) => v === value);
  return option ? option[1] : '';
};

export function settingsSummary(s) {
  return [`${s.photos} photos`, s.rounds ? `${s.rounds} rounds` : '', s.time ? `${s.time} s` : '∞', label('mode', s.mode)].filter(Boolean).join(' · ');
}

/** The iPhone shortcut link for this player's current pool token. */
export function shortcutHref(view) {
  const origin = location.origin;
  return shortcutLink({
    uploadUrl: origin + API.poolUpload(view.code, view.me.pool.token),
    doneUrl: origin + API.poolDone(view.code, view.me.pool.token),
    backUrl: `${origin}/${view.code}`,
    ua: navigator.userAgent,
  });
}

function grid(tiles) {
  return `<div class="grid n${tiles.length}">${tiles.join('')}</div>`;
}

function chosenTiles() {
  return photos.chosen.map((c) => (c.url ? `<div style="background-image:url('${c.url}')"></div>` : '<div class="ld"></div>'));
}

function mine({ view, session, device }) {
  const me = view.me;
  if (me.ready) {
    // After a reload the local previews are gone; neutral tiles stand in for them.
    const tiles = photos.chosen.length === me.photoCount && photos.chosen.every((c) => c.url)
      ? chosenTiles()
      : Array.from({ length: me.photoCount }, () => '<div>📷</div>');
    return `${me.photoCount ? grid(tiles) : ''}<div class="status"><b>✓ Ready</b></div><button class="link" data-act="unready">Change</button>`;
  }
  if (photos.chosen.length) {
    const busy = session.uploading;
    return `<div class="q">Play with these?</div>${grid(chosenTiles())}
      <div class="yn"><button class="btn" data-act="no" ${busy ? 'disabled' : ''}>No</button><button class="btn yes ${busy ? 'busy' : ''}" data-act="yes" ${isRolling() || busy ? 'disabled' : ''}>Yes</button></div>
      <button class="link" data-act="other">Other photos</button>`;
  }
  if (session.poolLoading) return '<div class="pick"><div class="spin"></div><b>Loading photos…</b></div>';
  const route = photoRoute();
  let all = '';
  if (route === 'folder') {
    all = `<button class="pick" data-act="folder"><div class="ic">🖼️</div><b>All photos</b><small>${isAndroid() ? 'Open DCIM › Camera' : 'Pick a photo folder'}</small></button>`;
  } else if (route === 'shortcut') {
    all = device.shortcutOk
      ? `<a class="pick" href="${esc(shortcutHref(view))}"><div class="ic">🖼️</div><b>All photos</b></a>`
      : '<button class="pick" data-act="ios"><div class="ic">🖼️</div><b>All photos</b></button>';
  }
  const choose = all
    ? '<button class="btn" data-act="choose">Choose photos</button>'
    : '<button class="pick" data-act="choose"><div class="ic">📷</div><b>Choose photos</b><small>Pick as many as you like</small></button>';
  return `${all}${choose}<button class="link" data-act="guess">Play without photos</button>`;
}

function status({ view }) {
  if (!view.me.ready) return '';
  const ps = view.players;
  if (ps.length < 2) return '<div class="status">Waiting for friends…</div>';
  const waiting = ps.filter((p) => !p.ready || !p.connected);
  if (waiting.length) return `<div class="status">Waiting for ${waiting.map((p) => esc(p.name)).join(', ')}…</div>`;
  if (!ps.some((p) => p.photoCount > 0)) return '<div class="status">Someone needs photos.</div>';
  return '';
}

export function lobbyScreen(c) {
  const { view } = c;
  const host = view.hostId === view.me.id;
  return {
    key: `lobby|${view.code}`,
    layout: `<div class="wrap">
      <div class="top"><button class="icon" data-act="leave" aria-label="Leave">✕</button><span></span><button class="icon qmark" data-act="help" aria-label="How to play">?</button></div>
      <button class="code" data-act="invite" aria-label="Invite friends">${[...view.code].map((ch) => `<span>${esc(ch)}</span>`).join('')}</button>
      <div data-part="cfg"></div>
      <div class="chips" data-part="chips"></div>
      <div class="mine" data-part="mine"></div>
      <div data-part="status"></div>
    </div>`,
    parts: {
      cfg: `<button class="cfg ${host ? 'host' : ''}" data-act="settings">${esc(settingsSummary(view.settings))}${host ? ' ⚙︎' : ''}</button>`,
      chips: view.players.map((p) => `<div class="chip ${p.ready ? 'rd' : ''} ${p.connected ? '' : 'off'}">${avatar(p)}<span class="nm">${esc(p.name)}</span>${p.id === view.hostId ? '<span aria-label="Host">👑</span>' : ''}${p.ready ? '<span class="ok">✓</span>' : ''}</div>`).join(''),
      mine: mine(c),
      status: status(c),
    },
  };
}
