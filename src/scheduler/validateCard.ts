import type { Card, SchedulerSettings } from '../domain/scheduler';
import { finite, integer, requireValue } from './config';
import { validateTimestamp } from './calendar';

export function validateCard(value: unknown, settings: SchedulerSettings): asserts value is Card {
  requireValue(value !== null && typeof value === 'object' && !Array.isArray(value), 'Card must be an object');
  const card = value as Record<string, unknown>;
  requireValue(typeof card.problemId === 'string' && card.problemId.trim().length > 0, 'Card requires problemId');
  requireValue(['new', 'learning', 'review', 'relearning'].includes(String(card.state)) && typeof card.state === 'string', 'Invalid card state');
  requireValue(finite(card.ease) && card.ease >= settings.minEase, 'Invalid card ease');
  requireValue(integer(card.intervalDays, 0, settings.maxIntervalDays), 'Card interval must fit maxIntervalDays');
  requireValue(integer(card.dueDay, Number.MIN_SAFE_INTEGER), 'Invalid dueDay');
  requireValue(integer(card.stepIndex, 0), 'Invalid stepIndex');
  requireValue(integer(card.reps, 0) && integer(card.lapses, 0, card.reps), 'Invalid repetition/lapse counters');
  requireValue(typeof card.archived === 'boolean', 'Invalid archived flag');
  requireValue(card.notes === undefined || typeof card.notes === 'string', 'Invalid notes');
  validateTimestamp(card.addedAt);
  if (card.state === 'new') {
    requireValue(card.reps === 0 && card.lapses === 0 && card.lastReviewedAt === undefined, 'New cards must be unreviewed');
  } else validateTimestamp(card.lastReviewedAt);
  if (card.state === 'new' || card.state === 'learning') {
    requireValue(card.intervalDays === 0, 'New/learning intervalDays must be zero');
  } else requireValue(card.intervalDays > 0, 'Review/relearning intervalDays must be positive');
  if (card.state === 'learning' || card.state === 'relearning') {
    validateTimestamp(card.dueAt);
    const steps = card.state === 'learning' ? settings.learningSteps : settings.relearningSteps;
    requireValue(card.stepIndex < steps.length, 'stepIndex is outside the configured steps');
  } else {
    requireValue(card.dueAt === undefined && card.stepIndex === 0, 'New/review cards require no dueAt and stepIndex zero');
  }
  if (card.state !== 'new') requireValue(card.reps > 0, 'A reviewed card requires a repetition');
}
