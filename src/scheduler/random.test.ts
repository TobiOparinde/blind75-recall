import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from './config';
import { fuzzInterval, hash32 } from './random';
import { intervalPreviews } from './schedule';
import { NOW, reviewCard } from './testFixtures';

describe('deterministic seeded fuzz', () => {
  it.each([['', 2_166_136_261], ['a', 3_826_002_220], ['foobar', 3_214_735_720]] as const)('FNV-1a fixed vector %s', (key, expected) => {
    expect(hash32(key)).toBe(expected);
  });

  it.each([1, 2])('leaves interval %i untouched', (days) => {
    for (let reps = 0; reps < 100; reps++) expect(fuzzInterval(days, 'lc-1', reps, DEFAULT_SETTINGS)).toBe(days);
  });

  it.each([[3, 2, 4], [20, 19, 21], [100, 95, 105]] as const)('interval %i spans its inclusive range %i–%i, including zero offset', (days, low, high) => {
    const results = new Set(Array.from({ length: 2000 }, (_, reps) => fuzzInterval(days, 'lc-1', reps, DEFAULT_SETTINGS)));
    expect(Math.min(...results)).toBe(low);
    expect(Math.max(...results)).toBe(high);
    expect(results.has(days)).toBe(true);
    expect([...results].every((value) => Number.isInteger(value) && value >= low && value <= high)).toBe(true);
  });

  it('uses both problem identity and pre-rating reps, and is independent of call order', () => {
    expect(hash32('fuzz:v1|lc-1|10')).toBe(625_485_067);
    const results = Array.from({ length: 100 }, (_, reps) => fuzzInterval(100, 'lc-1', reps, DEFAULT_SETTINGS));
    expect(new Set(results).size).toBeGreaterThan(1);
    expect(results).not.toEqual(Array.from({ length: 100 }, (_, reps) => fuzzInterval(100, 'lc-2', reps, DEFAULT_SETTINGS)));
    expect([...results].reverse()).toEqual(Array.from({ length: 100 }, (_, index) => fuzzInterval(100, 'lc-1', 99 - index, DEFAULT_SETTINGS)));
    expect(hash32('fuzz:v1|lc-1|23')).not.toBe(hash32('fuzz:v1|lc-12|3'));
  });

  it('same captured card and rep count always yield the same complete results', () => {
    const first = intervalPreviews(reviewCard({ intervalDays: 100 }), NOW, DEFAULT_SETTINGS, 'UTC');
    for (let i = 0; i < 20; i++) expect(intervalPreviews(reviewCard({ intervalDays: 100 }), NOW, DEFAULT_SETTINGS, 'UTC')).toStrictEqual(first);
  });

  it('lapse fuzz happens once, including return intervals of at least three days', () => {
    const intervals = new Set(Array.from({ length: 100 }, (_, reps) => intervalPreviews(reviewCard({ reps: reps + 1, intervalDays: 100 }), NOW, DEFAULT_SETTINGS, 'UTC')[1].nextCard.intervalDays));
    expect([...intervals].sort((a, b) => a - b)).toEqual([24, 25, 26]);
  });
});
