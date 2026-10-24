import type { SchedulerSettings } from '../domain/scheduler';
import { requireValue } from './config';

/** Versioned callers supply namespace + delimited inputs; unsigned FNV-1a over UTF-8. */
export function hash32(key: string): number {
  let hash = 2_166_136_261;
  for (const byte of new TextEncoder().encode(key)) {
    hash = Math.imul(hash ^ byte, 16_777_619) >>> 0;
  }
  return hash;
}

/** Internal: caller has validated card/settings; the same seed is shared by ratings. */
export function fuzzInterval(interval: number, problemId: string, reps: number, settings: SchedulerSettings): number {
  requireValue(Number.isSafeInteger(interval) && interval >= 1, 'Interval calculation exceeded safe integer range');
  if (interval < settings.fuzzThresholdDays) return interval;
  const radius = Math.max(settings.fuzzMinDays, Math.round(interval * settings.fuzzFraction));
  requireValue(Number.isSafeInteger(2 * radius + 1), 'Fuzz range exceeded safe integer range');
  const sample = hash32(`fuzz:v1|${problemId}|${reps}`) / 4_294_967_296;
  return interval + Math.floor(sample * (2 * radius + 1)) - radius;
}
