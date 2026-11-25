/**
 * The bubble draft's screen: the app's lobby as a ready player sees it while the group
 * waits for Mia (lobby.js), and over its photo area the frame's bubble (soap.js, comic.js,
 * gummy.js) teasing her.
 *
 * Mechanisms: the layer over the photo area lets every tap through (`pointer-events-none`),
 * as the app's would. The bubbles' text is measured to fit, so the screen waits for the
 * display font first. Until the page's Play, and always with Reduce Motion, the final
 * picture shows and nothing moves; Play plays the frame's story, its endless moves included.
 * (In the app every move would also carry `motion-reduce:animate-none`; here Reduce Motion
 * simply never starts them.)
 * "Line" picks the line, or shows the three one after another (the final picture then
 * shows the last one, as a long wait ends on it); "Name" gives Mia a 16-letter name to try
 * the longest case.
 */
import { options, play } from '/kit/screen.js';
import * as comic from './comic.js';
import * as gummy from './gummy.js';
import { paintLobby } from './lobby.js';
import * as soap from './soap.js';
import { LINES } from './stage.js';

const BUBBLES = { soap, comic, gummy };

const name = options.name || 'Mia';
const { area, last, others } = paintLobby(document.getElementById('app'), name);
const order = !options.line || options.line === 'all' ? [0, 1, 2] : [Number(options.line) - 1];
const lines = order.map((i) => LINES[i].replaceAll('{name}', name));

await document.fonts.load('800 20px "Bricolage Grotesque"');
area.classList.add('relative');
const layer = document.createElement('div');
layer.className = 'pointer-events-none absolute inset-0 z-10';
area.append(layer);

const bubble = BUBBLES[options.frame] || soap;
const scene = { width: layer.clientWidth, height: layer.clientHeight, last, others, lines, text: play ? lines[0] : lines.at(-1) };
bubble.paint(layer, scene);
if (play) await bubble.play(layer, scene);
