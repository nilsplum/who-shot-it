/**
 * Soap bubbles: the line floats inside one big soap bubble, and small soap bubbles with the
 * player's name rise past it and pop, one after another, for as long as the group waits.
 *
 * The look: a round bubble, dark and glassy inside (so the white text reads over any
 * photo), its skin's colours swirling along its rim in two films that turn against each
 * other at different speeds (cyan, violet, pink, yellow, teal: the player colours), a thin
 * bright edge, a crescent of light at its top left and a small glint at its bottom right.
 * The text is white and fat, with a pink and a cyan fringe at its edges, as light splits on
 * a bubble's skin, and a soft dark glow behind it.
 *
 * The story: the big bubble is blown, from a speck to its size with the wobble of a bubble
 * leaving the wand; then it drifts and wobbles for good, its films turning, the text inside
 * swaying a little in 3D, so the bulging letters bend with it. The small bubbles are born
 * one after another and keep rising past it on both sides (some in front of it, some behind),
 * swaying, each popping at the top with a ring of light and coming again from the bottom.
 * A new line condenses inside the big bubble as it gives a little shiver.
 *
 * Invariants: no two of its endless moves share a period (3.4 s, 5.2 s, 7.6 s, 13 s, 19 s,
 * the small bubbles' own), so the picture never repeats exactly; the films turn as whole layers
 * and their colours never change, so nothing is ever repainted.
 */
import { esc } from '/js/ui.js';
import { wait } from '/kit/screen.js';
import { bulgeHtml, fitCircle } from './bulge.js';
import { nextLines, replay, shortName } from './stage.js';

/**
 * The small bubbles: their lane (a share of the width), how long one rise takes (s), how
 * far into its rise each is when the story starts (a share), how far it sways (px), whether
 * it passes in front of the big bubble, where it rests in the final picture (a share of the
 * height from the middle) and its size (a share of a small bubble's size for this name).
 */
const MINIS = [
  { x: 0.1, dur: 7.2, at: 0.62, sway: 8, front: true, rest: -0.3, size: 1 },
  { x: 0.9, dur: 6.4, at: 0.2, sway: 10, front: true, rest: 0.32, size: 0.92 },
  { x: 0.17, dur: 8.6, at: 0.08, sway: 6, front: false, rest: 0.38, size: 0.8 },
  { x: 0.83, dur: 7.8, at: 0.46, sway: 7, front: false, rest: -0.36, size: 0.84 },
  { x: 0.5, dur: 9.6, at: 0.3, sway: 12, front: false, rest: 0.47, size: 0.72 },
];

/** A soap bubble's inside: its two films, the content, its light on top. */
const bubble = (content, films = 2) => `<div class="soap size-full">
  <i class="soap-film in-data-live:animate-soap-swirl"></i>${films > 1 ? '<i class="soap-film-2 in-data-live:animate-soap-swirl-back"></i>' : ''}
  <div class="absolute inset-0 grid place-items-center">${content}</div>
  <i class="soap-shine"></i>
</div>`;

/** One small bubble with the name: rising (`--from` to `--to`), swaying, born once, living and popping each rise. */
function mini(spec, i, { width, height, name, d }) {
  const size = d * spec.size;
  const left = Math.min(Math.max(spec.x * width - size / 2, -size * 0.12), width - size * 0.88);
  const timing = `--dur:${spec.dur}s;--delay:${(-spec.at * spec.dur).toFixed(2)}s;--sway:${spec.sway}px;--sway-dur:${(2.3 + i * 0.41).toFixed(2)}s`;
  return `<div class="absolute in-data-live:animate-soap-rise" style="left:${left.toFixed(1)}px;top:${(height / 2 - size / 2).toFixed(1)}px;width:${size.toFixed(1)}px;height:${size.toFixed(1)}px;translate:0 ${(spec.rest * height).toFixed(1)}px;--from:${(height * 0.62).toFixed(1)}px;--to:${(-height * 0.64).toFixed(1)}px;${timing}">
    <div class="size-full in-data-live:animate-soap-sway">
      <div class="relative size-full in-data-playing:not-data-go:invisible data-go:animate-soap-born" data-mini>
        <div class="size-full in-data-live:animate-soap-life">${bubble(`<div class="soap-text w-max text-center leading-none" data-text>${bulgeHtml(name, { max: 11, across: [0.86, 1.16] })}</div>`, 1)}</div>
        <i class="soap-ring in-data-live:animate-soap-ring"></i>
      </div>
    </div>
  </div>`;
}

/** Paints the final picture into `layer` (`scene`: its size, the last player, the line to show). */
export function paint(layer, { width, height, last, text }) {
  const D = Math.min(width * 0.76, height * 0.76);
  const name = shortName(last.name);
  const d = Math.min(84, Math.max(48, 28 + [...new Intl.Segmenter().segment(name)].length * 5.2));
  const minis = MINIS.map((spec, i) => ({ spec, html: mini(spec, i, { width, height, name, d }) }));
  const main = `<div class="absolute" style="left:${(width / 2 - D / 2).toFixed(1)}px;top:${(height * 0.47 - D / 2).toFixed(1)}px;width:${D.toFixed(1)}px;height:${D.toFixed(1)}px">
    <div class="size-full in-data-live:animate-soap-drift">
      <div class="size-full in-data-playing:not-data-go:invisible data-go:animate-soap-blow" data-main>
        <div class="size-full data-pulse:animate-soap-shiver" data-pulse-target>
          <div class="size-full in-data-live:animate-soap-wobble">${bubble(`<div class="data-pop:animate-soap-condense" data-pop-target><div class="soap-text w-max text-center leading-none in-data-live:animate-soap-sway-text" data-text data-line>${bulgeHtml(text, { max: 11 })}</div></div>`)}</div>
        </div>
      </div>
    </div>
  </div>`;
  layer.innerHTML = `<div class="absolute inset-0" data-scene>
    ${minis.filter((m) => !m.spec.front).map((m) => m.html).join('')}${main}${minis.filter((m) => m.spec.front).map((m) => m.html).join('')}
    <p class="sr-only" role="status">${esc(text)}</p>
  </div>`;
  fitCircle(layer.querySelector('[data-line]'), D * 0.9, 38);
  for (const el of layer.querySelectorAll('[data-mini] [data-text]')) fitCircle(el, el.closest('[data-mini]').offsetWidth * 0.86, 30);
}

/** Plays the story over the final picture just painted; `lines` are the lines to show one after another. */
export async function play(layer, { lines }) {
  const scene = layer.querySelector('[data-scene]');
  scene.setAttribute('data-playing', '');
  await wait(250);
  scene.querySelector('[data-main]').setAttribute('data-go', '');
  scene.setAttribute('data-live', '');
  await wait(850);
  for (const el of scene.querySelectorAll('[data-mini]')) {
    el.setAttribute('data-go', '');
    await wait(230);
  }
  const size = scene.querySelector('[data-main]').offsetWidth;
  await nextLines(scene, lines, (text) => {
    const line = scene.querySelector('[data-line]');
    line.innerHTML = bulgeHtml(text, { max: 11 });
    fitCircle(line, size * 0.9, 38);
    scene.querySelector('[role="status"]').textContent = text;
    replay(scene.querySelector('[data-pop-target]'), 'data-pop');
    replay(scene.querySelector('[data-pulse-target]'), 'data-pulse');
  });
}
