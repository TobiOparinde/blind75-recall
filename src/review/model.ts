import type { Problem } from '../domain/problem';
import type { Card, ReviewLog, ScheduleResult, SchedulerSettings } from '../domain/scheduler';
import { dayIndex } from '../scheduler/calendar';
import { buildQueue } from '../scheduler/queue';

export function sameValue(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const first = a as Record<string, unknown>;
  const second = b as Record<string, unknown>;
  const keys = Object.keys(first);
  return keys.length === Object.keys(second).length && keys.every((key) => Object.hasOwn(second, key) && sameValue(first[key], second[key]));
}

export function todayModel(cards: readonly Card[], logs: readonly ReviewLog[], problems: readonly Problem[], now: number, settings: SchedulerSettings, timeZone: string) {
  const today = dayIndex(now, settings.rolloverHour, timeZone);
  const days = logs.map((log) => dayIndex(log.ratedAt, settings.rolloverHour, timeZone));
  const completed = days.filter((day) => day === today).length;
  const history = new Set(days.filter((day) => day <= today));
  let streak = 0;
  let cursor = history.has(today) ? today : today - 1;
  while (history.has(cursor--)) streak++;
  const queue = buildQueue(cards, problems, now, settings, timeZone, completed);
  const active = cards.filter((card) => !card.archived);
  const readyIds = new Set(queue.ready.map((card) => card.problemId));
  return {
    ...queue, completed, streak, goalHit: completed >= settings.dailyGoal, activeCount: active.length,
    learning: queue.ready.filter((card) => card.state === 'learning' || card.state === 'relearning').length,
    review: queue.ready.filter((card) => card.state === 'review').length,
    fresh: queue.ready.filter((card) => card.state === 'new').length,
    earlyCards: active.filter((card) => !readyIds.has(card.problemId)).sort((a, b) => a.dueDay - b.dueDay || (a.problemId < b.problemId ? -1 : a.problemId > b.problemId ? 1 : 0)),
    tomorrow: active.filter((card) => (card.state === 'learning' || card.state === 'relearning'
      ? dayIndex(card.dueAt, settings.rolloverHour, timeZone) : card.dueDay) === today + 1).length,
  };
}

export function previewLabel(result: ScheduleResult, now: number, settings: SchedulerSettings, timeZone: string): string {
  const card = result.nextCard;
  if (card.state === 'learning' || card.state === 'relearning') {
    const minutes = Math.ceil((card.dueAt - now) / 60_000);
    return minutes < 1 ? '<1m' : `${minutes}m`;
  }
  return `${Math.max(0, card.dueDay - dayIndex(now, settings.rolloverHour, timeZone))}d`;
}

export function countdown(dueAt: number, now: number): string {
  const seconds = Math.max(0, Math.ceil((dueAt - now) / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/** UI-only expiry. Never changes a displayed M2 proposal behind the user's back. */
export function previewNeedsRefresh(answer: { now: number; timeZone: string; previews: Readonly<Record<1 | 2 | 3 | 4, ScheduleResult>> },
  now: number, settings: SchedulerSettings, timeZone: string): boolean {
  if (answer.timeZone !== timeZone || dayIndex(answer.now, settings.rolloverHour, answer.timeZone) !== dayIndex(now, settings.rolloverHour, timeZone)) return true;
  return Object.values(answer.previews).some(({ nextCard }) => (nextCard.state === 'learning' || nextCard.state === 'relearning') && nextCard.dueAt <= now);
}
