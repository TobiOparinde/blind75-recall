import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { newCard } from '../../src/scheduler/testFixtures';
import { checkbox, NOW, ready, seedStored } from './library.helpers';

test.use({ timezoneId: 'UTC' });
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date(NOW)); await page.goto('/#library'); await ready(page);
});
const matrix = [[375,667], [390,844], [430,932], [667,375], [844,390], [932,430], [820,1180], [320,568], [1024,768]] as const;
async function audit(page: Page) {
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  expect(result.violations.map(({ id, nodes }) => ({ id, nodes: nodes.map((node) => ({ target: node.target, summary: node.failureSummary })) }))).toEqual([]);
}
async function layout(page: Page) {
  expect(await page.evaluate(() => {
    const root = document.documentElement; const body = document.body; const main = document.querySelector('main')!;
    return { horizontal: root.scrollWidth > innerWidth || main.scrollWidth > main.clientWidth + 1, bodyScroll: body.scrollHeight > innerHeight + 1,
      contentScroll: getComputedStyle(main).overflowY };
  })).toEqual({ horizontal: false, bodyScroll: false, contentScroll: 'auto' });
  const failures = await page.locator('button,a,input,select,summary').evaluateAll((elements) => elements.flatMap((element) => {
    if (!element.getClientRects().length || getComputedStyle(element).visibility === 'hidden' || element.closest('details:not([open])') && element.tagName !== 'SUMMARY') return [];
    const target = element.matches('input[type=checkbox]') ? element.closest('label')! : element;
    const rect = target.getBoundingClientRect();
    const reasons: string[] = [];
    if (rect.width < 43.9 || rect.height < 43.9) reasons.push(`target ${rect.width}x${rect.height}`);
    if (rect.left < -1 || rect.right > innerWidth + 1) reasons.push('horizontal clipping');
    if (element.matches('input,select') && parseFloat(getComputedStyle(element).fontSize) < 16) reasons.push('input font');
    return reasons.length ? [{ control: element.textContent?.slice(0, 50) || element.getAttribute('aria-label') || element.tagName, reasons }] : [];
  }));
  expect(failures).toEqual([]);
}
for (const [width, height] of matrix) {
  test(`all screens satisfy geometry and touch targets at ${width}x${height}`, async ({ page }, info) => {
    const errors: string[] = []; page.on('pageerror', (error) => errors.push(error.message));
    await page.setViewportSize({ width, height });
    await seedStored(page, { cards: [newCard({ problemId: 'lc-3' }), newCard({ problemId: 'lc-217' })], settings: { dailyGoal: 1 } });
    for (const route of ['library', 'stats', 'settings', 'today']) {
      await page.goto(`/#${route}`); await expect(page.getByRole('heading', { name: route[0]!.toUpperCase() + route.slice(1), exact: true })).toBeVisible();
      await layout(page);
      const content = page.locator(`.${route === 'stats' || route === 'settings' ? 'utility-screen' : route}`);
      const box = (await content.boundingBox())!; expect(box.width).toBeLessThanOrEqual(721);
      const main = (await page.locator('main').boundingBox())!;
      expect(Math.abs(box.x + box.width / 2 - (main.x + main.width / 2))).toBeLessThan(2);
      const nav = (await page.getByRole('navigation').boundingBox())!;
      if (height < 500) expect(nav.x + nav.width).toBeLessThanOrEqual(main.x + 1);
      else expect(nav.y).toBeGreaterThanOrEqual(main.y + main.height - 1);
      await page.screenshot({ path: info.outputPath(`${route}.png`) });
    }
    await page.getByRole('button', { name: 'Start review', exact: true }).click(); await layout(page);
    await page.getByRole('button', { name: 'Show answer', exact: true }).click(); await layout(page);
    const problem = (await page.locator('.review-problem').boundingBox())!;
    const answer = (await page.locator('.review-answer').boundingBox())!;
    if (height < 500) expect(problem.x + problem.width).toBeLessThanOrEqual(answer.x + 1);
    else expect(problem.y + problem.height).toBeLessThanOrEqual(answer.y + 1);
    const ratings = await page.locator('.rating-button').evaluateAll((buttons) => buttons.map((button) => {
      const r = button.getBoundingClientRect(); return { y: r.y, bottom: r.bottom, right: r.right };
    }));
    for (const rating of ratings) { expect(Math.abs(rating.y - ratings[0]!.y)).toBeLessThan(1); expect(rating.bottom).toBeLessThanOrEqual(height); expect(rating.right).toBeLessThanOrEqual(width); }
    await page.screenshot({ path: info.outputPath('review.png') });
    await page.locator('.rating-guide summary').click(); await layout(page);
    await page.getByRole('button', { name: 'Good 2d', exact: true }).click();
    await expect(page.getByText('Goal hit', { exact: true })).toBeVisible(); expect(errors).toEqual([]);
  });
}
for (const route of ['today', 'library', 'stats', 'settings']) {
  test(`${route} passes automated WCAG AA accessibility`, async ({ page }) => {
    await seedStored(page, { cards: [newCard({ problemId: 'lc-217' })] }); await page.goto(`/#${route}`);
    await expect(page.getByRole('heading', { name: route[0]!.toUpperCase() + route.slice(1), exact: true })).toBeVisible(); await audit(page);
    if (route === 'library') { await checkbox(page).click(); await expect(page.getByRole('dialog')).toBeVisible(); await audit(page); }
    if (route === 'settings') { await page.getByRole('button', { name: 'Reset user data' }).click(); await page.getByRole('button', { name: 'Continue reset' }).click(); await audit(page); }
  });
}
test('review front, back and expanded guide pass automated WCAG AA', async ({ page }) => {
  await seedStored(page, { cards: [newCard({ problemId: 'lc-217' })] }); await page.goto('/#today');
  await page.getByRole('button', { name: 'Start review', exact: true }).click(); await audit(page);
  await page.getByRole('button', { name: 'Show answer', exact: true }).click(); await audit(page);
  await page.locator('.rating-guide summary').click(); await audit(page);
});
test('keyboard navigation moves focus to the new screen and reveal keeps keyboard ratings usable', async ({ page }) => {
  await page.getByRole('link', { name: 'Stats', exact: true }).focus(); await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Stats', exact: true })).toBeFocused();
  await page.getByRole('link', { name: 'Library', exact: true }).focus(); await page.keyboard.press('Enter'); await ready(page);
  await checkbox(page).focus(); await page.keyboard.press('Space');
  await page.getByRole('link', { name: 'Today', exact: true }).focus(); await page.keyboard.press('Enter');
  await page.locator('.early-queue summary').focus(); await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Review #217 Contains Duplicate New · Due tomorrow Easy', exact: true }).focus(); await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Show answer', exact: true }).focus(); await page.keyboard.press('Enter');
  await page.keyboard.press('3'); await expect(page.getByText('1 / 3 ratings today', { exact: true })).toBeVisible();
});
test('safe area layout reserves all four injected inset values and works at every width 320–1024', async ({ page }) => {
  test.setTimeout(90_000);
  await page.addStyleTag({ content: '.app-shell { --safe-top: 20px; --safe-right: 44px; --safe-bottom: 34px; --safe-left: 44px; }' });
  for (const [width, height] of matrix) {
    await page.setViewportSize({ width, height });
    const padding = await page.locator('.app-shell').evaluate((element) => {
      const s = getComputedStyle(element); return [s.paddingTop, s.paddingRight, s.paddingBottom, s.paddingLeft];
    });
    expect(padding).toEqual(['20px', '44px', '34px', '44px']); await layout(page);
  }
  for (let width = 320; width <= 1024; width++) {
    await page.setViewportSize({ width, height: 768 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});
test('review actions remain inside simulated safe areas through portrait and landscape rotation', async ({ page }) => {
  await seedStored(page, { cards: [newCard({ problemId: 'lc-3' })] });
  await page.goto('/#today');
  await page.addStyleTag({ content: '.app-shell { --safe-top: 20px; --safe-right: 44px; --safe-bottom: 34px; --safe-left: 44px; }' });
  await page.getByRole('button', { name: 'Start review', exact: true }).click(); await page.getByRole('button', { name: 'Show answer', exact: true }).click();
  const names = await page.locator('.rating-button').allTextContents();
  for (const [width, height] of matrix.slice(0, 7)) {
    await page.setViewportSize({ width, height });
    expect(await page.locator('.rating-button').allTextContents()).toEqual(names);
    for (const button of await page.locator('.rating-button').all()) {
      const rect = (await button.boundingBox())!;
      expect(rect.x).toBeGreaterThanOrEqual(44); expect(rect.x + rect.width).toBeLessThanOrEqual(width - 44);
      expect(rect.y).toBeGreaterThanOrEqual(20); expect(rect.y + rect.height).toBeLessThanOrEqual(height - 34);
    }
  }
});
test('focus, contrast, reduced motion and small-screen text reflow remain usable', async ({ page }) => {
  await seedStored(page, { cards: [newCard({ problemId: 'lc-3' })] });
  await page.goto('/#settings'); await page.getByLabel('Daily goal', { exact: true }).focus();
  await page.keyboard.press('Tab');
  expect(await page.getByLabel('Rollover hour', { exact: true }).evaluate((element) => getComputedStyle(element).outlineStyle)).toBe('solid');
  const contrast = await page.getByLabel('Daily goal', { exact: true }).evaluate((element) => {
    const s = getComputedStyle(element);
    const luminance = (color: string) => {
      const values = color.match(/\d+/g)!.slice(0, 3).map((part) => { const c = Number(part) / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
      return values[0]! * 0.2126 + values[1]! * 0.7152 + values[2]! * 0.0722;
    };
    const a = luminance(s.borderTopColor), b = luminance(s.backgroundColor); return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  });
  expect(contrast).toBeGreaterThanOrEqual(3);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--motion-duration').trim())).toMatch(/^0m?s$/);
  await page.setViewportSize({ width: 375, height: 667 });
  await page.addStyleTag({ content: 'html { font-size: 200%; }' });
  for (const route of ['library', 'stats', 'settings', 'today']) {
    await page.goto(`/#${route}`);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.querySelector('main')!.scrollWidth <= document.querySelector('main')!.clientWidth + 1)).toBe(true);
  }
  await page.getByRole('button', { name: 'Start review', exact: true }).click();
  await page.getByRole('button', { name: 'Show answer', exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && [...document.querySelectorAll('.review-problem,.review-answer,.rating-button')].every((element) => element.scrollWidth <= element.clientWidth + 1))).toBe(true);
  // At 200% text, vertical content scrolling is expected; nothing may be lost.
  await page.locator('.rating-buttons').scrollIntoViewIfNeeded();
  for (const button of await page.locator('.rating-button').all()) await expect(button).toBeInViewport();
});
