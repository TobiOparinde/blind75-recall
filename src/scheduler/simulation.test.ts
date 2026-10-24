import { describe, expect, it } from 'vitest';
import { problems } from '../data';
import type { Card, CardState, Rating, SchedulerSettings } from '../domain/scheduler';
import { dayIndex } from './calendar';
import { DEFAULT_SETTINGS } from './config';
import { buildQueue } from './queue';
import { intervalPreviews, schedule } from './schedule';
import { validateCard } from './validateCard';

function simulate(settings: SchedulerSettings, timeZone: string) {
  const start = Date.parse('2026-01-01T12:00:00Z');
  const startDay = dayIndex(start, settings.rolloverHour, timeZone);
  let seed = 0x75c0ffee;
  const random = () => {
    seed = (Math.imul(seed, 1_664_525) + 1_013_904_223) >>> 0;
    return seed / 4_294_967_296;
  };
  const cards = new Map<string, Card>(problems.map((problem, i) => [problem.id, {
    problemId: problem.id, state: 'new', ease: settings.startingEase[problem.difficulty],
    intervalDays: 0, dueDay: startDay + (settings.firstReview === 'tomorrow' ? 1 : 0),
    stepIndex: 0, reps: 0, lapses: 0, addedAt: start + i, archived: false,
  }]));
  const states = new Set<CardState>(['new']);
  const ratingCounts = [0, 0, 0, 0];
  let earlyCount = 0;
  let total = 0;

  for (let day = 0; day < 365; day++) {
    let completed = 0;
    const apply = (card: Card, now: number) => {
      const rating = (Math.floor(random() * 4) + 1) as Rating;
      const captured = Object.freeze(card);
      const previews = intervalPreviews(captured, now, settings, timeZone);
      const result = schedule(captured, rating, now, settings, timeZone);
      expect(result).toStrictEqual(previews[rating]);
      expect(() => validateCard(result.nextCard, settings)).not.toThrow();
      const next = result.nextCard;
      for (const value of Object.values(next).filter((value) => typeof value === 'number')) {
        expect(Number.isFinite(value)).toBe(true);
      }
      expect(next.intervalDays).toBeGreaterThanOrEqual(0);
      expect(next.intervalDays).toBeLessThanOrEqual(settings.maxIntervalDays);
      expect(next.ease).toBeGreaterThanOrEqual(1.3);
      expect(next.reps).toBe(card.reps + 1);
      expect(next.lapses).toBe(card.lapses + (card.state === 'review' && rating === 1 ? 1 : 0));
      if (card.state === 'review' && result.early && rating !== 1) {
        expect(next.dueDay).toBeGreaterThanOrEqual(card.dueDay);
        expect(next.intervalDays).toBeGreaterThanOrEqual(card.intervalDays);
      }
      cards.set(card.problemId, next);
      states.add(next.state);
      ratingCounts[rating - 1] = ratingCounts[rating - 1]! + 1;
      earlyCount += Number(result.early);
      completed++;
      total++;
    };

    for (const minutes of [0, 15, 30, 90]) {
      const now = start + day * 86_400_000 + minutes * 60_000;
      const queue = buildQueue([...cards.values()], problems, now, settings, timeZone, completed);
      for (const card of queue.ready) apply(cards.get(card.problemId)!, now);
      if (minutes === 90 && day % 7 === 0) {
        const card = [...cards.values()][Math.floor(random() * cards.size)]!;
        apply(card, now);
      }
    }
  }
  expect([...states].sort()).toEqual(['learning', 'new', 'relearning', 'review']);
  expect(ratingCounts.every((count) => count > 0)).toBe(true);
  expect(earlyCount).toBeGreaterThan(0);
  expect(total).toBeGreaterThan(1000);
  return { cards: [...cards.values()], total, earlyCount, ratingCounts };
}

describe('seeded 365-day invariant simulation over all 75 problems', () => {
  it.each([
    ['default London', DEFAULT_SETTINGS, 'Europe/London'],
    ['multi-step New York with 30-day cap', { ...DEFAULT_SETTINGS,
      learningSteps: [60_000, 600_000], relearningSteps: [60_000, 600_000, 3_600_000],
      maxIntervalDays: 30 }, 'America/New_York'],
  ] as const)('%s is bounded and exactly reproducible', (_name, settings, zone) => {
    expect(simulate(settings, zone)).toStrictEqual(simulate(settings, zone));
  }, 15_000);
});
