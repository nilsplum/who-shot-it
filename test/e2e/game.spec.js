/**
 * Friends play a whole game on three phones (the real app UI, a fake photo library):
 * the terms, the "New game" step with a preset and the settings "?", joining by code, a
 * phone going offline (its red pill, removed by a guest), the host removing a player, the
 * photos dealt with "Play with these?" (ready at once on Yes), the bubble that teases the
 * one player the others still wait for (on their phones, not on hers, gone while two are
 * left), reload, the last player's Yes stamped START asking "Is everyone here?" on that
 * phone only ("No, wait" changes nothing, "Yes, start" starts), the start
 * behind an opaque 3-2-1, a flagged photo (hidden from the others, Cancel, then
 * Delete), five rounds with their reveals (played step by step, the verdict felt) and
 * leaderboards (one ending in the new order with the medal on the leader, "Show again" held on
 * one phone and seen on another, FINAL ROUND before the last photo), the podium's
 * reveal (third, second, first, then "Play again", the winner's fireworks felt bang by bang to
 * their end; a group's first game asks for no rating),
 * "Play again" from a guest while the
 * others still look at their results, and leaving with the code remembered. A slow phone:
 * the start waits in its film leader for its photos still on their way (the ring shows how
 * far, no words), and a leaderboard waits for it to load the next photos. The room-wide "Is everyone here?" as
 * the fallback (the last one removed): No, "Start now", and a START Yes after the answer.
 * A full table of 16 (three phones of
 * the smallest sizes and light bots, `bots.js`) on every screen of a game (the question
 * before it too, and the bubble for a last player with the longest name): nothing scrolls
 * the page, the lobby's photos are as wide as No and Yes, its players take two rows that
 * their arrow pages through (turning at each end), and the reaction row shows whole
 * buttons. Then "Which photos" on a phone with screenshots and a chat full of text, the
 * swaps (the turn to the swaps left, ✕ at none, a refused tap), the hold and "No →"'s slide
 * in the photo choice ("How to play" explaining them, with its quiet "⭐ Rate the game"), the
 * version gate (a newer version out: "✨ Update" on the start screen; too old: "Update to
 * play", only on Create game or Join, from the gate the app knows or from the server's own
 * answer, the code still typed afterwards), the terms after an update, and the website (the
 * same page in a plain browser): invite page and legal page.
 */
import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { CLOSE, STATUS } from '../../web/shared/api.js';
import { ENVIRONMENTS, LIMITS, REACTIONS, STORES } from '../../web/shared/config.js';
import { RATING } from '../../web/js/review.js';
import { addBots } from './bots.js';
import { library, newPhone } from './fake-phone.js';

/** Opens the app on a new phone with `photos` as its library: terms accepted, name typed; `options` as for `newPhone` (a viewport). */
async function openApp(browser, name, photos = library, options = {}) {
  const page = await newPhone(browser, { photos }, options);
  await page.goto('/');
  await page.getByRole('button', { name: 'I agree, let’s play' }).click();
  await page.fill('#name', name);
  return page;
}

async function join(page, code) {
  await page.fill('#code', code);
  await page.getByRole('button', { name: 'Join', exact: true }).click();
}

/** The first time: "Continue" (the phone's question is answered "Allow all"), and a set of `count` is dealt. */
async function dealPhotos(page, count) {
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'Play with these?' })).toBeVisible();
  await expect(page.locator('[data-act="swap"]')).toHaveCount(count);
}

/** The photos dealt (`dealPhotos`), then Yes (not the last one's: that one starts the game, `startFirstGame`). */
async function choosePhotos(page, count) {
  await dealPhotos(page, count);
  await page.locator('[data-act="yes"]').click();
  await expect(page.getByText('✓ Ready')).toBeVisible();
}

/** The last player's Yes (stamped START) in a group's first game: it asks "Is everyone here?" on that phone, "Yes, start". */
async function startFirstGame(page) {
  await page.locator('[data-act="yes"][data-start]').click();
  await page.getByRole('button', { name: 'Yes, start', exact: true }).click();
}

