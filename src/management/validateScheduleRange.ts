import type { SchedulerSettings } from '../domain/scheduler';
import { dayIndex, validateTimestamp } from '../scheduler/calendar';
import { integer, requireValue, validateSettings } from '../scheduler/config';

/** Check representability at a captured time before accepting a configuration. */
export function validateScheduleRange(settings: SchedulerSettings, now: number, timeZone: string) {
  validateSettings(settings);
  validateTimestamp(now);
  for (const field of ['learningSteps', 'relearningSteps'] as const) {
    for (const step of settings[field]) {
      try { validateTimestamp(now + step); }
      catch { throw new RangeError(`${field} duration exceeds the supported date range`); }
    }
  }
  const today = dayIndex(now, settings.rolloverHour, timeZone);
  requireValue(integer(today + settings.maxIntervalDays, Number.MIN_SAFE_INTEGER), 'maxIntervalDays exceeds the supported schedule range');
}
