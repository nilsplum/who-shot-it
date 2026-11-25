/**
 * The last one and the bubble that teases them (web/js/nudge.js): who the group waits for,
 * the bubble's rhythm (5 s on screen, leaving, back 15 s after it began), the order of its
 * lines that every phone shares and that goes on after an interruption, its small bubbles,
 * the bulge of its letters, and its lines' manners.
 */
import { describe, expect, test } from 'vitest';
import { NUDGE, NUDGE_CALLS, NUDGE_LINES, bulgeRows, lastToSayYes, nudgeAt, nudgeTrack, shortName, startsWith } from '../../web/js/nudge.js';

/** A lobby view as the room sends it, seen from `me`: `players` as [name, ready, connected?, photos?]. */
function lobby(players, { me = 'Ann', games = 0, phase = 'lobby', onResults = false } = {}) {
  return {
    code: 'ABCD',
    games,
    phase,
    me: { id: me, onResults },
    players: players.map(([name, ready, connected = true, photoCount = ready ? 4 : 0], i) => ({
      id: name, name, avatar: ['🦊', '🐼', '🐸', '🦄', '🐙'][i], ready, connected, sending: false, photoCount,
    })),
  };
}

/** The bubble on `view`'s phone at `ms`, after its wait was tracked from 0. */
const at = (view, ms, track = nudgeTrack(null, view, 0)) => nudgeAt(view, track, ms);

describe('the last one', () => {
  test('is the one player whose Yes would start the game', () => {
    expect(lastToSayYes(lobby([['Ann', true], ['Ben', false]]))).toMatchObject({ id: 'Ben' });
    expect(lastToSayYes(lobby([['Ann', true], ['Ben', false], ['Cleo', true]]))).toMatchObject({ id: 'Ben' });
    // Two still to say Yes, or nobody: no last one.
    expect(lastToSayYes(lobby([['Ann', true], ['Ben', false], ['Cleo', false]]))).toBeNull();
    expect(lastToSayYes(lobby([['Ann', true], ['Ben', true]]))).toBeNull();
    // Someone else is offline: the start waits for them too, so this Yes would not start it.
    expect(lastToSayYes(lobby([['Ann', true, false], ['Ben', false]]))).toBeNull();
    // The last one offline is still the last one.
    expect(lastToSayYes(lobby([['Ann', true], ['Ben', false, false]]))).toMatchObject({ id: 'Ben' });
    // Alone in the room, or out of the lobby: none.
    expect(lastToSayYes(lobby([['Ann', false]]))).toBeNull();
    expect(lastToSayYes(lobby([['Ann', true], ['Ben', false]], { phase: 'countdown' }))).toBeNull();
  });
});

test("the last one's Yes starts the game (its START), with photos, or without when someone else has some", () => {
  const view = lobby([['Ann', true], ['Ben', false]], { me: 'Ben' });
  expect(startsWith(view, true)).toBe(true);
  expect(startsWith(view, false)).toBe(true);
  // Nobody else has photos: only a Yes with photos would start it.
  const empty = lobby([['Ann', true, true, 0], ['Ben', false]], { me: 'Ben' });
  expect(startsWith(empty, true)).toBe(true);
  expect(startsWith(empty, false)).toBe(false);
  // Not on the others' phones, and not while two are still to say Yes.
  expect(startsWith(lobby([['Ann', true], ['Ben', false]]), true)).toBe(false);
  expect(startsWith(lobby([['Ann', false], ['Ben', false]], { me: 'Ben' }), true)).toBe(false);
});

