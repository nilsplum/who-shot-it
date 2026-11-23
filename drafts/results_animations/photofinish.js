/**
 * Photo finish: before the podium, everyone's final score races up at once, a bar per
 * player in join order, their numbers counting. Whoever reaches their score stops, the
 * lowest first, with a light tap. Third place stops with a bronze stamp, then the last two
 * climb on in slow motion, bar to bar, the taps speeding up and the edges darkening.
 * Second stops (a silver stamp, a thud). The winner's bar surges alone to the finish line:
 * a hit-stop, a white flash, the gold stamp, the fireworks. Then the race folds into the
 * podium: the three fly up to their places and the rest of the end screen fades in.
 *
 * Mechanisms: one number, the race's score, rises along a timeline of stages (everyone,
 * the last three, the last two, the winner alone); every bar shows the lesser of it and
 * its player's score, so the bars still racing are always level and nobody can tell who is
 * ahead until someone stops. The bars use the players' own colours (`colourOf`, like
 * their avatars). The podium waits invisible underneath until the fold.
 *
 * Invariants: the race shows only the final scores, never an invented history (no lead
 * changes that did not happen); the winner's bar ends exactly at the finish line.
 */
import { avatar, colourOf, esc } from '/js/ui.js';
import { colour, ring } from './fx.js';
import { CURVE, buzz, centre, finale, flash, freeze, light, reveal, shake, sparkle, tween, vignette, wait } from './stage.js';

/** The space for the score after each bar, in px. */
const LABEL = 58;

/** The race over the end screen's results: a lane per player (avatar, bar, score) and the finish line. */
function track(sc) {
  const box = sc.screen.querySelector('[data-part="results"]').getBoundingClientRect();
  const n = sc.players.length;
  const lane = Math.min(46, Math.floor((box.height - 48) / n) - 4);
  const size = lane >= 40 ? 'lg' : lane >= 32 ? 'md' : 'sm';
  const el = document.createElement('div');
  el.className = 'pf-track pointer-events-none fixed z-40 flex flex-col justify-center gap-1';
  el.style.cssText = `left:${box.left + 16}px;top:${box.top}px;width:${box.width - 32}px;height:${box.height}px`;
  el.innerHTML = `<p class="mb-2 text-center text-xs text-muted">Final scores</p>${sc.players.map((p) => `<div class="pf-lane flex items-center gap-2" style="height:${lane}px" data-id="${esc(p.id)}">${avatar(p, size)}<div class="pf-run relative h-full flex-1"><i class="pf-bar" style="--player:${colourOf(p.avatar)}"></i><b class="pf-score" data-score>0</b></div></div>`).join('')}<i class="pf-finish" style="right:${LABEL}px"></i>`;
  document.body.append(el);
  const width = el.querySelector('.pf-run').getBoundingClientRect().width - LABEL;
  const lanes = [...el.querySelectorAll('.pf-lane')].map((laneEl) => {
    const player = sc.players.find((p) => p.id === laneEl.dataset.id);
    return { el: laneEl, player, bar: laneEl.querySelector('.pf-bar'), score: laneEl.querySelector('[data-score]'), avatar: laneEl.firstElementChild, done: false };
  });
  return { el, lanes, width, max: sc.ranked[0].score };
}

/** A medal stamped onto a lane where its bar stopped: the place number in the place's colour, slammed down. */
function stamp(lane, place) {
  const at = centre(lane.score);
  const el = document.createElement('div');
  el.className = 'pf-stamp pointer-events-none fixed z-45 grid size-9 place-items-center rounded-full font-display text-xl font-extrabold text-navy';
  el.style.cssText = `left:${at.r.right + 4}px;top:${at.y - 18}px;background:var(--color-${place.tone})`;
  el.textContent = place.n;
  document.body.append(el);
  el.animate([{ scale: 3, rotate: '-25deg', opacity: 0 }, { scale: 0.9, rotate: '4deg', opacity: 1, offset: 0.7 }, { scale: 1, rotate: '0deg', opacity: 1 }], { duration: 320, easing: 'ease-in' });
  ring({ x: at.r.right + 22, y: at.y, from: 10, to: place.n === 1 ? 160 : 70, life: 0.5, width: 6, tint: colour(place.tone) });
  return el;
}

