import { describe, expect, it, vi } from 'vitest';
import type { Card, Rating, ReviewLog, SchedulerSettings } from '../domain/scheduler';
import { DEFAULT_SETTINGS } from './config';
import { dayIndex } from './calendar';
import { intervalPreviews, schedule } from './schedule';
import { DAY_MS, learningCard, newCard, NO_FUZZ, NOW, relearningCard, reviewCard, TODAY } from './testFixtures';

const ratings = [1, 2, 3, 4] as const;
const factories = { new: newCard, learning: learningCard, review: reviewCard, relearning: relearningCard };

describe('all default state/rating transitions', () => {
  it.each([
    ['new', 1, 'learning', 0, 2.5, 0], ['new', 2, 'learning', 0, 2.5, 0],
    ['new', 3, 'review', 2, 2.5, 0], ['new', 4, 'review', 5, 2.5, 0],
    ['learning', 1, 'learning', 0, 2.5, 0], ['learning', 2, 'learning', 0, 2.5, 0],
    ['learning', 3, 'review', 2, 2.5, 0], ['learning', 4, 'review', 5, 2.5, 0],
    ['review', 1, 'relearning', 3, 2.3, 1], ['review', 2, 'review', 12, 2.35, 0],
    ['review', 3, 'review', 25, 2.5, 0], ['review', 4, 'review', 33, 2.65, 0],
    ['relearning', 1, 'relearning', 8, 2.3, 1], ['relearning', 2, 'relearning', 8, 2.3, 1],
    ['relearning', 3, 'review', 8, 2.3, 1], ['relearning', 4, 'review', 8, 2.3, 1],
  ] as const)('%s + %i -> %s, %i days', (state, rating, nextState, interval, ease, lapses) => {
    const card = factories[state]();
    const result = schedule(card, rating, NOW, NO_FUZZ, 'UTC');
    expect(result.early).toBe(false);
    expect(result.nextCard).toMatchObject({
      state: nextState, intervalDays: interval, stepIndex: 0,
      reps: card.reps + 1, lapses, lastReviewedAt: NOW,
      problemId: card.problemId, addedAt: card.addedAt, archived: false,
    });
    expect(result.nextCard.ease).toBeCloseTo(ease, 12);
    if (nextState === 'review') {
      expect(result.nextCard.dueDay).toBe(TODAY + interval);
      expect(result.nextCard).not.toHaveProperty('dueAt');
    } else {
      expect(result.nextCard.dueAt).toBe(NOW + 600_000);
      expect(result.nextCard.dueDay).toBe(card.dueDay);
    }
    expect(result.nextCard.notes).toBe(card.notes);
  });

  it.each([[2, 13], [3, 30], [4, 46]] as const)('applies the correct late bonus for rating %i', (rating, days) => {
    const result = schedule(reviewCard({ dueDay: TODAY - 4 }), rating, NOW, NO_FUZZ, 'UTC');
    expect(result.nextCard.intervalDays).toBe(days);
    expect(result.nextCard.dueDay).toBe(TODAY + days);
  });

  it('uses pre-rating ease for Easy and respects the interval modifier', () => {
    expect(schedule(reviewCard(), 4, NOW, NO_FUZZ, 'UTC').nextCard.intervalDays).toBe(33);
    expect(schedule(reviewCard(), 3, NOW, { ...NO_FUZZ, intervalModifier: 0.5 }, 'UTC').nextCard.intervalDays).toBe(13);
  });

  it.each(ratings)('enforces the minimum ease on rating %i', (rating) => {
    const result = schedule(reviewCard({ ease: 1.3 }), rating, NOW, NO_FUZZ, 'UTC');
    expect(result.nextCard.ease).toBeCloseTo(rating === 4 ? 1.45 : 1.3, 12);
  });

  it('a lapse uses the old interval, stays bounded and is not triggered again during relearning', () => {
    const lapse = schedule(reviewCard({ intervalDays: 100, lapses: 3 }), 1, NOW, NO_FUZZ, 'UTC').nextCard;
    expect(lapse).toMatchObject({ intervalDays: 25, lapses: 4, state: 'relearning' });
    const repeat = schedule(lapse, 1, NOW + 600_000, NO_FUZZ, 'UTC').nextCard;
    expect(repeat).toMatchObject({ intervalDays: 25, lapses: 4, ease: lapse.ease });
    const exit = schedule(repeat, 3, NOW + DAY_MS, NO_FUZZ, 'UTC').nextCard;
    expect(exit).toMatchObject({ state: 'review', intervalDays: 25, dueDay: TODAY + 26, stepIndex: 0 });
  });

  it('does not suspend or archive leeches', () => {
    expect(schedule(reviewCard({ lapses: 4 }), 1, NOW, DEFAULT_SETTINGS, 'UTC').nextCard.archived).toBe(false);
  });
});

