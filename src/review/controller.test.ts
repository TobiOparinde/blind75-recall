import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { problems } from '../data';
import { RecallDatabase } from '../storage/database';
import { ReviewRepository } from '../storage/reviewRepository';
import { DEFAULT_SETTINGS } from '../scheduler/config';
import { learningCard, newCard, NOW, reviewCard } from '../scheduler/testFixtures';
import { ReviewController } from './controller';
import { todayModel } from './model';

let serial = 0;
let database: RecallDatabase;
let repository: ReviewRepository;
let controller: ReviewController;
let now: number;
let elapsed: number;
let cleanups: (() => void)[];
beforeEach(async () => {
  now = NOW; elapsed = 0; cleanups = [];
  database = new RecallDatabase(`m4-controller-${++serial}`);
  repository = new ReviewRepository(database, problems);
  await repository.initialize();
  controller = new ReviewController(repository, problems, () => now, () => 'UTC', () => elapsed);
});
afterEach(async () => { cleanups.forEach((stop) => stop()); database.close(); await database.delete(); });
async function connect(target = controller) {
  cleanups.push(target.connect());
  await vi.waitFor(() => expect(target.getSnapshot().data).not.toBeNull());
}
function model() {
  const state = controller.getSnapshot();
  return todayModel(state.data!.cards, state.data!.logs, problems, now, state.data!.settings, 'UTC');
}
async function revealAndRate(rating: 1 | 2 | 3 | 4 = 3) { controller.reveal(); await controller.rate(rating); }

