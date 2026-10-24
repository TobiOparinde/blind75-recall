import type { Card, CardFields, IntervalPreviews, Rating, ReviewCard, ScheduleResult, SchedulerSettings } from '../domain/scheduler';
import { dayIndex, validateTimestamp } from './calendar';
import { integer, requireValue, validateSettings } from './config';
import { fuzzInterval } from './random';
import { validateCard } from './validateCard';

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));

/** Reserve room for strict order wherever the cap/growth floor permit it. */
function successfulIntervals(card: ReviewCard, base: number, late: number, settings: SchedulerSettings): readonly [number, number, number] {
  const raw = [
    Math.max(base + 1, Math.round((base + late / 4) * settings.hardMultiplier * settings.intervalModifier)),
    Math.max(base + 1, Math.round((base + late / 2) * card.ease * settings.intervalModifier)),
    Math.max(base + 1, Math.round((base + late) * card.ease * settings.easyBonus * settings.intervalModifier)),
  ].map((interval) => fuzzInterval(interval, card.problemId, card.reps, settings));
  const maximum = settings.maxIntervalDays;
  const floor = Math.min(base + 1, maximum);
  const hard = clamp(raw[0]!, floor, Math.max(floor, maximum - 2));
  const goodFloor = Math.min(maximum, hard + 1);
  const good = clamp(raw[1]!, goodFloor, Math.max(goodFloor, maximum - 1));
  const easy = clamp(raw[2]!, Math.min(maximum, good + 1), maximum);
  return [hard, good, easy];
}

function reviewCard(base: CardFields & { readonly lastReviewedAt: number }, intervalDays: number, today: number, dueDay = today + intervalDays): ReviewCard {
  return { ...base, state: 'review', intervalDays, dueDay, stepIndex: 0 };
}

/** Pure scheduling. now is captured by the caller; this function never reads a clock. */
export function schedule(card: Card, rating: Rating, now: number, settings: SchedulerSettings, timeZone: string): ScheduleResult {
  validateSettings(settings);
  validateCard(card, settings);
  validateTimestamp(now);
  requireValue(integer(rating, 1, 4), 'Invalid rating');
  requireValue(!card.archived, 'Archived cards cannot be rated');
  const today = dayIndex(now, settings.rolloverHour, timeZone);
  const early = card.state === 'learning' || card.state === 'relearning' ? now < card.dueAt : today < card.dueDay;
  const base = {
    problemId: card.problemId, ease: card.ease, intervalDays: card.intervalDays,
    dueDay: card.dueDay, stepIndex: card.stepIndex, reps: card.reps + 1,
    lapses: card.lapses, lastReviewedAt: now, addedAt: card.addedAt, archived: card.archived,
    ...(card.notes === undefined ? {} : { notes: card.notes }),
  };
  let nextCard: Card;
  if (card.state === 'review') {
    if (rating === 1) {
      const interval = Math.max(1, Math.round(card.intervalDays * settings.lapseMultiplier));
      nextCard = {
        ...base, state: 'relearning', stepIndex: 0,
        intervalDays: clamp(fuzzInterval(interval, card.problemId, card.reps, settings), 1, settings.maxIntervalDays),
        ease: Math.max(settings.minEase, card.ease - settings.againEasePenalty),
        lapses: card.lapses + 1, dueAt: now + settings.relearningSteps[0]!,
      };
    } else {
      const elapsed = Math.max(1, today - dayIndex(card.lastReviewedAt, settings.rolloverHour, timeZone));
      const calculationBase = early ? elapsed : card.intervalDays;
      const intervals = successfulIntervals(card, calculationBase, early ? 0 : Math.max(0, today - card.dueDay), settings);
      const calculated = intervals[rating - 2]!;
      const interval = early ? Math.max(card.intervalDays, calculated) : calculated;
      const ease = rating === 2 ? Math.max(settings.minEase, card.ease - settings.hardEasePenalty)
        : rating === 4 ? card.ease + settings.easyEaseBonus : card.ease;
      nextCard = reviewCard({ ...base, ease }, interval, today,
        early ? Math.max(card.dueDay, today + calculated) : today + calculated);
    }
  } else {
    const relearning = card.state === 'relearning';
    const steps = relearning ? settings.relearningSteps : settings.learningSteps;
    if (!relearning && rating === 4) nextCard = reviewCard(base, settings.easyIntervalDays, today);
    else if (rating >= 3 && card.stepIndex === steps.length - 1) {
      nextCard = reviewCard(base, relearning ? card.intervalDays : settings.graduatingIntervalDays, today);
    } else {
      const stepIndex = rating === 1 ? 0 : rating === 2 ? card.stepIndex : card.stepIndex + 1;
      const dueAt = now + steps[stepIndex]!;
      nextCard = relearning
        ? { ...base, state: 'relearning', stepIndex, dueAt }
        : { ...base, state: 'learning', intervalDays: 0, stepIndex, dueAt };
    }
  }
  validateCard(nextCard, settings);
  return { nextCard, early };
}

/** The four complete updates use precisely the public scheduling path and captured time. */
export function intervalPreviews(card: Card, now: number, settings: SchedulerSettings, timeZone: string): IntervalPreviews {
  return {
    1: schedule(card, 1, now, settings, timeZone),
    2: schedule(card, 2, now, settings, timeZone),
    3: schedule(card, 3, now, settings, timeZone),
    4: schedule(card, 4, now, settings, timeZone),
  };
}
