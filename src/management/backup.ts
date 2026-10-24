import type { Card, ReviewLog, SchedulerSettings } from '../domain/scheduler';
import type { ReviewSnapshot } from '../storage/reviewRepository';
import { DEFAULT_SETTINGS, finite, integer, requireValue, validateSettings } from '../scheduler/config';
import { validateCard } from '../scheduler/validateCard';
import { validateTimestamp } from '../scheduler/calendar';

export interface Backup {
  readonly format: 'blind75-recall';
  readonly schemaVersion: 1;
  readonly settings: SchedulerSettings;
  readonly cards: readonly Card[];
  readonly reviewLogs: readonly ReviewLog[];
}
function object(value: unknown): asserts value is Record<string, unknown> {
  requireValue(value !== null && typeof value === 'object' && !Array.isArray(value), 'Expected an object');
}
function keys(value: object, allowed: readonly string[]) {
  requireValue(Object.keys(value).every((key) => allowed.includes(key)), 'Unexpected backup field');
}
const cardKeys = ['problemId', 'state', 'ease', 'intervalDays', 'dueDay', 'dueAt', 'stepIndex', 'reps', 'lapses', 'lastReviewedAt', 'notes', 'addedAt', 'archived'];
function card(value: unknown, settings: SchedulerSettings, ids: ReadonlySet<string>): asserts value is Card {
  object(value); keys(value, cardKeys); validateCard(value, settings);
  requireValue(ids.has(value.problemId), `Unknown problem: ${value.problemId}`);
}
/** Historical snapshots can predate a changed cap/step list; never reinterpret them. */
const historicalSettings: SchedulerSettings = { ...DEFAULT_SETTINGS, maxIntervalDays: Number.MAX_SAFE_INTEGER };
export function validateBackup(value: unknown, ids: ReadonlySet<string>): asserts value is Backup {
  object(value); keys(value, ['format', 'schemaVersion', 'settings', 'cards', 'reviewLogs']);
  requireValue(value.format === 'blind75-recall' && value.schemaVersion === 1, 'Incompatible backup format or schema version');
  object(value.settings); keys(value.settings, Object.keys(DEFAULT_SETTINGS));
  object(value.settings.startingEase); keys(value.settings.startingEase, ['easy', 'medium', 'hard']);
  validateSettings(value.settings);
  requireValue(Array.isArray(value.cards) && Array.isArray(value.reviewLogs), 'Backup requires cards and reviewLogs arrays');
  const cards = new Set<string>();
  for (const item of value.cards) {
    card(item, value.settings, ids);
    requireValue(!cards.has(item.problemId), 'Duplicate card'); cards.add(item.problemId);
  }
  const logIds = new Set<number>();
  for (const log of value.reviewLogs) {
    object(log); keys(log, ['id', 'problemId', 'ratedAt', 'rating', 'stateBefore', 'intervalBefore', 'intervalAfter', 'easeBefore', 'easeAfter', 'durationMs', 'early', 'cardBefore']);
    requireValue(integer(log.id, 1) && !logIds.has(log.id), 'Invalid or duplicate log ID'); logIds.add(log.id);
    requireValue(typeof log.problemId === 'string' && cards.has(log.problemId), 'Log requires an existing card');
    requireValue(integer(log.rating, 1, 4) && integer(log.durationMs, 0) && typeof log.early === 'boolean', 'Invalid review log');
    validateTimestamp(log.ratedAt);
    object(log.cardBefore); keys(log.cardBefore, cardKeys);
    requireValue(integer(log.cardBefore.stepIndex, 0), 'Invalid historical stepIndex');
    // A prior step list is not stored. Validate its nonnegative index separately,
    // then validate the remaining state invariants without a current-list bound.
    const snapshot = { ...log.cardBefore, stepIndex: log.cardBefore.state === 'learning' || log.cardBefore.state === 'relearning' ? 0 : log.cardBefore.stepIndex };
    card(snapshot, historicalSettings, ids);
    requireValue(log.cardBefore.problemId === log.problemId && !log.cardBefore.archived, 'Invalid pre-rating card identity');
    requireValue(log.stateBefore === log.cardBefore.state && log.intervalBefore === log.cardBefore.intervalDays && log.easeBefore === log.cardBefore.ease, 'Log summary does not match its snapshot');
    requireValue(integer(log.intervalAfter, 0) && finite(log.easeAfter) && log.easeAfter >= 1.3, 'Invalid post-rating summary');
    requireValue((log.stateBefore !== 'review' && log.stateBefore !== 'relearning') || log.intervalAfter >= 1, 'Invalid review interval');
    requireValue((log.stateBefore !== 'new' && log.stateBefore !== 'learning') || (log.rating !== 4 || log.intervalAfter >= 1), 'Invalid graduation interval');
  }
}
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, item]) => [key, canonical(item)]));
  return value;
}
export function exportBackup(data: ReviewSnapshot): string {
  const backup: Backup = { format: 'blind75-recall', schemaVersion: 1, settings: data.settings,
    cards: [...data.cards].sort((a, b) => a.problemId < b.problemId ? -1 : a.problemId > b.problemId ? 1 : 0),
    reviewLogs: [...data.logs].sort((a, b) => a.id - b.id) };
  return JSON.stringify(canonical(backup), null, 2) + '\n';
}
export function parseBackup(text: string, ids: ReadonlySet<string>): Backup {
  const value: unknown = JSON.parse(text); validateBackup(value, ids); return value;
}
