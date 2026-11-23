/**
 * The results animations' screen: an end screen with stand-in players, and the podium
 * animation of this frame playing over it.
 *
 * Mechanisms: "Supercharge, in the app" paints the app's own end screen
 * (web/js/views/end.js, through the app's painter web/js/render.js) and plays the app's own
 * reveal over it (web/js/podium.js, with the kit's `buzz`), so it is exactly what the app
 * shows. The first five paint the end screen as it was when they were made
 * (end_before.js) and hand it to their animation (one of PLAYS) as a scene (stage.js).
 * Until the page's Play (`play`), and always with Reduce Motion, the final screen simply
 * stays, as in the app with Reduce Motion.
 *
 * Invariants: the screen is never changed by hand before an animation starts: what is left
 * at the end is the end screen it was painted with.
 */
import { REACTIONS } from '/shared/config.js';
import { playPodium } from '/js/podium.js';
import { createPainter } from '/js/render.js';
import { quietScrollbars } from '/js/ui.js';
import { endScreen } from '/js/views/end.js';
import { buzz, options, play } from '/kit/screen.js';
import { endScreen as endScreenBefore } from './end_before.js';
import { jackpot } from './jackpot.js';
import { photofinish } from './photofinish.js';
import { standings } from './players.js';
import { scene } from './stage.js';
import { spotlight } from './spotlight.js';
import { supercharge } from './supercharge.js';
import { tricky } from './tricky.js';

const PLAYS = { spotlight, jackpot, supercharge, tricky, photofinish };

const view = { phase: 'end', code: 'DRFT', final: standings(Number(options.players) || 6) };
const root = document.getElementById('app');
const inApp = options.frame === 'supercharge_app';
createPainter(root)((inApp ? endScreen : endScreenBefore)({ view }, REACTIONS));
quietScrollbars();

const story = PLAYS[options.frame];
if (play && inApp) playPodium(root.firstElementChild, buzz);
else if (play && story) story(scene(root.firstElementChild, view.final));
