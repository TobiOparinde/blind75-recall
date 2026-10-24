import type { ReviewLog } from '../domain/scheduler';
import { reviewCard, NOW, DAY_MS } from '../scheduler/testFixtures';

export function historyFixture(problemId = 'lc-217') {
  const card = reviewCard({ problemId, lastReviewedAt: NOW - DAY_MS });
  const before = reviewCard({ problemId, intervalDays: 4, reps: 9, lastReviewedAt: NOW - 5 * DAY_MS });
  const log: Omit<ReviewLog, 'id'> = {
    problemId, ratedAt: NOW - DAY_MS, rating: 3, stateBefore: 'review',
    intervalBefore: 4, intervalAfter: card.intervalDays,
    easeBefore: before.ease, easeAfter: card.ease, durationMs: 1200,
    early: false, cardBefore: before,
  };
  return { card, log };
}
