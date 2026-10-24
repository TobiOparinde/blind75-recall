import { expect, type Page } from '@playwright/test';
import type { Card, ReviewLog, SchedulerSettings } from '../../src/domain/scheduler';
import type { SettingsRecord } from '../../src/storage/database';

export const NOW = Date.parse('2026-10-24T12:00:00Z');
export const TODAY = 20750;
export const checkbox = (page: Page, title = 'Contains Duplicate') => page.getByRole('checkbox', { name: `Completed: ${title}`, exact: true });
export const row = (page: Page, id: string) => page.locator(`[data-problem-id="${id}"]`);

export async function ready(page: Page) {
  await expect(checkbox(page)).toBeEnabled();
  await expect(page.locator('#library')).toHaveAttribute('aria-busy', 'false');
}

export async function settled(page: Page) {
  await expect(page.locator('#library')).toHaveAttribute('aria-busy', 'false');
}

export async function readStored(page: Page) {
  return page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('blind75-recall');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction(['cards', 'reviewLogs', 'settings'], 'readonly');
    const done = new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(transaction.error);
    });
    const read = <T,>(table: string) => new Promise<T[]>((resolve, reject) => {
      const request = transaction.objectStore(table).getAll();
      request.onsuccess = () => resolve(request.result as T[]);
      request.onerror = () => reject(request.error);
    });
    const [cards, logs, settings] = await Promise.all([read<Card>('cards'), read<ReviewLog>('reviewLogs'), read<SettingsRecord>('settings')]);
    await done;
    const version = database.version;
    database.close();
    return { cards, logs, settings, version };
  });
}

export function historyFixture() {
  const card: Card = {
    problemId: 'lc-217', state: 'review', ease: 2.3, intervalDays: 20,
    dueDay: TODAY + 5, stepIndex: 0, reps: 8, lapses: 2,
    lastReviewedAt: NOW - 15 * 86_400_000, addedAt: NOW - 100 * 86_400_000,
    archived: false, notes: 'My saved pattern note',
  };
  const log: Omit<ReviewLog, 'id'> = {
    problemId: card.problemId, ratedAt: card.lastReviewedAt!, rating: 3,
    stateBefore: 'review', intervalBefore: 8, intervalAfter: 20,
    easeBefore: 2.3, easeAfter: 2.3, durationMs: 900, early: false,
    cardBefore: { ...card, intervalDays: 8, dueDay: TODAY - 15, reps: 7 },
  };
  return { card, log };
}

/** Native IndexedDB fixtures, deliberately without any production test hooks. */
export async function seedStored(page: Page, fixture: { cards?: readonly Card[]; logs?: readonly Omit<ReviewLog, 'id'>[]; firstReview?: SchedulerSettings['firstReview'] }) {
  await page.evaluate(async (fixture) => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('blind75-recall');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction(['cards', 'reviewLogs', 'settings', 'metadata'], 'readwrite');
    const done = new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(transaction.error);
    });
    fixture.cards?.forEach((card) => transaction.objectStore('cards').put(card));
    fixture.logs?.forEach((log) => transaction.objectStore('reviewLogs').add(log));
    if (fixture.firstReview) {
      const request = transaction.objectStore('settings').get('scheduler');
      request.onsuccess = () => {
        const row = request.result as SettingsRecord;
        transaction.objectStore('settings').put({ ...row, value: { ...row.value, firstReview: fixture.firstReview } });
      };
    }
    const revision = transaction.objectStore('metadata').get('membershipRevision');
    revision.onsuccess = () => transaction.objectStore('metadata').put({ key: 'membershipRevision', value: (revision.result as { value: number }).value + 1 });
    await done;
    database.close();
  }, fixture);
  await page.reload();
  await ready(page);
}
