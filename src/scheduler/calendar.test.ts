import { describe, expect, it } from 'vitest';
import { dayIndex } from './calendar';

const ordinal = (date: string) => Date.parse(`${date}T00:00:00Z`) / 86_400_000;

describe('explicit civil-calendar rollover', () => {
  it.each([
    ['2026-10-24T03:59:00Z', 'UTC', 4, '2026-10-23'],
    ['2026-10-24T04:00:00Z', 'UTC', 4, '2026-10-24'],
    ['2026-10-24T04:01:00Z', 'UTC', 4, '2026-10-24'],
    ['2026-10-24T02:59:00Z', 'Europe/London', 4, '2026-10-23'],
    ['2026-10-24T03:01:00Z', 'Europe/London', 4, '2026-10-24'],
    ['2026-03-29T02:59:00Z', 'Europe/London', 4, '2026-03-28'],
    ['2026-03-29T03:01:00Z', 'Europe/London', 4, '2026-03-29'],
    ['2026-10-25T03:59:00Z', 'Europe/London', 4, '2026-10-24'],
    ['2026-10-25T04:01:00Z', 'Europe/London', 4, '2026-10-25'],
    ['2026-03-29T00:59:59.999Z', 'Europe/London', 1, '2026-03-28'],
    ['2026-03-29T01:00:00Z', 'Europe/London', 1, '2026-03-29'],
    ['2026-10-24T23:59:59.999Z', 'Europe/London', 1, '2026-10-24'],
    ['2026-10-25T00:00:00Z', 'Europe/London', 1, '2026-10-25'],
    ['2026-10-25T01:00:00Z', 'Europe/London', 1, '2026-10-25'],
    ['2026-10-25T01:59:59Z', 'Europe/London', 1, '2026-10-25'],
    ['2026-03-08T06:59:59Z', 'America/New_York', 2, '2026-03-07'],
    ['2026-03-08T07:00:00Z', 'America/New_York', 2, '2026-03-08'],
    ['2026-11-01T05:00:00Z', 'America/New_York', 1, '2026-11-01'],
    ['2026-11-01T06:00:00Z', 'America/New_York', 1, '2026-11-01'],
    ['2026-10-03T15:29:59.999Z', 'Australia/Lord_Howe', 2, '2026-10-03'],
    ['2026-10-03T15:30:00Z', 'Australia/Lord_Howe', 2, '2026-10-04'],
    ['2026-03-29T00:59:59.999Z', 'Antarctica/Troll', 2, '2026-03-28'],
    ['2026-03-29T01:00:00Z', 'Antarctica/Troll', 2, '2026-03-29'],
    ['2026-10-24T23:59:59.999Z', 'Antarctica/Troll', 2, '2026-10-24'],
    ['2026-10-25T00:00:00Z', 'Antarctica/Troll', 2, '2026-10-25'],
    ['2026-10-25T01:30:00Z', 'Antarctica/Troll', 2, '2026-10-25'],
    ['2026-10-24T23:59:59Z', 'UTC', 0, '2026-10-24'],
    ['2026-10-25T00:00:00Z', 'UTC', 0, '2026-10-25'],
    ['1970-01-01T00:00:00Z', 'UTC', 0, '1970-01-01'],
    ['1969-12-31T23:59:59.999Z', 'UTC', 0, '1969-12-31'],
    ['2026-01-01T00:00:00Z', 'Asia/Kathmandu', 4, '2026-01-01'],
  ])('%s in %s at rollover %i -> %s', (instant, zone, hour, expected) => {
    expect(dayIndex(Date.parse(instant), hour, zone)).toBe(ordinal(expected));
  });

  it.each([
    ['2026-03-28T04:00:00Z', '2026-03-29T03:00:00Z', 23],
    ['2026-10-24T03:00:00Z', '2026-10-25T04:00:00Z', 25],
  ])('%s to %s spans %i hours but one civil day', (before, after, hours) => {
    expect((Date.parse(after) - Date.parse(before)) / 3_600_000).toBe(hours);
    expect(dayIndex(Date.parse(after), 4, 'Europe/London') - dayIndex(Date.parse(before), 4, 'Europe/London')).toBe(1);
  });

  it('uses the supplied timezone, including after travel and clock changes', () => {
    const now = Date.parse('2026-10-24T08:00:00Z');
    expect(dayIndex(now, 4, 'Asia/Tokyo')).toBe(ordinal('2026-10-24'));
    expect(dayIndex(now, 4, 'America/Los_Angeles')).toBe(ordinal('2026-10-23'));
    expect(dayIndex(now - 86_400_000, 4, 'UTC')).toBe(ordinal('2026-10-23'));
  });

  it.each([NaN, Infinity, 0.5, 8_640_000_000_000_001])('rejects invalid timestamp %s', (now) => {
    expect(() => dayIndex(now, 4, 'UTC')).toThrow(RangeError);
  });
  it.each([-1, 24, 4.5, NaN])('rejects invalid rollover %s', (hour) => {
    expect(() => dayIndex(0, hour, 'UTC')).toThrow(RangeError);
  });
  it.each(['', 'Invalid/Zone'])('rejects invalid timezone %s', (zone) => {
    expect(() => dayIndex(0, 4, zone)).toThrow(RangeError);
  });
});
