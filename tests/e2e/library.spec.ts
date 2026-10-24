import { expect, test } from '@playwright/test';
import { buildQueue } from '../../src/scheduler/queue';
import { checkbox, historyFixture, NOW, readStored, ready, row, seedStored, settled, TODAY } from './library.helpers';

test.use({ timezoneId: 'UTC' });
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date(NOW));
  await page.goto('/');
  await ready(page);
});

test('fresh Library has 75 grouped problems, progress, premium badges and collapsible categories', async ({ page }) => {
  await expect(page.getByText('Completed 0 / 75')).toBeVisible();
  await expect(page.getByRole('checkbox')).toHaveCount(75);
  await expect(page.locator('details.category')).toHaveCount(18);
  await expect(page.getByText('Premium', { exact: true })).toHaveCount(6);
  await expect(row(page, 'lc-217')).toContainText('#217');
  await expect(row(page, 'lc-217')).toContainText('Not in deck');
  await expect(page.getByRole('progressbar', { name: 'Completed problems' })).toHaveAttribute('aria-valuenow', '0');
  const first = page.locator('details.category').first();
  await expect(first.locator('summary')).toContainText('Arrays & Hashing');
  await first.locator('summary').click();
  await expect(checkbox(page)).not.toBeVisible();
  await first.locator('summary').click();
  await expect(checkbox(page)).toBeVisible();
  const stored = await readStored(page);
  expect(stored).toMatchObject({ cards: [], logs: [], version: 10 });
  expect(stored.settings).toHaveLength(1);
});

test('first tick creates tomorrow’s card, undo archives it and re-tick restores it across reload', async ({ page }) => {
  await checkbox(page).click();
  await settled(page);
  await expect(page.getByText('Completed 1 / 75')).toBeVisible();
  await expect(row(page, 'lc-217')).toContainText('New · Due tomorrow');
  const first = await readStored(page);
  expect(first.cards).toEqual([{ problemId: 'lc-217', state: 'new', ease: 2.6,
    intervalDays: 0, dueDay: TODAY + 1, stepIndex: 0, reps: 0, lapses: 0, addedAt: NOW, archived: false }]);
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await settled(page);
  await expect(checkbox(page)).not.toBeChecked();
  expect((await readStored(page)).cards).toEqual([{ ...first.cards[0], archived: true }]);
  await checkbox(page).click();
  await settled(page);
  await page.reload();
  await ready(page);
  await expect(checkbox(page)).toBeChecked();
  expect((await readStored(page)).cards).toEqual(first.cards);
});

test('archive requires confirmation; cancel/Escape preserve membership and history survives restoration', async ({ page }) => {
  const { card, log } = historyFixture();
  await seedStored(page, { cards: [card], logs: [log] });
  const before = await readStored(page);
  await expect(row(page, 'lc-217')).toContainText('Due in 5d');
  await checkbox(page).click();
  const dialog = page.getByRole('dialog', { name: 'Remove from deck?' });
  await expect(dialog).toContainText('History is kept.');
  await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused();
  await expect(checkbox(page)).toBeChecked();
  expect((await readStored(page)).cards).toEqual(before.cards);
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog).not.toBeVisible();
  await checkbox(page).click();
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(checkbox(page)).toBeFocused();
  await checkbox(page).click();
  await dialog.getByRole('button', { name: 'Remove', exact: true }).click();
  await settled(page);
  await expect(checkbox(page)).not.toBeChecked();
  const archived = await readStored(page);
  expect(archived.cards).toEqual([{ ...card, archived: true }]);
  expect(archived.logs).toEqual(before.logs);
  expect(buildQueue(archived.cards, [{ id: 'lc-217', difficulty: 'easy' }], NOW, archived.settings[0]!.value, 'UTC').ready).toEqual([]);
  await page.reload();
  await ready(page);
  await checkbox(page).click();
  await settled(page);
  const restored = await readStored(page);
  expect(restored.cards).toEqual(before.cards);
  expect(restored.logs).toEqual(before.logs);
});

test('archive undo restores the exact card and review log', async ({ page }) => {
  const { card, log } = historyFixture();
  await seedStored(page, { cards: [card], logs: [log] });
  const before = await readStored(page);
  await checkbox(page).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Remove', exact: true }).click();
  await settled(page);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await settled(page);
  await expect(checkbox(page)).toBeChecked();
  const after = await readStored(page);
  expect(after.cards).toEqual(before.cards);
  expect(after.logs).toEqual(before.logs);
});

test('multiple ticks persist and completion/difficulty filters intersect correctly', async ({ page }) => {
  for (const title of ['Contains Duplicate', 'Group Anagrams', 'Minimum Window Substring']) {
    await checkbox(page, title).click();
    await settled(page);
  }
  await expect(page.getByText('Completed 3 / 75')).toBeVisible();
  const completion = page.getByRole('group', { name: 'Completion' });
  const difficulty = page.getByRole('group', { name: 'Difficulty' });
  await completion.getByRole('button', { name: 'Completed', exact: true }).click();
  await expect(page.getByRole('checkbox')).toHaveCount(3);
  await difficulty.getByRole('button', { name: 'Easy', exact: true }).click();
  await expect(page.getByRole('checkbox')).toHaveCount(1);
  await expect(checkbox(page)).toBeChecked();
  await completion.getByRole('button', { name: 'Remaining', exact: true }).click();
  await expect(page.getByRole('checkbox')).toHaveCount(18);
  await difficulty.getByRole('button', { name: 'Hard', exact: true }).click();
  await expect(page.getByRole('checkbox')).toHaveCount(6);
  await expect(page.getByText('Completed 3 / 75')).toBeVisible();
  expect((await readStored(page)).cards).toHaveLength(3);
  await page.reload();
  await ready(page);
  await expect(page.getByText('Completed 3 / 75')).toBeVisible();
});