test('friends play a full game and start another one', async ({ browser }) => {
  const host = await openApp(browser, 'Ann');
  await host.getByRole('button', { name: 'Create game' }).click();

  // New game: a preset, then fine-tuning under "Custom", with a "?" explanation; the
  // green "Done" stays in reach below the settings.
  await host.getByRole('button', { name: /Tricky/ }).click();
  await expect(host.getByRole('button', { name: /Tricky/ })).toHaveAttribute('aria-pressed', 'true');
  await host.getByRole('button', { name: 'Custom' }).click();
  await host.getByRole('button', { name: 'What does Streak bonus mean?' }).click();
  await expect(host.getByText('You get extra points.')).toBeVisible();
  // Far down the list: the explanation opens where the finger is (the list keeps its scroll).
  await host.getByRole('button', { name: 'What does Photo mix mean?' }).click();
  await expect(host.getByText('Pure chance: some come up a lot, others hardly.')).toBeInViewport();
  await host.locator('[data-k="photos"][data-v="4"]').click();
  await host.locator('[data-k="rounds"][data-v="5"]').click();
  await expect(host.getByRole('button', { name: 'Done' })).toBeInViewport();
  await host.getByRole('button', { name: 'Done' }).click();
  await expect(host.getByRole('button', { name: 'Custom' })).toHaveAttribute('aria-pressed', 'true');
  await host.getByRole('button', { name: 'Start game' }).click();
  await expect(host.locator('[data-act="settings"]')).toContainText('4 photos · 5 rounds · 15 s · Mix');
  const code = (await host.locator('[data-act="invite"]').innerText()).replace(/\s/g, '');

  const guests = [];
  for (const name of ['Ben', 'Cleo', 'Dan', 'Eve']) {
    const page = await openApp(browser, name);
    await join(page, code);
    guests.push(page);
  }
  // The pills, in their two rows; five fit, so the rows stand still and show no arrow.
  const chips = host.locator('[data-part="chips"] > * > *');
  await expect(chips).toHaveCount(5);
  await expect(host.getByRole('button', { name: 'More players' })).toBeHidden();

  // Eve's phone goes away. Nobody is removed for that by the room: her pill turns red on
  // every phone, and anyone (here Ben, not the host) may take her off; she could join again.
  const eve = guests.pop();
  await eve.close();
  const away = guests[0].getByRole('button', { name: 'Eve is offline: remove from game' });
  await expect(away).toContainText('Offline, tap to remove');
  expect(await styleOf(guests[0], '[aria-label="Eve is offline: remove from game"]', 'borderTopColor')).toBe(themeColour('red'));
  await away.click();
  await expect(guests[0].getByText('They can join again with the code.')).toBeVisible();
  await guests[0].getByRole('button', { name: 'Remove', exact: true }).click();
  await expect(chips).toHaveCount(4);

  // The host removes Dan, who cannot come back.
  const dan = guests.pop();
  await host.getByRole('button', { name: 'Dan: remove from game' }).click();
  await host.getByRole('button', { name: 'Remove', exact: true }).click();
  await expect(dan.getByText('The host removed you from this game.')).toBeVisible();
  await join(dan, code);
  await expect(dan.getByText('The host removed you from this game.')).toBeVisible();
  await expect(chips).toHaveCount(3);

  // A reload lands back in the same game as the same player.
  await guests[0].reload();
  await expect(guests[0].locator('[data-act="invite"]')).toContainText(code);
  await expect(chips).toHaveCount(3);

  const everyone = [host, ...guests];
  const [ben, cleo] = guests;
  await choosePhotos(host, 4);
  await choosePhotos(ben, 4);
  // Cleo is the last one: a bubble teases her on the others' phones at once, never on hers;
  // it goes when Ben changes his photos (two to wait for) and comes back with his Yes.
  const bubble = (page) => page.locator('[data-part="nudge"] [data-cell="line"]');
  for (const page of [host, ben]) await expect(page.locator('[data-part="nudge"] [role="status"]')).toContainText('Cleo');
  await expect(bubble(cleo)).toHaveCount(0);
  await ben.getByRole('button', { name: 'Change' }).click();
  await expect(bubble(host)).toHaveCount(0);
  await ben.locator('[data-act="yes"]').click();
  await expect(bubble(host)).toHaveCount(1);
  // Cleo's Yes is the one that starts the game: it says START (nobody else's does). The stamp
  // never changes the button's height, and Yes sits left of "No →".
  await dealPhotos(cleo, 4);
  const yes = cleo.locator('[data-act="yes"]');
  await expect(yes.locator('[data-cell="start"]')).toHaveText('START');
  await expect(yes).toHaveAccessibleName('Yes, start the game');
  await expect(host.locator('[data-cell="start"]')).toHaveCount(0);
  const [yesBox, noBox] = [await yes.boundingBox(), await cleo.getByRole('button', { name: 'No, other photos' }).boundingBox()];
  expect(Math.round(yesBox.height)).toBe(Math.round(noBox.height));
  expect(yesBox.x).toBeLessThan(noBox.x);
  // The group's first game: her Yes asks "Is everyone here?" on her phone only. "No, wait"
  // changes nothing (she stays not ready); then "Yes, start" starts it.
  await yes.click();
  await expect(cleo.getByRole('heading', { name: 'Is everyone here?' })).toBeVisible();
  for (const page of [host, ben]) await expect(page.getByRole('heading', { name: 'Is everyone here?' })).toHaveCount(0);
  await cleo.getByRole('button', { name: 'No, wait' }).click();
  await expect(cleo.getByRole('heading', { name: 'Is everyone here?' })).toHaveCount(0);
  await expect(cleo.getByText('✓ Ready')).toHaveCount(0);
  await startFirstGame(cleo);
  // The start: a screen of its own, nothing of the lobby shows through.
  const cover = host.locator('#cover > div');
  await expect(cover).toBeVisible();
  expect(await styleOf(host, '#cover > div', 'backgroundColor')).toMatch(/^rgb\(\d+, \d+, \d+\)$/);

  // What the host felt: each number of the 3-2-1, then a light tap as the first photo appears.
  await expect(guests[1].getByText('1 / 5', { exact: true })).toBeVisible();
  await expect.poll(() => host.evaluate(() => window.felt)).toEqual(['120 ms', '120 ms', '120 ms', 'LIGHT']);

  // Round 1 is flagged: the others stop seeing the photo and wait, the flagger sees the
  // countdown to its deletion. Cancel brings it back; flagged again, Delete deletes it for
  // everyone and the game moves on.
  await expect(guests[1].getByText('1 / 5', { exact: true })).toBeVisible();
  const flagged = host.getByText('Someone flagged this photo');
  await guests[1].getByRole('button', { name: 'Report this photo' }).click();
  await expect(flagged).toBeVisible();
  await expect(guests[1].getByText(/^Automatic deletion in \d+ s$/)).toBeVisible();
  await guests[1].getByRole('button', { name: 'Cancel' }).click();
  await expect(flagged).toHaveCount(0);
  await expect(host.getByRole('button', { name: 'Report this photo' })).toBeVisible();
  await guests[1].getByRole('button', { name: 'Report this photo' }).click();
  await expect(flagged).toBeVisible();
  await guests[1].getByRole('button', { name: 'Delete photo' }).click();
  const bar = host.locator('#tbar');
  for (let round = 2; round <= 5; round++) {
    if (round === 5) {
      // From the last photo on, the host's phone notes each podium place as its orb bursts
      // (it loses `data-covered`), with the vibration felt at that moment.
      await host.evaluate(() => {
        window.revealed = [];
        new MutationObserver((changes) => {
          for (const c of changes) if (!c.target.hasAttribute('data-covered')) window.revealed.push([c.target.dataset.place, window.felt.at(-1)]);
        }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['data-covered'] });
      });
    }
    for (const page of everyone) {
      await expect(page.getByText(`${round} / 5`, { exact: true })).toBeVisible();
      // The time to answer has the warm look.
      if (page === host) await expect(bar).toHaveAttribute('data-kind', 'answer');
      await page.locator('[data-act="answer"]').first().click();
    }
    for (const page of everyone) await expect(page.locator('[aria-label$=": their photo"]')).toHaveCount(1);
    // Everyone answered: the time to look at the answer has the cool look on the reveal (the
    // leaderboard has no timer bar). The reveal plays step by step (web/js/reveal.js): the
    // host felt the verdict as their card popped (one firm pulse right, two wrong), then the
    // reactions came.
    await expect(bar).toHaveAttribute('data-kind', 'look');
    await expect.poll(() => host.evaluate(() => window.felt.at(-1))).toBe('MEDIUM');
    await expect(host.locator('[data-after]')).toHaveAttribute('data-go', '');
    if (round === 2) {
      // The leaderboard after the reveal: everyone ranked, with this round's pick.
      await expect(host.getByRole('heading', { name: 'Round 2 of 5' })).toBeVisible();
      const rows = host.locator('[data-part="board"] [data-rank]');
      await expect(rows).toHaveCount(3);
      await expect(rows.first()).toContainText(/[✓✗] /);
      // Its entrance starts in the old order and ends in the new one: top to bottom by rank,
      // each row showing its new rank.
      const standing = () => rows.evaluateAll((els) => els
        .map((el) => ({ top: el.getBoundingClientRect().top, shown: Number(el.querySelector('[data-cell="rank"]').textContent), rank: Number(el.dataset.rank) }))
        .sort((a, b) => a.top - b.top)
        .every((r, i, all) => r.shown === r.rank && (i === 0 || all[i - 1].rank <= r.rank)));
      await expect.poll(standing).toBe(true);
      // Its story ends (the screen lets go of `data-playing`) with the medal on each leader
      // who has points (the rows ranked first with a total above 0) and nowhere else, and
      // there is no timer bar on the board.
      await expect(host.locator('[data-playing]')).toHaveCount(0);
      await expect(host.locator('#tbar')).toHaveCount(0);
      const leaders = await rows.evaluateAll((els) => els.filter((el) => el.dataset.rank === '1' && Number(el.querySelector('[data-cell="total"]').textContent) > 0).length);
      await expect(host.locator('[data-part="board"] [data-medal]')).toHaveCount(leaders);
      if (leaders) await expect(rows.first().locator('[data-medal]')).toBeVisible();
      // A row lifted over the others (`data-lift`: a little bigger) must not make the list
      // scroll sideways: a list that scrolls vertically scrolls sideways too, so it leaves
      // room at its sides. The row's own transition is switched off for the measure.
      const sideways = await host.locator('[data-part="board"]').evaluate((list) => {
        const row = list.querySelector('[data-rank]');
        row.style.transition = 'none';
        row.setAttribute('data-lift', '');
        const extra = list.scrollWidth - list.clientWidth;
        row.removeAttribute('data-lift');
        row.style.transition = '';
        return extra;
      });
      expect(sideways, 'the lifted row sticks out of the list').toBe(0);
      // Holding "Show again" on one phone shows the photo on every phone.
      const button = guests[0].getByRole('button', { name: 'Show the photo again' });
      const box = await button.boundingBox();
      await guests[0].mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await guests[0].mouse.down();
      await expect(host.locator('#look').getByRole('img', { name: 'Photo' })).toBeVisible();
      await guests[0].mouse.up();
      await expect(host.locator('#look img')).toHaveCount(0);
    }
    if (round === 4) {
      // The board before the last photo keeps the standings secret: FINAL ROUND lands with a
      // heavy thud, no ranking. After the last photo the podium comes straight away.
      await expect(host.getByText('FINAL ROUND', { exact: true })).toBeVisible();
      await expect(host.getByText('Results are hidden')).toBeVisible();
      await expect(host.locator('[data-part="board"] [data-rank]')).toHaveCount(0);
      await expect.poll(() => host.evaluate(() => window.felt.at(-1))).toBe('HEAVY');
    }
  }

  const podium = (page) => page.getByRole('list', { name: 'Podium' }).getByRole('listitem');
  for (const page of everyone) await expect(podium(page)).toHaveCount(3);
  // The podium charges up place by place: third bursts out first (a firm pulse), then second
  // and the winner (each a heavy thud), and only then does "Play again" appear.
  await expect(host.getByRole('button', { name: 'Play again' })).toBeVisible();
  expect(await host.evaluate(() => window.revealed)).toEqual([['3', 'MEDIUM'], ['2', 'HEAVY'], ['1', 'HEAVY']]);
  // A group's first game asks for no rating, however close (the store's window waits for its
  // 3rd game, web/js/review.js): nothing a moment after the story, still on the results.
  await host.waitForTimeout(RATING.afterMs + 500);
  expect(await host.evaluate(() => window.rated)).toBe(0);
  // The winner's fireworks are felt bang by bang to their end, not only their first few: well
  // over six light taps after the winner's thud, while the host still looks at the results.
  const fireworkTaps = () => host.evaluate(() => window.felt.slice(window.felt.lastIndexOf('HEAVY') + 1).filter((f) => f === 'LIGHT').length);
  await expect.poll(fireworkTaps, { timeout: 10_000 }).toBeGreaterThanOrEqual(12);
  // Play again is everyone's: a guest opens the next game, the others keep their results
  // until they join it, and the lobby quietly says who it is waiting on.
  await guests[0].getByRole('button', { name: 'Play again' }).click();
  await expect(guests[0].getByRole('heading', { name: 'Play with these?' })).toBeVisible();
  await expect(guests[0].locator('[data-act="swap"]')).toHaveCount(4);
  await expect(podium(host)).toHaveCount(3);
  const waiting = guests[0].locator('[data-part="status"]');
  await expect(waiting).toHaveText('Waiting on Ann, Cleo');
  await host.getByRole('button', { name: 'Play again' }).click();
  await expect(host.getByRole('heading', { name: 'Play with these?' })).toBeVisible();
  await expect(waiting).toHaveText('Waiting on Ann, Cleo');
  // Leaving from the results: the start screen already holds the code.
  await guests[1].getByRole('button', { name: 'Leave' }).click();
  await expect(guests[1].locator('#code')).toHaveValue(code);
  await expect(waiting).toHaveText('Waiting on Ann');
});