describe('multi-step learning and relearning', () => {
  const settings: SchedulerSettings = Object.freeze({ ...NO_FUZZ,
    learningSteps: Object.freeze([60_000, 600_000, 86_400_000]),
    relearningSteps: Object.freeze([60_000, 600_000, 86_400_000]),
  });

  it.each([
    [0, 1, 0, 60_000], [0, 2, 0, 60_000], [0, 3, 1, 600_000],
    [1, 1, 0, 60_000], [1, 2, 1, 600_000], [1, 3, 2, 86_400_000],
    [2, 1, 0, 60_000], [2, 2, 2, 86_400_000],
  ] as const)('learning step %i rating %i -> step %i', (stepIndex, rating, expectedStep, delay) => {
    const result = schedule(learningCard({ stepIndex }), rating, NOW, settings, 'UTC').nextCard;
    expect(result).toMatchObject({ state: 'learning', stepIndex: expectedStep, dueAt: NOW + delay, intervalDays: 0 });
  });

  it.each([0, 1, 2])('Easy graduates learning immediately from step %i', (stepIndex) => {
    expect(schedule(learningCard({ stepIndex }), 4, NOW, settings, 'UTC').nextCard)
      .toMatchObject({ state: 'review', stepIndex: 0, intervalDays: 5, dueDay: TODAY + 5 });
  });

  it('Good graduates the final learning step', () => {
    expect(schedule(learningCard({ stepIndex: 2 }), 3, NOW, settings, 'UTC').nextCard)
      .toMatchObject({ state: 'review', stepIndex: 0, intervalDays: 2 });
  });

  it.each([
    [0, 1, 0, 60_000], [0, 2, 0, 60_000], [0, 3, 1, 600_000], [0, 4, 1, 600_000],
    [1, 1, 0, 60_000], [1, 2, 1, 600_000], [1, 3, 2, 86_400_000], [1, 4, 2, 86_400_000],
    [2, 1, 0, 60_000], [2, 2, 2, 86_400_000],
  ] as const)('relearning step %i rating %i -> step %i', (stepIndex, rating, expectedStep, delay) => {
    expect(schedule(relearningCard({ stepIndex }), rating, NOW, settings, 'UTC').nextCard)
      .toMatchObject({ state: 'relearning', stepIndex: expectedStep, dueAt: NOW + delay, intervalDays: 8, ease: 2.3, lapses: 1 });
  });

  it.each([3, 4] as const)('rating %i exits final relearning with its retained interval', (rating) => {
    const result = schedule(relearningCard({ stepIndex: 2 }), rating, NOW, settings, 'UTC').nextCard;
    expect(result).toMatchObject({ state: 'review', intervalDays: 8, dueDay: TODAY + 8, ease: 2.3, lapses: 1 });
    expect(result).not.toHaveProperty('dueAt');
  });

  it('new cards start at the first step without an invented mandatory wait', () => {
    expect(schedule(newCard(), 3, NOW, settings, 'UTC').nextCard)
      .toMatchObject({ state: 'learning', stepIndex: 1, dueAt: NOW + 600_000 });
  });
});

