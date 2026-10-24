import { expect, test, type Page } from '@playwright/test';
import type { Card } from '../../src/domain/scheduler';
import { schedule } from '../../src/scheduler/schedule';
import { newCard, reviewCard, learningCard } from '../../src/scheduler/testFixtures';
import { checkbox, NOW, readStored, ready, seedStored, TODAY } from './library.helpers';

test.use({ timezoneId: 'UTC' });
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date(NOW));
  await page.goto('/#library');
  await ready(page);
});
async function today(page: Page) {
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Today', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Today', exact: true })).toBeVisible();
}
async function seed(page: Page, cards: readonly Card[], goal = 3) {
  await seedStored(page, { cards, settings: { dailyGoal: goal } });
  await today(page);
}
async function start(page: Page) {
  await page.getByRole('button', { name: 'Start review', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Review session' })).toBeVisible();
}
async function rate(page: Page, label = 'Good') {
  await page.getByRole('button', { name: 'Show answer', exact: true }).click();
  await page.getByRole('button', { name: new RegExp(`^${label} `) }).click();
  await expect(page.locator('main')).toHaveAttribute('aria-busy', 'false');
}

test('Today guides an empty deck to Library and shows future/caught-up cards', async ({ page }) => {
  await today(page);
  await expect(page.getByRole('img', { name: 'Daily goal: 0 of 3 ratings' })).toBeVisible();
  await expect(page.getByText('0 due', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Open Library' }).click();
  await checkbox(page).click();
  await expect(page.locator('#library')).toHaveAttribute('aria-busy', 'false');
  await today(page);
  await expect(page.getByText('All caught up. Next up tomorrow: 1 problem.')).toBeVisible();
  await page.locator('.early-queue summary').click();
  await page.getByRole('button', { name: 'Review Contains Duplicate', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Contains Duplicate' })).toBeVisible();
});

for (const [rating, label] of [[1, 'Again'], [2, 'Hard'], [3, 'Good'], [4, 'Easy']] as const) {
  test(`${label} applies exactly the displayed scheduler result and log`, async ({ page }) => {
    const card = reviewCard({ problemId: 'lc-217' });
    await seed(page, [card]);
    const before = await readStored(page);
    const expected = schedule(card, rating, NOW, before.settings[0]!.value, 'UTC');
    await start(page);
    await expect(page.getByText('Arrays & Hashing', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Open on LeetCode' })).toHaveAttribute('target', '_blank');
    await expect(page.getByRole('button', { name: /^Again / })).toHaveCount(0);
    await page.getByRole('button', { name: 'Show answer', exact: true }).click();
    await expect(page.getByRole('link', { name: 'NeetCode', exact: true })).toHaveAttribute('href', /neetcode\.io/);
    const text = expected.nextCard.state === 'relearning' ? '10m' : `${expected.nextCard.dueDay - TODAY}d`;
    await expect(page.getByRole('button', { name: `${label} ${text}`, exact: true })).toBeVisible();
    // Rerender/focus must not recapture the preview's scheduler time.
    await page.clock.setFixedTime(new Date(NOW + 30_000));
    await page.getByRole('button', { name: `${label} ${text}`, exact: true }).click();
    await expect(page.locator('main')).toHaveAttribute('aria-busy', 'false');
    const after = await readStored(page);
    expect(after.cards).toEqual([expected.nextCard]);
    expect(after.logs).toHaveLength(1);
    expect(after.logs[0]).toMatchObject({ rating, ratedAt: NOW, cardBefore: card, early: expected.early });
  });
}

test('goal 1 highlights one pick, then Goal hit and Keep going permit additional ratings', async ({ page }) => {
  await seed(page, [newCard({ problemId: 'lc-217', ease: 2.6 }), newCard({ problemId: 'lc-49' }), newCard({ problemId: 'lc-76', ease: 2.3 })], 1);
  await expect(page.locator('[data-queue-group="picks"] .queue-row')).toHaveCount(1);
  await expect(page.locator('[data-queue-group="remaining"] .queue-row')).toHaveCount(2);
  await start(page); await rate(page);
  await expect(page.getByText('Goal hit', { exact: true })).toBeVisible();
  await expect(page.getByText('1 / 1 ratings today', { exact: true })).toBeVisible();
  await expect(page.getByText('Streak: 1 day', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Keep going', exact: true }).click();
  await rate(page); // Automatically serves the next ready card, even beyond the goal.
  await expect(page.getByRole('region', { name: 'Review session' })).toBeVisible();
  await rate(page);
  await expect(page.getByText('3 / 1 ratings today', { exact: true })).toBeVisible();
  expect((await readStored(page)).logs).toHaveLength(3);
});

test('queue rows start out of order and early practice follows section 7.9', async ({ page }) => {
  await seed(page, [newCard({ problemId: 'lc-217' }), newCard({ problemId: 'lc-49' })]);
  await page.getByRole('button', { name: 'Review Group Anagrams', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Group Anagrams', exact: true })).toBeVisible();
  await rate(page);
  await expect(page.getByRole('heading', { name: 'Contains Duplicate', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Close review' }).click();
  const card = reviewCard({ problemId: 'lc-217', dueDay: TODAY + 1, lastReviewedAt: NOW - 9 * 86_400_000 });
  // Return to Library for the independent native fixture; application exposes no test API.
  await page.getByRole('navigation').getByRole('link', { name: 'Library', exact: true }).click();
  await seedStored(page, { cards: [card] }); await today(page);
  await page.locator('.early-queue summary').click();
  await page.getByRole('button', { name: 'Review Contains Duplicate', exact: true }).click();
  await rate(page);
  const after = await readStored(page);
  expect(after.cards.find((item) => item.problemId === card.problemId)!.dueDay).toBeGreaterThan(card.dueDay);
  expect(after.logs.at(-1)).toMatchObject({ early: true, cardBefore: card });
});

test('Again waits, counts down to 7:42, and Show now is an explicit early override', async ({ page }) => {
  await seed(page, [newCard({ problemId: 'lc-217' })]);
  await start(page); await rate(page, 'Again');
  await expect(page.getByRole('timer')).toHaveText('Next card in 10:00');
  expect((await readStored(page)).logs).toHaveLength(1);
  await page.clock.setFixedTime(new Date(NOW + 138_000));
  await expect(page.getByRole('timer')).toHaveText('Next card in 7:42');
  await page.getByRole('button', { name: 'Show now', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Contains Duplicate' })).toBeVisible();
  await rate(page);
  expect((await readStored(page)).logs.at(-1)).toMatchObject({ early: true });
});

test('a due learning card automatically reappears in the same waiting session', async ({ page }) => {
  await seed(page, [newCard({ problemId: 'lc-217' })]);
  await start(page); await rate(page, 'Again');
  await expect(page.getByRole('timer')).toBeVisible();
  await page.clock.setFixedTime(new Date(NOW + 600_000));
  await expect(page.getByRole('heading', { name: 'Contains Duplicate' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Show answer', exact: true })).toBeVisible();
  expect((await readStored(page)).logs).toHaveLength(1);
});

test('Today also exposes waiting learning and Show now without auto-promoting it', async ({ page }) => {
  await seed(page, [learningCard({ problemId: 'lc-217', dueAt: NOW + 462_000 })]);
  await expect(page.getByRole('timer')).toHaveText('Next card in 7:42');
  await expect(page.getByRole('button', { name: 'Start review' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Show now', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Contains Duplicate' })).toBeVisible();
});

test('reload before or after revealing creates no log; committed ratings recover exactly once', async ({ page }) => {
  await seed(page, [newCard({ problemId: 'lc-217' })]);
  await start(page); await page.reload();
  await expect(page.getByRole('button', { name: 'Start review' })).toBeEnabled();
  expect((await readStored(page)).logs).toEqual([]);
  await start(page);
  await page.getByRole('button', { name: 'Show answer', exact: true }).click();
  await page.reload();
  expect((await readStored(page)).logs).toEqual([]);
  await start(page); await rate(page);
  const saved = await readStored(page);
  await page.reload();
  await expect(page.getByText('1 / 3 ratings today', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Undo rating' })).toHaveCount(0);
  expect((await readStored(page)).logs).toEqual(saved.logs);
  expect((await readStored(page)).cards).toEqual(saved.cards);
});

test('reload immediately after a rating leaves either its whole transaction or no transaction', async ({ page }) => {
  const card = newCard({ problemId: 'lc-217' });
  await seed(page, [card]); await start(page);
  await page.getByRole('button', { name: 'Show answer', exact: true }).click();
  await page.getByRole('button', { name: 'Good 2d', exact: true }).dispatchEvent('click');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Today', exact: true })).toBeVisible();
  const stored = await readStored(page);
  expect(stored.logs.length).toBeLessThanOrEqual(1);
  expect(stored.cards[0]!.reps).toBe(stored.logs.length);
  if (stored.logs.length === 0) expect(stored.cards).toEqual([card]);
  else expect(stored.cards).toEqual([schedule(card, 3, NOW, stored.settings[0]!.value, 'UTC').nextCard]);
  await page.reload();
  expect((await readStored(page)).logs).toEqual(stored.logs);
});

test('undo restores the full snapshot, one log, progress and queue without exposing an older undo', async ({ page }) => {
  const first = newCard({ problemId: 'lc-217' }); const second = newCard({ problemId: 'lc-49' });
  await seed(page, [first, second]); await start(page); await rate(page); await rate(page);
  const before = await readStored(page);
  expect(before.logs).toHaveLength(2);
  await page.getByRole('button', { name: 'Undo rating', exact: true }).click();
  await expect(page.locator('main')).toHaveAttribute('aria-busy', 'false');
  await expect(page.getByRole('heading', { name: 'Group Anagrams', exact: true })).toBeVisible();
  await expect(page.getByText('1 / 3 ratings today', { exact: true })).toBeVisible();
  const after = await readStored(page);
  expect(after.cards.find((card) => card.problemId === second.problemId)).toEqual(second);
  expect(after.logs).toEqual(before.logs.slice(0, 1));
  await expect(page.getByRole('button', { name: 'Undo rating', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Close review' }).click();
  await expect(page.locator('[data-queue-group="picks"]').getByRole('button', { name: 'Review Group Anagrams', exact: true })).toBeVisible();
});

test('archived cards never enter the queue and another tab invalidates a selected card', async ({ page, context }) => {
  await seed(page, [newCard({ problemId: 'lc-217' }), newCard({ problemId: 'lc-49', archived: true })]);
  await expect(page.getByRole('button', { name: 'Review Group Anagrams', exact: true })).toHaveCount(0);
  await start(page); await page.getByRole('button', { name: 'Show answer', exact: true }).click();
  const second = await context.newPage();
  try {
    await second.goto('/#library'); await ready(second);
    await checkbox(second).click();
    await second.getByRole('dialog').getByRole('button', { name: 'Remove', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Review session' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Start review' })).toHaveCount(0);
    expect((await readStored(page)).logs).toEqual([]);
  } finally { await second.close(); }
});

test('cross-tab ratings refresh progress and invalidate stale undo without overwriting', async ({ page, context }) => {
  await seed(page, [newCard({ problemId: 'lc-217' }), newCard({ problemId: 'lc-49' })], 1);
  const second = await context.newPage();
  try {
    await second.clock.setFixedTime(new Date(NOW)); await second.goto('/');
    await start(page); await rate(page);
    await expect(second.getByText('1 / 1 ratings today', { exact: true })).toBeVisible();
    await second.getByRole('button', { name: 'Keep going', exact: true }).click(); await rate(second);
    await expect(page.getByText('2 / 1 ratings today', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Undo rating', exact: true })).toHaveCount(0);
    expect((await readStored(page)).logs).toHaveLength(2);
  } finally { await second.close(); }
});

test('Space and numeric shortcuts work while links and ordinary buttons keep their own behavior', async ({ page }) => {
  await seed(page, [newCard({ problemId: 'lc-217' })]); await start(page);
  await page.getByRole('link', { name: 'Open on LeetCode' }).focus();
  await page.keyboard.press('1');
  expect((await readStored(page)).logs).toHaveLength(0);
  await page.getByRole('button', { name: 'Show answer', exact: true }).focus();
  await page.keyboard.press('Space');
  await expect(page.getByRole('button', { name: 'Good 2d', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'NeetCode', exact: true }).focus(); await page.keyboard.press('3');
  expect((await readStored(page)).logs).toHaveLength(0);
  await page.getByRole('region', { name: 'Review session' }).focus(); await page.keyboard.press('3');
  await expect(page.locator('main')).toHaveAttribute('aria-busy', 'false');
  expect((await readStored(page)).logs).toHaveLength(1);
});

test('a long-open answer stays revealed but requires explicit interval refresh after rollover', async ({ page }) => {
  await seed(page, [newCard({ problemId: 'lc-217' })]); await start(page);
  await page.getByRole('button', { name: 'Show answer', exact: true }).click();
  await page.clock.setFixedTime(new Date(NOW + 86_400_000));
  await expect(page.getByRole('button', { name: 'Good 2d', exact: true })).toBeDisabled();
  await expect(page.getByRole('heading', { name: 'Contains Duplicate' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'NeetCode', exact: true })).toBeVisible();
  expect((await readStored(page)).logs).toHaveLength(0);
  await page.getByRole('button', { name: 'Refresh intervals' }).click();
  await page.getByRole('button', { name: 'Good 2d', exact: true }).click();
  await expect(page.locator('main')).toHaveAttribute('aria-busy', 'false');
  expect((await readStored(page)).logs[0]?.ratedAt).toBe(NOW + 86_400_000);
});

test('rating and reload recovery work offline without replaying the accepted event', async ({ page, context }) => {
  await seed(page, [newCard({ problemId: 'lc-217' })], 1);
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await expect(page.getByRole('button', { name: 'Start review' })).toBeEnabled();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  await context.setOffline(true);
  try {
    await start(page); await rate(page);
    const saved = await readStored(page);
    await page.reload();
    await expect(page.getByText('1 / 1 ratings today', { exact: true })).toBeVisible();
    expect((await readStored(page)).logs).toEqual(saved.logs);
    expect((await readStored(page)).cards).toEqual(saved.cards);
  } finally { await context.setOffline(false); }
});

for (const [width, height] of [[375,667], [390,844], [430,932], [667,375], [844,390], [932,430], [820,1180], [320,568], [1024,768]] as const) {
  test(`review preserves answer and previews rotating from ${width}x${height}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height });
    await seed(page, [newCard({ problemId: 'lc-3' })], 1);
    const action = (await page.getByRole('button', { name: 'Start review' }).boundingBox())!;
    if (height < 500 && width > height) {
      const overview = (await page.locator('.today-overview').boundingBox())!;
      expect(action.x).toBeGreaterThanOrEqual(overview.x + overview.width);
    }
    expect(action.y + action.height / 2).toBeGreaterThanOrEqual(height * 0.6);
    await page.screenshot({ path: testInfo.outputPath('today.png') });
    await start(page);
    await page.getByRole('button', { name: 'Show answer', exact: true }).click();
    const controls = page.locator('.rating-buttons button');
    const before = await controls.allTextContents();
    await page.screenshot({ path: testInfo.outputPath('review-before.png') });
    await page.setViewportSize({ width: height, height: width });
    await expect(page.getByRole('heading', { name: 'Longest Substring Without Repeating Characters', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Show answer', exact: true })).toHaveCount(0);
    expect(await controls.allTextContents()).toEqual(before);
    const layout = await controls.evaluateAll((buttons) => buttons.map((button) => {
      const box = button.getBoundingClientRect();
      return { x: box.x, y: box.y, right: box.right, bottom: box.bottom, width: box.width, height: box.height };
    }));
    expect(layout).toHaveLength(4);
    for (const box of layout) {
      expect(box.x).toBeGreaterThanOrEqual(0); expect(box.right).toBeLessThanOrEqual(height);
      expect(box.y).toBeGreaterThanOrEqual(0); expect(box.bottom).toBeLessThanOrEqual(width);
      expect(box.width).toBeGreaterThanOrEqual(44); expect(box.height).toBeGreaterThanOrEqual(44);
      expect(Math.abs(box.y - layout[0]!.y)).toBeLessThan(1);
    }
    await page.screenshot({ path: testInfo.outputPath('review-after.png') });
    await page.getByRole('button', { name: 'Good 2d', exact: true }).click();
    await expect(page.getByText('Goal hit', { exact: true })).toBeVisible();
    expect((await readStored(page)).logs).toHaveLength(1);
  });
}
