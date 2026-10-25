import type { ReviewLog, SchedulerSettings } from '../domain/scheduler';
import { dayIndex } from '../scheduler/calendar';

// History timestamps are immutable. Rehydrated Dexie objects can reuse the same
// calendar result; imports/clock travel cannot reuse a result for another input.
let context = '';
const days = new Map<number, number>();
export function reviewDay(log: Pick<ReviewLog, 'ratedAt'>, settings: Pick<SchedulerSettings, 'rolloverHour'>, timeZone: string): number {
  const key = `${timeZone}|${settings.rolloverHour}`;
  if (key !== context) { days.clear(); context = key; }
  const cached = days.get(log.ratedAt);
  if (cached !== undefined) return cached;
  const day = dayIndex(log.ratedAt, settings.rolloverHour, timeZone);
  if (days.size >= 8192) days.clear();
  days.set(log.ratedAt, day);
  return day;
}