test('a slow phone: the start waits for its photos in the film leader, a leaderboard for its next photos; both show how far the table is', async ({ browser }) => {
  const host = await openApp(browser, 'Ann');
  await host.getByRole('button', { name: 'Create game' }).click();
  await host.getByRole('button', { name: 'Custom' }).click();
  await host.locator('[data-k="photos"][data-v="4"]').click();
  await host.locator('[data-k="rounds"][data-v="5"]').click();
  await host.getByRole('button', { name: 'Done' }).click();
  await host.getByRole('button', { name: 'Start game' }).click();
  const code = (await host.locator('[data-act="invite"]').innerText()).replace(/\s/g, '');
  // Ben's phone gets the game's first photo at once, the rest only when the test lets them through.
  const guest = await openApp(browser, 'Ben');
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  let served = 0;
  await guest.route('**/api/rooms/*/photos/*', async (route) => {
    served += 1;
    if (served > 1) await gate;
    await route.continue();
  });
  // Ben's own photos reach the room only when the test lets them through.
  let sendPhotos;
  const sent = new Promise((resolve) => {
    sendPhotos = resolve;
  });
  await guest.route('**/api/rooms/*/photos', async (route) => {
    if (route.request().method() === 'PUT') await sent;
    await route.continue();
  });
  await join(guest, code);
  await choosePhotos(host, 4);
  await dealPhotos(guest, 4);
  await startFirstGame(guest);
  // The start waits for Ben's photos in its film leader: no words and no number yet, the ring
  // half full (Ann's photos are in, Ben's still on their way).
  const ring = host.getByRole('progressbar', { name: 'Getting the photos ready' });
  await expect(ring).toHaveAttribute('aria-valuenow', '50');
  await expect(host.locator('#cover [data-count]')).toHaveCount(0);
  expect(await host.locator('#cover').innerText()).toBe('');
  // Once they are in, the 3-2-1 cuts in on the same leader, and the ring goes.
  sendPhotos();
  await expect(host.locator('#cover [data-count]')).toBeVisible();
  await expect(ring).toHaveCount(0);
  // Round 1 needs only its own photo, which both phones hold before the 3-2-1.
  await expect(guest.getByText('1 / 5', { exact: true })).toBeVisible();
  for (const page of [host, guest]) await page.locator('[data-act="answer"]').first().click();
  // The leaderboard's time runs out, but Ben does not hold round 2's photo yet: it stays.
  await expect(host.getByRole('progressbar', { name: 'Loading photos' })).toBeVisible({ timeout: 20_000 });
  await expect(host.getByRole('heading', { name: 'Round 1 of 5' })).toBeVisible();
  release();
  await expect(host.getByText('2 / 5', { exact: true })).toBeVisible();
});

