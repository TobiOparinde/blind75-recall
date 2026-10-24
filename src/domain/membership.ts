import type { Problem } from './problem';
import type { Card, NewCard, SchedulerSettings } from './scheduler';
import { dayIndex } from '../scheduler/calendar';
import { validateSettings } from '../scheduler/config';
import { validateCard } from '../scheduler/validateCard';

export function newCardForProblem(problem: Problem, now: number, settings: SchedulerSettings, timeZone: string): NewCard {
  validateSettings(settings);
  const card: NewCard = {
    problemId: problem.id, state: 'new', ease: settings.startingEase[problem.difficulty],
    intervalDays: 0, dueDay: dayIndex(now, settings.rolloverHour, timeZone) + Number(settings.firstReview === 'tomorrow'),
    stepIndex: 0, reps: 0, lapses: 0, addedAt: now, archived: false,
  };
  validateCard(card, settings);
  return card;
}

export function changeMembership(problem: Problem, card: Card | undefined, completed: boolean,
  now: number, settings: SchedulerSettings, timeZone: string): Card | undefined {
  if (!card) return completed ? newCardForProblem(problem, now, settings, timeZone) : undefined;
  validateCard(card, settings);
  if (card.problemId !== problem.id) throw new Error('Card/problem identity mismatch');
  return card.archived === !completed ? card : { ...card, archived: !completed };
}

/** All Card fields are primitives; compare values without relying on JSON key order. */
export function sameCard(a: Card | undefined, b: Card | undefined): boolean {
  if (!a || !b) return a === b;
  const first = a as unknown as Record<string, unknown>;
  const second = b as unknown as Record<string, unknown>;
  return [...new Set([...Object.keys(a), ...Object.keys(b)])].every((key) => Object.is(first[key], second[key]));
}
