/**
 * Builds a game's round plan: which photo comes up in which round.
 *
 * Mechanisms: part of the pure game logic; `rules.js` calls `buildPlan` once when the
 * countdown ends, with every ready player's uploaded photos.
 *
 * Invariants:
 * - Rounds = all photos, or the "Rounds" setting if that is smaller.
 * - When not every photo is played, "Photo picks: Fair" takes photos in turns, so every
 *   player's photos come up equally often (within one); "Random" draws from all photos.
 * - The order avoids the same owner twice in a row whenever the photos allow it, so a
 *   streak of one person's photos never gives the answer away.
 */

import { shuffle } from '../../web/shared/random.js';

/** Takes `count` photos in turns: always from an owner with the fewest picks so far. */
function pickFair(byOwner, count, rng) {
  const queues = shuffle([...byOwner.entries()], rng).map(([owner, photos]) => ({ owner, photos: shuffle(photos, rng), taken: 0 }));
  const picked = [];
  while (picked.length < count) {
    const open = queues.filter((q) => q.taken < q.photos.length);
    if (!open.length) break;
    const fewest = Math.min(...open.map((q) => q.taken));
    const candidates = open.filter((q) => q.taken === fewest);
    const q = candidates[Math.floor(rng() * candidates.length)];
    picked.push({ owner: q.owner, photo: q.photos[q.taken] });
    q.taken += 1;
  }
  return picked;
}

/**
 * Orders the photos randomly, weighted by how many each owner has left, so the same owner
 * never comes twice in a row whenever that is possible at all. An owner may only be picked
 * if the rest can still be arranged without repeats afterwards: no other owner may hold
 * more than half of what is left (rounded up), and the picked one no more than half
 * (rounded down), because it cannot come next.
 */
export function arrange(entries, rng) {
  const groups = new Map();
  for (const e of entries) {
    if (!groups.has(e.owner)) groups.set(e.owner, []);
    groups.get(e.owner).push(e);
  }
  const out = [];
  let last = null;
  while (out.length < entries.length) {
    const after = entries.length - out.length - 1;
    const open = [...groups.entries()].filter(([, list]) => list.length);
    const others = open.filter(([owner]) => owner !== last);
    const safe = others.filter(([owner, list]) => list.length - 1 <= Math.floor(after / 2)
      && open.every(([o, l]) => o === owner || l.length <= Math.ceil(after / 2)));
    // No safe choice means a repeat is unavoidable; take the least bad one.
    const choices = safe.length ? safe : others.length ? others : open;
    const total = choices.reduce((n, [, list]) => n + list.length, 0);
    let r = rng() * total;
    let picked = choices[choices.length - 1];
    for (const choice of choices) {
      r -= choice[1].length;
      if (r < 0) {
        picked = choice;
        break;
      }
    }
    out.push(picked[1].shift());
    last = picked[0];
  }
  return out;
}

/**
 * @param players [{ id, photos: [photoId] }]
 * @param settings normalized settings (`rounds`, `fair`)
 * @returns [{ owner, photo }] in play order
 */
export function buildPlan(players, settings, rng) {
  const byOwner = new Map(players.filter((p) => p.photos.length).map((p) => [p.id, p.photos]));
  const all = [...byOwner.entries()].flatMap(([owner, photos]) => photos.map((photo) => ({ owner, photo })));
  const count = settings.rounds ? Math.min(settings.rounds, all.length) : all.length;
  const chosen = count < all.length && settings.fair ? pickFair(byOwner, count, rng) : shuffle(all, rng).slice(0, count);
  return arrange(shuffle(chosen, rng), rng);
}