export async function photofinish(sc) {
  sc.podium.style.opacity = '0';
  const race = track(sc);
  const placeOf = (id) => sc.places.find((p) => p.player.id === id);
  const stamps = [];
  /** Where the race stands: every lane shows the lesser of it and its score; a lane that reaches its score stops. */
  const set = (score) => {
    for (const lane of race.lanes) {
      const value = Math.min(score, lane.player.score);
      lane.bar.style.width = `${Math.max(6, (value / race.max) * race.width)}px`;
      lane.score.style.left = `${Math.max(6, (value / race.max) * race.width) + 6}px`;
      lane.score.textContent = Math.round(value);
      if (!lane.done && score >= lane.player.score) {
        lane.done = true;
        const place = placeOf(lane.player.id);
        if (!place) {
          lane.el.setAttribute('data-out', '');
          buzz('tap');
        } else if (place.n !== 1) {
          lane.el.setAttribute('data-placed', '');
          stamps.push(stamp(lane, place));
          buzz(place.n === 3 ? 'yes' : 'land');
          if (place.n === 2) shake(sc.screen, 4);
        }
      }
    }
  };
  set(0);
  race.el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 400 });
  await wait(700);
  const s = sc.ranked.map((p) => p.score);
  const n = s.length;
  const run = (from, to, ms, curve) => tween(ms, (k) => set(from + (to - from) * k), curve);
  // Everyone, until three are left (or a good way up when there are only two or three).
  const start = n > 3 ? s[3] : s[n - 1] * (n === 3 ? 0.75 : 0.8);
  await run(0, start, n > 3 ? 2600 : 1700, CURVE.out);
  // Three left, then third place stops and gets its stamp.
  if (n >= 3) {
    await Promise.all([run(start, s[2], 1300), ticksWhile(1300, 260, 200)]);
    await wait(450);
  }
  // The last two, bar to bar, in slow motion.
  const dark = vignette();
  dark.to(0.6, 900);
  for (const lane of race.lanes.filter((l) => !l.done)) lane.el.setAttribute('data-close', '');
  const from = n >= 3 ? s[2] : start;
  await Promise.all([run(from, s[1], 2800, (k) => k), ticksWhile(2800, 230, 70)]);
  await wait(650);
  // The winner alone: a surge to the finish line.
  await Promise.all([run(s[1], s[0], Math.max(700, Math.min(1400, ((s[0] - s[1]) / s[0]) * 6000)), CURVE.in), ticksWhile(700, 90, 50)]);
  const winnerLane = race.lanes.find((l) => l.player.id === sc.ranked[0].id);
  await freeze(160);
  flash(0.95, 650);
  const finish = centre(winnerLane.score);
  stamps.push(stamp(winnerLane, sc.places.find((p) => p.n === 1)));
  winnerLane.el.setAttribute('data-won', '');
  sparkle({ x: finish.r.left, y: finish.y }, 'yellow', 80, 160);
  buzz('land');
  shake(sc.screen, 9);
  dark.to(0, 900);
  finale(sc, { x: finish.r.left, y: finish.y }, 2600);
  await wait(1300);
  // The race folds into the podium: the three lift out of their lanes, the race fades away,
  // the podium appears under them, and they fly up to their places (third first).
  const flyers = sc.places.map((place) => [place, lift(race.lanes.find((l) => l.player.id === place.player.id).avatar)]);
  for (const el of [race.el, ...stamps]) el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 350, fill: 'forwards' });
  await wait(250);
  sc.podium.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 400, fill: 'forwards' });
  for (const [place, flyer] of flyers) {
    fly(flyer, place).then(() => {
      reveal(place, place.n === 1 ? 1.35 : 1.15, 380);
      light(place);
    });
    await wait(160);
  }
}

/** Light taps for `ms`, one every `from` ms at first and `to` at the end: the race's pulse. */
async function ticksWhile(ms, from, to) {
  const start = performance.now();
  while (performance.now() - start < ms) {
    buzz('tap');
    const k = (performance.now() - start) / ms;
    await wait(from + (to - from) * k);
  }
}

/** A copy of a lane's avatar over it, on its own, so it stays when the race fades. */
function lift(avatarEl) {
  const a = avatarEl.getBoundingClientRect();
  const flyer = avatarEl.cloneNode(true);
  flyer.classList.add('fixed', 'z-60');
  flyer.style.left = `${a.left}px`;
  flyer.style.top = `${a.top}px`;
  flyer.style.margin = '0';
  document.body.append(flyer);
  return flyer;
}

/** A lifted avatar flies up to its place on the podium, growing to the podium's size, and is gone. */
async function fly(flyer, place) {
  const a = flyer.getBoundingClientRect();
  const to = centre(place.avatar);
  const dx = to.x - (a.left + a.width / 2);
  const dy = to.y - (a.top + a.height / 2);
  const grow = to.r.width / a.width;
  await tween(600, (k) => {
    const lift = 4 * 40 * k * (1 - k);
    flyer.style.transform = `translate(${dx * k}px, ${dy * k - lift}px) scale(${1 + (grow - 1) * k})`;
  }, CURVE.inOut);
  flyer.remove();
}
