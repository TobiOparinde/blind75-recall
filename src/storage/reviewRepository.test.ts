import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { problems } from '../data';
import { ReviewRepository, ReviewConflictError, type RatingCommand } from './reviewRepository';
import { RecallDatabase } from './database';
import { DEFAULT_SETTINGS } from '../scheduler/config';
import { schedule } from '../scheduler/schedule';
import { learningCard, newCard, NOW, relearningCard, reviewCard, TODAY } from '../scheduler/testFixtures';
import type { Card, Rating } from '../domain/scheduler';

let serial = 0;
let database: RecallDatabase;
let repository: ReviewRepository;
const connections: RecallDatabase[] = [];
beforeEach(async () => {
  database = new RecallDatabase(`m4-repository-${++serial}`);
  connections.push(database);
  repository = new ReviewRepository(database, problems);
  await repository.initialize();
});
afterEach(async () => { connections.splice(0).forEach((db) => db.close()); await database.delete(); });

async function command(card: Card = reviewCard({ problemId: 'lc-217' }), rating: Rating = 3): Promise<RatingCommand> {
  await database.cards.put(card);
  const data = await repository.reviewSnapshot();
  return { revision: data.revision, cardBefore: structuredClone(card), settings: data.settings, rating, now: NOW,
    timeZone: 'UTC', preview: schedule(card, rating, NOW, data.settings, 'UTC'), durationMs: 1234 };
}

describe('atomic rating persistence', () => {
  it.each([1, 2, 3, 4] as const)('rating %i persists exactly the proposal and complete review log', async (rating) => {
    const input = await command(undefined, rating);
    const result = await repository.acceptRating(input);
    expect(result.snapshot.cards).toEqual([input.preview.nextCard]);
    expect(result.snapshot.logs).toEqual([{ id: 1, problemId: input.cardBefore.problemId, ratedAt: NOW, rating,
      stateBefore: 'review', intervalBefore: input.cardBefore.intervalDays, intervalAfter: input.preview.nextCard.intervalDays,
      easeBefore: input.cardBefore.ease, easeAfter: input.preview.nextCard.ease,
      early: input.preview.early, durationMs: 1234, cardBefore: input.cardBefore }]);
    expect(result.undo).toEqual({ revision: 1, logId: 1, cardAfter: input.preview.nextCard });
    expect(result.snapshot.revision).toBe(1);
  });

  it.each([newCard, learningCard, relearningCard])('persists and undoes every non-review state snapshot', async (factory) => {
    const input = await command(factory({ problemId: 'lc-217' }), 1);
    const result = await repository.acceptRating(input);
    const undone = await repository.undoRating(result.undo);
    expect(undone.cards).toEqual([input.cardBefore]);
    expect(undone.logs).toEqual([]);
  });

  it('records early reviews and uses the approved equations rather than freezing dates', async () => {
    const input = await command(reviewCard({ problemId: 'lc-217', dueDay: TODAY + 1, lastReviewedAt: NOW - 9 * 86_400_000 }));
    const result = await repository.acceptRating(input);
    expect(result.snapshot.logs[0]?.early).toBe(true);
    expect(result.snapshot.cards[0]?.dueDay).toBeGreaterThan(TODAY + 1);
  });

  it('duplicate delivery and reload do not create a second rating', async () => {
    const input = await command();
    const first = await repository.acceptRating(input);
    await expect(repository.acceptRating(input)).rejects.toBeInstanceOf(ReviewConflictError);
    database.close();
    const db = new RecallDatabase(database.name); connections.push(db);
    const reopened = new ReviewRepository(db, problems);
    expect(await reopened.reviewSnapshot()).toEqual(first.snapshot);
    await expect(reopened.acceptRating(input)).rejects.toBeInstanceOf(ReviewConflictError);
    expect(await db.reviewLogs.count()).toBe(1);
  });

  it('concurrent tabs accepting the same card produce only one committed log', async () => {
    const input = await command();
    const db = new RecallDatabase(database.name); connections.push(db);
    const other = new ReviewRepository(db, problems);
    const results = await Promise.allSettled([repository.acceptRating(input), other.acceptRating(input)]);
    expect(results.map((result) => result.status).sort()).toEqual(['fulfilled', 'rejected']);
    expect(await database.reviewLogs.count()).toBe(1);
  });

  it('rejects archived cards, stale settings/revisions, stale cards and altered proposals', async () => {
    let input = await command();
    await database.cards.put({ ...input.cardBefore, archived: true });
    await expect(repository.acceptRating(input)).rejects.toBeInstanceOf(ReviewConflictError);
    input = await command();
    await repository.saveSettings({ ...DEFAULT_SETTINGS, dailyGoal: 1 });
    await expect(repository.acceptRating(input)).rejects.toBeInstanceOf(ReviewConflictError);
    input = await command();
    await expect(repository.acceptRating({ ...input, preview: { ...input.preview, nextCard: { ...input.preview.nextCard, dueDay: TODAY + 99 } } })).rejects.toBeInstanceOf(ReviewConflictError);
    await database.cards.put({ ...input.cardBefore, notes: 'Changed elsewhere' });
    await expect(repository.acceptRating(input)).rejects.toBeInstanceOf(ReviewConflictError);
    expect(await database.reviewLogs.count()).toBe(0);
  });

  it.each([-1, NaN, Infinity, 0.5])('rejects invalid duration %s before writing', async (durationMs) => {
    const input = await command();
    await expect(repository.acceptRating({ ...input, durationMs })).rejects.toThrow(RangeError);
    expect(await database.reviewLogs.count()).toBe(0);
  });

  it.each(['log', 'revision', 'card'] as const)('failure writing %s rolls back card, log and revision', async (store) => {
    const input = await command();
    const before = await repository.reviewSnapshot();
    if (store === 'log') database.reviewLogs.hook('creating', () => { throw new Error('Injected failure'); });
    if (store === 'revision') database.metadata.hook('updating', () => { throw new Error('Injected failure'); });
    if (store === 'card') database.cards.hook('updating', () => { throw new Error('Injected failure'); });
    await expect(repository.acceptRating(input)).rejects.toThrow('Injected failure');
    expect(await repository.reviewSnapshot()).toEqual(before);
  });
});