/**
 * The screen on `page` fits it: the page scrolls neither down nor sideways, and a reaction
 * row shows its first five reactions whole. With `paging`, its arrow then goes to the last
 * five (whole again) and turns round, and from there back to the first and turns again.
 */
async function fits(page, { paging = false } = {}) {
  const { width, height } = page.viewportSize();
  const where = `${width} x ${height}`;
  const overflow = await page.evaluate(() => [document.documentElement.scrollWidth - innerWidth, document.documentElement.scrollHeight - innerHeight]);
  expect(overflow, `${where}: the page scrolls`).toEqual([0, 0]);
  if (!(await page.locator('[data-act="react"]').count())) return;
  // The reactions inside the row's visible part, and how many are cut by its edge.
  const shown = () => page.evaluate(() => {
    const buttons = [...document.querySelectorAll('[data-act="react"]')];
    const row = buttons[0].parentElement.getBoundingClientRect();
    const boxes = buttons.map((b) => b.getBoundingClientRect());
    return {
      whole: boxes.flatMap((b, i) => (b.left >= row.left - 1 && b.right <= row.right + 1 ? [i] : [])),
      cut: boxes.filter((b) => b.right > row.left + 1 && b.left < row.right - 1 && (b.left < row.left - 1 || b.right > row.right + 1)).length,
    };
  });
  const first = [0, 1, 2, 3, 4];
  const last = first.map((i) => REACTIONS.length - 5 + i);
  await expect.poll(shown, where).toEqual({ whole: first, cut: 0 });
  if (!paging) return;
  const arrow = page.getByRole('button', { name: 'More reactions' });
  await arrow.click();
  await expect.poll(shown, `${where}: the arrow goes to the end`).toEqual({ whole: last, cut: 0 });
  await expect(arrow, `${where}: and turns round there`).toHaveAttribute('data-back');
  await arrow.click();
  await expect.poll(shown, `${where}: and back`).toEqual({ whole: first, cut: 0 });
  await expect(arrow, `${where}: where it turns again`).not.toHaveAttribute('data-back');
}

