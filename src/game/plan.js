/**
 * Builds a game's round plan: which photo comes up in which round.
 *
 * Mechanisms: part of the pure game logic; `rules.js` calls `buildPlan` once when the
 * countdown ends, with every ready player's uploaded photos.
 *
 * Invariants:
 * - Rounds = all photos, or the "Rounds" setting if that is smaller.
 * - When not every photo is played, "Photo mix: Balanced" gives each player between 60% and
 *   140% of an equal share (LIMITS.balancedSpread), drawn at random, so counting whose
 *   photos were already shown never tells whose comes next; "Random" draws from all photos
 *   alike, so one player may come up a lot and another hardly.
 * - The order avoids the same owner twice in a row whenever the photos allow it, so a
 *   streak of one person's photos never gives the answer away.
 */

import { LIMITS } from '../../web/shared/config.js';
import { shuffle } from '../../web/shared/random.js';

/**
 * Takes `count` photos for "Balanced": every owner first gets the lower bound of the range
 * (what their photos allow), then the rest goes out one photo at a time to a random owner
 * still under the upper bound. Only when nobody under it has photos left (some brought only
 * a few) do the others go beyond it, so the rounds are always filled.
 */
function pickBalanced(byOwner, count, rng) {
  const owners = shuffle([...byOwner.entries()], rng).map(([owner, photos]) => ({ owner, photos: shuffle(photos, rng), take: 0 }));
  const share = count / owners.length;
  const low = Math.round(share * (1 - LIMITS.balancedSpread));
  const high = Math.round(share * (1 + LIMITS.balancedSpread));
  let left = count;
  // With more players than rounds the lower bounds may add up to more than the rounds; the
  // shuffled order then decides who gets one.
  for (const o of owners) {
    o.take = Math.min(low, o.photos.length, left);
    left -= o.take;
  }
  for (const cap of [high, Infinity]) {
    for (let open = owners.filter((o) => o.take < Math.min(cap, o.photos.length)); left > 0 && open.length;) {
      const o = open[Math.floor(rng() * open.length)];
      o.take += 1;
      left -= 1;
      if (o.take >= Math.min(cap, o.photos.length)) open = open.filter((x) => x !== o);
    }
  }
  return owners.flatMap((o) => o.photos.slice(0, o.take).map((photo) => ({ owner: o.owner, photo })));
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
  const chosen = count < all.length && settings.fair ? pickBalanced(byOwner, count, rng) : shuffle(all, rng).slice(0, count);
  return arrange(shuffle(chosen, rng), rng);
}
