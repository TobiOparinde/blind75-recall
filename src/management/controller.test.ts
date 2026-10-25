import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { problems } from '../data';
import { DEFAULT_SETTINGS } from '../scheduler/config';
import { newCard } from '../scheduler/testFixtures';
import { RecallDatabase } from '../storage/database';
import { ManagementRepository } from '../storage/managementRepository';
import { ManagementController } from './controller';
import { exportBackup } from './backup';
const ids = new Set(problems.map((problem) => problem.id));
let serial = 0; let db: RecallDatabase; let repo: ManagementRepository; let controller: ManagementController;
beforeEach(async () => { db = new RecallDatabase(`m5-controller-${++serial}`); repo = new ManagementRepository(db, problems); await repo.initialize(); controller = new ManagementController(repo, ids); });
afterEach(async () => { vi.restoreAllMocks(); db.close(); await db.delete(); });
describe('management action controller', () => {
  it('exposes a gentle reminder and clears it after export', async () => {
    let now = 0; const timed = new ManagementController(repo, ids, () => now);
    await timed.checkReminder(); expect(timed.getSnapshot().backupDue).toBe(false);
    now = 30 * 86_400_000; await timed.checkReminder(); expect(timed.getSnapshot().backupDue).toBe(true);
    await timed.export(); expect(timed.getSnapshot().backupDue).toBe(false);
  });
  it('exports successfully when optional reminder housekeeping fails', async () => {
    vi.spyOn(repo, 'backupReminder').mockRejectedValue(new Error('Quota exceeded'));
    expect(await controller.export()).toContain('"schemaVersion": 1'); expect(controller.getSnapshot().error).toBeNull();
  });
  it('requires two confirmations and allows cancellation at either reset stage', async () => {
    await db.cards.put(newCard()); const data = await repo.reviewSnapshot();
    controller.beginReset(data.revision); expect(controller.getSnapshot().resetStage).toBe(1);
    await controller.confirmReset(); expect(controller.getSnapshot().resetStage).toBe(2); expect((await repo.reviewSnapshot()).cards).toHaveLength(1);
    controller.cancel(); await controller.confirmReset(); expect((await repo.reviewSnapshot()).cards).toHaveLength(1);
    controller.beginReset(data.revision); controller.cancel(); expect(controller.getSnapshot().resetStage).toBe(0);
    controller.beginReset(data.revision); await controller.confirmReset(); await controller.confirmReset();
    expect((await repo.reviewSnapshot()).cards).toEqual([]); expect(controller.getSnapshot().resetStage).toBe(0);
  });
  it('previews import counts without writes, requires confirmation and supports cancel', async () => {
    const data = await repo.reviewSnapshot(); const text = exportBackup({ ...data, cards: [newCard()] });
    await controller.prepareImport(text); expect(controller.getSnapshot().preview?.backup.cards).toHaveLength(1);
    expect((await repo.reviewSnapshot()).cards).toEqual([]); controller.cancel(); await controller.confirmImport(); expect((await repo.reviewSnapshot()).cards).toEqual([]);
    await controller.prepareImport(text); await controller.confirmImport(); expect((await repo.reviewSnapshot()).cards).toHaveLength(1);
    expect(controller.getSnapshot().preview).toBeNull();
  });
  it('rejects malformed imports and stale overwrite confirmations with no data loss', async () => {
    await controller.prepareImport('{}'); expect(controller.getSnapshot().error).toBeTruthy(); expect(controller.getSnapshot().preview).toBeNull();
    const data = await repo.reviewSnapshot(); await controller.prepareImport(exportBackup(data));
    await repo.saveConfiguration({ ...DEFAULT_SETTINGS, dailyGoal: 1 }, data.revision);
    await controller.confirmImport(); expect(controller.getSnapshot().error).toContain('changed'); expect((await repo.reviewSnapshot()).settings.dailyGoal).toBe(1);
  });
  it('locks management actions before reading an import file and prevents overlapping selections', async () => {
    const before = await repo.reviewSnapshot();
    let finish!: (text: string) => void;
    const first = controller.prepareImport(() => new Promise((resolve) => { finish = resolve; }));
    expect(controller.getSnapshot().busy).toBe(true);
    const secondRead = vi.fn().mockResolvedValue(exportBackup(before));
    await controller.prepareImport(secondRead);
    expect(secondRead).not.toHaveBeenCalled();
    controller.beginReset(before.revision);
    await controller.save({ ...DEFAULT_SETTINGS, dailyGoal: 1 }, before.revision);
    expect(controller.getSnapshot().resetStage).toBe(0);
    expect(await repo.reviewSnapshot()).toEqual(before);
    finish(exportBackup({ ...before, cards: [newCard()] })); await first;
    expect(controller.getSnapshot().busy).toBe(false);
    expect(controller.getSnapshot().preview?.backup.cards).toHaveLength(1);
    expect(await repo.reviewSnapshot()).toEqual(before);
  });
  it('reports a failed import file read without changing data or retaining a preview', async () => {
    const before = await repo.reviewSnapshot();
    await controller.prepareImport(() => Promise.reject(new Error('File could not be read')));
    expect(controller.getSnapshot().error).toBe('File could not be read');
    expect(controller.getSnapshot().busy).toBe(false);
    expect(controller.getSnapshot().preview).toBeNull();
    expect(await repo.reviewSnapshot()).toEqual(before);
  });
  it('guards duplicate clicks while an action is pending and reports a failed write', async () => {
    let reject!: (error: Error) => void;
    vi.spyOn(repo, 'saveConfiguration').mockReturnValue(new Promise((_, fail) => { reject = fail; }));
    const pending = controller.save(DEFAULT_SETTINGS, 0); expect(controller.getSnapshot().busy).toBe(true);
    await controller.save(DEFAULT_SETTINGS, 0); expect(repo.saveConfiguration).toHaveBeenCalledTimes(1);
    reject(new Error('Storage unavailable')); await pending; expect(controller.getSnapshot().busy).toBe(false); expect(controller.getSnapshot().error).toBe('Storage unavailable');
  });
  it('export reads committed persisted state and does not change revision or data', async () => {
    const data = await repo.reviewSnapshot(); expect(await controller.export()).toBe(exportBackup(data)); expect(await repo.reviewSnapshot()).toEqual(data);
  });
});