describe('review session controller', () => {
  it('starts from the M2 queue, can select out of order and never selects an archive', async () => {
    await database.cards.bulkPut([reviewCard({ problemId: 'lc-49' }), learningCard({ problemId: 'lc-217' }), newCard({ problemId: 'lc-76', archived: true })]);
    await connect(); controller.start();
    expect(controller.getSnapshot().session).toMatchObject({ kind: 'card', card: { problemId: 'lc-217' }, answer: null });
    controller.start('lc-49');
    expect(controller.getSnapshot().session).toMatchObject({ card: { problemId: 'lc-49' } });
    controller.close(); controller.start('lc-76');
    expect(controller.getSnapshot().session).toBeNull();
  });

  it.each([1, 2, 3, 4] as const)('applies exactly the preview for %i, despite subsequent clock ticks', async (rating) => {
    await database.cards.put(reviewCard({ problemId: 'lc-217' }));
    await connect(); controller.start(); controller.reveal();
    const session = controller.getSnapshot().session!;
    if (session.kind !== 'card' || !session.answer) throw new Error('Missing preview');
    const result = structuredClone(session.answer.previews[rating]);
    now += 60_000; elapsed = 1234; controller.tick();
    await controller.rate(rating);
    expect(controller.getSnapshot().data!.cards[0]).toStrictEqual(result.nextCard);
    expect(controller.getSnapshot().data!.logs[0]).toMatchObject({ durationMs: 1234, ratedAt: NOW, rating, early: result.early });
  });

  it('goal 1 stops on Goal hit, and Keep going permits unlimited further/manual ratings', async () => {
    await repository.saveSettings({ ...DEFAULT_SETTINGS, dailyGoal: 1 });
    await database.cards.bulkPut([newCard({ problemId: 'lc-217' }), newCard({ problemId: 'lc-49' })]);
    await connect();
    expect(model().picks).toHaveLength(1);
    controller.start(); await revealAndRate();
    expect(controller.getSnapshot().session).toBeNull();
    expect(model()).toMatchObject({ completed: 1, goalHit: true, picks: [] });
    controller.start();
    expect(controller.getSnapshot().session).toMatchObject({ continuing: true });
    await revealAndRate();
    controller.start('lc-217'); await revealAndRate();
    expect(model().completed).toBe(3);
    expect(controller.getSnapshot().data!.logs[2]?.early).toBe(true);
  });

  it('waits after Again and resumes automatically when the learning timestamp becomes due', async () => {
    await database.cards.put(newCard({ problemId: 'lc-217' }));
    await connect(); controller.start(); await revealAndRate(1);
    expect(controller.getSnapshot().session).toEqual({ kind: 'waiting', continuing: false });
    expect(model().ready).toEqual([]);
    now += 600_000; controller.tick();
    expect(controller.getSnapshot().session).toMatchObject({ kind: 'card', card: { state: 'learning', problemId: 'lc-217' }, answer: null });
    await revealAndRate(3);
    expect(model().completed).toBe(2);
  });

  it('Show now starts waiting learning early and logs the override', async () => {
    await database.cards.put(learningCard({ problemId: 'lc-217', dueAt: NOW + 462_000 }));
    await connect(); controller.start();
    expect(controller.getSnapshot().session).toBeNull();
    controller.start('lc-217'); await revealAndRate();
    expect(controller.getSnapshot().data!.logs[0]?.early).toBe(true);
  });

  it('rerenders and clock changes preserve the current card, revealed answer and attempt start', async () => {
    await database.cards.put(reviewCard({ problemId: 'lc-217' }));
    await connect(); controller.start(); elapsed = 200; controller.reveal();
    const session = controller.getSnapshot().session;
    now += 15_000; elapsed = 1500;
    controller.tick(); controller.tick();
    expect(controller.getSnapshot().session).toBe(session);
    await controller.rate(3);
    expect(controller.getSnapshot().data!.logs[0]?.durationMs).toBe(1500);
  });

  it('reload drops an uncommitted session and reconstructs committed progress without an undo chain', async () => {
    await database.cards.put(newCard({ problemId: 'lc-217' }));
    await connect(); controller.start(); controller.reveal();
    const fresh = new ReviewController(repository, problems, () => now, () => 'UTC');
    await connect(fresh);
    expect(fresh.getSnapshot()).toMatchObject({ session: null, undo: null, data: { logs: [] } });
    await controller.rate(3);
    const reopened = new ReviewController(repository, problems, () => now, () => 'UTC');
    await connect(reopened);
    expect(reopened.getSnapshot()).toMatchObject({ session: null, undo: null });
    expect(reopened.getSnapshot().data!.logs).toHaveLength(1);
  });

  it('undo restores card/log/progress/queue and consumes only the latest undo', async () => {
    const first = reviewCard({ problemId: 'lc-217' });
    const second = reviewCard({ problemId: 'lc-49' });
    await database.cards.bulkPut([first, second]); await connect();
    controller.start('lc-217'); await revealAndRate();
    controller.start('lc-49'); await revealAndRate();
    expect(model().completed).toBe(2);
    await controller.undo();
    expect(model().completed).toBe(1);
    expect(model().ready.map((card) => card.problemId)).toContain('lc-49');
    expect(controller.getSnapshot()).toMatchObject({ undo: null, session: { kind: 'card', card: second, answer: null } });
    await controller.undo();
    expect(controller.getSnapshot().data!.logs).toHaveLength(1);
  });

  it('optimistic rating shows the next card before the write resolves and blocks double taps', async () => {
    await database.cards.bulkPut([reviewCard({ problemId: 'lc-217' }), reviewCard({ problemId: 'lc-49' })]);
    await connect(); controller.start('lc-217'); controller.reveal();
    const real = repository.acceptRating.bind(repository);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    vi.spyOn(repository, 'acceptRating').mockImplementationOnce(async (input) => { await gate; return real(input); });
    const pending = controller.rate(3);
    expect(controller.getSnapshot()).toMatchObject({ busy: true, session: { card: { problemId: 'lc-49' } } });
    expect(model().completed).toBe(1);
    await controller.rate(3);
    release(); await pending;
    expect(await database.reviewLogs.count()).toBe(1);
  });

  it('failed writes roll back the optimistic card, progress and revealed session', async () => {
    await database.cards.put(reviewCard({ problemId: 'lc-217' }));
    await connect(); controller.start(); controller.reveal();
    const session = controller.getSnapshot().session;
    vi.spyOn(repository, 'acceptRating').mockRejectedValueOnce(new Error('Injected write failure'));
    await controller.rate(3);
    expect(controller.getSnapshot().session).toEqual(session);
    expect(model().completed).toBe(0);
    expect(controller.getSnapshot().error).not.toBeNull();
    controller.retry(); await vi.waitFor(() => expect(controller.getSnapshot().error).toBeNull());
    await controller.rate(3);
    expect(model().completed).toBe(1);
  });

  it('uncertain acknowledgement rereads committed data instead of replaying a rating', async () => {
    await database.cards.put(reviewCard({ problemId: 'lc-217' }));
    await connect(); controller.start(); controller.reveal();
    const real = repository.acceptRating.bind(repository);
    vi.spyOn(repository, 'acceptRating').mockImplementationOnce(async (input) => { await real(input); throw new Error('Lost acknowledgement'); });
    await controller.rate(3);
    expect(model().completed).toBe(1);
    expect(controller.getSnapshot().session).toBeNull();
    controller.retry(); await vi.waitFor(() => expect(controller.getSnapshot().error).toBeNull());
    expect(await database.reviewLogs.count()).toBe(1);
  });

  it('archiving the selected card invalidates its session without rating it', async () => {
    await database.cards.put(reviewCard({ problemId: 'lc-217' }));
    await connect(); controller.start(); controller.reveal();
    await repository.setCompleted(['lc-217'], false, NOW, 'UTC');
    await vi.waitFor(() => expect(controller.getSnapshot().session).toBeNull());
    await controller.rate(3);
    expect(await database.reviewLogs.count()).toBe(0);
  });

  it('a day rollover or expired learning proposal requires an explicit UI refresh, retaining the answer', async () => {
    await database.cards.put(reviewCard({ problemId: 'lc-217' }));
    await connect(); controller.start(); controller.reveal();
    const session = controller.getSnapshot().session;
    now += 86_400_000; controller.tick();
    expect(controller.getSnapshot().session).toBe(session);
    await controller.rate(3);
    expect(await database.reviewLogs.count()).toBe(0);
    controller.reveal(true); await controller.rate(3);
    expect(model().completed).toBe(1);
    expect(controller.getSnapshot().data!.logs[0]?.ratedAt).toBe(now);
  });

  it('a failed undo retains only its own retry token, never an older one', async () => {
    await database.cards.put(reviewCard({ problemId: 'lc-217' }));
    await connect(); controller.start(); await revealAndRate();
    const token = controller.getSnapshot().undo;
    vi.spyOn(repository, 'undoRating').mockRejectedValueOnce(new Error('Temporary failure'));
    await controller.undo();
    expect(model().completed).toBe(1);
    expect(controller.getSnapshot().undo).toEqual(token);
    controller.retry(); await vi.waitFor(() => expect(controller.getSnapshot().error).toBeNull());
    await controller.undo();
    expect(model().completed).toBe(0);
    expect(controller.getSnapshot().undo).toBeNull();
  });
});
