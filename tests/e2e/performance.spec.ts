import { mkdir, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import type { Problem } from '../../src/domain/problem';
import type { ReviewLog } from '../../src/domain/scheduler';
import { schedule } from '../../src/scheduler/schedule';
import { DEFAULT_SETTINGS } from '../../src/scheduler/config';
import { newCard, reviewCard } from '../../src/scheduler/testFixtures';
import { dayIndex } from '../../src/scheduler/calendar';
import { ready, seedStored } from './library.helpers';
const { problems } = JSON.parse(readFileSync(new URL('../../src/data/blind75.v1.json', import.meta.url), 'utf8')) as { problems: Problem[] };

test.use({ trace: 'off', timezoneId: 'UTC', viewport: { width: 390, height: 844 } });
for (const historySize of [5000, 10_000]) test(`profile ready/offline launches and rating paint latency with ${historySize} historical ratings`, async ({ page, context, browserName, browser }, info) => {
  test.setTimeout(240_000);
  const now = Date.now();
  await page.addInitScript(() => {
    const metrics = window as unknown as { auditReady?: number };
    const observer = new MutationObserver(() => {
      if (document.querySelector('.today .goal-ring')) {
        observer.disconnect(); requestAnimationFrame(() => { metrics.auditReady = performance.now(); });
      }
    });
    observer.observe(document, { childList: true, subtree: true });
  });
  const launch = async (initial = false) => {
    if (initial) await page.goto('/#today'); else await page.reload();
    await expect.poll(() => page.evaluate(() => (window as unknown as { auditReady?: number }).auditReady ?? 0)).toBeGreaterThan(0);
    return page.evaluate(() => (window as unknown as { auditReady: number }).auditReady);
  };
  const coldMs = await launch(true);
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  const warmMs = await launch();
  await context.setOffline(true); const offlineMs = await launch(); await context.setOffline(false);
  await page.goto('/#library'); await ready(page);
  let card = reviewCard({ problemId: 'lc-217', dueDay: dayIndex(now, 4, 'UTC') + 90, reps: 1 });
  const logs: Omit<ReviewLog, 'id'>[] = [];
  for (let index = 0; index < historySize; index++) {
    const ratedAt = now - (historySize - index) * 60_000;
    const result = schedule(card, 3, ratedAt, DEFAULT_SETTINGS, 'UTC');
    logs.push({ problemId: card.problemId, ratedAt, rating: 3, stateBefore: card.state, intervalBefore: card.intervalDays,
      intervalAfter: result.nextCard.intervalDays, easeBefore: card.ease, easeAfter: result.nextCard.ease, durationMs: 1000, early: result.early, cardBefore: card });
    if (result.nextCard.state !== 'review') throw new Error('Benchmark history must stay in review');
    card = result.nextCard;
  }
  await seedStored(page, { cards: [card, ...problems.filter((problem) => problem.id !== card.problemId).map((problem) => newCard({ problemId: problem.id }))], logs, settings: { dailyGoal: 20 } });
  await page.goto('/#today');
  // Immediately after rollover, fewer than 20 history events may belong to today.
  await page.getByRole('button', { name: /^(Start review|Keep going)$/ }).click();
  const samples: { domMs: number; paintMs: number }[] = [];
  for (let index = 0; index < 10; index++) {
    await page.getByRole('button', { name: 'Show answer', exact: true }).click();
    await page.evaluate(() => {
      const metrics = window as unknown as { auditRating?: { domMs: number; paintMs: number } };
      delete metrics.auditRating;
      document.addEventListener('click', () => {
        const start = performance.now(); const old = document.querySelector('.review-problem h1')?.textContent;
        const observer = new MutationObserver(() => {
          if (document.querySelector('.review-problem h1')?.textContent !== old) {
            observer.disconnect(); const domMs = performance.now() - start;
            requestAnimationFrame(() => requestAnimationFrame(() => { metrics.auditRating = { domMs, paintMs: performance.now() - start }; }));
          }
        });
        observer.observe(document.querySelector('main')!, { childList: true, subtree: true, characterData: true });
      }, { capture: true, once: true });
    });
    await page.getByRole('button', { name: 'Good 2d', exact: true }).click();
    await expect.poll(() => page.evaluate(() => Boolean((window as unknown as { auditRating?: unknown }).auditRating))).toBe(true);
    samples.push(await page.evaluate(() => (window as unknown as { auditRating: { domMs: number; paintMs: number } }).auditRating));
    await expect(page.locator('main')).toHaveAttribute('aria-busy', 'false');
  }
  const sorted = [...samples].sort((a, b) => a.paintMs - b.paintMs);
  const result = { browserName, browserVersion: browser.version(), date: new Date().toISOString(), platform: process.platform,
    viewport: '390x844', throttle: 'none; local production server; trace disabled', historicalRatings: historySize, cards: 75,
    coldMs, warmMs, offlineMs, samples, medianPaintMs: sorted[5]!.paintMs, p95PaintMs: sorted[9]!.paintMs };
  await mkdir('.local', { recursive: true }); await writeFile(`.local/performance-${browserName}${historySize === 5000 ? '' : `-${historySize}`}.json`, JSON.stringify(result, null, 2) + '\n');
  await info.attach('performance', { body: JSON.stringify(result), contentType: 'application/json' });
  expect(result.p95PaintMs).toBeLessThan(100);
});
