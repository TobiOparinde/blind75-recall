import { describe, expect, it } from 'vitest';
import { problems } from '../data';
import { DEFAULT_SETTINGS } from '../scheduler/config';
import { reviewCard } from '../scheduler/testFixtures';
import { historyFixture } from '../storage/testFixtures';
import { exportBackup, parseBackup } from './backup';
const ids = new Set(problems.map((problem) => problem.id));
function fixture(): Record<string, unknown> {
  const { card, log } = historyFixture();
  return JSON.parse(exportBackup({ cards: [card], logs: [{ ...log, id: 7 }], settings: DEFAULT_SETTINGS, revision: 2 })) as Record<string, unknown>;
}
describe('backup validation', () => {
  it.each(['', '{', 'null', '[]', 'true'])('rejects malformed input %s', (text) => expect(() => parseBackup(text, ids)).toThrow());
  it.each([
    ['version', (data: Record<string, unknown>) => { data.schemaVersion = 2; }],
    ['format', (data: Record<string, unknown>) => { data.format = 'other'; }],
    ['unknown field', (data: Record<string, unknown>) => { data.extra = true; }],
    ['missing cards', (data: Record<string, unknown>) => { delete data.cards; }],
    ['invalid settings', (data: Record<string, unknown>) => { (data.settings as Record<string, unknown>).dailyGoal = 21; }],
    ['invalid settings extra', (data: Record<string, unknown>) => { (data.settings as Record<string, unknown>).extra = 1; }],
    ['unknown problem', (data: Record<string, unknown>) => { data.cards = [reviewCard({ problemId: 'lc-nope' })]; }],
    ['duplicate card', (data: Record<string, unknown>) => { const cards = data.cards as unknown[]; cards.push(cards[0]); }],
    ['invalid card', (data: Record<string, unknown>) => { (data.cards as Record<string, unknown>[])[0]!.intervalDays = -1; }],
    ['duplicate log', (data: Record<string, unknown>) => { const logs = data.reviewLogs as unknown[]; logs.push(logs[0]); }],
    ['orphan log', (data: Record<string, unknown>) => { data.cards = []; }],
    ['invalid rating', (data: Record<string, unknown>) => { (data.reviewLogs as Record<string, unknown>[])[0]!.rating = 5; }],
    ['bad timestamp', (data: Record<string, unknown>) => { (data.reviewLogs as Record<string, unknown>[])[0]!.ratedAt = 'today'; }],
    ['bad summary', (data: Record<string, unknown>) => { (data.reviewLogs as Record<string, unknown>[])[0]!.easeBefore = 9; }],
    ['missing snapshot', (data: Record<string, unknown>) => { delete (data.reviewLogs as Record<string, unknown>[])[0]!.cardBefore; }],
    ['negative duration', (data: Record<string, unknown>) => { (data.reviewLogs as Record<string, unknown>[])[0]!.durationMs = -1; }],
  ])('rejects %s', (_, mutate) => { const data = fixture(); mutate(data); expect(() => parseBackup(JSON.stringify(data), ids)).toThrow(); });
  it('accepts finite historical intervals exceeding the current cap', () => {
    const data = fixture(); const logs = data.reviewLogs as Record<string, unknown>[];
    const card = logs[0]!.cardBefore as Record<string, unknown>; card.intervalDays = 200; logs[0]!.intervalBefore = 200;
    expect(parseBackup(JSON.stringify(data), ids).reviewLogs[0]!.intervalBefore).toBe(200);
  });
});
