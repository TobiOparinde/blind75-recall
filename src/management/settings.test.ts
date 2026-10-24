import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../scheduler/config';
import { settingsFromForm } from './settings';
const form = () => {
  const data = new FormData();
  for (const key of ['dailyGoal', 'rolloverHour', 'graduatingIntervalDays', 'easyIntervalDays', 'maxIntervalDays', 'firstReview'] as const) data.set(key, String(DEFAULT_SETTINGS[key]));
  data.set('learningSteps', '1, 10'); data.set('relearningSteps', '2.5'); return data;
};
describe('settings form conversion', () => {
  it('converts minutes to exact milliseconds while retaining advanced defaults', () => {
    const settings = settingsFromForm(form(), DEFAULT_SETTINGS);
    expect(settings).toEqual({ ...DEFAULT_SETTINGS, learningSteps: [60_000, 600_000], relearningSteps: [150_000] });
  });
  it.each([['dailyGoal', '0'], ['dailyGoal', '21'], ['dailyGoal', '1.5'], ['rolloverHour', '24'], ['rolloverHour', '-1'],
    ['graduatingIntervalDays', '181'], ['easyIntervalDays', '0'], ['maxIntervalDays', '4'], ['firstReview', 'never'],
    ['rolloverHour', ''], ['learningSteps', ''], ['learningSteps', '1,'], ['learningSteps', 'NaN'], ['relearningSteps', '-1'], ['relearningSteps', 'Infinity']])('rejects %s=%s', (key, value) => {
    const data = form(); data.set(key, value); expect(() => settingsFromForm(data, DEFAULT_SETTINGS)).toThrow();
  });
});
