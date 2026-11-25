import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await page.evaluate(() => localStorage.clear());
  await page.goto('./');
});

test('plays a full round with the keyboard and the coach', async ({ page }) => {
  await expect(page.getByTestId('bankroll')).toHaveText('$1,000');
  await page.getByTestId('deal').click();
  // Play until the round settles, always following the tagged best play (insurance: No).
  const summary = page.getByTestId('summary-bar');
  for (let i = 0; i < 40; i++) {
    if (await summary.isVisible()) break;
    const best = page.getByRole('button', { name: /BEST PLAY/ });
    if ((await best.count()) > 0) await best.first().click();
    await page.waitForTimeout(300);
  }
  await expect(summary).toBeVisible({ timeout: 10_000 });
  await expect(summary.getByText(/of \d+ optimal|No decisions this round/)).toBeVisible();
  await page.keyboard.press('Space');
  await expect(page.getByTestId('bet-bar')).toBeVisible();
});

test('setup, chart and stats screens load, settings persist on reload', async ({ page }) => {
  await page.getByRole('link', { name: 'Table setup' }).click();
  await page.getByTestId('setup-seat-2').click(); // empty -> you
  await page.getByRole('radio', { name: '8' }).click();
  await page.getByRole('link', { name: 'Strategy chart' }).click();
  await expect(page.getByText('Basic strategy for 8 decks.')).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Pair 8,8 versus A: Split' })).toBeVisible();
  await page.reload();
  await expect(page.getByText('Basic strategy for 8 decks.')).toBeVisible();
  await page.getByRole('link', { name: 'Stats' }).click();
  await expect(page.getByRole('heading', { name: 'Stats' })).toBeVisible();
  await page.getByRole('link', { name: 'Play' }).click();
  await expect(page.getByTestId('seat-2')).toContainText('You · Seat 2');
});
