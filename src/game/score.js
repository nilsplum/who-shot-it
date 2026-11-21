/**
 * Points for one answer.
 *
 * Mechanisms: part of the pure game logic; `rules.js` calls `pointsFor` for every player
 * when a round is revealed.
 *
 * Invariants: a right answer earns SCORING.min..max, falling linearly with the answer
 * time ("Speed counts") or SCORING.fixed ("Fixed"). With an unlimited timer, speed is
 * measured against TIMING.untimedReferenceMs. The streak bonus adds streakStep for each
 * right answer in a row beyond the first, capped at streakMax. Wrong or no answer: 0.
 */

import { SCORING, TIMING } from '../../web/shared/config.js';
import { answerTimeMs } from './state.js';

/**
 * @param correct whether the pick was the photo's owner
 * @param ms answer time in milliseconds
 * @param streak right answers in a row including this one
 */
export function pointsFor({ correct, ms, streak }, settings) {
  if (!correct) return 0;
  const total = answerTimeMs(settings, TIMING.untimedReferenceMs);
  const t = Math.max(0, Math.min(total, ms));
  const base = settings.points === 'fixed'
    ? SCORING.fixed
    : Math.round(SCORING.min + (SCORING.max - SCORING.min) * (1 - t / total));
  const bonus = settings.streak && streak > 1 ? Math.min(SCORING.streakMax, (streak - 1) * SCORING.streakStep) : 0;
  return base + bonus;
}