/**
 * Pages a sideways row (`ui.sidewaysRow`) by its arrow named `label`, as a player would: a
 * page (the row's visible width) per tap to the right end, where the arrow turns round
 * (`data-back`) and not a tap earlier, then a page per tap back to the left end, where it
 * turns again. Each tap waits for the row to glide to its page.
 */
async function pageThrough(page, label) {
  const arrow = page.getByRole('button', { name: label });
  const row = () => arrow.evaluate((el) => {
    const s = el.previousElementSibling;
    return { left: s.scrollLeft, width: s.clientWidth, max: s.scrollWidth - s.clientWidth };
  });
  const pointsBack = (back) => (back ? expect(arrow).toHaveAttribute('data-back') : expect(arrow).not.toHaveAttribute('data-back'));
  const { width, max } = await row();
  const pages = Math.ceil(max / width);
  expect(pages, `${label}: the row is longer than the screen`).toBeGreaterThan(0);
  for (const back of [false, true]) {
    for (let k = 1; k <= pages; k++) {
      await pointsBack(back);
      await arrow.click();
      const target = back ? Math.max(max - k * width, 0) : Math.min(k * width, max);
      await expect.poll(async () => Math.abs((await row()).left - target) <= 1, `${label}: tap ${k} ${back ? 'back' : 'on'}`).toBe(true);
    }
  }
  await pointsBack(false);
}

/** Whether every element matching `selector` (at least one) lies inside the screen. */
const inside = (page, selector) => page.evaluate((s) => {
  const boxes = [...document.querySelectorAll(s)].map((el) => el.getBoundingClientRect());
  return boxes.length > 0 && boxes.every((b) => b.left >= 0 && b.top >= 0 && b.right <= innerWidth && b.bottom <= innerHeight);
}, selector);

/** How far the photo grid's outer edges are from the outer edges of Yes (left) and "No →" (right), in px. */
const gridEdges = (page) => page.evaluate(() => {
  const box = (el) => el.getBoundingClientRect();
  const tiles = [...document.querySelectorAll('[data-act="swap"]')].map(box);
  const yes = box(document.querySelector('[data-act="yes"]'));
  const no = box(document.querySelector('[data-act="no"]'));
  return [Math.round(Math.min(...tiles.map((t) => t.left)) - yes.left), Math.round(Math.max(...tiles.map((t) => t.right)) - no.right)];
});

/**
 * A computed style of the `index`th element matching `selector`, found and read in one step
 * inside the page. A part that is repainted while the test looks (someone answered, the
 * 3-2-1's next number) can replace an element between a locator finding it and a second
 * call reading it, and a replaced element reads as an empty style.
 */
const styleOf = (page, selector, property, index = 0) => page.evaluate(([s, p, i]) => getComputedStyle(document.querySelectorAll(s)[i])[p], [selector, property, index]);

/** A colour of the theme (styles/app.css) as the browser reports it. */
function themeColour(name) {
  const css = fs.readFileSync(path.join(import.meta.dirname, '..', '..', 'styles', 'app.css'), 'utf8');
  const hex = css.match(new RegExp(`--color-${name}:\\s*#([0-9a-fA-F]{6});`))[1];
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return `rgb(${r}, ${g}, ${b})`;
}

