import type { SchedulerSettings } from '../domain/scheduler';
import { validateSettings } from '../scheduler/config';

export const numericSettings = [
  ['dailyGoal', 'Daily goal', 1, 20], ['rolloverHour', 'Rollover hour', 0, 23],
  ['graduatingIntervalDays', 'Graduating interval (days)', 1, undefined],
  ['easyIntervalDays', 'Easy interval (days)', 1, undefined], ['maxIntervalDays', 'Maximum interval (days)', 1, undefined],
] as const;
export function settingsFromForm(form: FormData, current: SchedulerSettings): SchedulerSettings {
  const number = (key: string) => {
    const text = String(form.get(key) ?? '').trim();
    if (!text) throw new RangeError(`${key} is required`);
    return Number(text);
  };
  const steps = (key: string) => {
    const text = String(form.get(key) ?? '').trim();
    if (!text || text.split(',').some((part) => !part.trim())) throw new RangeError('Enter comma-separated positive step durations in minutes');
    return text.split(',').map((part) => Number(part.trim()) * 60_000);
  };
  const next = { ...current, ...Object.fromEntries(numericSettings.map(([key]) => [key, number(key)])),
    firstReview: form.get('firstReview'), learningSteps: steps('learningSteps'), relearningSteps: steps('relearningSteps') };
  validateSettings(next); return next;
}