describe('the bubble', () => {
  const waiting = lobby([['Ann', true], ['Ben', true], ['Cleo', false]]);

  test('comes at once, stays 5 s, leaves, and comes back 15 s after it began', () => {
    expect(at(waiting, 0)).toMatchObject({ name: 'Cleo', leaving: false });
    expect(at(waiting, NUDGE.showMs - 1)).toMatchObject({ leaving: false });
    expect(at(waiting, NUDGE.showMs)).toMatchObject({ leaving: true });
    expect(at(waiting, NUDGE.showMs + NUDGE.leaveMs)).toBeNull();
    expect(at(waiting, NUDGE.everyMs - 1)).toBeNull();
    expect(at(waiting, NUDGE.everyMs)).toMatchObject({ leaving: false });
    // Each appearance another line, every line about Cleo.
    expect(at(waiting, NUDGE.everyMs).line).not.toBe(at(waiting, 0).line);
    expect(at(waiting, 0).line).toContain('Cleo');
  });

  test("is never on the last one's own phone, on the results, out of the lobby, or for a last one who is offline", () => {
    expect(at(lobby([['Ann', true], ['Cleo', false]], { me: 'Cleo' }), 0)).toBeNull();
    expect(at(lobby([['Ann', true], ['Cleo', false]], { onResults: true }), 0)).toBeNull();
    expect(at(lobby([['Ann', true], ['Cleo', false]], { phase: 'countdown' }), 0)).toBeNull();
    expect(at(lobby([['Ann', true], ['Cleo', false, false]]), 0)).toBeNull();
  });

  test('every phone shows the same line, side and small bubbles; the next game another order', () => {
    const first = at(waiting, 0);
    // Ben's phone: the same appearance (its own player is one of the small bubbles' callers either way).
    expect(at({ ...waiting, me: { id: 'Ben', onResults: false } }, 0)).toEqual(first);
    const order = (games) => Array.from({ length: NUDGE_LINES.length }, (_, n) => at({ ...waiting, games }, n * NUDGE.everyMs).line);
    expect(new Set(order(0)).size).toBe(NUDGE_LINES.length);
    expect(order(1)).not.toEqual(order(0));
    expect([-1, 1]).toContain(first.from);
  });

  test('a small bubble per other player, three at most, each calling the name by its first part when it is long', () => {
    expect(at(lobby([['Ann', true], ['Cleo', false]]), 0).calls).toEqual([{ text: 'Cleo?', avatar: '🦊' }]);
    expect(at(waiting, 0).calls.map((c) => c.text)).toEqual(['Cleo?', 'Cleo!!']);
    const big = lobby([['Ann', true], ['Ben', true], ['Dan', true], ['Eve', true], ['Maximilian-Alexa', false]]);
    expect(at(big, 0).calls.map((c) => c.text)).toEqual(NUDGE_CALLS.map((c) => c.replace('{name}', 'Maximilian')));
    expect(at(big, 0).line).toContain('Maximilian-Alexa');
  });

  test('a wait that stops and comes back for the same player goes on with its order', () => {
    let track = nudgeTrack(null, waiting, 0);
    const lines = [at(waiting, 0, track).line, at(waiting, NUDGE.everyMs, track).line];
    // While the same wait goes on, its memory stays as it is.
    expect(nudgeTrack(track, waiting, 20000)).toBe(track);
    // Ben taps Change at 20 s (two appearances began): no wait; he says Yes again at 30 s.
    const two = lobby([['Ann', true], ['Ben', false], ['Cleo', false]]);
    track = nudgeTrack(track, two, 20000);
    expect(nudgeAt(two, track, 20000)).toBeNull();
    track = nudgeTrack(track, waiting, 30000);
    const third = nudgeAt(waiting, track, 30000).line;
    expect(lines).not.toContain(third);
    // The order is the one the wait had: its third line.
    expect(third).toBe(at(waiting, 2 * NUDGE.everyMs).line);
  });
});

describe('its letters', () => {
  const text = (row) => row.map((c) => c.ch).join('');

  test('rows of at most 13 characters, even, a long name broken after its hyphen', () => {
    const rows = bulgeRows('Maximilian-Alexa is negotiating with the camera roll').map(text);
    expect(rows.every((r) => r.length <= 13)).toBe(true);
    expect(rows[0]).toBe('Maximilian-');
    expect(rows.join(' ').replace('- ', '-')).toBe('Maximilian-Alexa is negotiating with the camera roll');
    // Not one short word left alone at the end: the rows are as even as they can be.
    const lengths = rows.map((r) => r.length);
    expect(Math.max(...lengths) - Math.min(...lengths)).toBeLessThanOrEqual(6);
  });

  test('an emoji and an accented letter stay whole; an emoji is marked to keep its colours', () => {
    const chars = bulgeRows('What is Zoë hiding? 👀').flat();
    expect(chars.map((c) => c.ch)).toContain('ë');
    expect(chars.filter((c) => c.emoji).map((c) => c.ch)).toEqual(['👀']);
  });

  test('bulge like a ball: each row biggest in its middle, the same at both ends, the middle row biggest', () => {
    const rows = bulgeRows('Breaking news: Cleo is still choosing');
    for (const row of rows) {
      const k = row.map((c) => c.k);
      expect(k[0]).toBe(k[k.length - 1]);
      expect(Math.max(...k)).toBe(k[Math.floor(k.length / 2)]);
    }
    // The rows in the middle are bigger than the first and the last (a row's own peak also
    // depends on its length, so only the outer rows are compared).
    const peak = rows.map((row) => Math.max(...row.map((c) => c.k)));
    expect(rows.length).toBeGreaterThanOrEqual(3);
    expect(peak[0]).toBeLessThan(Math.max(...peak));
    expect(peak.at(-1)).toBeLessThan(Math.max(...peak));
    // A small bubble's call bulges less.
    const call = bulgeRows('Cleo?', { call: true })[0].map((c) => c.k);
    expect(Math.max(...call) / Math.min(...call)).toBeLessThan(1.3);
  });
});

test('a long name is called by its first part when that is a real name', () => {
  expect(shortName('Maximilian-Alexa')).toBe('Maximilian');
  expect(shortName('Anna Lena Sophie')).toBe('Anna');
  expect(shortName('Cleo')).toBe('Cleo');
  expect(shortName('Bartholomew')).toBe('Bartholomew');
  expect(shortName('Al-Rashid-Hassan')).toBe('Al-Rashid-Hassan');
});

test('every line names the player once and talks about them, never to them', () => {
  for (const line of [...NUDGE_LINES, ...NUDGE_CALLS]) expect(line.split('{name}')).toHaveLength(2);
  for (const line of NUDGE_LINES) {
    expect(line, line).not.toMatch(/\{name\},|\byou\b|\byour\b/i);
    // No possessive of the name ("Chris's" breaks on names ending in s).
    expect(line, line).not.toMatch(/\{name\}['’]/);
  }
});
