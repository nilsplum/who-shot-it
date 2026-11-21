/**
 * The "New game" step between "Create game" and the lobby: the two presets most groups
 * play, a "Game settings" button for everything else, and "Start game".
 *
 * Mechanisms: shown while `session.setup` is on. It edits the settings this phone
 * remembers (`device.settings`): a preset replaces them all (`PRESETS`), the settings
 * sheet (`views/sheets.js`) fine-tunes them, and "Start game" creates the room with them.
 * The host can still change everything in the lobby.
 *
 * Invariant: a preset card is highlighted only while the settings are exactly that preset
 * (`presetOf`); after any fine-tuning the settings button says "Custom" instead.
 */

import { PRESETS, presetOf } from '../../shared/config.js';
import { esc } from '../ui.js';
import { settingsSummary } from './lobby.js';

export function newGameScreen({ device, session }) {
  const current = presetOf(device.settings);
  const busy = session.creating;
  return {
    key: 'newgame',
    layout: `<div class="wrap">
      <div class="top"><button class="icon" data-act="back" aria-label="Back">‹</button><span class="title">New game</span><button class="icon qmark" data-act="help" aria-label="How to play">?</button></div>
      <div class="presets" data-part="presets"></div>
      <div data-part="custom"></div>
      <div class="spacer"></div>
      <div data-part="start"></div>
    </div>`,
    parts: {
      presets: PRESETS.map((p) => `<button class="preset ${current === p ? 'on' : ''}" data-act="preset" data-v="${p.key}" aria-pressed="${current === p}">
          <span class="ic">${p.icon}</span><b>${esc(p.label)}</b><small>${esc(p.text)}</small></button>`).join(''),
      custom: `<button class="btn cfgbtn" data-act="settings">⚙︎ Game settings<small>${esc((current ? '' : 'Custom · ') + settingsSummary(device.settings))}</small></button>`,
      start: `<button class="btn main ${busy ? 'busy' : ''}" data-act="start" ${busy ? 'disabled' : ''}>Start game</button>`,
    },
  };
}
