import { integer, requireValue } from './config';

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
const DATE_LIMIT = 8_640_000_000_000_000;
const formatters = new Map<string, Intl.DateTimeFormat>();
const boundaries = new Map<string, number>();

export function validateTimestamp(value: unknown): asserts value is number {
  requireValue(integer(value, -DATE_LIMIT, DATE_LIMIT), 'Timestamp must be a valid integer UTC epoch millisecond value');
}

function formatter(timeZone: string): Intl.DateTimeFormat {
  requireValue(typeof timeZone === 'string' && timeZone.trim().length > 0, 'An explicit timezone is required');
  let result = formatters.get(timeZone);
  if (!result) {
    result = new Intl.DateTimeFormat('en-GB', {
      timeZone, calendar: 'iso8601', numberingSystem: 'latn', era: 'short',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    });
    if (formatters.size >= 64) formatters.clear();
    formatters.set(timeZone, result);
  }
  return result;
}

/** Encode local civil components as a UTC scalar, solely for calendar arithmetic. */
function wallTime(epoch: number, format: Intl.DateTimeFormat): number {
  const parts = Object.fromEntries(format.formatToParts(epoch).map((part) => [part.type, part.value]));
  const year = Number(parts.year);
  const date = new Date(0);
  date.setUTCFullYear(parts.era === 'BC' ? 1 - year : year, Number(parts.month) - 1, Number(parts.day));
  date.setUTCHours(Number(parts.hour), Number(parts.minute), Number(parts.second), epoch - Math.floor(epoch / 1000) * 1000);
  return date.getTime();
}

function rolloverBoundary(day: number, rolloverHour: number, timeZone: string, format: Intl.DateTimeFormat): number {
  const key = `${timeZone}|${day}|${rolloverHour}`;
  const cached = boundaries.get(key);
  if (cached !== undefined) return cached;
  const target = day * DAY_MS + rolloverHour * HOUR_MS;
  const offsets = new Set<number>();
  // Both sides of even date-line/whole-day changes are included. No host-local dates.
  for (let hours = -36; hours <= 36; hours += 6) {
    const probe = Math.max(-DATE_LIMIT, Math.min(DATE_LIMIT, target + hours * HOUR_MS));
    offsets.add(wallTime(probe, format) - probe);
  }
  const candidates = [...offsets].map((offset) => target - offset)
    .filter((candidate) => Math.abs(candidate) <= DATE_LIMIT).sort((a, b) => a - b);
  const exact = candidates.find((candidate) => wallTime(candidate, format) === target);
  let boundary: number;
  if (exact !== undefined) boundary = exact;
  else {
    // Missing wall time: find the first valid instant across the forward jump.
    const before = candidates.filter((candidate) => wallTime(candidate, format) < target);
    const after = candidates.filter((candidate) => wallTime(candidate, format) > target);
    const beforeGap = before.at(-1);
    const afterGap = after[0];
    requireValue(beforeGap !== undefined && afterGap !== undefined && beforeGap < afterGap, 'Cannot resolve calendar rollover');
    let low: number = beforeGap;
    let high: number = afterGap;
    while (high - low > 1) {
      const middle = low + Math.floor((high - low) / 2);
      if (wallTime(middle, format) < target) low = middle;
      else high = middle;
    }
    boundary = high;
  }
  if (boundaries.size >= 512) boundaries.clear();
  boundaries.set(key, boundary);
  return boundary;
}

/** One civil-day index; repeated rollover uses its first occurrence, gaps their end. */
export function dayIndex(now: number, rolloverHour: number, timeZone: string): number {
  validateTimestamp(now);
  requireValue(integer(rolloverHour, 0, 23), 'rolloverHour must be 0–23');
  const format = formatter(timeZone);
  const day = Math.floor(wallTime(now, format) / DAY_MS);
  return now < rolloverBoundary(day, rolloverHour, timeZone, format) ? day - 1 : day;
}
