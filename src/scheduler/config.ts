import type { SchedulerSettings } from '../domain/scheduler';

export const DEFAULT_SETTINGS: SchedulerSettings = Object.freeze({
  dailyGoal: 3,
  rolloverHour: 4,
  firstReview: 'tomorrow',
  learningSteps: Object.freeze([10 * 60_000]),
  relearningSteps: Object.freeze([10 * 60_000]),
  graduatingIntervalDays: 2,
  easyIntervalDays: 5,
  maxIntervalDays: 180,
  startingEase: Object.freeze({ easy: 2.6, medium: 2.5, hard: 2.3 }),
  minEase: 1.3,
  hardMultiplier: 1.2,
  easyBonus: 1.3,
  intervalModifier: 1,
  lapseMultiplier: 0.25,
  againEasePenalty: 0.2,
  hardEasePenalty: 0.15,
  easyEaseBonus: 0.15,
  leechThreshold: 4,
  fuzzFraction: 0.05,
  fuzzMinDays: 1,
  fuzzThresholdDays: 3,
  learnAheadMs: 10 * 60_000,
});

export function requireValue(condition: unknown, message: string): asserts condition {
  if (!condition) throw new RangeError(message);
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function integer(value: unknown, minimum: number, maximum = Number.MAX_SAFE_INTEGER): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= minimum && value <= maximum;
}

export function validateSettings(value: unknown): asserts value is SchedulerSettings {
  requireValue(record(value), 'Settings must be an object');
  requireValue(integer(value.dailyGoal, 1, 20), 'dailyGoal must be 1–20');
  requireValue(integer(value.rolloverHour, 0, 23), 'rolloverHour must be 0–23');
  requireValue(value.firstReview === 'today' || value.firstReview === 'tomorrow', 'Invalid firstReview');
  for (const field of ['learningSteps', 'relearningSteps']) {
    const steps = value[field];
    requireValue(Array.isArray(steps) && steps.length > 0 && steps.every((step) => integer(step, 1)), `${field} must contain positive millisecond durations`);
  }
  requireValue(integer(value.maxIntervalDays, 1), 'Invalid maxIntervalDays');
  for (const field of ['graduatingIntervalDays', 'easyIntervalDays']) {
    requireValue(integer(value[field], 1, value.maxIntervalDays), `${field} must fit maxIntervalDays`);
  }
  requireValue(finite(value.minEase) && value.minEase >= 1.3, 'minEase must be at least 1.3');
  requireValue(record(value.startingEase), 'Invalid startingEase');
  for (const difficulty of ['easy', 'medium', 'hard']) {
    const ease = value.startingEase[difficulty];
    requireValue(finite(ease) && ease >= value.minEase, 'Starting ease must fit minEase');
  }
  for (const field of ['hardMultiplier', 'easyBonus', 'intervalModifier', 'lapseMultiplier']) {
    requireValue(finite(value[field]) && value[field] > 0, `${field} must be positive and finite`);
  }
  requireValue(finite(value.lapseMultiplier) && value.lapseMultiplier <= 1, 'lapseMultiplier must not exceed 1');
  for (const field of ['againEasePenalty', 'hardEasePenalty', 'easyEaseBonus']) {
    requireValue(finite(value[field]) && value[field] >= 0, `${field} must be nonnegative and finite`);
  }
  requireValue(integer(value.leechThreshold, 1), 'Invalid leechThreshold');
  requireValue(finite(value.fuzzFraction) && value.fuzzFraction >= 0 && value.fuzzFraction <= 1, 'fuzzFraction must be 0–1');
  requireValue(integer(value.fuzzMinDays, 0), 'Invalid fuzzMinDays');
  requireValue(integer(value.fuzzThresholdDays, 1), 'Invalid fuzzThresholdDays');
  requireValue(integer(value.learnAheadMs, 0), 'Invalid learnAheadMs');
}