test('a full table fits the smallest phones: 16 players on every screen of a game', async ({ browser, baseURL }) => {
  // Three phones at common small sizes (Android, iPhone SE, iPhone 15); light bots fill the room.
  const sizes = [{ width: 360, height: 640 }, { width: 375, height: 667 }, { width: 393, height: 852 }];
  const phones = [];
  // The third has the longest name a player can have (LIMITS.nameMax).
  for (const [i, viewport] of sizes.entries()) phones.push(await openApp(browser, ['Ann', 'Ben', 'Cleopatra-Marlen'][i], library, { viewport }));
  const [host, ...guests] = phones;
  await host.getByRole('button', { name: 'Create game' }).click();
  // No clock and "Host taps": each screen stays until the test moves on.
  await host.getByRole('button', { name: 'Custom' }).click();
  await host.locator('[data-k="photos"][data-v="4"]').click();
  await host.locator('[data-k="rounds"][data-v="5"]').click();
  await host.locator('[data-k="time"][data-v="0"]').click();
  await host.locator('[data-k="auto"][data-v="false"]').click();
  await host.getByRole('button', { name: 'Done' }).click();
  await host.getByRole('button', { name: 'Start game' }).click();
  const code = (await host.locator('[data-act="invite"]').innerText()).replace(/\s/g, '');
  for (const page of guests) await join(page, code);
  const bots = await addBots(baseURL, code, LIMITS.maxPlayers - phones.length);
  try {
    await expect(host.locator('[data-part="chips"] > * > *')).toHaveCount(LIMITS.maxPlayers);
    // The lobby: 16 pills in two rows above the photos, which are exactly as wide as No and
    // Yes. The rows scroll sideways together, and their arrow pages through them.
    for (const page of phones) {
      await dealPhotos(page, 4);
      await fits(page);
      await expect.poll(() => gridEdges(page), 'the grid lines up with Yes and "No →"').toEqual([0, 0]);
      await expect(page.locator('[data-part="chips"] > *')).toHaveCount(2);
      await pageThrough(page, 'More players');
    }
    const sayYes = async (page) => {
      await page.locator('[data-act="yes"]').click();
      await expect(page.getByText('✓ Ready')).toBeVisible();
    };
    await sayYes(host);
    await sayYes(guests[0]);
    // The last one, with the longest name: once her bubble has slid in and its two to four
    // small bubbles have popped up, all of it is inside the smallest screen, and nothing scrolls.
    await expect.poll(() => inside(host, '[data-part="nudge"] [data-cell="bubble"], [data-part="nudge"] [data-cell="call"]')).toBe(true);
    const calls = await host.locator('[data-part="nudge"] [data-cell="call"]').count();
    expect(calls >= 2 && calls <= 4, `${calls} small bubbles`).toBe(true);
    await fits(host);
    // Ann changes her photos (two to wait for, the bubble goes) and the third phone says Yes:
    // now Ann's Yes starts the game and asks first, on the smallest phone, all of it on screen.
    await host.getByRole('button', { name: 'Change' }).click();
    await expect(host.locator('[data-part="nudge"] [data-cell="bubble"]')).toHaveCount(0);
    await sayYes(guests[1]);
    await host.locator('[data-act="yes"][data-start]').click();
    await expect(host.getByRole('heading', { name: 'Is everyone here?' })).toBeVisible();
    await fits(host);
    await host.getByRole('button', { name: 'Yes, start', exact: true }).click();
    for (let round = 1; round <= 5; round++) {
      for (const page of phones) await expect(page.getByText(`${round} / 5`, { exact: true })).toBeVisible();
      if (round === 1) {
        // Guessing: 16 cards, the photo and "who has answered" all on screen. Ben's own dot
        // has the dashed ring until he answers.
        for (const page of phones) await fits(page);
        // The bots answer meanwhile, and every answer repaints the row (`styleOf`).
        const ring = (page, i) => styleOf(page, '[data-part="dots"] > * > *', 'borderTopStyle', i);
        expect(await ring(guests[0], 1)).toBe('dashed');
        await guests[0].locator('[data-act="answer"]').first().click();
        await expect.poll(() => ring(guests[0], 1)).toBe('solid');
      }
      for (const page of phones) {
        if (round > 1 || page !== guests[0]) await page.locator('[data-act="answer"]').first().click();
      }
      await expect(host.locator('[aria-label$=": their photo"]')).toHaveCount(1);
      if (round === 1) for (const page of phones) await fits(page);
      // The last photo's reveal goes straight to the podium.
      if (round === 5) break;
      await expect(host.getByRole('heading', { name: `Round ${round} of 5` })).toBeVisible();
      if (round === 1) for (const page of phones) await fits(page, { paging: true });
      if (round === 4) {
        for (const page of phones) await expect(page.getByText('FINAL ROUND', { exact: true })).toBeVisible();
        for (const page of phones) await fits(page);
      }
      await host.getByRole('button', { name: 'Next' }).click();
    }
    const podium = (page) => page.getByRole('list', { name: 'Podium' }).getByRole('listitem');
    for (const page of phones) {
      await expect(podium(page)).toHaveCount(3);
      await fits(page, { paging: true });
    }
    // Thirteen more players than the podium holds: their ranking scrolls in its own list,
    // under a podium that stays on screen.
    const ranking = host.locator('[data-part="ranking"]');
    await expect(ranking.getByRole('listitem')).toHaveCount(LIMITS.maxPlayers - 3);
    expect(await ranking.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);
    await ranking.evaluate((el) => el.scrollTo(0, el.scrollHeight));
    await expect(host.getByRole('list', { name: 'Podium' })).toBeInViewport();
  } finally {
    bots.close();
  }
});

test('the room-wide "Is everyone here?" is only the fallback: the last one is removed, every phone asks; after No, "Start now"', async ({ browser }) => {
  const host = await openApp(browser, 'Ann');
  await host.getByRole('button', { name: 'Create game' }).click();
  await host.getByRole('button', { name: 'Custom' }).click();
  await host.locator('[data-k="photos"][data-v="4"]').click();
  await host.getByRole('button', { name: 'Done' }).click();
  await host.getByRole('button', { name: 'Start game' }).click();
  const code = (await host.locator('[data-act="invite"]').innerText()).replace(/\s/g, '');
  const ben = await openApp(browser, 'Ben');
  await join(ben, code);
  const cleo = await openApp(browser, 'Cleo');
  await join(cleo, code);
  await choosePhotos(host, 4);
  await choosePhotos(ben, 4);
  // Cleo is the last one, and the host removes her: everyone left said Yes without the
  // question on a last phone, so every phone asks.
  await host.getByRole('button', { name: 'Cleo: remove from game' }).click();
  await host.getByRole('button', { name: 'Remove', exact: true }).click();
  for (const page of [host, ben]) await expect(page.getByRole('heading', { name: 'Is everyone here?' })).toBeVisible();
  // Ben answers No: the group waits, with "Start now" on every phone while it can start the game.
  await ben.getByRole('button', { name: 'No, wait' }).click();
  for (const page of [host, ben]) await expect(page.getByRole('button', { name: 'Start now' })).toBeVisible();
  // Ben changes his photos: no "Start now" while it could not start; his Yes is now the last
  // one (START), and since the group already answered, it starts the game without asking.
  await ben.getByRole('button', { name: 'Change' }).click();
  await expect(host.getByRole('button', { name: 'Start now' })).toHaveCount(0);
  await ben.locator('[data-act="yes"][data-start]').click();
  await expect(ben.getByRole('heading', { name: 'Is everyone here?' })).toHaveCount(0);
  for (const page of [host, ben]) await expect(page.locator('#cover > div')).toBeVisible();
});