describe('guarded rating undo', () => {
  it('restores all fields, removes exactly one log and never exposes an older undo', async () => {
    const first = await repository.acceptRating(await command());
    const input = await command(reviewCard({ problemId: 'lc-49', notes: 'Complete snapshot', lapses: 2 }));
    const second = await repository.acceptRating(input);
    const undone = await repository.undoRating(second.undo);
    expect(undone.cards.find((card) => card.problemId === 'lc-49')).toEqual(input.cardBefore);
    expect(undone.logs).toEqual(first.snapshot.logs);
    await expect(repository.undoRating(second.undo)).rejects.toBeInstanceOf(ReviewConflictError);
    await expect(repository.undoRating(first.undo)).rejects.toBeInstanceOf(ReviewConflictError);
  });

  it('membership changes invalidate rating undo, and rating changes invalidate membership undo', async () => {
    const tick = await repository.setCompleted(['lc-217'], true, NOW, 'UTC');
    const first = await repository.acceptRating(await command(tick.snapshot.cards[0]!, 3));
    await expect(repository.undoMembership(tick.undo!)).rejects.toThrow();
    await repository.setCompleted(['lc-49'], true, NOW, 'UTC');
    await expect(repository.undoRating(first.undo)).rejects.toBeInstanceOf(ReviewConflictError);
  });

  it('requires the latest log and exact post-rating card even if revision was not advanced', async () => {
    const first = await repository.acceptRating(await command());
    await database.reviewLogs.add({ ...first.snapshot.logs[0]!, id: 2 });
    await expect(repository.undoRating(first.undo)).rejects.toBeInstanceOf(ReviewConflictError);
    await database.reviewLogs.delete(2);
    await database.cards.put({ ...first.undo.cardAfter, notes: 'Changed card' });
    await expect(repository.undoRating(first.undo)).rejects.toBeInstanceOf(ReviewConflictError);
  });

  it('undo deletion failure rolls back the restored card and metadata', async () => {
    const result = await repository.acceptRating(await command());
    database.reviewLogs.hook('deleting', () => { throw new Error('Delete failed'); });
    await expect(repository.undoRating(result.undo)).rejects.toThrow('Delete failed');
    expect(await repository.reviewSnapshot()).toEqual(result.snapshot);
  });
});
