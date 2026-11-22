/**
 * Friends play a whole game on three phones (the real app UI, a fake photo library):
 * the terms, the "New game" step with a preset and the settings "?", joining by code,
 * the host removing a player, the photos dealt with "Play with these?", reload, the
 * automatic start, a reported photo, five rounds with their leaderboards (and "Show
 * again" held on one phone, seen on another), the end, "Play again" from a guest while the
 * others still look at their results, and leaving with the code remembered. Then "Which
 * photos" on a phone with screenshots and a chat full of text. Plus the website (the same
 * page in a plain browser): invite page and legal page.
 */
import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { library, newPhone } from './fake-phone.js';

/** Opens the app on a new phone: terms accepted, name typed. */
async function openApp(browser, name, photos) {
  const page = await newPhone(browser, photos);
  await page.goto('/');
  await page.getByRole('button', { name: 'I agree, let’s play' }).click();
  await page.fill('#name', name);
  return page;
}

async function join(page, code) {
  await page.fill('#code', code);
  await page.getByRole('button', { name: 'Join', exact: true }).click();
}

/** The first time: "Continue" (the phone's question is answered "Allow all"), then Yes. */
async function choosePhotos(page, count) {
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'Play with these?' })).toBeVisible();
  await expect(page.locator('[data-act="swap"]')).toHaveCount(count);
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
  for (const name of ['Ben', 'Cleo', 'Dan']) {
    const page = await openApp(browser, name);
    await join(page, code);
    guests.push(page);
  }
  const chips = host.locator('[data-part="chips"] > *');
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

  // Round 1 is reported: the photo goes for everyone and the game moves on.
  await expect(guests[1].getByText('1 / 5', { exact: true })).toBeVisible();
  await guests[1].getByRole('button', { name: 'Report this photo' }).click();
  await guests[1].getByRole('button', { name: 'Delete photo' }).click();
  for (let round = 2; round <= 5; round++) {
    for (const page of everyone) {
      await expect(page.getByText(`${round} / 5`, { exact: true })).toBeVisible();
      await page.locator('[data-act="answer"]').first().click();
    }
    for (const page of everyone) await expect(page.locator('[aria-label$=": their photo"]')).toHaveCount(1);
    if (round === 2) {
      // The leaderboard after the reveal: everyone ranked, with this round's pick.
      await expect(host.getByRole('heading', { name: 'Round 2 of 5' })).toBeVisible();
      const rows = host.locator('[data-part="board"] > *');
      await expect(rows).toHaveCount(3);
      await expect(rows.first()).toContainText(/[✓✗] /);
      // Holding "Show again" on one phone shows the photo on every phone.
      const button = guests[0].getByRole('button', { name: 'Show the photo again' });
      const box = await button.boundingBox();
      await guests[0].mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await guests[0].mouse.down();
      await expect(host.locator('#look img')).toBeVisible();
      await guests[0].mouse.up();
      await expect(host.locator('#look img')).toHaveCount(0);
    }
  }

  const podium = (page) => page.getByRole('list', { name: 'Podium' }).getByRole('listitem');
  for (const page of everyone) await expect(podium(page)).toHaveCount(3);
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
  const swaps = phone.getByText(/^↻ /);
  await expect(swaps).toHaveText('↻ Tap a photo to swap it: 3 left');
  const style = async (i) => tiles.nth(i).getAttribute('style');
  const second = await style(1);
  for (let left = 2; left >= 0; left--) {
    const before = await style(0);
    await tiles.nth(0).click();
    await expect.poll(() => style(0)).not.toBe(before);
    await expect(swaps).toHaveText(left ? `↻ Tap a photo to swap it: ${left} left` : '↻ No swaps left');
  }
  expect(await style(1)).toBe(second);
  // The fourth tap is refused: a short cross on that photo, the photo stays. The set is
  // painted anew while the marks clear, so the hold below waits until the cross is gone.
  const kept = await style(0);
  await tiles.nth(0).click();
  const cross = tiles.nth(0).getByText('✗');
  await expect(cross).toBeVisible();
  expect(await style(0)).toBe(kept);
  await expect(cross).toHaveCount(0);
  // Holding a photo shows it big until the finger lifts (anywhere); it swaps nothing.
  const box = await tiles.nth(1).boundingBox();
  await phone.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await phone.mouse.down();
  await expect(phone.locator('#look img')).toBeVisible();
  await phone.mouse.move(5, 5);
  await expect(phone.locator('#look img')).toBeVisible();
  await phone.mouse.up();
  await expect(phone.locator('#look img')).toHaveCount(0);
  expect(await style(1)).toBe(second);
  // "No" deals a new set and resets the swaps.
  await phone.getByRole('button', { name: 'No', exact: true }).click();
  await expect(swaps).toHaveText('↻ Tap a photo to swap it: 3 left');
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
