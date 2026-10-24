import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, validateSettings } from './config';
import { validateCard } from './validateCard';
import { learningCard, newCard, relearningCard, reviewCard } from './testFixtures';

describe('typed configuration and state invariants', () => {
  it('centralizes all approved defaults and freezes nested values', () => {
    expect(DEFAULT_SETTINGS).toEqual({
      dailyGoal: 3, rolloverHour: 4, firstReview: 'tomorrow',
      learningSteps: [600_000], relearningSteps: [600_000],
      graduatingIntervalDays: 2, easyIntervalDays: 5, maxIntervalDays: 180,
      startingEase: { easy: 2.6, medium: 2.5, hard: 2.3 }, minEase: 1.3,
      hardMultiplier: 1.2, easyBonus: 1.3, intervalModifier: 1, lapseMultiplier: 0.25,
      againEasePenalty: 0.2, hardEasePenalty: 0.15, easyEaseBonus: 0.15,
      leechThreshold: 4, fuzzFraction: 0.05, fuzzMinDays: 1, fuzzThresholdDays: 3,
      learnAheadMs: 600_000,
    });
    expect(Object.isFrozen(DEFAULT_SETTINGS)).toBe(true);
    expect(Object.isFrozen(DEFAULT_SETTINGS.learningSteps)).toBe(true);
    expect(Object.isFrozen(DEFAULT_SETTINGS.relearningSteps)).toBe(true);
    expect(Object.isFrozen(DEFAULT_SETTINGS.startingEase)).toBe(true);
    expect(() => validateSettings(DEFAULT_SETTINGS)).not.toThrow();
  });

  it.each([
    ['dailyGoal', 0], ['dailyGoal', 21], ['dailyGoal', 1.5],
    ['rolloverHour', -1], ['rolloverHour', 24], ['rolloverHour', 4.5],
    ['firstReview', 'next-week'], ['learningSteps', []], ['learningSteps', [0]],
    ['learningSteps', [-1]], ['learningSteps', [Infinity]], ['learningSteps', [1.5]],
    ['relearningSteps', []], ['relearningSteps', ['600000']],
    ['maxIntervalDays', 0], ['maxIntervalDays', 2], ['maxIntervalDays', NaN],
    ['graduatingIntervalDays', 0], ['graduatingIntervalDays', 181],
    ['easyIntervalDays', 181], ['minEase', 1.2], ['minEase', Infinity],
    ['startingEase', { easy: 2.6, medium: 2.5, hard: 1.2 }], ['startingEase', {}],
    ['hardMultiplier', 0], ['easyBonus', Infinity], ['intervalModifier', NaN],
    ['lapseMultiplier', 0], ['lapseMultiplier', 1.1], ['againEasePenalty', -0.2],
    ['hardEasePenalty', NaN], ['easyEaseBonus', -1], ['leechThreshold', 0],
    ['fuzzFraction', -1], ['fuzzFraction', 1.1], ['fuzzMinDays', -1],
    ['fuzzThresholdDays', 0], ['learnAheadMs', -1],
  ])('rejects invalid %s = %j', (field, value) => {
    expect(() => validateSettings({ ...DEFAULT_SETTINGS, [field]: value })).toThrow(RangeError);
  });

  it.each([null, [], {}, { ...DEFAULT_SETTINGS, minEase: undefined }])('rejects malformed settings', (value) => {
    expect(() => validateSettings(value)).toThrow(RangeError);
  });

  it.each([newCard(), learningCard(), reviewCard(), relearningCard()])('accepts a canonical $state card', (card) => {
    expect(() => validateCard(card, DEFAULT_SETTINGS)).not.toThrow();
  });

  it.each([
    ['state', 'invalid'], ['state', ['review']], ['problemId', ''], ['ease', 1.2],
    ['ease', NaN], ['intervalDays', 0], ['intervalDays', 181], ['intervalDays', -1],
    ['intervalDays', 1.5], ['dueDay', NaN], ['dueDay', 0.5], ['dueAt', 1000],
    ['stepIndex', 1], ['reps', -1], ['reps', 0], ['reps', NaN], ['lapses', 11],
    ['lapses', -1], ['archived', 'false'], ['notes', false], ['addedAt', NaN],
    ['lastReviewedAt', undefined],
  ])('rejects malformed review card %s = %j', (field, value) => {
    expect(() => validateCard({ ...reviewCard(), [field]: value }, DEFAULT_SETTINGS)).toThrow(RangeError);
  });

  it.each([
    { ...newCard(), reps: 1 }, { ...newCard(), lastReviewedAt: 0 },
    { ...newCard(), intervalDays: 1 }, { ...learningCard(), intervalDays: 1 },
    { ...learningCard(), dueAt: undefined }, { ...learningCard(), stepIndex: 1 },
    { ...relearningCard(), intervalDays: 0 }, { ...relearningCard(), stepIndex: -1 },
    null, [],
  ])('rejects incompatible state fields', (value) => {
    expect(() => validateCard(value, DEFAULT_SETTINGS)).toThrow(RangeError);
  });

  it('rejects a lower cap or removed step rather than silently changing a card', () => {
    expect(() => validateCard(reviewCard(), { ...DEFAULT_SETTINGS, maxIntervalDays: 5 })).toThrow();
    expect(() => validateCard(learningCard({ stepIndex: 1 }), DEFAULT_SETTINGS)).toThrow();
  });
});
