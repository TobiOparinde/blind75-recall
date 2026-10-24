import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { problems } from '../data';
import { DEFAULT_SETTINGS } from '../scheduler/config';
import { buildQueue } from '../scheduler/queue';
import { NOW, TODAY } from '../scheduler/testFixtures';
import { RecallDatabase } from './database';
import { LibraryRepository, MembershipConflictError } from './libraryRepository';
import { historyFixture } from './testFixtures';

let serial = 0;
let database: RecallDatabase;
let repository: LibraryRepository;
let connections: RecallDatabase[];

beforeEach(async () => {
  database = new RecallDatabase(`m3-repository-${++serial}`);
  connections = [database];
  repository = new LibraryRepository(database, problems);
  await repository.initialize();
});

afterEach(async () => {
  connections.forEach((connection) => connection.close());
  await database.delete();
});

function anotherConnection() {
  const connection = new RecallDatabase(database.name);
  connections.push(connection);
  return new LibraryRepository(connection, problems);
}

describe('versioned persistent cards, settings and history', () => {
  it('initializes an empty deck/log and one settings record, idempotently', async () => {
    await repository.initialize();
    const snapshot = await repository.snapshot();
    expect(snapshot).toEqual({ cards: [], settings: DEFAULT_SETTINGS, revision: 0 });
    expect(database.verno).toBe(1);
    expect(await database.settings.count()).toBe(1);
    expect(await database.reviewLogs.count()).toBe(0);
    expect((await anotherConnection().snapshot()).settings).toEqual(DEFAULT_SETTINGS);
  });

  it.each([
    ['lc-217', 2.6], ['lc-49', 2.5], ['lc-76', 2.3],
  ] as const)('first tick %s creates a canonical new card with ease %s', async (id, ease) => {
    const result = await repository.setCompleted([id], true, NOW, 'UTC');
    expect(result.changedCount).toBe(1);
    expect(result.snapshot.cards[0]).toEqual({ problemId: id, state: 'new', ease,
      intervalDays: 0, dueDay: TODAY + 1, stepIndex: 0, reps: 0, lapses: 0,
      addedAt: NOW, archived: false });
    expect(result.undo?.revision).toBe(1);
    expect(await database.reviewLogs.count()).toBe(0);
  });

  it.each([['today', TODAY], ['tomorrow', TODAY + 1]] as const)('persists configured firstReview=%s', async (firstReview, dueDay) => {
    await repository.saveSettings({ ...DEFAULT_SETTINGS, firstReview });
    database.close();
    const reopened = anotherConnection();
    const result = await reopened.setCompleted(['lc-217'], true, NOW, 'UTC');
    expect(result.snapshot.settings.firstReview).toBe(firstReview);
    expect(result.snapshot.cards[0]?.dueDay).toBe(dueDay);
  });

  it('uses the persisted rollover and supplied timezone when a new card is ticked', async () => {
    await repository.saveSettings({ ...DEFAULT_SETTINGS, firstReview: 'today' });
    const now = Date.parse('2026-10-24T02:59:00Z'); // 03:59 London, before rollover.
    const result = await repository.setCompleted(['lc-217'], true, now, 'Europe/London');
    expect(result.snapshot.cards[0]?.dueDay).toBe(TODAY - 1);
  });

  it('deduplicates ticks and keeps all 30 additions rather than applying a daily cap', async () => {
    const selected = problems.slice(0, 30).map((problem) => problem.id);
    const result = await repository.setCompleted([...selected, selected[0]!], true, NOW, 'UTC');
    expect(result.changedCount).toBe(30);
    expect(result.snapshot.cards).toHaveLength(30);
    expect(result.snapshot.cards.every((card) => card.dueDay === TODAY + 1)).toBe(true);
    expect((await repository.setCompleted(selected, true, NOW + 1000, 'UTC')).changedCount).toBe(0);
    expect(await database.cards.count()).toBe(30);
  });

  it('persists cards across closed database connections', async () => {
    const before = await repository.setCompleted(['lc-217', 'lc-49', 'lc-76'], true, NOW, 'UTC');
    database.close();
    expect(await anotherConnection().snapshot()).toEqual(before.snapshot);
  });

  it('reconnects the same repository after its connection closes, preserving settings/cards/logs', async () => {
    await repository.saveSettings({ ...DEFAULT_SETTINGS, firstReview: 'today' });
    const { card, log } = historyFixture();
    await database.cards.put(card);
    await database.reviewLogs.add(log);
    const before = await repository.snapshot();
    const history = await repository.reviewHistory(card.problemId);
    database.close();
    expect(await repository.snapshot()).toEqual(before);
    expect(await repository.reviewHistory(card.problemId)).toEqual(history);
    expect(database.isOpen()).toBe(true);
  });

  it('archive and re-tick restore every scheduling field and all existing logs', async () => {
    const { card, log } = historyFixture();
    await database.transaction('rw', database.cards, database.reviewLogs, async () => {
      await database.cards.put(card);
      await database.reviewLogs.add(structuredClone(log));
      await database.reviewLogs.add({ ...log, ratedAt: log.ratedAt + 1 });
    });
    const history = await repository.reviewHistory(card.problemId);
    expect(history.map((entry) => entry.id)).toEqual([1, 2]);
    const archived = await repository.setCompleted([card.problemId], false, NOW, 'UTC');
    expect(archived.snapshot.cards).toEqual([{ ...card, archived: true }]);
    expect(buildQueue(archived.snapshot.cards, problems, NOW, archived.snapshot.settings, 'UTC').ready).toEqual([]);
    expect(await repository.reviewHistory(card.problemId)).toEqual(history);
    database.close();
    const reopened = anotherConnection();
    const restored = await reopened.setCompleted([card.problemId], true, NOW + 10_000, 'America/New_York');
    expect(restored.snapshot.cards).toEqual([card]);
    expect(await reopened.reviewHistory(card.problemId)).toEqual(history);
    expect(buildQueue(restored.snapshot.cards, problems, NOW, restored.snapshot.settings, 'UTC').ready).toEqual([card]);
  });

  it('does not create a card when unticking a never-ticked problem', async () => {
    const result = await repository.setCompleted(['lc-217'], false, NOW, 'UTC');
    expect(result).toMatchObject({ changedCount: 0, undo: null, snapshot: { cards: [], revision: 0 } });
  });
});

