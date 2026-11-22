/**
 * The "New game" step between "Create game" and the lobby: three cards in one choice (the
 * two presets most groups play, and "Custom" for everything else), and "Start game".
 *
 * Mechanisms: shown while `session.setup` is on. It edits the settings this phone
 * remembers (`device.settings`): a preset replaces them all (`PRESETS`), "Custom" opens the
 * settings sheet (`views/sheets.js`) to fine-tune them, and "Start game" creates the room
 * with them. The host can still change everything in the lobby.
 *
 * Invariant: exactly one card is highlighted (`aria-pressed`): a preset while the settings
 * are exactly that preset (`presetOf`), otherwise "Custom". The cards carry only an icon
 * and a word (and a presets' one line), so the choice reads at a glance.
 */

import { PRESETS, presetOf } from '../../shared/config.js';
import { HELP_BUTTON, barTitle, esc, iconButton, topBar } from '../ui.js';

/** A card of the choice: icon left, title and line right; yellow while it is the one chosen. */
const CARD = 'grid grid-cols-[auto_1fr] items-center gap-x-3.5 rounded-3xl border-2 border-transparent bg-card p-4 text-left active:scale-98 aria-pressed:border-yellow aria-pressed:bg-picked';
const ICON = 'row-span-2 text-6xl';
const TITLE = 'font-display text-2xl font-extrabold';

export function newGameScreen({ device, session }) {
  const current = presetOf(device.settings);
  const busy = session.creating;
  return {
    key: 'newgame',
    layout: `<div class="screen">
      ${topBar(iconButton('back', 'Back', '‹'), barTitle('New game'), HELP_BUTTON)}
      <div class="mt-4.5 mb-3 grid gap-2.5" data-part="presets"></div>
      <div class="flex-1"></div>
      <div data-part="start"></div>
    </div>`,
    parts: {
      presets: `${PRESETS.map((p) => `<button class="${CARD}" data-act="preset" data-v="${p.key}" aria-pressed="${current === p}">
          <span class="${ICON}">${p.icon}</span><b class="${TITLE}">${esc(p.label)}</b><small class="text-sm font-medium text-muted">${esc(p.text)}</small></button>`).join('')}
        <button class="${CARD}" data-act="settings" aria-pressed="${!current}"><span class="${ICON}">⚙️</span><b class="${TITLE} row-span-2">Custom</b></button>`,
      start: `<button class="btn bg-coral text-white" data-act="start" ${busy ? 'disabled' : ''}>Start game</button>`,
    },
  };
}
