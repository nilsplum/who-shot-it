/**
 * Gummy orbit: the line on a glossy jelly sweet, and glossy marbles with the player's name
 * circling it in 3D, like moons: in front of it below, behind it above.
 *
 * The look: a thick, rounded sweet in the last player's colour deepened with violet, lit
 * from the top left (a light core fading into a deep edge), with a wide gloss over its upper
 * half, a bright rim along its bottom, a darker underside showing its thickness and a soft
 * glow of its own colour on the page. The text is white with a hint of the sweet's colour,
 * very fat, pressed into it with a short dark edge below every letter. The marbles are small
 * glass spheres in the other players' colours, each with a highlight, the name on it.
 *
 * The story: the sweet drops in from above and lands like jelly (it squashes, springs up,
 * wobbles out); then it keeps wobbling softly and tilting in 3D, so its bulging letters bend
 * with it, and a glint sweeps over it now and then. The marbles pop out and circle it on a
 * tilted ring, slowly, growing as they pass in front and disappearing behind it. A new line
 * makes the sweet bounce once as the words change.
 *
 * Mechanisms: one 3D scene (`transform-3d`, a perspective) holds the sweet and the ring, so
 * the browser draws the marbles in front of it or behind it by their depth. The ring turns
 * (`gummy-orbit`) and every marble turns back by as much (`gummy-face`), around its own
 * middle (the point it sits on), so they keep facing the screen and their names stay upright.
 *
 * Invariants: the ring is always wider than the sweet (each marble passes the sweet's side
 * clear of it), so a marble never cuts through it; the sweet keeps one size for every line it
 * shows (the largest); only transforms move.
 */
import { colourOf, esc } from '/js/ui.js';
import { wait } from '/kit/screen.js';
import { bulgeHtml, fitBox, fitCircle } from './bulge.js';
import { nextLines, replay, shortName } from './stage.js';

/** How far the ring is tipped back (deg), where its marbles stand in the final picture (deg), and how far apart they are. */
const TILT = 72;
const REST = 34;
const SPREAD = [0, 120, 240];

const mainText = (text) => bulgeHtml(text, { max: 13 });

/** Paints the final picture into `layer` (`scene`: its size, the players, the lines and the line to show). */
export function paint(layer, { width, height, last, others, lines, text }) {
  const name = shortName(last.name);
  const d = Math.round(Math.min(72, Math.max(48, 26 + [...new Intl.Segmenter().segment(name)].length * 4.6)));
  // The widest the ring may be: a marble at its side (a little bigger and further out when
  // it comes forward) stays on the screen, inside the 16 px margin beside the photos. The
  // sweet is narrower than the ring by a marble and a gap on each side.
  const reach = width / 2 + 12 - d * 0.62;
  const room = Math.min(width * 0.74, 2 * (reach - d / 2 - 6));
  layer.innerHTML = `<div class="absolute inset-0" data-scene>
    <div class="absolute top-[44%] left-1/2 size-0 transform-3d perspective-[62rem]" data-stage>
      <div class="absolute top-0 left-0 -translate-1/2 transform-3d in-data-live:animate-gummy-tilt">
        <div class="origin-bottom in-data-playing:not-data-go:invisible data-go:animate-gummy-drop" data-main>
          <div class="origin-bottom data-pop:animate-gummy-boing" data-pop-target>
            <div class="origin-bottom in-data-live:animate-gummy-jelly">
              <div class="gummy grid place-items-center px-8 py-5" style="--player:${colourOf(last.avatar)}" data-box>
                <i class="gummy-gloss"></i><i class="gummy-glint in-data-live:animate-gummy-glint"></i>
                <div class="gummy-text relative w-max text-center" data-text>${mainText(text)}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="absolute top-0 left-0 size-0 transform-3d in-data-live:animate-gummy-orbit" data-ring></div>
    </div>
    <p class="sr-only" role="status">${esc(text)}</p>
  </div>`;
  const box = layer.querySelector('[data-box]');
  const line = box.querySelector('[data-text]');
  let w = 0;
  let h = 0;
  for (const each of lines) {
    line.innerHTML = mainText(each);
    fitBox(line, room - 64, height * 0.34, 32);
    w = Math.max(w, line.offsetWidth);
    h = Math.max(h, line.offsetHeight);
  }
  line.innerHTML = mainText(text);
  fitBox(line, room - 64, height * 0.34, 32);
  box.style.width = `${w + 64}px`;
  box.style.height = `${h + 40}px`;
  // The ring: wide enough that a marble passes the sweet's sides clear of it, low enough
  // that the ones in front pass below it and the ones behind are hidden by it.
  const R = (w + 64) / 2 + d / 2 + 6;
  const lean = R * Math.cos((TILT * Math.PI) / 180);
  const drop = Math.max(0, (h + 40) / 2 + d / 2 + 8 - lean);
  const ring = layer.querySelector('[data-ring]');
  ring.style.setProperty('--oy', `${drop.toFixed(1)}px`);
  ring.style.transform = `translateY(${drop.toFixed(1)}px) rotateX(${TILT}deg) rotateZ(${REST}deg)`;
  ring.innerHTML = SPREAD.map((a, i) => `<div class="absolute top-0 left-0 transform-3d" style="transform:rotateZ(${a}deg) translateX(${R.toFixed(1)}px) rotateZ(${-a}deg)">
    <div class="origin-top-left transform-3d in-data-live:animate-gummy-face" style="transform:rotateZ(${-REST}deg) rotateX(${-TILT}deg)">
      <div class="-translate-1/2">
        <div class="in-data-playing:not-data-go:invisible data-go:animate-gummy-moon-in" data-mini>
          <div class="marble grid place-items-center" style="--m:${colourOf(others[i].avatar)};width:${d}px;height:${d}px">
            <div class="marble-text relative w-max text-center" data-text>${bulgeHtml(name, { max: 11, across: [0.86, 1.16] })}</div>
          </div>
        </div>
      </div>
    </div>
  </div>`).join('');
  for (const el of ring.querySelectorAll('[data-text]')) fitCircle(el, d * 0.86, 20);
}

/** Plays the story over the final picture just painted; `lines` are the lines to show one after another. */
export async function play(layer, { lines }) {
  const scene = layer.querySelector('[data-scene]');
  scene.setAttribute('data-playing', '');
  await wait(250);
  scene.querySelector('[data-main]').setAttribute('data-go', '');
  await wait(700);
  scene.setAttribute('data-live', '');
  for (const el of scene.querySelectorAll('[data-mini]')) {
    el.setAttribute('data-go', '');
    await wait(160);
  }
  const box = scene.querySelector('[data-box]');
  const line = box.querySelector('[data-text]');
  await nextLines(scene, lines, (text) => {
    line.innerHTML = mainText(text);
    fitBox(line, box.offsetWidth - 64, box.offsetHeight - 40, 32);
    scene.querySelector('[role="status"]').textContent = text;
    replay(scene.querySelector('[data-pop-target]'), 'data-pop');
  });
}