test('mark all in category preserves existing schedules/history and offers bulk undo', async ({ page }) => {
  const { card, log } = historyFixture();
  await seedStored(page, { cards: [card], logs: [log] });
  const before = await readStored(page);
  await page.getByRole('button', { name: 'Mark all 8 problems in Arrays & Hashing' }).click();
  await settled(page);
  await expect(page.getByText('Completed 8 / 75')).toBeVisible();
  expect((await readStored(page)).cards.find((item) => item.problemId === card.problemId)).toEqual(card);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await settled(page);
  await expect(page.getByText('Completed 1 / 75')).toBeVisible();
  const after = await readStored(page);
  expect(after.cards.filter((item) => !item.archived)).toEqual([card]);
  expect(after.logs).toEqual(before.logs);
});

test('persisted today-first settings are honored without a Settings screen', async ({ page }) => {
  await seedStored(page, { firstReview: 'today' });
  await checkbox(page).click();
  await settled(page);
  await expect(row(page, 'lc-217')).toContainText('New · Due today');
  expect((await readStored(page)).cards[0]?.dueDay).toBe(TODAY);
});

test('Library edits and saved cards remain available offline after reload', async ({ page, context }) => {
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await ready(page);
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  await checkbox(page).click();
  await settled(page);
  await context.setOffline(true);
  await page.reload();
  await ready(page);
  await expect(checkbox(page)).toBeChecked();
  await checkbox(page, 'Valid Anagram').click();
  await settled(page);
  await expect(page.getByText('Completed 2 / 75')).toBeVisible();
  await context.setOffline(false);
  await page.reload();
  await ready(page);
  await expect(checkbox(page, 'Valid Anagram')).toBeChecked();
  expect((await readStored(page)).cards.filter((card) => !card.archived)).toHaveLength(2);
});

test('two tabs synchronize membership and invalidate stale local undo', async ({ page, context }) => {
  const second = await context.newPage();
  try {
    await second.clock.setFixedTime(new Date(NOW));
    await second.goto('/');
    await ready(second);
    await checkbox(page).click();
    await settled(page);
    await expect(checkbox(second)).toBeChecked();
    await checkbox(second, 'Valid Anagram').click();
    await settled(second);
    await expect(page.getByText('Completed 2 / 75')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Undo', exact: true })).toHaveCount(0);
    await checkbox(second).click();
    await second.getByRole('dialog').getByRole('button', { name: 'Remove', exact: true }).click();
    await settled(second);
    await expect(checkbox(page)).not.toBeChecked();
    const stored = await readStored(page);
    expect(stored.cards.filter((card) => !card.archived)).toHaveLength(1);
    expect(stored.cards).toHaveLength(2);
  } finally { await second.close(); }
});

test('small difficulty badges retain AA text contrast with the specified colors', async ({ page }) => {
  const colors = await page.evaluate(() => ['easy', 'medium', 'hard'].map((difficulty) => {
    const style = getComputedStyle(document.querySelector(`.difficulty-${difficulty}`)!);
    return { color: style.color, background: style.backgroundColor };
  }));
  const luminance = (color: string) => {
    const channels = color.match(/\d+(?:\.\d+)?/g)!.slice(0, 3).map((channel) => {
      const value = Number(channel) / 255;
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
    return channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722;
  };
  for (const { color, background } of colors) {
    const first = luminance(color);
    const second = luminance(background);
    expect((Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05)).toBeGreaterThanOrEqual(4.5);
  }
});

for (const [width, height] of [[375,667], [390,844], [430,932], [667,375], [844,390], [932,430], [820,1180], [320,568], [1024,768]] as const) {
  test(`Library and confirmation fit ${width}x${height}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height });
    await page.getByRole('heading', { name: 'Library', exact: true }).scrollIntoViewIfNeeded();
    const layout = await page.evaluate(() => {
      const main = document.querySelector('main')!;
      const boundary = main.getBoundingClientRect();
      const rows = [...document.querySelectorAll('.problem-row')];
      return {
        pageWidth: document.documentElement.scrollWidth,
        mainOverflow: main.scrollWidth > main.clientWidth,
        rowsFit: rows.every((row) => {
          const box = row.getBoundingClientRect();
          return row.scrollWidth <= row.clientWidth && box.left >= boundary.left && box.right <= boundary.right;
        }),
        targetsFit: [...document.querySelectorAll('.checkbox-target')].every((target) => {
          const box = target.getBoundingClientRect();
          return box.width >= 44 && box.height >= 44;
        }),
      };
    });
    expect(layout).toEqual({ pageWidth: width, mainOverflow: false, rowsFit: true, targetsFit: true });
    await checkbox(page).click();
    await settled(page);
    await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeInViewport();
    await page.screenshot({ path: testInfo.outputPath('library.png') });
    await checkbox(page).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    const box = (await dialog.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(height);
    await dialog.getByRole('button', { name: 'Cancel' }).click();
  });
}
