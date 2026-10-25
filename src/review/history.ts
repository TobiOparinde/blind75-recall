import type { ReviewLog, SchedulerSettings } from '../domain/scheduler';
import { dayIndex } from '../scheduler/calendar';

// History timestamps are immutable. Rehydrated Dexie objects can reuse the same
// calendar result; imports/clock travel cannot reuse a result for another input.
let context = '';
const days = new Map<number, number>();
let snapshots = new WeakMap<object, { ratedAt: number; day: number }>();
export function reviewDay(log: Pick<ReviewLog, 'ratedAt'>, settings: Pick<SchedulerSettings, 'rolloverHour'>, timeZone: string): number {
  const key = `${timeZone}|${settings.rolloverHour}`;
  if (key !== context) { days.clear(); snapshots = new WeakMap(); context = key; }
  const snapshot = snapshots.get(log);
  if (snapshot?.ratedAt === log.ratedAt) return snapshot.day;
  const cached = days.get(log.ratedAt);
  const day = cached ?? dayIndex(log.ratedAt, settings.rolloverHour, timeZone);
  // Retain the first bounded batch across database rereads. Flushing/evicting
  // during a sequential scan makes every entry miss once history exceeds it.
  if (days.size < 8192) days.set(log.ratedAt, day);
  // Larger live snapshots reuse dates too, without retaining discarded logs.
  snapshots.set(log, { ratedAt: log.ratedAt, day });
  return day;
}
