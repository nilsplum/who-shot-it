/**
 * Points for one answer.
 *
 * Mechanisms: part of the pure game logic; `rules.js` calls `pointsFor` for every player
 * when a round is revealed.
 *
 * Invariants: a right answer earns SCORING.min..max, falling linearly with the answer
 * time ("Speed bonus") or SCORING.fixed ("Fixed"). With an unlimited timer, speed is
 * measured against TIMING.untimedReferenceMs. The streak bonus (`streakBonus`) adds
 * streakStep for each right answer in a row beyond the first, capped at streakMax. On one's
 * own photo the total, bonus included, is scaled by the "Own photo" setting (a share in
 * percent): the owner always knows it, and with "Photo mix: Balanced" some players have more
 * photos in the game than others. Wrong or no answer: 0.
 */

import { SCORING, TIMING, streakBonus } from '../../web/shared/config.js';
import { answerTimeMs } from './state.js';

/**
 * @param correct whether the pick was the photo's owner
 * @param ms answer time in milliseconds
 * @param streak right answers in a row including this one
 * @param own whether the photo is the answering player's own
 */
export function pointsFor({ correct, ms, streak, own = false }, settings) {
  if (!correct) return 0;
  const total = answerTimeMs(settings, TIMING.untimedReferenceMs);
  const t = Math.max(0, Math.min(total, ms));
  const base = settings.points === 'fixed'
    ? SCORING.fixed
    : Math.round(SCORING.min + (SCORING.max - SCORING.min) * (1 - t / total));
  const bonus = settings.streak ? streakBonus(streak) : 0;
  return own ? Math.round(((base + bonus) * settings.own) / 100) : base + bonus;
}