test('"Which photos" leaves out photos full of text, and screenshots if asked', async ({ browser }) => {
  const text = (name) => fs.readFileSync(path.join(import.meta.dirname, '..', 'fixtures', 'text', name)).toString('base64');
  // Two photos, a game screenshot (little text) and a chat screenshot (full of text).
  const phone = await openApp(browser, 'Ann', [library[0], library[1], { data: text('keep-game.jpg'), screenshot: true }, { data: text('skip-chat.jpg'), screenshot: true }]);
  await phone.getByRole('button', { name: 'Create game' }).click();
  await phone.getByRole('button', { name: 'Start game' }).click();
  await phone.getByRole('button', { name: 'Continue' }).click();
  const tiles = phone.locator('[data-act="swap"]');
  // The default, "Little text": everything but the chat (5 per player, but 3 fit).
  await expect(tiles).toHaveCount(3);
  const choose = async (label) => {
    await phone.locator('[data-act="settings"]').click();
    await phone.locator('[data-k="filter"]', { hasText: label }).click();
    await phone.getByRole('button', { name: 'Done' }).click();
  };
  await choose('No screenshots');
  await expect(tiles).toHaveCount(2);
  await choose('All');
  await expect(tiles).toHaveCount(4);
});

test('choosing photos: a tap swaps one and shows the swaps left (✕ at none), a hold shows it big, "No →" slides in a new set', async ({ browser }) => {
  // Twelve photos (the fixtures twice), so the deck has more than enough to swap from.
  const phone = await openApp(browser, 'Ann', [...library, ...library]);
  await phone.getByRole('button', { name: 'Create game' }).click();
  await phone.getByRole('button', { name: 'Custom' }).click();
  await phone.locator('[data-k="photos"][data-v="4"]').click();
  await phone.getByRole('button', { name: 'Done' }).click();
  await phone.getByRole('button', { name: 'Start game' }).click();
  await phone.getByRole('button', { name: 'Continue' }).click();
  const tiles = phone.locator('[data-act="swap"]');
  await expect(tiles).toHaveCount(4);
  // "How to play" explains the swap and the hold in one line, and offers the App Store's own
  // review page in a quiet link (this phone is an iPhone), never a prompt.
  await phone.getByRole('button', { name: 'How to play' }).click();
  await expect(phone.getByText('Tap a photo to swap just that one. Hold it to see it big.')).toBeVisible();
  await expect(phone.getByRole('link', { name: '⭐ Rate the game' })).toHaveAttribute('href', `${STORES.ios}?action=write-review`);
  await expect(phone.getByText('It helps other groups find it.')).toBeVisible();
  await phone.getByRole('button', { name: 'Got it' }).click();
  // Big versions are prepared ahead for photos still waiting in the bucket, only from what
  // the phone stores (no download); the set on screen may download.
  await expect.poll(() => phone.evaluate(() => window.pulled.some((p) => p.download === false))).toBe(true);
  // No line under the photos explains them: the tile itself shows what is left as it turns.
  await expect(phone.getByText(/Tap to swap|hold to preview/)).toHaveCount(0);
  // A tile's photo is its first face; a swapped tile turns to the swaps left (yellow, ✕ in
  // red at none), the new photo pops over them, and then the tile is plain again.
  const photoOf = (i) => tiles.nth(i).locator('span').first().getAttribute('style');
  const count = tiles.nth(0).locator('[data-cell="count"]');
  const second = await photoOf(1);
  for (const left of [2, 1, 0]) {
    const before = await photoOf(0);
    await tiles.nth(0).click();
    await expect(count).toHaveText(left ? String(left) : '✕');
    await expect(count).toHaveCSS('color', themeColour(left ? 'yellow' : 'red'));
    await expect(count).toHaveCount(0);
    expect(await photoOf(0)).not.toBe(before);
  }
  expect(await photoOf(1)).toBe(second);
  // The fourth tap is refused: the photo stays, shakes and shows a red ✕, anew on every
  // refused tap (a new element, so it plays again).
  const kept = await photoOf(0);
  await tiles.nth(0).click();
  const nope = tiles.nth(0).locator('[data-cell="nope"]');
  await expect(nope).toHaveText('✕');
  expect(await photoOf(0)).toBe(kept);
  const first = await nope.elementHandle();
  await tiles.nth(0).click();
  await expect.poll(() => first.evaluate((el) => el.isConnected)).toBe(false);
  await expect(nope).toHaveCount(1);
  // Felt: a light tap for each swap, two firm pulses for each refusal.
  await expect.poll(() => phone.evaluate(() => window.felt)).toEqual(['LIGHT', 'LIGHT', 'LIGHT', 'MEDIUM', 'MEDIUM', 'MEDIUM', 'MEDIUM']);
  // Holding a photo shows it big until the finger lifts (anywhere); it swaps nothing.
  const box = await tiles.nth(1).boundingBox();
  await phone.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await phone.mouse.down();
  // The photo shows at once and turns sharp in place: its big version above the preview.
  const held = phone.locator('#look').getByRole('img', { name: 'Photo' });
  await expect(held).toBeVisible();
  await expect(phone.locator('#look img')).toHaveCount(2);
  await phone.mouse.move(5, 5);
  await expect(held).toBeVisible();
  await phone.mouse.up();
  await expect(phone.locator('#look img')).toHaveCount(0);
  expect(await photoOf(1)).toBe(second);
  // "No →" slides in a new set (the old one slides out, gone a moment later) and the swaps
  // start over.
  await phone.getByRole('button', { name: 'No, other photos' }).click();
  await expect(phone.locator('[data-cell="leaving"]')).toHaveCount(1);
  await expect.poll(() => photoOf(0)).not.toBe(kept);
  await expect(phone.locator('[data-cell="leaving"]')).toHaveCount(0);
  await tiles.nth(0).click();
  await expect(count).toHaveText('2');
});

