import Dexie, { type Table } from 'dexie';
import type { Card, ReviewLog, SchedulerSettings } from '../domain/scheduler';

export const DATABASE_NAME = 'blind75-recall';
export const DATABASE_VERSION = 1;

export interface SettingsRecord {
  readonly key: 'scheduler';
  readonly value: SchedulerSettings;
}

export interface MetadataRecord {
  readonly key: 'membershipRevision' | 'backupReminderAt';
  readonly value: number;
}

/** Initial schema: M1/M2 did not create a database. Future migrations must be additive. */
export class RecallDatabase extends Dexie {
  declare readonly cards: Table<Card, string>;
  declare readonly reviewLogs: Table<ReviewLog, number, Omit<ReviewLog, 'id'> & { readonly id?: number }>;
  declare readonly settings: Table<SettingsRecord, SettingsRecord['key']>;
  declare readonly metadata: Table<MetadataRecord, MetadataRecord['key']>;

  constructor(name = DATABASE_NAME) {
    super(name);
    this.version(DATABASE_VERSION).stores({
      cards: '&problemId,state,dueDay,dueAt',
      reviewLogs: '++id,problemId,ratedAt',
      settings: '&key',
      metadata: '&key',
    });
  }
}
