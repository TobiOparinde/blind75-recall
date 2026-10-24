import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { DEFAULT_SETTINGS } from '../../src/scheduler/config';
import { learningCard, newCard, reviewCard } from '../../src/scheduler/testFixtures';
import { checkbox, historyFixture, NOW, readStored, ready, seedStored, TODAY } from './library.helpers';

test.use({ timezoneId: 'UTC' });
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date(NOW)); await page.goto('/#library'); await ready(page);
});
async function settings(page: Page) {
  await page.goto('/#settings'); await expect(page.getByLabel('Daily goal', { exact: true })).toBeVisible();
}
async function upload(page: Page, text: string) {
  await page.getByLabel('Import JSON', { exact: true }).setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(text) });
}
async function backup(page: Page) {
  const downloading = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export JSON', exact: true }).click();
  const download = await downloading; expect(download.suggestedFilename()).toBe('blind75-recall-backup.json');
  return readFile((await download.path())!, 'utf8');
}
test('navigation exposes Stats and the Today Settings gear without changing the deck', async ({ page }) => {
  await page.getByRole('link', { name: 'Today', exact: true }).click(); await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Add to Home Screen', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Stats', exact: true }).click(); await expect(page.getByRole('heading', { name: 'Stats', exact: true })).toBeVisible();
  await expect(page.getByText('No reviews yet', { exact: true })).toBeVisible(); expect((await readStored(page)).cards).toEqual([]);
});
test('stats render due, forecast, retention, maturity, category weakness and leeches', async ({ page }) => {
  const { card, log } = historyFixture();
  await seedStored(page, { cards: [{ ...card, dueDay: TODAY, lapses: 4 }, newCard({ problemId: 'lc-1', dueDay: TODAY + 1 }), learningCard({ problemId: 'lc-242', dueAt: NOW + 60_000 }), reviewCard({ problemId: 'lc-125', intervalDays: 21, dueDay: TODAY + 6 })], logs: [log] });
  await page.getByRole('link', { name: 'Stats', exact: true }).click();
  await expect(page.getByLabel('Today: 2 cards')).toBeVisible(); await expect(page.getByLabel('In 1 days: 1 cards')).toBeVisible(); await expect(page.getByLabel('In 6 days: 1 cards')).toBeVisible();
  await expect(page.getByText('100%', { exact: true })).toBeVisible(); await expect(page.getByText('4 lapses', { exact: true })).toBeVisible();
  await expect(page.getByText('Arrays & Hashing', { exact: true })).toBeVisible(); await expect(page.getByText('Young', { exact: true })).toBeVisible();
  await page.reload(); await expect(page.getByText('4 lapses', { exact: true })).toBeVisible();
});
test('settings persist all exposed values and new ticks follow first-review timing', async ({ page }) => {
  await settings(page);
  await page.getByLabel('Daily goal', { exact: true }).fill('1'); await page.getByLabel('Rollover hour', { exact: true }).fill('5');
  await page.getByLabel('First review', { exact: true }).selectOption('today');
  await page.getByLabel('Learning steps (minutes)', { exact: true }).fill('1, 10'); await page.getByLabel('Relearning steps (minutes)', { exact: true }).fill('2, 5');
  await page.getByLabel('Graduating interval (days)', { exact: true }).fill('3'); await page.getByLabel('Easy interval (days)', { exact: true }).fill('7'); await page.getByLabel('Maximum interval (days)', { exact: true }).fill('100');
  await page.getByRole('button', { name: 'Save settings', exact: true }).click(); await expect(page.getByText(/Settings saved/)).toBeVisible(); await page.reload();
  await expect(page.getByLabel('Daily goal', { exact: true })).toHaveValue('1'); await expect(page.getByLabel('Learning steps (minutes)', { exact: true })).toHaveValue('1, 10');
  const saved = (await readStored(page)).settings[0]!.value;
  expect(saved).toEqual({ ...DEFAULT_SETTINGS, dailyGoal: 1, rolloverHour: 5, firstReview: 'today', learningSteps: [60_000, 600_000], relearningSteps: [120_000, 300_000], graduatingIntervalDays: 3, easyIntervalDays: 7, maxIntervalDays: 100 });
  await page.getByRole('link', { name: 'Library', exact: true }).click(); await ready(page); await checkbox(page).click();
  await expect.poll(async () => (await readStored(page)).cards.length).toBe(1); expect((await readStored(page)).cards[0]!.dueDay).toBe(TODAY);
});
test('invalid settings and incompatible schedules are rejected without mutation', async ({ page }) => {
  await seedStored(page, { cards: [reviewCard()] }); const before = await readStored(page); await settings(page);
  await page.getByLabel('Maximum interval (days)', { exact: true }).fill('5'); await page.getByRole('button', { name: 'Save settings' }).click();
  await expect(page.getByRole('alert')).toContainText('interval'); expect(await readStored(page)).toEqual(before);
  await page.getByLabel('Learning steps (minutes)', { exact: true }).fill('1,'); await page.getByRole('button', { name: 'Save settings' }).click();
  await expect(page.getByText(/comma-separated positive/)).toBeVisible(); expect(await readStored(page)).toEqual(before);
});
test('export/import into a clean browser exactly restores cards, archived history, settings and schedules', async ({ page, browser }) => {
  const { card, log } = historyFixture();
  await seedStored(page, { cards: [card, newCard({ problemId: 'lc-1', archived: true }), learningCard({ problemId: 'lc-242' })], logs: [log], settings: { dailyGoal: 7, rolloverHour: 5 } });
  const original = await readStored(page); await settings(page); const text = await backup(page); expect(await backup(page)).toBe(text);
  const clean = await browser.newContext({ baseURL: 'http://127.0.0.1:4173', timezoneId: 'UTC' });
  try {
    const target = await clean.newPage(); await target.clock.setFixedTime(new Date(NOW)); await target.goto('/#settings'); await expect(target.getByLabel('Daily goal', { exact: true })).toBeVisible();
    expect((await readStored(target)).cards).toEqual([]); await upload(target, text); await expect(target.getByRole('group', { name: 'Import preview' })).toContainText('3 cards (2 active), 1 review logs');
    expect((await readStored(target)).cards).toEqual([]); await target.getByRole('button', { name: 'Confirm overwrite' }).click(); await expect(target.getByText(/Backup imported/)).toBeVisible();
    expect(await readStored(target)).toEqual(original); await target.reload(); expect(await readStored(target)).toEqual(original); expect(await backup(target)).toBe(text);
  } finally { await clean.close(); }
});
test('import cancellation leaves current data unchanged', async ({ page }) => {
  await checkbox(page).click(); await settings(page); const before = await readStored(page); const text = await backup(page);
  await upload(page, text); await expect(page.getByRole('group', { name: 'Import preview' })).toBeVisible();
  await page.getByRole('button', { name: 'Cancel import' }).click(); await expect(page.getByRole('button', { name: 'Confirm overwrite' })).toHaveCount(0); expect(await readStored(page)).toEqual(before);
});
for (const [label, input] of [['malformed', '{bad'], ['version mismatch', JSON.stringify({ format: 'blind75-recall', schemaVersion: 2 })], ['invalid card', JSON.stringify({ format: 'blind75-recall', schemaVersion: 1, settings: DEFAULT_SETTINGS, cards: [{ ...newCard(), ease: -1 }], reviewLogs: [] })]]) {
  test(`rejects ${label} imports cleanly with no partial overwrite`, async ({ page }) => {
    await checkbox(page).click(); await settings(page); const before = await readStored(page); await upload(page, input!);
    await expect(page.getByRole('alert')).toBeVisible(); await expect(page.getByRole('button', { name: 'Confirm overwrite' })).toHaveCount(0); expect(await readStored(page)).toEqual(before);
  });
}
test('a change in another tab invalidates an import confirmation', async ({ page, context }) => {
  await settings(page); const text = await backup(page); await upload(page, text); await expect(page.getByRole('group', { name: 'Import preview' })).toBeVisible();
  const second = await context.newPage(); await second.goto('/#library'); await ready(second); await checkbox(second).click();
  await expect.poll(async () => (await readStored(second)).cards.length).toBe(1);
  await page.getByRole('button', { name: 'Confirm overwrite' }).click(); await expect(page.getByRole('alert')).toContainText('changed'); expect((await readStored(page)).cards).toHaveLength(1);
});
test('reset requires both confirmations and returns defaults/empty deck while preserving Library', async ({ page }) => {
  const { card, log } = historyFixture(); await seedStored(page, { cards: [card], logs: [log], settings: { dailyGoal: 9 } }); await settings(page);
  const before = await readStored(page); await page.getByRole('button', { name: 'Reset user data' }).click(); await page.getByRole('button', { name: 'Continue reset' }).click(); expect(await readStored(page)).toEqual(before);
  await page.getByRole('button', { name: 'Cancel reset' }).click(); expect(await readStored(page)).toEqual(before);
  await page.getByRole('button', { name: 'Reset user data' }).click(); await page.getByRole('button', { name: 'Continue reset' }).click(); await page.getByRole('button', { name: 'Permanently reset' }).click(); await expect(page.getByText(/All user data reset/)).toBeVisible();
  const after = await readStored(page); expect(after.cards).toEqual([]); expect(after.logs).toEqual([]); expect(after.settings[0]!.value).toEqual(DEFAULT_SETTINGS);
  await page.getByRole('link', { name: 'Today', exact: true }).click(); await expect(page.getByRole('link', { name: 'Open Library' })).toBeVisible();
  await page.getByRole('link', { name: 'Open Library' }).click(); await ready(page); await expect(page.getByRole('checkbox')).toHaveCount(75);
});
test('Stats, Settings, export, import and reset work offline after a cached load', async ({ page, context }) => {
  await checkbox(page).click(); await settings(page); await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await context.setOffline(true);
  try {
    await page.reload(); await expect(page.getByLabel('Daily goal', { exact: true })).toBeVisible();
    await page.getByLabel('Daily goal', { exact: true }).fill('2'); await page.getByRole('button', { name: 'Save settings' }).click(); await expect(page.getByText(/Settings saved/)).toBeVisible();
    const text = await backup(page); await upload(page, text); await page.getByRole('button', { name: 'Confirm overwrite' }).click(); await expect(page.getByText(/Backup imported/)).toBeVisible();
    await page.getByRole('link', { name: 'Stats', exact: true }).click(); await expect(page.getByRole('heading', { name: '7-day forecast' })).toBeVisible();
    await page.goto('/#settings'); await page.getByRole('button', { name: 'Reset user data' }).click(); await page.getByRole('button', { name: 'Continue reset' }).click(); await page.getByRole('button', { name: 'Permanently reset' }).click(); await expect(page.getByText(/All user data reset/)).toBeVisible();
  } finally { await context.setOffline(false); }
});
test('30-day backup reminder survives reload and clears after export', async ({ page }) => {
  await page.getByRole('link', { name: 'Today', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Today', exact: true })).toBeVisible();
  await expect.poll(async () => page.evaluate(async () => {
    const request = indexedDB.open('blind75-recall');
    return new Promise<boolean>((resolve) => { request.onsuccess = () => {
      const db = request.result; const tx = db.transaction('metadata'); const read = tx.objectStore('metadata').get('backupReminderAt');
      read.onsuccess = () => resolve(Boolean(read.result)); tx.oncomplete = () => db.close();
    }; });
  })).toBe(true);
  await page.clock.setFixedTime(new Date(NOW + 30 * 86_400_000)); await page.reload();
  await expect(page.getByText('Time for a backup.', { exact: false })).toBeVisible();
  await page.getByRole('link', { name: 'Export your data in Settings' }).click(); await backup(page);
  await page.getByRole('link', { name: 'Today', exact: true }).click(); await expect(page.getByText('Time for a backup.', { exact: false })).toHaveCount(0);
});
for (const [width, height] of [[390, 844], [844, 390], [320, 568], [820, 1180]] as const) {
  test(`M5 screens fit ${width}x${height} and retain an unsaved form through rotation`, async ({ page }, info) => {
    await page.setViewportSize({ width, height }); await settings(page);
    await page.getByLabel('Daily goal', { exact: true }).fill('7'); await page.setViewportSize({ width: height, height: width }); await expect(page.getByLabel('Daily goal', { exact: true })).toHaveValue('7');
    await page.setViewportSize({ width, height });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await page.getByLabel('Daily goal', { exact: true }).evaluate((element) => parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(16);
    await page.screenshot({ path: info.outputPath('settings.png') });
    await page.getByRole('link', { name: 'Stats', exact: true }).click(); await expect(page.getByRole('heading', { name: 'Stats', exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath('stats.png') });
  });
}