test('the version gate: "✨ Update" when a newer version is out; "Update to play" only on Create game or Join, the code still typed', async ({ browser }) => {
  // The local server has no version gate (a deployed one gets it at its deploy), so these
  // phones hear the answers of a server that has one. The fake phone is an iPhone running a
  // production build: its store page is the App Store's.
  const store = ENVIRONMENTS.production.update.ios;
  const sheet = (page) => page.getByRole('heading', { name: 'Update to play' });
  const openWith = async (page, name, gate) => {
    if (gate) await page.route('**/api/gate', (route) => route.fulfill({ json: gate }));
    await page.goto('/');
    await page.getByRole('button', { name: 'I agree, let’s play' }).click();
    await page.fill('#name', name);
  };

  // A newer version is out and this one may still play: only the small link, straight to the store.
  const newer = await newPhone(browser);
  await openWith(newer, 'Ann', { min: null, newest: { ios: '99.0.0', android: null } });
  await expect(newer.getByRole('link', { name: '✨ Update' })).toHaveAttribute('href', store);
  await newer.getByRole('button', { name: 'Create game' }).click();
  await expect(newer.getByRole('button', { name: 'Start game' })).toBeVisible();
  await expect(sheet(newer)).toHaveCount(0);

  // Too old for the gate it knows: Create game and Join ask at once, before anything else.
  const old = await newPhone(browser);
  await openWith(old, 'Ben', { min: '99.0.0', newest: { ios: '99.0.0', android: null } });
  await old.getByRole('button', { name: 'Create game' }).click();
  await expect(sheet(old)).toBeVisible();
  await expect(old.getByText('It takes about a minute.')).toBeVisible();
  await expect(old.getByRole('link', { name: 'Update', exact: true })).toHaveAttribute('href', store);
  await old.getByRole('button', { name: 'Not now' }).click();
  await expect(sheet(old)).toHaveCount(0);
  await join(old, 'ABCD');
  await expect(sheet(old)).toBeVisible();
  // The code is kept for after the update (the app starts again then).
  await old.reload();
  await expect(old.locator('#code')).toHaveValue('ABCD');

  // The gate did not come (an old server, no network at the start): the server's own answer
  // to Create, and to Join, which ends on the start screen with the code still typed.
  const late = await newPhone(browser);
  await late.route('**/api/rooms', (route) => (route.request().method() === 'POST' ? route.fulfill({ status: STATUS.update, json: { error: 'update' } }) : route.fallback()));
  await late.routeWebSocket(/\/socket$/, (ws) => ws.close({ code: CLOSE.update, reason: 'update' }));
  await openWith(late, 'Cleo');
  await expect(late.getByRole('link', { name: '✨ Update' })).toHaveCount(0);
  await late.getByRole('button', { name: 'Create game' }).click();
  await late.getByRole('button', { name: 'Start game' }).click();
  await expect(sheet(late)).toBeVisible();
  await late.getByRole('button', { name: 'Not now' }).click();
  await late.getByRole('button', { name: 'Back' }).click();
  await join(late, 'ABCD');
  await expect(sheet(late)).toBeVisible();
  await expect(late.locator('#code')).toHaveValue('ABCD');
});

test('the terms come back after an update: a phone that accepted an older version sees them again', async ({ browser }) => {
  const page = await newPhone(browser);
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('whoshotit', JSON.stringify({ name: 'Ann', agreed: '2026-11-21' })));
  await page.reload();
  await expect(page.getByRole('button', { name: 'I agree, let’s play' })).toBeVisible();
  await page.getByRole('button', { name: 'I agree, let’s play' }).click();
  await expect(page.locator('#name')).toHaveValue('Ann');
  await page.reload();
  await expect(page.locator('#name')).toHaveValue('Ann');
});

test('in a browser the page is the website: the invite page and the legal page', async ({ page }) => {
  await page.goto('/ABCD');
  await expect(page.getByText('You’re invited to game')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open in the app' })).toHaveAttribute('href', 'whoshotit://join/ABCD');
  // Only the stores with a public page get a button (STORES): a friend never lands on "not found".
  await expect(page.getByRole('link', { name: 'App Store (iPhone)' })).toHaveAttribute('href', STORES.ios);
  await expect(page.getByRole('link', { name: 'Google Play (Android)' })).toHaveCount(STORES.android ? 1 : 0);
  await page.goto('/legal');
  await expect(page.getByRole('heading', { name: 'Imprint (Impressum)' })).toBeVisible();
  await expect(page.getByText('Zum Isetal 1')).toBeVisible();
});
