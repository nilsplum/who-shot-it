/**
 * The end screen: podium, fastest right guess, best fooler, the rest of the ranking,
 * reactions and (for the host) "Play again".
 *
 * Mechanisms: shown in the `end` phase. "Play again" returns everyone to the lobby,
 * where each player gets a fresh random set of photos (`main.js`, `photos.spent`).
 * All photos of the game are already deleted on the server at this point.
 */

import { avatar, esc, reactionsRow } from '../ui.js';

export function endScreen({ view }, reactions) {
  const host = view.hostId === view.me.id;
  const ranked = view.players.slice().sort((a, b) => b.score - a.score);
  const top = ranked.slice(0, 3);
  const podium = [[top[1], 'p2', 2], [top[0], 'p1', 1], [top[2], 'p3', 3]].filter(([p]) => p);
  const name = (id) => esc((view.players.find((p) => p.id === id) || {}).name || '');
  const { fastest, fooler } = view.stats || {};
  const facts = [
    fastest ? `⚡ ${name(fastest.id)}: ${(fastest.ms / 1000).toFixed(1)} s` : '',
    fooler ? `🎭 ${name(fooler.id)}: fooled ${fooler.count}×` : '',
  ].filter(Boolean);
  const body = `
    <div class="podium">${podium.map(([p, cls, n]) => `<div class="pod ${cls}">${avatar(p)}<div class="pn">${esc(p.name)}</div><div class="ps">${p.score}</div><div class="blk">${n}</div></div>`).join('')}</div>
    ${facts.length ? `<div class="facts">${facts.map((f) => `<div>${f}</div>`).join('')}</div>` : ''}
    ${ranked.length > 3 ? `<ul class="rank">${ranked.slice(3).map((p, i) => `<li><span class="muted">${i + 4}.</span>${avatar(p)}<span class="n">${esc(p.name)}</span><b>${p.score}</b></li>`).join('')}</ul>` : ''}`;
  return {
    key: `end|${view.code}`,
    layout: `<div class="wrap">
      <div class="top"><button class="icon" data-act="leave" aria-label="Leave">✕</button><span></span><span></span></div>
      <div data-part="body"></div>
      <div class="spacer"></div>
      <div class="end-reacts">${reactionsRow(reactions)}</div>
      <div data-part="again"></div>
    </div>`,
    parts: {
      body,
      again: host ? '<button class="btn main" data-act="again">Play again</button>' : '',
    },
  };
}
