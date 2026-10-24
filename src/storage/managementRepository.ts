import type { SchedulerSettings } from '../domain/scheduler';
import { DEFAULT_SETTINGS, validateSettings } from '../scheduler/config';
import { validateCard } from '../scheduler/validateCard';
import { validateTimestamp } from '../scheduler/calendar';
import { validateBackup, type Backup } from '../management/backup';
import { ReviewConflictError, ReviewRepository } from './reviewRepository';

export class ManagementRepository extends ReviewRepository {
  /** Device housekeeping, separate from deck revisions and backup contents. */
  async backupReminder(now: number, acknowledge = false): Promise<boolean> {
    validateTimestamp(now); await this.initialize();
    return this.database.transaction('rw', this.database.metadata, async () => {
      const row = await this.database.metadata.get('backupReminderAt');
      if (!row || acknowledge) {
        await this.database.metadata.put({ key: 'backupReminderAt', value: now + 30 * 86_400_000 });
        return false;
      }
      validateTimestamp(row.value); return now >= row.value;
    });
  }
  private get managementStores() { return [this.database.cards, this.database.reviewLogs, this.database.settings, this.database.metadata]; }
  async saveConfiguration(settings: SchedulerSettings, revision: number) {
    const next = structuredClone(settings); validateSettings(next);
    await this.initialize();
    return this.database.transaction('rw', this.managementStores, async () => {
      const current = await this.readReviewCurrent();
      if (current.revision !== revision) throw new ReviewConflictError();
      current.cards.forEach((card) => validateCard(card, next));
      await this.database.settings.put({ key: 'scheduler', value: next });
      await this.advanceRevision();
      return this.readReviewCurrent();
    });
  }
  async replaceBackup(backup: Backup, revision: number, ids: ReadonlySet<string>) {
    const next = structuredClone(backup); validateBackup(next, ids);
    await this.initialize();
    return this.database.transaction('rw', this.managementStores, async () => {
      const current = await this.readReviewCurrent();
      if (current.revision !== revision) throw new ReviewConflictError();
      await this.database.cards.clear();
      await this.database.reviewLogs.clear();
      await this.database.cards.bulkPut(next.cards);
      await this.database.reviewLogs.bulkPut(next.reviewLogs);
      await this.database.settings.put({ key: 'scheduler', value: next.settings });
      await this.advanceRevision();
      return this.readReviewCurrent();
    });
  }
  async reset(revision: number, ids: ReadonlySet<string>) {
    await this.initialize();
    return this.database.transaction('rw', this.managementStores, async () => {
      const result = await this.replaceBackup({ format: 'blind75-recall', schemaVersion: 1, cards: [], reviewLogs: [], settings: DEFAULT_SETTINGS }, revision, ids);
      await this.database.metadata.delete('backupReminderAt');
      return result;
    });
  }
}
