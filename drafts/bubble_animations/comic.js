/**
 * Comic chorus: the line in a pop-art speech bubble of the last player's own colour, and
 * the others' small speech bubbles shouting the player's name, one after another, as a
 * table of friends would.
 *
 * The look: a soft, hand-drawn speech bubble (smooth, slightly uneven curves, no spikes),
 * its fill the last player's colour from light at the top to deep at the bottom, halftone
 * dots shading its lower right like printed comics, a gleam at its top left, a thick dark
 * outline and a hard dark shadow offset to the bottom right (its thickness), its tail
 * pointing up to the players' row. Behind it, rays of light turn slowly. The text is white
 * comic lettering: very fat, outlined in the dark blue and standing out with a short dark
 * extrusion. The small bubbles are each in the colour of the friend who shouts, their tails
 * pointing off the screen to where that friend sits.
 *
 * The story: the bubble slams onto the screen (from big and turned, a little overshoot, set)
 * with its rays; then it rocks gently in 3D, so the bulging letters bend with it, and every
 * few seconds it gives one springy bounce, as if someone tapped it. The small bubbles pop out
 * of their tails in turn (a little too big, settle), wiggle while they shout and vanish
 * again, round and round. A new line slams in again.
 *
 * Invariants: the big bubble keeps one size for every line it shows (the largest), so the
 * small ones never jump; the rays turn as one layer and nothing is ever repainted.
 */
import { colourOf, esc } from '/js/ui.js';
import { wait } from '/kit/screen.js';
import { bulgeHtml, fitBox } from './bulge.js';
import { nextLines, replay, shortName } from './stage.js';

/**
 * The chorus: which friend shouts (one of the others), what (`{name}` is the last player),
 * where the bubble sits next to the big one, how it is turned (deg) and when it first
 * shouts (s, in a cycle of 3.9 s, so a new one comes every 1.3 s).
 */
const CHORUS = [
  { who: 0, text: '{name}?', place: 'top-right', tilt: 7, delay: 0 },
  { who: 1, text: '{name}!!', place: 'bottom-left', tilt: -8, delay: 1.3 },
  { who: 2, text: '{name}…', place: 'bottom-right', tilt: 5, delay: 2.6 },
];

/** A comic tail: its fill and its outline (the outline leaves the base open, where it joins its bubble). */
const TAIL = 'M7 28 C 10 18, 8 9, 1 1 C 13 6, 22 15, 28 28';
const tail = (where, fill) => `<svg class="pointer-events-none absolute h-7 w-8.5 ${where}" viewBox="0 0 34 28" aria-hidden="true"><path class="${fill}" d="${TAIL} Z"/><path class="comic-tail-line" d="${TAIL}"/></svg>`;

/** Where each small bubble's tail is and which way it points: up and right, down and left, down and right. */
const TAILS = {
  'top-right': tail('-top-6.25 right-[18%] -scale-x-100', 'comic-tail-light'),
  'bottom-left': tail('-bottom-6.25 left-[18%] -scale-y-100', 'comic-tail-solid'),
  'bottom-right': tail('-bottom-6.25 right-[18%] -scale-100', 'comic-tail-solid'),
};
/** Each small bubble pops out of its tail. */
const ORIGINS = { 'top-right': '80% 0%', 'bottom-left': '20% 100%', 'bottom-right': '80% 100%' };

const mainText = (text) => bulgeHtml(text, { max: 13 });
const miniText = (text) => bulgeHtml(text, { max: 13, across: [0.86, 1.16] });

