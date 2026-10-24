import type { LearningCard, NewCard, RelearningCard, ReviewCard, SchedulerSettings } from '../domain/scheduler';
import { DEFAULT_SETTINGS } from './config';

export const NOW = Date.parse('2026-10-24T12:00:00Z');
export const DAY_MS = 86_400_000;
export const TODAY = Math.floor(NOW / DAY_MS);
export const NO_FUZZ: SchedulerSettings = Object.freeze({ ...DEFAULT_SETTINGS, fuzzFraction: 0, fuzzMinDays: 0 });

export function reviewCard(overrides: Partial<ReviewCard> = {}): ReviewCard {
  return { problemId: 'lc-1', state: 'review', ease: 2.5, intervalDays: 10,
    dueDay: TODAY, stepIndex: 0, reps: 10, lapses: 0,
    lastReviewedAt: NOW - 10 * DAY_MS, addedAt: NOW - 30 * DAY_MS,
    archived: false, notes: 'Preserve these notes', ...overrides };
}

export function newCard(overrides: Partial<NewCard> = {}): NewCard {
  return { problemId: 'lc-1', state: 'new', ease: 2.5, intervalDays: 0,
    dueDay: TODAY, stepIndex: 0, reps: 0, lapses: 0,
    addedAt: NOW - DAY_MS, archived: false, ...overrides };
}

export function learningCard(overrides: Partial<LearningCard> = {}): LearningCard {
  return { problemId: 'lc-1', state: 'learning', ease: 2.5, intervalDays: 0,
    dueDay: TODAY - 4, dueAt: NOW, stepIndex: 0, reps: 3, lapses: 0,
    lastReviewedAt: NOW - 600_000, addedAt: NOW - 10 * DAY_MS,
    archived: false, ...overrides };
}

export function relearningCard(overrides: Partial<RelearningCard> = {}): RelearningCard {
  return { problemId: 'lc-1', state: 'relearning', ease: 2.3, intervalDays: 8,
    dueDay: TODAY - 4, dueAt: NOW, stepIndex: 0, reps: 12, lapses: 1,
    lastReviewedAt: NOW - 600_000, addedAt: NOW - 30 * DAY_MS,
    archived: false, ...overrides };
}
