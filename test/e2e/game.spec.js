/**
 * Three friends play a whole game in three phone browsers: create, invite link, reload,
 * settings, photo choice, the automatic start, five rounds, the end and "Play again".
 */
import path from 'node:path';
import { expect, test } from '@playwright/test';

const PHOTOS = [1, 2, 3, 4, 5, 6].map((i) => path.join(import.meta.dirname, '..', 'fixtures', `photo-${i}.jpg`));

async function phone(browser) {
  const context = await browser.newContext();
  return context.newPage();
}

test('three friends play a full game and start another one', async ({ browser }) => {
  const host = await phone(browser);
  await host.goto('/');
  await host.fill('#name', 'Ann');
  await host.getByRole('button', { name: 'Create game' }).click();
  await expect(host).toHaveURL(/\/[A-Z0-9]{4}$/);
  const code = new URL(host.url()).pathname.slice(1);

  await host.locator('.cfg').click();
  await host.locator('[data-k="photos"][data-v="3"]').click();
  await host.locator('[data-k="rounds"][data-v="5"]').click();
  await host.getByRole('button', { name: 'Done' }).click();
  await expect(host.locator('.cfg')).toContainText('3 photos · 5 rounds');

  const guests = [];
  for (const name of ['Ben', 'Cleo']) {
    const page = await phone(browser);
    await page.goto(`/${code}`);
    await page.fill('#name', name);
    await page.getByRole('button', { name: `Join ${code}` }).click();
    guests.push(page);
  }
  const everyone = [host, ...guests];
  await expect(host.locator('.chip')).toHaveCount(3);

  // A reload lands back in the same room as the same player.
  await guests[0].reload();
  await expect(guests[0].locator('.code')).toContainText(code.split('').join(''));
  await expect(host.locator('.chip')).toHaveCount(3);

  for (const page of everyone) {
    await page.setInputFiles('#pick-files', PHOTOS);
    await expect(page.locator('.q')).toHaveText('Play with these?');
    await expect(page.locator('.grid div[style]')).toHaveCount(3);
    await page.getByRole('button', { name: 'Yes' }).click();
    await expect(page.getByText('✓ Ready')).toBeVisible();
  }

  for (let round = 1; round <= 5; round++) {
    for (const page of everyone) {
      await expect(page.locator('.rnd')).toHaveText(`${round} / 5`);
      await page.locator('button.opt').first().click();
    }
    for (const page of everyone) await expect(page.locator('.opt.ok')).toHaveCount(1);
  }

  for (const page of everyone) await expect(page.locator('.podium .pod')).toHaveCount(3);
  await expect(guests[0].getByRole('button', { name: 'Play again' })).toHaveCount(0);
  await host.getByRole('button', { name: 'Play again' }).click();
  for (const page of everyone) {
    await expect(page.locator('.q')).toHaveText('Play with these?');
    await expect(page.locator('.grid div[style]')).toHaveCount(3);
  }
});

test('the legal page has the imprint and is linked from the start screen', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Legal & privacy' }).click();
  await expect(page.getByRole('heading', { name: 'Imprint (Impressum)' })).toBeVisible();
  await expect(page.getByText('Hünensteig 36')).toBeVisible();
});