describe('membership undo, concurrency and rollback', () => {
  it('undoes a first tick by archiving, then re-ticks without restarting', async () => {
    const result = await repository.setCompleted(['lc-217'], true, NOW, 'UTC');
    const undone = await repository.undoMembership(result.undo!);
    expect(undone.cards).toEqual([{ ...result.snapshot.cards[0]!, archived: true }]);
    const restored = await repository.setCompleted(['lc-217'], true, NOW + 1000, 'UTC');
    expect(restored.snapshot.cards).toEqual(result.snapshot.cards);
    await expect(repository.undoMembership(result.undo!)).rejects.toBeInstanceOf(MembershipConflictError);
  });

  it('undoes an archive or restore without deleting or rewriting history', async () => {
    const { card, log } = historyFixture();
    await database.cards.put(card);
    await database.reviewLogs.add(log);
    const before = await repository.reviewHistory(card.problemId);
    const removed = await repository.setCompleted([card.problemId], false, NOW, 'UTC');
    expect((await repository.undoMembership(removed.undo!)).cards).toEqual([card]);
    await repository.setCompleted([card.problemId], false, NOW, 'UTC');
    const restored = await repository.setCompleted([card.problemId], true, NOW, 'UTC');
    expect((await repository.undoMembership(restored.undo!)).cards).toEqual([{ ...card, archived: true }]);
    expect(await repository.reviewHistory(card.problemId)).toEqual(before);
  });

  it('bulk undo changes only cards affected by that action', async () => {
    await repository.setCompleted(['lc-217'], true, NOW, 'UTC');
    const category = problems.filter((problem) => problem.category === 'Arrays & Hashing');
    const result = await repository.setCompleted(category.map((problem) => problem.id), true, NOW + 1, 'UTC');
    expect(result.changedCount).toBe(7);
    const undone = await repository.undoMembership(result.undo!);
    expect(undone.cards.filter((card) => !card.archived).map((card) => card.problemId)).toEqual(['lc-217']);
    expect(undone.cards).toHaveLength(8);
  });

  it('rejects stale undo after another connection changes membership', async () => {
    const first = await repository.setCompleted(['lc-217'], true, NOW, 'UTC');
    await anotherConnection().setCompleted(['lc-49'], true, NOW, 'UTC');
    await expect(repository.undoMembership(first.undo!)).rejects.toBeInstanceOf(MembershipConflictError);
    expect((await repository.snapshot()).cards.filter((card) => !card.archived)).toHaveLength(2);
  });

  it('also guards the whole post-action card against future review writes', async () => {
    const first = await repository.setCompleted(['lc-217'], true, NOW, 'UTC');
    await database.cards.put(historyFixture().card);
    await expect(repository.undoMembership(first.undo!)).rejects.toBeInstanceOf(MembershipConflictError);
    expect(await database.cards.get('lc-217')).toEqual(historyFixture().card);
  });

  it('serializes concurrent duplicate ticks without replacing a newly-created card', async () => {
    const other = anotherConnection();
    await other.initialize();
    const results = await Promise.all([
      repository.setCompleted(['lc-217'], true, NOW, 'UTC'),
      other.setCompleted(['lc-217'], true, NOW + 1000, 'UTC'),
    ]);
    expect(results.map((result) => result.changedCount).sort()).toEqual([0, 1]);
    expect((await repository.snapshot()).revision).toBe(1);
    expect(await database.cards.count()).toBe(1);
  });

  it('concurrent additions to different problems both survive', async () => {
    const other = anotherConnection();
    await Promise.all([
      repository.setCompleted(['lc-217'], true, NOW, 'UTC'),
      other.setCompleted(['lc-49'], true, NOW, 'UTC'),
    ]);
    const result = await repository.snapshot();
    expect(result.revision).toBe(2);
    expect(result.cards.map((card) => card.problemId).sort()).toEqual(['lc-217', 'lc-49']);
  });

  it('aborts an entire bulk tick if any card write fails', async () => {
    database.cards.hook('creating', (_key, card) => {
      if (card.problemId === 'lc-49') throw new Error('Simulated write failure');
    });
    await expect(repository.setCompleted(['lc-217', 'lc-49'], true, NOW, 'UTC')).rejects.toThrow('Simulated write failure');
    expect(await database.cards.count()).toBe(0);
    expect((await repository.snapshot()).revision).toBe(0);
  });

  it('rolls back card writes if the related revision write fails', async () => {
    await repository.setCompleted(['lc-217'], true, NOW, 'UTC');
    const before = await repository.snapshot();
    database.metadata.hook('updating', () => { throw new Error('Simulated metadata failure'); });
    await expect(repository.setCompleted(['lc-217'], false, NOW, 'UTC')).rejects.toThrow('Simulated metadata failure');
    expect(await repository.snapshot()).toEqual(before);
  });

  it('rejects incompatible settings without overwriting valid settings or cards', async () => {
    await database.cards.put(historyFixture().card);
    const before = await repository.snapshot();
    await expect(repository.saveSettings({ ...DEFAULT_SETTINGS, maxIntervalDays: 5 })).rejects.toThrow();
    await expect(repository.saveSettings({ ...DEFAULT_SETTINGS, learningSteps: [] })).rejects.toThrow();
    expect(await repository.snapshot()).toEqual(before);
  });

  it('validates unknown IDs before making membership writes', async () => {
    await expect(repository.setCompleted(['lc-217', 'unknown'], true, NOW, 'UTC')).rejects.toThrow('Unknown problem');
    expect(await database.cards.count()).toBe(0);
  });

  it('observes writes from a second connection and stops after unsubscribe', async () => {
    const snapshots: number[] = [];
    const error = vi.fn();
    const subscription = repository.observe((snapshot) => snapshots.push(snapshot.revision), error);
    try {
      await vi.waitFor(() => expect(snapshots.at(-1)).toBe(0));
      const other = anotherConnection();
      await other.setCompleted(['lc-217'], true, NOW, 'UTC');
      await vi.waitFor(() => expect(snapshots.at(-1)).toBe(1));
      subscription.unsubscribe();
      await other.saveSettings({ ...DEFAULT_SETTINGS, firstReview: 'today' });
      expect(snapshots.at(-1)).toBe(1);
      expect(error).not.toHaveBeenCalled();
    } finally { subscription.unsubscribe(); }
  });
});
