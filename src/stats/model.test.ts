import { describe, expect, it } from 'vitest';
import { problems } from '../data';
import { DEFAULT_SETTINGS } from '../scheduler/config';
import { DAY_MS, learningCard, newCard, NOW, relearningCard, reviewCard, TODAY } from '../scheduler/testFixtures';
import type { Card, Rating, ReviewLog } from '../domain/scheduler';
import { statsModel } from './model';

function log(id: number, rating: Rating, days = 0, state: Card['state'] = 'review', problemId = 'lc-217'): ReviewLog {
  return { id, rating, problemId, ratedAt: NOW - days * DAY_MS, stateBefore: state, intervalBefore: 10, intervalAfter: 20,
    easeBefore: 2.5, easeAfter: 2.5, durationMs: 100, early: false, cardBefore: reviewCard({ problemId }) };
}
const model = (cards: readonly Card[] = [], logs: readonly ReviewLog[] = [], now = NOW, zone = 'UTC') => statsModel({ cards, logs, settings: DEFAULT_SETTINGS, revision: 0 }, problems, now, zone);
describe('derived statistics', () => {
  it('returns an empty forecast and unknown retention for an empty deck', () => {
    const stats = model(); expect(stats.dueToday).toBe(0); expect(stats.streak).toBe(0);
    expect(stats.retention).toBeNull(); expect(stats.forecast.map((day) => day.count)).toEqual([0, 0, 0, 0, 0, 0, 0]);
  });
  it('counts only ready active cards due today, with waiting steps in today’s forecast', () => {
    const stats = model([newCard(), reviewCard({ problemId: 'lc-217', dueDay: TODAY - 3 }), learningCard({ problemId: 'lc-242' }),
      relearningCard({ problemId: 'lc-49', dueAt: NOW + 60_000 }), reviewCard({ problemId: 'lc-347', dueDay: TODAY + 1 }), reviewCard({ problemId: 'lc-238', archived: true })]);
    expect(stats.dueToday).toBe(3); expect(stats.forecast.map((day) => day.count)).toEqual([4, 1, 0, 0, 0, 0, 0]);
  });
  it('forecasts exact stored deadlines, overdue rolled into today, and ignores day seven', () => {
    const stats = model([-5, 0, 1, 2, 3, 4, 5, 6, 7].map((offset, index) => reviewCard({ problemId: problems[index]!.id, dueDay: TODAY + offset })));
    expect(stats.forecast.map((day) => day.count)).toEqual([2, 1, 1, 1, 1, 1, 1]);
  });
  it.each([['new', newCard(), 'New'], ['learning', learningCard(), 'Learning'], ['relearning', relearningCard(), 'Learning'],
    ['young', reviewCard({ intervalDays: 20 }), 'Young'], ['mature', reviewCard({ intervalDays: 21 }), 'Mature']] as const)('classifies %s', (_, card, label) => {
    expect(model([card]).maturity[label]).toBe(1); expect(Object.values(model([{ ...card, archived: true }]).maturity)).toEqual([0, 0, 0, 0]);
  });
  it('counts Good/Easy across all states, early practice and archived history within 30 logical days', () => {
    const stats = model([reviewCard({ archived: true })], [log(1, 3, 0, 'new'), { ...log(2, 4, 29), early: true }, log(3, 1, 1), log(4, 2, 2), log(5, 4, 30), log(6, 4, -1)]);
    expect(stats.retention).toBe(0.5); expect(stats.retentionReviews).toBe(4);
  });
  it.each([[[], 0], [[0, 0, 1, 2], 3], [[1, 2], 2], [[2, 3], 0], [[-1, 0, 1], 2]])('streak uses consecutive distinct logical days %j', (days, expected) => {
    expect(model([], days.map((day, index) => log(index + 1, 3, day))).streak).toBe(expected);
  });
  it('attributes learning forecasts and retention at rollover across DST using M2 civil days', () => {
    const now = Date.parse('2026-10-25T04:01:00Z');
    const before = Date.parse('2026-10-25T03:59:00Z');
    const stats = model([learningCard({ dueAt: before }), learningCard({ problemId: 'lc-217', dueAt: now + DAY_MS })], [{ ...log(1, 3), ratedAt: before }], now, 'Europe/London');
    expect(stats.streak).toBe(1); expect(stats.forecast.slice(0, 2).map((day) => day.count)).toEqual([1, 1]);
  });
  it('measures category lapses from review-state Again, not learning Again', () => {
    const stats = model([], [log(1, 1), log(2, 3), log(3, 1, 0, 'learning'), log(4, 3, 0, 'review', 'lc-125')]);
    expect(stats.weakest[0]).toEqual({ category: 'Arrays & Hashing', lapses: 1, reviews: 2, rate: 0.5 });
    expect(stats.weakest[1]?.rate).toBe(0);
  });
  it('detects active leeches at the configured threshold without suspending them', () => {
    const stats = model([reviewCard({ lapses: 3 }), reviewCard({ problemId: 'lc-217', lapses: 4 }), reviewCard({ problemId: 'lc-242', lapses: 9, archived: true })]);
    expect(stats.leeches.map((card) => card.problemId)).toEqual(['lc-217']); expect(stats.dueToday).toBe(2);
  });
});
