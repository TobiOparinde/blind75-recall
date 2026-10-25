import { expect, it, vi } from 'vitest';
import * as calendar from '../scheduler/calendar';
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

it('does not thrash calendar calculations when live history exceeds the timestamp cache', () => {
  const logs = Array.from({ length: 10_000 }, (_, index) => ({ ratedAt: Date.UTC(2026, 9, 25) + index * 1000 }));
  const settings = { rolloverHour: 23 };
  const spy = vi.spyOn(calendar, 'dayIndex');
  try {
    const first = logs.map((log) => reviewDay(log, settings, 'UTC'));
    spy.mockClear();
    expect(logs.map((log) => reviewDay(log, settings, 'UTC'))).toEqual(first);
    expect(spy).not.toHaveBeenCalled();
    expect(logs.map((log) => reviewDay({ ...log }, settings, 'UTC'))).toEqual(first);
    expect(spy).toHaveBeenCalledTimes(10_000 - 8192);
  } finally { spy.mockRestore(); }
});

it('never reuses a snapshot date after its timestamp or calendar context changes', () => {
  const log = { ratedAt: Date.parse('2026-10-25T03:59:00Z') };
  for (const zone of ['UTC', 'America/New_York', 'UTC']) {
    for (const hour of [4, 0, 4]) {
      for (const delta of [0, 120_000, -120_000]) {
        log.ratedAt += delta;
        expect(reviewDay(log, { rolloverHour: hour }, zone)).toBe(dayIndex(log.ratedAt, hour, zone));
      }
    }
  }
});
