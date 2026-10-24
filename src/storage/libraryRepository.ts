import { liveQuery, type Subscription } from 'dexie';
import type { Problem } from '../domain/problem';
import type { Card, SchedulerSettings } from '../domain/scheduler';
import { changeMembership, sameCard } from '../domain/membership';
import { DEFAULT_SETTINGS, validateSettings } from '../scheduler/config';
import { validateCard } from '../scheduler/validateCard';
import { validateTimestamp } from '../scheduler/calendar';
import { RecallDatabase } from './database';

export interface LibrarySnapshot {
  readonly cards: readonly Card[];
  readonly settings: SchedulerSettings;
  readonly revision: number;
}

export interface MembershipUndo {
  readonly revision: number;
  readonly changes: readonly { readonly before: Card | undefined; readonly after: Card }[];
}

export interface MembershipResult {
  readonly snapshot: LibrarySnapshot;
  readonly undo: MembershipUndo | null;
  readonly changedCount: number;
}

export class MembershipConflictError extends Error {
  constructor() { super('The library changed after this action'); }
}

export class LibraryRepository {
  private initialization: Promise<void> | undefined;
  private initialized = false;
  private readonly problems: ReadonlyMap<string, Problem>;

  constructor(readonly database: RecallDatabase, problems: readonly Problem[]) {
    this.problems = new Map(problems.map((problem) => [problem.id, problem]));
  }

  initialize(): Promise<void> {
    if (this.initialized && !this.database.isOpen()) {
      this.initialization = undefined;
      this.initialized = false;
    }
    this.initialization ??= (async () => {
      await this.database.open();
      await this.database.transaction('rw', this.database.settings, this.database.metadata, async () => {
        const row = await this.database.settings.get('scheduler');
        if (row) validateSettings(row.value);
        else await this.database.settings.add({ key: 'scheduler', value: structuredClone(DEFAULT_SETTINGS) });
        if (!await this.database.metadata.get('membershipRevision')) {
          await this.database.metadata.add({ key: 'membershipRevision', value: 0 });
        }
      });
      this.initialized = true;
    })().catch((error: unknown) => { this.initialization = undefined; this.initialized = false; throw error; });
    return this.initialization;
  }

  protected async readCurrent(): Promise<LibrarySnapshot> {
    const [cards, settings, revision] = await Promise.all([
      this.database.cards.toArray(), this.database.settings.get('scheduler'),
      this.database.metadata.get('membershipRevision'),
    ]);
    if (!settings || !revision) throw new Error('Library is not initialized');
    validateSettings(settings.value);
    cards.forEach((card) => validateCard(card, settings.value));
    if (!Number.isSafeInteger(revision.value) || revision.value < 0) throw new Error('Invalid membership revision');
    return { cards, settings: settings.value, revision: revision.value };
  }

  async snapshot(): Promise<LibrarySnapshot> {
    await this.initialize();
    return this.database.transaction('r', this.database.cards, this.database.settings, this.database.metadata, () => this.readCurrent());
  }

  /** Dexie propagates live-query changes between its IndexedDB connections/tabs. */
  observe(next: (snapshot: LibrarySnapshot) => void, error: (error: unknown) => void): Subscription {
    return liveQuery(() => this.database.transaction('r', this.database.cards, this.database.settings,
      this.database.metadata, () => this.readCurrent())).subscribe({ next, error });
  }

  protected async advanceRevision(): Promise<number> {
    const row = await this.database.metadata.get('membershipRevision');
    if (!row || !Number.isSafeInteger(row.value) || row.value < 0 || row.value >= Number.MAX_SAFE_INTEGER) {
      throw new Error('Invalid membership revision');
    }
    const value = row.value + 1;
    await this.database.metadata.put({ key: 'membershipRevision', value });
    return value;
  }

  async setCompleted(problemIds: readonly string[], completed: boolean, now: number, timeZone: string): Promise<MembershipResult> {
    await this.initialize();
    validateTimestamp(now);
    const ids = [...new Set(problemIds)];
    const problems = ids.map((id) => {
      const problem = this.problems.get(id);
      if (!problem) throw new Error(`Unknown problem: ${id}`);
      return problem;
    });
    return this.database.transaction('rw', this.database.cards, this.database.settings, this.database.metadata, async () => {
      const current = await this.readCurrent();
      const stored = new Map(current.cards.map((card) => [card.problemId, card]));
      const changes: { before: Card | undefined; after: Card }[] = [];
      for (const problem of problems) {
        const before = stored.get(problem.id);
        const after = changeMembership(problem, before, completed, now, current.settings, timeZone);
        if (after && !sameCard(before, after)) changes.push({ before, after });
      }
      if (changes.length === 0) return { snapshot: current, undo: null, changedCount: 0 };
      await this.database.cards.bulkPut(changes.map((change) => change.after));
      const revision = await this.advanceRevision();
      return { snapshot: await this.readCurrent(), undo: { revision, changes }, changedCount: changes.length };
    });
  }

  async undoMembership(token: MembershipUndo): Promise<LibrarySnapshot> {
    await this.initialize();
    return this.database.transaction('rw', this.database.cards, this.database.settings, this.database.metadata, async () => {
      const current = await this.readCurrent();
      if (token.revision !== current.revision) throw new MembershipConflictError();
      const cards = new Map(current.cards.map((card) => [card.problemId, card]));
      if (token.changes.some((change) => !sameCard(cards.get(change.after.problemId), change.after))) throw new MembershipConflictError();
      // Undoing a first tick archives the new card; no card/history is ever deleted.
      const restored = token.changes.map((change) => change.before ?? { ...change.after, archived: true });
      restored.forEach((card) => validateCard(card, current.settings));
      await this.database.cards.bulkPut(restored);
      await this.advanceRevision();
      return this.readCurrent();
    });
  }

  /** M3 has no settings UI; validate this boundary for existing/future callers. */
  async saveSettings(settings: SchedulerSettings): Promise<LibrarySnapshot> {
    validateSettings(settings);
    await this.initialize();
    return this.database.transaction('rw', this.database.cards, this.database.settings, this.database.metadata, async () => {
      const cards = await this.database.cards.toArray();
      cards.forEach((card) => validateCard(card, settings));
      await this.database.settings.put({ key: 'scheduler', value: structuredClone(settings) });
      await this.advanceRevision();
      return this.readCurrent();
    });
  }

  async reviewHistory(problemId: string) {
    await this.initialize();
    return this.database.reviewLogs.where('problemId').equals(problemId).sortBy('id');
  }
}