describe('approved section 7.9 early reviews', () => {
  it.each([[2, 2.35], [3, 2.5], [4, 2.65]] as const)('early rating %i preserves an existing later schedule', (rating, ease) => {
    const card = reviewCard({ intervalDays: 30, dueDay: TODAY + 29, lastReviewedAt: NOW - DAY_MS });
    const result = schedule(card, rating, NOW, DEFAULT_SETTINGS, 'UTC');
    expect(result.early).toBe(true);
    expect(result.nextCard).toMatchObject({ dueDay: card.dueDay, intervalDays: 30, reps: 11, lastReviewedAt: NOW });
    expect(result.nextCard.ease).toBeCloseTo(ease, 12);
  });

  it.each([[2, 11], [3, 23], [4, 29]] as const)('early rating %i can extend to %i days (no blanket freeze)', (rating, expected) => {
    const card = reviewCard({ dueDay: TODAY + 1, lastReviewedAt: NOW - 9 * DAY_MS });
    const result = schedule(card, rating, NOW, NO_FUZZ, 'UTC');
    expect(result.early).toBe(true);
    expect(result.nextCard.intervalDays).toBe(expected);
    expect(result.nextCard.dueDay).toBe(TODAY + expected);
  });

  it('computes dueDay from calc, independently of max(oldIntervalDays, calc)', () => {
    const result = schedule(reviewCard({ intervalDays: 30, dueDay: TODAY + 1, lastReviewedAt: NOW - 9 * DAY_MS }), 3, NOW, NO_FUZZ, 'UTC');
    expect(result.nextCard).toMatchObject({ intervalDays: 30, dueDay: TODAY + 23 });
  });

  it('ten early Goods never move the date earlier or compound the previous interval', () => {
    let card: Card = reviewCard({ dueDay: TODAY + 29, intervalDays: 30, lastReviewedAt: NOW - DAY_MS });
    for (let attempt = 0; attempt < 10; attempt++) {
      const old = card;
      card = schedule(card, 3, NOW + attempt * 60_000, DEFAULT_SETTINGS, 'UTC').nextCard;
      expect(card.dueDay).toBeGreaterThanOrEqual(old.dueDay);
      expect(card.intervalDays).toBeGreaterThanOrEqual(old.intervalDays);
      expect(card).toMatchObject({ dueDay: TODAY + 29, intervalDays: 30 });
    }
    expect(card.reps).toBe(20);
  });

  it('repeated early Goods use minimum elapsed base 1, including same-day practice', () => {
    let card: Card = reviewCard({ intervalDays: 2, dueDay: TODAY + 1, lastReviewedAt: NOW });
    for (let attempt = 0; attempt < 10; attempt++) card = schedule(card, 3, NOW, NO_FUZZ, 'UTC').nextCard;
    expect(card).toMatchObject({ intervalDays: 3, dueDay: TODAY + 3, reps: 20 });
  });

  it('early Again follows the ordinary lapse path using the old interval', () => {
    const card = reviewCard({ intervalDays: 100, dueDay: TODAY + 99, lastReviewedAt: NOW });
    const result = schedule(card, 1, NOW, NO_FUZZ, 'UTC');
    expect(result.early).toBe(true);
    expect(result.nextCard).toMatchObject({ state: 'relearning', intervalDays: 25, dueAt: NOW + 600_000, lapses: 1, ease: 2.3 });
  });

  it('uses civil elapsed days across DST, not whole 24-hour durations', () => {
    const now = Date.parse('2026-03-29T03:01:00Z');
    const today = Date.parse('2026-03-29T00:00:00Z') / DAY_MS;
    const card = reviewCard({ intervalDays: 3, dueDay: today + 1, lastReviewedAt: Date.parse('2026-03-27T04:01:00Z') });
    expect(schedule(card, 3, now, NO_FUZZ, 'Europe/London').nextCard)
      .toMatchObject({ intervalDays: 5, dueDay: today + 5 });
  });

  it('clamps elapsed time to one if the clock moved behind the last rating', () => {
    const card = reviewCard({ intervalDays: 2, dueDay: TODAY + 1, lastReviewedAt: NOW + DAY_MS });
    expect(schedule(card, 3, NOW, NO_FUZZ, 'UTC').nextCard).toMatchObject({ intervalDays: 3, dueDay: TODAY + 3 });
  });

  it.each(ratings)('future new cards use their own state machine for manual rating %i', (rating) => {
    const result = schedule(newCard({ dueDay: TODAY + 1 }), rating, NOW, NO_FUZZ, 'UTC');
    expect(result.early).toBe(true);
    expect(result.nextCard.state).toBe(rating <= 2 ? 'learning' : 'review');
  });

  it.each([learningCard, relearningCard])('early step review is based on dueAt, not stale dueDay', (factory) => {
    const result = schedule(factory({ dueAt: NOW + 600_000, dueDay: TODAY - 10 }), 2, NOW, NO_FUZZ, 'UTC');
    expect(result.early).toBe(true);
    expect(result.nextCard.dueAt).toBe(NOW + 600_000);
  });
});

