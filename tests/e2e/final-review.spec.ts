import { expect, test } from '@playwright/test';
import { newCard } from '../../src/scheduler/testFixtures';
import { checkbox, NOW, ready, readStored, seedStored } from './library.helpers';

test.use({ timezoneId: 'UTC' });
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date(NOW)); await page.goto('/#library'); await ready(page);
});

test('Settings brings save and validation feedback into view instead of leaving it offscreen', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 }); await page.goto('/#settings');
  await page.getByLabel('Daily goal', { exact: true }).fill('7');
  await page.getByRole('button', { name: 'Save settings', exact: true }).click();
  const saved = page.getByText('Settings saved. Existing deadlines are unchanged.', { exact: true });
  await expect(saved).toBeFocused(); await expect(saved).toBeInViewport();
  await page.setViewportSize({ width: 667, height: 375 });
  await page.getByLabel('Learning steps (minutes)', { exact: true }).fill('144000000000');
  await page.getByRole('button', { name: 'Save settings', exact: true }).click();
  const error = page.getByRole('alert');
  await expect(error).toContainText('supported date range'); await expect(error).toBeFocused(); await expect(error).toBeInViewport();
  await page.getByLabel('Learning steps (minutes)', { exact: true }).fill('1,');
  await page.getByRole('button', { name: 'Save settings', exact: true }).click();
  const formError = page.getByText('Enter comma-separated positive step durations in minutes', { exact: true });
  await expect(formError).toBeFocused(); await expect(formError).toBeInViewport();
  await expect(page.getByRole('alert')).toHaveCount(1);
});

test('removal confirmation stays within safe areas with enlarged text and rotation', async ({ page }, info) => {
  await checkbox(page).click(); await expect(checkbox(page)).toBeChecked();
  await expect(page.locator('#library')).toHaveAttribute('aria-busy', 'false');
  await page.addStyleTag({ content: 'html { font-size: 200%; } .app-shell { --safe-top: 20px; --safe-right: 44px; --safe-bottom: 34px; --safe-left: 44px; }' });
  await checkbox(page).click();
  const dialog = page.getByRole('dialog');
  for (const [width, height] of [[375, 667], [667, 375], [844, 390], [390, 844]]) {
    await page.setViewportSize({ width: width!, height: height! });
    const rect = (await dialog.boundingBox())!;
    expect(rect.x).toBeGreaterThanOrEqual(44); expect(rect.x + rect.width).toBeLessThanOrEqual(width! - 44);
    expect(rect.y).toBeGreaterThanOrEqual(20); expect(rect.y + rect.height).toBeLessThanOrEqual(height! - 34);
    expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    for (const name of ['Cancel', 'Remove']) {
      const button = dialog.getByRole('button', { name, exact: true });
      await button.scrollIntoViewIfNeeded(); await expect(button).toBeInViewport();
      const box = (await button.boundingBox())!;
      expect(box.y).toBeGreaterThanOrEqual(rect.y); expect(box.y + box.height).toBeLessThanOrEqual(rect.y + rect.height);
    }
    await page.screenshot({ path: info.outputPath(`dialog-${width}x${height}.png`) });
  }
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(checkbox(page)).toBeFocused(); await expect(checkbox(page)).toBeChecked();
});

test('long problem and expanded rating guide remain usable in landscape with enlarged text', async ({ page }, info) => {
  await seedStored(page, { cards: [newCard({ problemId: 'lc-211' })] });
  await page.goto('/#today'); await page.getByRole('button', { name: 'Start review', exact: true }).click();
  await page.getByRole('button', { name: 'Show answer', exact: true }).click();
  await page.addStyleTag({ content: 'html { font-size: 200%; } .app-shell { --safe-top: 20px; --safe-right: 44px; --safe-bottom: 34px; --safe-left: 44px; }' });
  await page.locator('.rating-guide summary').click();
  for (const [width, height] of [[667, 375], [844, 390], [932, 430], [375, 667]]) {
    await page.setViewportSize({ width: width!, height: height! });
    await expect(page.getByRole('heading', { name: 'Design Add And Search Words Data Structure', exact: true })).toHaveCount(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth
      && [...document.querySelectorAll('.review-columns,.review-answer,.rating-button')].every((element) => element.scrollWidth <= element.clientWidth + 1))).toBe(true);
    for (const button of await page.locator('.rating-button').all()) {
      await button.scrollIntoViewIfNeeded(); await expect(button).toBeInViewport();
      const box = (await button.boundingBox())!;
      expect(box.width).toBeGreaterThanOrEqual(44); expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.x).toBeGreaterThanOrEqual(44); expect(box.x + box.width).toBeLessThanOrEqual(width! - 44);
      expect(box.y).toBeGreaterThanOrEqual(20); expect(box.y + box.height).toBeLessThanOrEqual(height! - 34);
    }
    await page.screenshot({ path: info.outputPath(`review-${width}x${height}.png`) });
  }
  await page.getByRole('button', { name: 'Good 2d', exact: true }).click();
  await expect.poll(async () => (await readStored(page)).logs.length).toBe(1);
});
