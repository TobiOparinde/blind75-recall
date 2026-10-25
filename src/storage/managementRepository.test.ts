import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { problems } from '../data';
import { DEFAULT_SETTINGS } from '../scheduler/config';
import { learningCard, newCard, NOW, reviewCard, TODAY } from '../scheduler/testFixtures';
import { schedule } from '../scheduler/schedule';
import { exportBackup, parseBackup } from '../management/backup';
import { RecallDatabase } from './database';
import { ManagementRepository } from './managementRepository';
import { ReviewConflictError } from './reviewRepository';

const ids = new Set(problems.map((problem) => problem.id));
let serial = 0;
let database: RecallDatabase;
let repository: ManagementRepository;
const databases: RecallDatabase[] = [];
beforeEach(async () => {
  database = new RecallDatabase(`m5-${++serial}`); databases.push(database);
  repository = new ManagementRepository(database, problems); await repository.initialize();
});
afterEach(async () => { vi.restoreAllMocks(); for (const db of databases.splice(0)) { db.close(); await db.delete(); } });
async function populate() {
  const card = reviewCard({ problemId: 'lc-217', lapses: 4 }); await database.cards.put(card);
  const data = await repository.reviewSnapshot();
  await repository.acceptRating({ revision: data.revision, cardBefore: card, settings: data.settings, rating: 3, now: NOW, timeZone: 'UTC',
    preview: schedule(card, 3, NOW, data.settings, 'UTC'), durationMs: 400 });
  await database.cards.put(newCard({ problemId: 'lc-1', archived: true, notes: 'Preserve me' }));
  return repository.reviewSnapshot();
}
describe('M5 transactional management', () => {
  it('reminds after 30 elapsed days, persists the deadline, and excludes housekeeping from backups', async () => {
    const before = await repository.reviewSnapshot(); const text = exportBackup(before);
    expect(await repository.backupReminder(NOW)).toBe(false);
    expect(await repository.backupReminder(NOW + 30 * 86_400_000 - 1)).toBe(false);
    database.close(); expect(await repository.backupReminder(NOW + 30 * 86_400_000)).toBe(true);
    expect(exportBackup(await repository.reviewSnapshot())).toBe(text);
    expect(await repository.backupReminder(NOW + 30 * 86_400_000, true)).toBe(false);
    expect(await repository.backupReminder(NOW + 31 * 86_400_000)).toBe(false);
    await repository.reset(before.revision, ids); expect(await database.metadata.get('backupReminderAt')).toBeUndefined();
  });
  it('exports deterministic JSON without runtime metadata, retaining archived cards and full logs', async () => {
    const data = await populate(); const text = exportBackup(data);
    expect(exportBackup({ ...data, cards: [...data.cards].reverse(), logs: [...data.logs].reverse(), revision: 99 })).toBe(text);
    const backup = parseBackup(text, ids); expect(backup.cards).toHaveLength(2); expect(backup.reviewLogs).toEqual(data.logs);
    expect(Object.keys(backup).sort()).toEqual(['cards', 'format', 'reviewLogs', 'schemaVersion', 'settings']);
  });
  it('restores exact cards, settings, schedules, archived history and log IDs in a clean database', async () => {
    const original = await populate();
    const clean = new RecallDatabase(`m5-clean-${++serial}`); databases.push(clean);
    const target = new ManagementRepository(clean, problems); const before = await target.reviewSnapshot();
    const restored = await target.replaceBackup(parseBackup(exportBackup(original), ids), before.revision, ids);
    expect(restored.cards).toEqual(original.cards); expect(restored.logs).toEqual(original.logs); expect(restored.settings).toEqual(original.settings);
    const active = restored.cards.find((card) => !card.archived)!;
    const result = await target.acceptRating({ revision: restored.revision, cardBefore: active, settings: restored.settings, rating: 4, now: NOW, timeZone: 'UTC',
      preview: schedule(active, 4, NOW, restored.settings, 'UTC'), durationMs: 1 });
    expect(result.snapshot.logs.at(-1)!.id).toBeGreaterThan(restored.logs.at(-1)!.id);
  });
  it('persists settings without rewriting cards and scheduler uses the new configuration', async () => {
    await database.cards.put(newCard()); const before = await repository.reviewSnapshot();
    const settings = { ...before.settings, dailyGoal: 1, firstReview: 'today' as const, learningSteps: [60_000, 120_000], graduatingIntervalDays: 7, easyIntervalDays: 9 };
    await repository.saveConfiguration(settings, before.revision);
    database.close(); const after = await repository.reviewSnapshot(); expect(after.settings).toEqual(settings); expect(after.cards).toEqual(before.cards);
    const again = schedule(after.cards[0]!, 1, NOW, after.settings, 'UTC').nextCard;
    expect(again.state === 'learning' && again.dueAt).toBe(NOW + 60_000);
    expect(schedule(again, 3, NOW, after.settings, 'UTC').nextCard.stepIndex).toBe(1);
    expect(schedule(after.cards[0]!, 4, NOW, after.settings, 'UTC').nextCard.dueDay).toBe(TODAY + 9);
  });
  it('rejects incompatible cap and step changes atomically', async () => {
    await database.settings.put({ key: 'scheduler', value: { ...DEFAULT_SETTINGS, learningSteps: [60_000, 120_000] } });
    await database.cards.bulkPut([reviewCard(), learningCard({ problemId: 'lc-217', stepIndex: 1 })]);
    const before = await repository.reviewSnapshot();
    await expect(repository.saveConfiguration({ ...before.settings, maxIntervalDays: 5 }, before.revision)).rejects.toThrow('interval');
    await expect(repository.saveConfiguration({ ...before.settings, learningSteps: [60_000] }, before.revision)).rejects.toThrow('stepIndex');
    expect(await repository.reviewSnapshot()).toEqual(before);
  });
  it.each([
    { learningSteps: [8_640_000_000_000_000] },
    { relearningSteps: [600_000, 8_640_000_000_000_000] },
    { maxIntervalDays: Number.MAX_SAFE_INTEGER },
  ])('rejects unrepresentable settings and imports without replacing data: %j', async (changes) => {
    const before = await populate();
    const settings = { ...before.settings, ...changes };
    await expect(repository.saveConfiguration(settings, before.revision, NOW, 'UTC')).rejects.toThrow(/range/);
    const backup = { ...parseBackup(exportBackup(before), ids), settings };
    await expect(repository.replaceBackup(backup, before.revision, ids, NOW, 'UTC')).rejects.toThrow(/range/);
    expect(await repository.reviewSnapshot()).toEqual(before);
  });
  it('preserves valid historical snapshots after step/cap settings change', async () => {
    await database.settings.put({ key: 'scheduler', value: { ...DEFAULT_SETTINGS, learningSteps: [60_000, 120_000] } });
    const card = learningCard({ stepIndex: 1 }); await database.cards.put(card);
    const data = await repository.reviewSnapshot();
    await repository.acceptRating({ revision: data.revision, cardBefore: card, settings: data.settings, rating: 4, now: NOW, timeZone: 'UTC', preview: schedule(card, 4, NOW, data.settings, 'UTC'), durationMs: 1 });
    const next = await repository.reviewSnapshot(); await repository.saveConfiguration(DEFAULT_SETTINGS, next.revision);
    expect(parseBackup(exportBackup(await repository.reviewSnapshot()), ids).reviewLogs[0]!.cardBefore.stepIndex).toBe(1);
  });
  it.each(['cards', 'reviewLogs', 'settings', 'metadata'] as const)('replacement rolls back all writes on %s failure', async (table) => {
    const before = await populate(); const backup = parseBackup(exportBackup({ ...before, cards: [], logs: [] }), ids);
    const store = database[table];
    if (table === 'cards' || table === 'reviewLogs') vi.spyOn(store, 'bulkPut').mockRejectedValueOnce(new Error('Disk full'));
    else vi.spyOn(store, 'put').mockRejectedValueOnce(new Error('Disk full'));
    await expect(repository.replaceBackup(backup, before.revision, ids)).rejects.toThrow('Disk full');
    expect(await repository.reviewSnapshot()).toEqual(before);
  });
  it('rejects stale import/reset/settings confirmations and invalidates rating undo', async () => {
    const before = await populate(); const backup = parseBackup(exportBackup(before), ids);
    await repository.saveConfiguration({ ...before.settings, dailyGoal: 1 }, before.revision);
    await expect(repository.replaceBackup(backup, before.revision, ids)).rejects.toBeInstanceOf(ReviewConflictError);
    await expect(repository.reset(before.revision, ids)).rejects.toBeInstanceOf(ReviewConflictError);
    await expect(repository.saveConfiguration(DEFAULT_SETTINGS, before.revision)).rejects.toBeInstanceOf(ReviewConflictError);
    const current = await repository.reviewSnapshot(); expect(current.settings.dailyGoal).toBe(1); expect(current.cards).toEqual(before.cards);
  });
  it('reset clears cards/logs/settings with a monotonically advancing revision and retains seed', async () => {
    const before = await populate(); const next = await repository.reset(before.revision, ids);
    expect(next.cards).toEqual([]); expect(next.logs).toEqual([]); expect(next.settings).toEqual(DEFAULT_SETTINGS); expect(next.revision).toBe(before.revision + 1);
    expect(problems).toHaveLength(75);
    await expect(repository.reset(before.revision, ids)).rejects.toBeInstanceOf(ReviewConflictError);
  });
  it('revalidates mutated prepared data at the write boundary', async () => {
    const before = await populate(); const backup = JSON.parse(exportBackup(before)) as { settings: { dailyGoal: number } };
    backup.settings.dailyGoal = 0;
    await expect(repository.replaceBackup(backup as never, before.revision, ids)).rejects.toThrow(); expect(await repository.reviewSnapshot()).toEqual(before);
  });
});
