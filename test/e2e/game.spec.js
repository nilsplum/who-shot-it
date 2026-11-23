/**
 * Friends play a whole game on three phones (the real app UI, a fake photo library):
 * the terms, the "New game" step with a preset and the settings "?", joining by code, a
 * phone going offline (its red pill, removed by a guest), the host removing a player, the
 * photos dealt with "Play with these?", reload, the automatic
 * start behind an opaque 3-2-1, a flagged photo (hidden from the others, Cancel, then
 * Delete), five rounds with their leaderboards (one ending in the new order, "Show again"
 * held on one phone and seen on another, FINAL ROUND before the last photo), the podium's
 * reveal (third, second, first, then "Play again"), "Play again" from a guest while the
 * others still look at their results, and leaving with the code remembered. A leaderboard
 * that waits for a phone still loading the next photos. A full table of 16 (three phones of
 * the smallest sizes and light bots, `bots.js`) on every screen of a game: nothing scrolls
 * the page, the lobby's photos are as wide as No and Yes, and the reaction row shows whole
 * buttons. Then "Which photos" on a phone with screenshots and a chat full of text, the
 * swaps (the count, the turn, a refused tap) and the hold in the photo choice, the terms
 * after an update, and the website (the same page in a plain browser): invite page and
 * legal page.
 */
import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { LIMITS, REACTIONS } from '../../web/shared/config.js';
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

/** The photos dealt (`dealPhotos`), then Yes. */
async function choosePhotos(page, count) {
  await dealPhotos(page, count);
  await page.getByRole('button', { name: 'Yes' }).click();
  await expect(page.getByText('✓ Ready')).toBeVisible();
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
  const chips = host.locator('[data-part="chips"] > *');
  await expect(chips).toHaveCount(5);

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
  for (const page of everyone) await choosePhotos(page, 4);
  // Everyone is ready: the 3-2-1 is a screen of its own, nothing of the lobby shows through.
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
    // Everyone answered: the time to look at the answer has the cool look, on the reveal and
    // the leaderboard, and the host felt the verdict (one firm pulse right, two wrong).
    await expect(bar).toHaveAttribute('data-kind', 'look');
    await expect.poll(() => host.evaluate(() => window.felt.at(-1))).toBe('MEDIUM');
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

test('a leaderboard waits for a phone still loading the next photos, and shows how far the table is', async ({ browser }) => {
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
  await join(guest, code);
  for (const page of [host, guest]) await choosePhotos(page, 4);
  // Round 1 needs only its own photo, which both phones hold after the 3-2-1.
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
 * five (whole again), and from there back to the first.
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
  await arrow.click();
  await expect.poll(shown, `${where}: and back`).toEqual({ whole: first, cut: 0 });
}

/** How far the photo grid's outer edges are from No's left and Yes's right edge, in px. */
const gridEdges = (page) => page.evaluate(() => {
  const box = (el) => el.getBoundingClientRect();
  const tiles = [...document.querySelectorAll('[data-act="swap"]')].map(box);
  const no = box(document.querySelector('[data-act="no"]'));
  const yes = box(document.querySelector('[data-act="yes"]'));
  return [Math.round(Math.min(...tiles.map((t) => t.left)) - no.left), Math.round(Math.max(...tiles.map((t) => t.right)) - yes.right)];
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
  for (const [i, viewport] of sizes.entries()) phones.push(await openApp(browser, ['Ann', 'Ben', 'Cleo'][i], library, { viewport }));
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
    await expect(host.locator('[data-part="chips"] > *')).toHaveCount(LIMITS.maxPlayers);
    // The lobby: 16 pills above the photos, which are exactly as wide as No and Yes.
    for (const page of phones) {
      await dealPhotos(page, 4);
      await fits(page);
      await expect.poll(() => gridEdges(page), 'the grid lines up with No and Yes').toEqual([0, 0]);
    }
    for (const page of phones) {
      await page.getByRole('button', { name: 'Yes' }).click();
      await expect(page.getByText('✓ Ready')).toBeVisible();
    }
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

test('choosing photos: tap one to swap it (three times), hold one to see it big', async ({ browser }) => {
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
  // Big versions are prepared ahead for photos still waiting in the bucket, only from what
  // the phone stores (no download); the set on screen may download.
  await expect.poll(() => phone.evaluate(() => window.pulled.some((p) => p.download === false))).toBe(true);
  // The line under the grid counts the swaps left, in green.
  const line = phone.getByText(/^Tap to swap/);
  await expect(line).toHaveText('Tap to swap (3 left), hold to preview');
  await expect(phone.getByText('(3 left)', { exact: true })).toHaveCSS('color', themeColour('green'));
  // A tile's photo is its front face; while it turns, the old photo is a second face behind it.
  const faces = (i) => tiles.nth(i).locator('span');
  const photoOf = (i) => faces(i).first().getAttribute('style');
  const second = await photoOf(1);
  for (let left = 2; left >= 0; left--) {
    const before = await photoOf(0);
    await tiles.nth(0).click();
    await expect.poll(() => photoOf(0)).not.toBe(before);
    await expect(line).toHaveText(`Tap to swap (${left} left), hold to preview`);
    await expect(faces(0)).toHaveCount(1);
  }
  expect(await photoOf(1)).toBe(second);
  // At 0 the count is red. The fourth tap is refused: the photo stays and gets no mark, and
  // the count is drawn anew, so its shake plays again.
  const zero = phone.getByText('(0 left)', { exact: true });
  await expect(zero).toHaveCSS('color', themeColour('red'));
  const shaken = await zero.elementHandle();
  const kept = await photoOf(0);
  await tiles.nth(0).click();
  await expect.poll(() => shaken.evaluate((el) => el.isConnected)).toBe(false);
  await expect(zero).toBeVisible();
  expect(await photoOf(0)).toBe(kept);
  await expect(faces(0)).toHaveCount(1);
  // Felt: a light tap for each turn, two firm pulses for the refusal.
  await expect.poll(() => phone.evaluate(() => window.felt)).toEqual(['LIGHT', 'LIGHT', 'LIGHT', 'MEDIUM', 'MEDIUM']);
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
  // "No" deals a new set and resets the swaps.
  await phone.getByRole('button', { name: 'No', exact: true }).click();
  await expect(line).toHaveText('Tap to swap (3 left), hold to preview');
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
  await expect(page.getByRole('link', { name: 'Google Play (Android)' })).toBeVisible();
  await page.goto('/legal');
  await expect(page.getByRole('heading', { name: 'Imprint (Impressum)' })).toBeVisible();
  await expect(page.getByText('Zum Isetal 1')).toBeVisible();
});