/** Paints the final picture into `layer` (`scene`: its size, the players, the lines and the line to show). */
export function paint(layer, { width, height, last, others, lines, text }) {
  const shouts = CHORUS.map((s) => ({ ...s, friend: others[s.who], words: s.text.replaceAll('{name}', shortName(last.name)) }));
  layer.innerHTML = `<div class="absolute inset-0" data-scene>
    <div class="absolute top-[46%] left-1/2 -translate-1/2" data-anchor>
      <div class="in-data-live:animate-comic-rock">
        <div class="in-data-playing:not-data-go:invisible data-go:animate-comic-slam" data-main>
          <div class="relative origin-bottom in-data-live:animate-comic-boing">
            <i class="comic-rays pointer-events-none absolute -inset-[38%] in-data-live:animate-comic-rays"></i>
            <div class="comic grid place-items-center px-5 py-4" style="--player:${colourOf(last.avatar)}" data-box>
              <i class="comic-dots"></i><i class="comic-shine"></i>
              ${tail('-top-6.25 left-[30%]', 'comic-tail-light')}
              <div class="comic-text relative w-max text-center" data-text>${mainText(text)}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
    ${shouts.map((s) => `<div class="absolute" style="--tilt:${s.tilt}deg;--delay:${s.delay}s" data-shout="${s.place}">
      <div class="in-data-playing:not-data-go:invisible" data-mini>
        <div class="in-data-live:animate-comic-shout" style="transform-origin:${ORIGINS[s.place]}">
          <div class="rotate-(--tilt) in-data-live:animate-comic-wiggle">
            <div class="comic-flat px-3.5 py-2" style="--player:${colourOf(s.friend.avatar)}">${TAILS[s.place]}<div class="comic-text relative w-max text-center" data-text>${miniText(s.words)}</div></div>
          </div>
        </div>
      </div>
    </div>`).join('')}
    <p class="sr-only" role="status">${esc(text)}</p>
  </div>`;
  const box = layer.querySelector('[data-box]');
  const line = box.querySelector('[data-text]');
  // One size for every line it will show: each fitted, the largest kept.
  let w = 0;
  let h = 0;
  for (const each of lines) {
    line.innerHTML = mainText(each);
    fitBox(line, width * 0.8 - 40, height * 0.36, 32);
    w = Math.max(w, line.offsetWidth);
    h = Math.max(h, line.offsetHeight);
  }
  line.innerHTML = mainText(text);
  fitBox(line, width * 0.8 - 40, height * 0.36, 32);
  box.style.width = `${w + 40}px`;
  box.style.height = `${h + 32}px`;
  for (const el of layer.querySelectorAll('[data-shout] [data-text]')) fitBox(el, width * 0.4, 48, 19);
  place(layer, width, height);
}

/**
 * Lays the small bubbles around the big one: above its right end, below its left end, and
 * below its right end, lower than the left one; never off the screen, and the two below
 * never on top of each other: when they would meet, they move apart to the screen's edges,
 * and only if that is not enough does the right one move down.
 */
function place(layer, width, height) {
  const origin = layer.getBoundingClientRect();
  const r = layer.querySelector('[data-box]').getBoundingClientRect();
  const main = { left: r.left - origin.left, right: r.right - origin.left, top: r.top - origin.top, bottom: r.bottom - origin.top };
  const el = (where) => layer.querySelector(`[data-shout="${where}"]`);
  const put = (node, x, y) => {
    const left = Math.min(Math.max(x, 6), width - node.offsetWidth - 6);
    const top = Math.min(Math.max(y, -8), height - node.offsetHeight);
    node.style.left = `${left}px`;
    node.style.top = `${top}px`;
    return { left, top, right: left + node.offsetWidth, bottom: top + node.offsetHeight };
  };
  const above = el('top-right');
  put(above, main.right - above.offsetWidth * 0.62, main.top - above.offsetHeight - 20);
  const left = el('bottom-left');
  const right = el('bottom-right');
  const y = main.bottom + 18;
  const x = main.right - right.offsetWidth * 0.8;
  const lower = put(left, main.left - left.offsetWidth * 0.2, y);
  if (Math.min(Math.max(x, 6), width - right.offsetWidth - 6) >= lower.right + 8) {
    put(right, x, y + right.offsetHeight * 0.6);
    return;
  }
  const apart = put(left, 0, y);
  const fits = width - right.offsetWidth - 6 >= apart.right + 8;
  put(right, width, fits ? y + right.offsetHeight * 0.45 : apart.bottom - right.offsetHeight * 0.1);
}

/** Plays the story over the final picture just painted; `lines` are the lines to show one after another. */
export async function play(layer, { lines }) {
  const scene = layer.querySelector('[data-scene]');
  const main = scene.querySelector('[data-main]');
  scene.setAttribute('data-playing', '');
  await wait(250);
  main.setAttribute('data-go', '');
  await wait(560);
  scene.setAttribute('data-live', '');
  for (const el of scene.querySelectorAll('[data-mini]')) el.setAttribute('data-go', '');
  const line = scene.querySelector('[data-box] [data-text]');
  const box = scene.querySelector('[data-box]');
  await nextLines(scene, lines, (text) => {
    line.innerHTML = mainText(text);
    fitBox(line, box.offsetWidth - 40, box.offsetHeight - 32, 32);
    scene.querySelector('[role="status"]').textContent = text;
    replay(main, 'data-go');
  });
}
