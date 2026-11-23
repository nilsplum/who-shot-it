/**
 * The countdown animations' screen: the app's own first round (round.js), and on Play this
 * frame's 3-2-1 over it, ending on the round's photo: the app's own (now.js) or one of the
 * four ideas (lens.js, timer.js, leader.js, pulse.js).
 *
 * Mechanisms: a countdown lays its cover over the round in the same task as the paint, so
 * no frame shows the photo early; its clock is stage.js's.
 *
 * Invariant: until the page's Play (`play`), and always with Reduce Motion, the round simply
 * stays, as in the app with Reduce Motion: what every countdown ends on.
 */
import { options, play } from '/kit/screen.js';
import { leader } from './leader.js';
import { lens } from './lens.js';
import { now } from './now.js';
import { pulse } from './pulse.js';
import { paintRound } from './round.js';
import { timer } from './timer.js';

const PLAYS = { now, lens, timer, leader, pulse };

const screen = paintRound(document.getElementById('app'));
const countdown = PLAYS[options.frame];
if (play && countdown) countdown(screen);