describe('cap saturation and ordering', () => {
  it.each([[177, 178, 179, 180], [178, 179, 180, 180], [179, 180, 180, 180], [180, 180, 180, 180]])(
    'interval %i saturates at %i/%i/%i', (intervalDays, hard, good, easy) => {
      const previews = intervalPreviews(reviewCard({ intervalDays }), NOW, DEFAULT_SETTINGS, 'UTC');
      expect([previews[2].nextCard.intervalDays, previews[3].nextCard.intervalDays, previews[4].nextCard.intervalDays]).toEqual([hard, good, easy]);
    },
  );

  it.each([1.3, 2.5, 6])('orders every valid starting interval at ease %s, even with large lateness', (ease) => {
    for (let intervalDays = 1; intervalDays <= 180; intervalDays++) {
      for (const late of [0, 30, 10_000]) {
        const result = intervalPreviews(reviewCard({ intervalDays, ease, dueDay: TODAY - late }), NOW, DEFAULT_SETTINGS, 'UTC');
        const [hard, good, easy] = [result[2].nextCard.intervalDays, result[3].nextCard.intervalDays, result[4].nextCard.intervalDays];
        const floor = Math.min(intervalDays + 1, 180);
        expect(hard).toBeGreaterThanOrEqual(floor);
        expect(easy).toBeLessThanOrEqual(180);
        if (floor <= 178) {
          expect(hard).toBeLessThan(good!);
          expect(good).toBeLessThan(easy!);
        } else {
          expect(hard).toBeLessThanOrEqual(good!);
          expect(good).toBeLessThanOrEqual(easy!);
          if (hard === good || good === easy) expect(easy).toBe(180);
        }
      }
    }
  });

  it.each([1, 2, 3, 5, 40])('supports configurable cap %i without exceeding it', (maximum) => {
    const settings = { ...NO_FUZZ, maxIntervalDays: maximum, graduatingIntervalDays: 1, easyIntervalDays: Math.min(5, maximum) };
    const result = intervalPreviews(reviewCard({ intervalDays: maximum }), NOW, settings, 'UTC');
    expect(ratings.map((rating) => result[rating].nextCard.intervalDays).every((days) => days >= 1 && days <= maximum)).toBe(true);
    expect([result[2].nextCard.intervalDays, result[3].nextCard.intervalDays, result[4].nextCard.intervalDays]).toEqual([maximum, maximum, maximum]);
  });
});

