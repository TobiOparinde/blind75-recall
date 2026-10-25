import { expect, it } from 'vitest';
import { dayIndex } from '../scheduler/calendar';
import { reviewDay } from './history';

it('retains exact calendar attribution across repeated reads, different timestamps, rollovers and DST zones', () => {
  for (const zone of ['UTC', 'Europe/London', 'America/New_York', 'Europe/London']) {
    for (const hour of [4, 1, 4]) {
      for (const text of ['2026-10-25T00:59:00Z', '2026-10-25T01:01:00Z', '2026-10-25T03:59:00Z', '2026-10-25T04:01:00Z']) {
        const ratedAt = Date.parse(text); const expected = dayIndex(ratedAt, hour, zone);
        expect(reviewDay({ ratedAt }, { rolloverHour: hour }, zone)).toBe(expected);
        expect(reviewDay({ ratedAt }, { rolloverHour: hour }, zone)).toBe(expected);
      }
    }
  }
});
it('bounds history caching without changing results or accepting invalid timestamps', () => {
  for (let ratedAt = 0; ratedAt < 8200; ratedAt++) expect(reviewDay({ ratedAt }, { rolloverHour: 4 }, 'UTC')).toBe(-1);
  expect(reviewDay({ ratedAt: 0 }, { rolloverHour: 4 }, 'UTC')).toBe(-1);
  expect(() => reviewDay({ ratedAt: NaN }, { rolloverHour: 4 }, 'UTC')).toThrow();
});
