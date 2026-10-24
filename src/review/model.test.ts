import { describe, expect, it } from 'vitest';
import { problems } from '../data';
import type { ReviewLog } from '../domain/scheduler';
import { DEFAULT_SETTINGS } from '../scheduler/config';
import { intervalPreviews } from '../scheduler/schedule';
import { learningCard, newCard, NOW, reviewCard, TODAY } from '../scheduler/testFixtures';
import { countdown, previewLabel, sameValue, todayModel } from './model';

function log(id: number, ratedAt = NOW): ReviewLog {
  return { id, problemId: 'lc-217', ratedAt, rating: 3, stateBefore: 'review', intervalBefore: 10, intervalAfter: 25,
    easeBefore: 2.5, easeAfter: 2.5, durationMs: 1000, early: true, cardBefore: reviewCard({ problemId: 'lc-217' }) };
}
describe('Today presentation from M2 queue and committed logs', () => {
  it('counts ready groups, excludes archives and shows manual future cards', () => {
    const model = todayModel([learningCard({ problemId: 'lc-217' }), reviewCard({ problemId: 'lc-49' }), newCard({ problemId: 'lc-76' }),
      reviewCard({ problemId: 'lc-1', dueDay: TODAY + 1 }), newCard({ problemId: 'lc-242', archived: true })], [], problems, NOW, DEFAULT_SETTINGS, 'UTC');
    expect(model).toMatchObject({ activeCount: 4, learning: 1, review: 1, fresh: 1, tomorrow: 1, completed: 0, streak: 0 });
    expect(model.earlyCards.map((card) => card.problemId)).toEqual(['lc-1']);
    expect(model.picks).toHaveLength(3);
  });
  it('goal 1 is soft, counts repeated/early events and restores progress after undo', () => {
    const cards = [reviewCard({ problemId: 'lc-217' }), reviewCard({ problemId: 'lc-49' })];
    const settings = { ...DEFAULT_SETTINGS, dailyGoal: 1 };
    expect(todayModel(cards, [], problems, NOW, settings, 'UTC').picks).toHaveLength(1);
    expect(todayModel(cards, [log(1), log(2)], problems, NOW, settings, 'UTC')).toMatchObject({ completed: 2, goalHit: true, picks: [], streak: 1 });
    expect(todayModel(cards, [], problems, NOW, settings, 'UTC').goalHit).toBe(false);
  });
  it('streak uses consecutive distinct local days ending today or yesterday', () => {
    const logs = [log(1, NOW - 86_400_000), log(2, NOW - 2 * 86_400_000), log(3, NOW - 86_400_000), log(4, NOW + 86_400_000)];
    expect(todayModel([], logs, problems, NOW, DEFAULT_SETTINGS, 'UTC').streak).toBe(2);
    expect(todayModel([], [...logs, log(5)], problems, NOW, DEFAULT_SETTINGS, 'UTC').streak).toBe(3);
    expect(todayModel([], logs, problems, NOW + 3 * 86_400_000, DEFAULT_SETTINGS, 'UTC').streak).toBe(0);
  });
  it('classifies ratings using rollover/DST instead of fixed 24-hour buckets', () => {
    const now = Date.parse('2026-03-29T03:01:00Z');
    expect(todayModel([], [log(1, Date.parse('2026-03-29T02:59:00Z')), log(2, now)], problems, now, DEFAULT_SETTINGS, 'Europe/London'))
      .toMatchObject({ completed: 1, streak: 2 });
  });
});
describe('preview labels and waiting countdown', () => {
  it('shows dates from exact results, including preserved early dates', () => {
    const previews = intervalPreviews(reviewCard({ dueDay: TODAY + 29, lastReviewedAt: NOW }), NOW, DEFAULT_SETTINGS, 'UTC');
    expect(previewLabel(previews[1], NOW, DEFAULT_SETTINGS, 'UTC')).toBe('10m');
    expect(previewLabel(previews[3], NOW, DEFAULT_SETTINGS, 'UTC')).toBe('29d');
  });
  it.each([[462_000, '7:42'], [600_000, '10:00'], [1, '0:01'], [0, '0:00'], [-1000, '0:00']])('formats delay %i as %s', (delay, expected) => {
    expect(countdown(NOW + Number(delay), NOW)).toBe(expected);
  });
  it('compares immutable data structurally, including settings with different key order', () => {
    expect(sameValue({ a: 1, b: [2, 3] }, { b: [2, 3], a: 1 })).toBe(true);
    expect(sameValue({ a: 1 }, { a: 2 })).toBe(false);
    expect(sameValue(null, {})).toBe(false);
    expect(sameValue([1], { 0: 1 })).toBe(false);
  });
});