describe('preview equality, immutability and log snapshots', () => {
  it.each([
    newCard(), learningCard(), relearningCard(), reviewCard(),
    reviewCard({ dueDay: TODAY - 20 }), reviewCard({ dueDay: TODAY + 10 }),
    reviewCard({ intervalDays: 180 }),
  ])('previews are deeply identical to applying each rating for $state', (input) => {
    const card = Object.freeze(input);
    const snapshot = structuredClone(card);
    const previews = intervalPreviews(card, NOW, DEFAULT_SETTINGS, 'Europe/London');
    for (const rating of [...ratings].reverse()) {
      expect(schedule(card, rating, NOW, DEFAULT_SETTINGS, 'Europe/London')).toStrictEqual(previews[rating]);
    }
    expect(card).toStrictEqual(snapshot);
  });

  it('does not read an ambient clock or randomness', () => {
    vi.spyOn(Date, 'now').mockImplementation(() => { throw new Error('Ambient clock'); });
    vi.spyOn(Math, 'random').mockImplementation(() => { throw new Error('Ambient randomness'); });
    expect(() => intervalPreviews(reviewCard(), NOW, DEFAULT_SETTINGS, 'UTC')).not.toThrow();
  });

  it('retains absolute learning delays across a DST change', () => {
    const now = Date.parse('2026-03-29T00:55:00Z');
    const result = schedule(learningCard(), 1, now, DEFAULT_SETTINGS, 'Europe/London');
    expect(result.nextCard.dueAt).toBe(Date.parse('2026-03-29T01:05:00Z'));
  });

  it('does not refuzz graduation or relearning exit', () => {
    for (let reps = 1; reps <= 50; reps++) {
      expect(schedule(learningCard({ reps }), 4, NOW, DEFAULT_SETTINGS, 'UTC').nextCard.intervalDays).toBe(5);
      expect(schedule(relearningCard({ reps, lapses: 0 }), 3, NOW, DEFAULT_SETTINGS, 'UTC').nextCard.intervalDays).toBe(8);
    }
  });

  it('the full log snapshot can restore steps, counters and the deterministic result', () => {
    const cardBefore = Object.freeze(relearningCard({ notes: 'Keep', dueAt: NOW - 1234 }));
    const proposal = schedule(cardBefore, 3, NOW, DEFAULT_SETTINGS, 'UTC');
    const log: ReviewLog = {
      id: 1, problemId: cardBefore.problemId, ratedAt: NOW, rating: 3,
      stateBefore: cardBefore.state, intervalBefore: cardBefore.intervalDays,
      intervalAfter: proposal.nextCard.intervalDays, easeBefore: cardBefore.ease,
      easeAfter: proposal.nextCard.ease, durationMs: 1000, early: proposal.early,
      cardBefore: structuredClone(cardBefore),
    };
    expect(log.cardBefore).toStrictEqual(cardBefore);
    expect(schedule(log.cardBefore, log.rating, log.ratedAt, DEFAULT_SETTINGS, 'UTC')).toStrictEqual(proposal);
  });

  it.each([0, 5, NaN])('rejects invalid rating %s', (rating) => {
    expect(() => schedule(reviewCard(), rating as Rating, NOW, DEFAULT_SETTINGS, 'UTC')).toThrow(RangeError);
  });
  it('rejects archived cards and overflow without returning corrupt updates', () => {
    expect(() => schedule(reviewCard({ archived: true }), 3, NOW, DEFAULT_SETTINGS, 'UTC')).toThrow();
    expect(() => schedule(reviewCard({ reps: Number.MAX_SAFE_INTEGER }), 3, NOW, DEFAULT_SETTINGS, 'UTC')).toThrow();
    expect(() => schedule(reviewCard(), 3, NOW, { ...DEFAULT_SETTINGS, intervalModifier: Number.MAX_VALUE }, 'UTC')).toThrow();
  });

  it('calendar changes do not mutate stored dates or timestamps', () => {
    const card = Object.freeze(reviewCard());
    const before = structuredClone(card);
    for (const zone of ['UTC', 'Asia/Tokyo', 'America/Los_Angeles']) {
      schedule(card, 3, NOW - DAY_MS, DEFAULT_SETTINGS, zone);
      dayIndex(NOW, 4, zone);
    }
    expect(card).toStrictEqual(before);
  });
});
