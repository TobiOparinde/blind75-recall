import { describe, expect, it, vi } from 'vitest';
import type { Card } from '../domain/scheduler';
import type { Problem } from '../domain/problem';
import { buildQueue } from './queue';
import { DEFAULT_SETTINGS } from './config';
import { schedule } from './schedule';
import * as random from './random';
import { DAY_MS, learningCard, newCard, NOW, relearningCard, reviewCard, TODAY } from './testFixtures';

const problems: readonly Pick<Problem, 'id' | 'difficulty'>[] = Array.from({ length: 40 }, (_, i) => ({ id: `lc-${i + 1}`, difficulty: 'medium' }));
const ids = (cards: readonly Card[]) => cards.map((card) => card.problemId);

describe('due queue ordering and state-specific eligibility', () => {
  it('combines due steps, overdue reviews and oldest new cards without admitting future/archived cards', () => {
    const cards: readonly Card[] = Object.freeze([
      newCard({ problemId: 'lc-1', addedAt: NOW - 100 }),
      reviewCard({ problemId: 'lc-2', dueDay: TODAY - 4 }),
      learningCard({ problemId: 'lc-3', dueAt: NOW - 2000, dueDay: TODAY + 100 }),
      relearningCard({ problemId: 'lc-4', dueAt: NOW - 1000 }),
      reviewCard({ problemId: 'lc-5', dueDay: TODAY - 3 }),
      newCard({ problemId: 'lc-6', addedAt: NOW - 200 }),
      reviewCard({ problemId: 'lc-7', dueDay: TODAY - 2 }),
      learningCard({ problemId: 'lc-8', dueAt: NOW + 600_000, dueDay: TODAY - 100 }),
      reviewCard({ problemId: 'lc-9', dueDay: TODAY + 1 }),
      reviewCard({ problemId: 'lc-10', dueDay: TODAY - 100, archived: true }),
      reviewCard({ problemId: 'lc-11', dueDay: TODAY - 2 }),
      reviewCard({ problemId: 'lc-12', dueDay: TODAY - 2 }),
      newCard({ problemId: 'lc-13', dueDay: TODAY + 1 }),
    ].map((card) => Object.freeze(card)));
    const source = problems.map((problem) => ({ ...problem, difficulty:
      problem.id === 'lc-5' || problem.id === 'lc-12' ? 'easy' as const
        : problem.id === 'lc-7' ? 'hard' as const : 'medium' as const }));
    const snapshot = structuredClone(cards);
    const queue = buildQueue(cards, source, NOW, DEFAULT_SETTINGS, 'UTC');
    expect(ids(queue.ready)).toEqual(['lc-3', 'lc-4', 'lc-2', 'lc-5', 'lc-7', 'lc-11', 'lc-12', 'lc-6', 'lc-1']);
    expect(ids(queue.picks)).toEqual(['lc-3', 'lc-4', 'lc-2']);
    expect(queue.learnAheadCandidates).toEqual([]);
    expect(queue.nextLearningDueAt).toBe(NOW + 600_000);
    expect(cards).toStrictEqual(snapshot);
  });

  it('treats equality as due and ignores stale dueDay during steps', () => {
    const cards = [newCard({ problemId: 'lc-1' }), reviewCard({ problemId: 'lc-2' }),
      learningCard({ problemId: 'lc-3', dueAt: NOW, dueDay: TODAY + 100 }),
      relearningCard({ problemId: 'lc-4', dueAt: NOW + 1, dueDay: TODAY - 100 })];
    expect(ids(buildQueue(cards, problems, NOW, DEFAULT_SETTINGS, 'UTC').ready)).toEqual(['lc-3', 'lc-2', 'lc-1']);
  });

  it('step timestamp ties use problem ID, regardless of state or difficulty', () => {
    const cards = [relearningCard({ problemId: 'lc-2' }), learningCard({ problemId: 'lc-1' })];
    expect(ids(buildQueue(cards, problems, NOW, DEFAULT_SETTINGS, 'UTC').ready)).toEqual(['lc-1', 'lc-2']);
  });

  it('new timestamp ties use stable code-point ID order, never difficulty', () => {
    const cards = [newCard({ problemId: 'lc-2' }), newCard({ problemId: 'lc-10' }), newCard({ problemId: 'lc-1' })];
    expect(ids(buildQueue(cards, problems, NOW, DEFAULT_SETTINGS, 'UTC').ready)).toEqual(['lc-1', 'lc-10', 'lc-2']);
  });

  it('daily goal is a soft target; 30 simultaneous additions remain available', () => {
    const cards = Array.from({ length: 30 }, (_, i) => newCard({ problemId: `lc-${i + 1}` }));
    const settings = { ...DEFAULT_SETTINGS, dailyGoal: 1 };
    const before = buildQueue(cards, problems, NOW, settings, 'UTC');
    expect(before.ready).toHaveLength(30);
    expect(before.picks).toHaveLength(1);
    expect(before.upNext).toHaveLength(29);
    const after = buildQueue(cards, problems, NOW, settings, 'UTC', 1);
    expect(after.ready).toHaveLength(30);
    expect(after.picks).toEqual([]);
    expect(after.upNext).toHaveLength(30);
    expect(buildQueue(cards, problems, NOW, settings, 'UTC', 99).upNext).toHaveLength(30);
    // Undo removes one committed event; no queue mutation or stored progress is needed.
    expect(buildQueue(cards, problems, NOW, settings, 'UTC', 0).picks).toHaveLength(1);
  });

  it('empty and fully archived decks produce no ready or ahead cards', () => {
    const expected = { ready: [], picks: [], upNext: [], learnAheadCandidates: [], nextLearningDueAt: null };
    expect(buildQueue([], [], NOW, DEFAULT_SETTINGS, 'UTC')).toEqual(expected);
    expect(buildQueue([learningCard({ archived: true })], problems, NOW, DEFAULT_SETTINGS, 'UTC')).toEqual(expected);
  });

  it('rebuilds identically from serialized cards and captured context', () => {
    const cards = [learningCard({ problemId: 'lc-1' }), reviewCard({ problemId: 'lc-2' }), newCard({ problemId: 'lc-3' })];
    expect(buildQueue(structuredClone(cards), problems, NOW, DEFAULT_SETTINGS, 'UTC'))
      .toStrictEqual(buildQueue(cards, problems, NOW, DEFAULT_SETTINGS, 'UTC'));
  });
});

describe('deterministic seeded review ties', () => {
  const cards = Array.from({ length: 10 }, (_, i) => reviewCard({ problemId: `lc-${i + 1}` }));
  const expected = ['lc-5', 'lc-4', 'lc-7', 'lc-6', 'lc-1', 'lc-3', 'lc-2', 'lc-9', 'lc-8', 'lc-10'];

  it('uses the documented day/identity seed, independent of input ordering', () => {
    expect(ids(buildQueue(cards, problems, NOW, DEFAULT_SETTINGS, 'UTC').ready)).toEqual(expected);
    expect(ids(buildQueue([...cards].reverse(), problems, NOW, DEFAULT_SETTINGS, 'UTC').ready)).toEqual(expected);
  });

  it('can change ties on the next day but not when reps change', () => {
    expect(ids(buildQueue(cards, problems, NOW + DAY_MS, DEFAULT_SETTINGS, 'UTC').ready))
      .toEqual(['lc-2', 'lc-3', 'lc-1', 'lc-6', 'lc-7', 'lc-4', 'lc-5', 'lc-8', 'lc-9', 'lc-10']);
    expect(ids(buildQueue(cards.map((card) => ({ ...card, reps: card.reps + 1 })), problems, NOW, DEFAULT_SETTINGS, 'UTC').ready)).toEqual(expected);
  });

  it('adding/removing a tied card preserves other pair order', () => {
    expect(ids(buildQueue(cards.filter((card) => card.problemId !== 'lc-4'), problems, NOW, DEFAULT_SETTINGS, 'UTC').ready))
      .toEqual(expected.filter((id) => id !== 'lc-4'));
    const withExtra = buildQueue([...cards, reviewCard({ problemId: 'lc-11' })], problems, NOW, DEFAULT_SETTINGS, 'UTC');
    expect(ids(withExtra.ready).filter((id) => id !== 'lc-11')).toEqual(expected);
  });

  it('hash collisions fall back to stable problem ID order', () => {
    vi.spyOn(random, 'hash32').mockReturnValue(0);
    expect(ids(buildQueue(cards, problems, NOW, DEFAULT_SETTINGS, 'UTC').ready))
      .toEqual(['lc-1', 'lc-10', 'lc-2', 'lc-3', 'lc-4', 'lc-5', 'lc-6', 'lc-7', 'lc-8', 'lc-9']);
  });
});

describe('opt-in learn-ahead and explicit Show now', () => {
  it.each([[1, true], [462_000, true], [600_000, true], [600_001, false]] as const)('future delay %i has ahead eligibility %s', (delay, eligible) => {
    const card = learningCard({ dueAt: NOW + delay });
    const result = buildQueue([card], problems, NOW, DEFAULT_SETTINGS, 'UTC');
    expect(result.ready).toEqual([]);
    expect(result.picks).toEqual([]);
    expect(result.nextLearningDueAt).toBe(NOW + delay);
    expect(result.learnAheadCandidates).toEqual(eligible ? [card] : []);
  });

  it.each([newCard({ problemId: 'lc-2' }), reviewCard({ problemId: 'lc-2' }), relearningCard({ problemId: 'lc-2' })])('never promotes waiting learning ahead of due $state work', (dueCard) => {
    const result = buildQueue([learningCard({ dueAt: NOW + 1000 }), dueCard], problems, NOW, DEFAULT_SETTINGS, 'UTC');
    expect(ids(result.ready)).toEqual(['lc-2']);
    expect(result.learnAheadCandidates).toEqual([]);
  });

  it('a lone Again waits ten minutes; rebuilding does not immediately repeat it', () => {
    const card = schedule(reviewCard(), 1, NOW, DEFAULT_SETTINGS, 'UTC').nextCard;
    const result = buildQueue([card], problems, NOW, DEFAULT_SETTINGS, 'UTC');
    expect(result.ready).toEqual([]);
    expect(result.nextLearningDueAt).toBe(NOW + 600_000);
    expect(result.learnAheadCandidates).toEqual([card]);
    expect(buildQueue([card], problems, NOW + 600_000, DEFAULT_SETTINGS, 'UTC').ready).toEqual([card]);
  });

  it('sorts all waiting states by timestamp, supports 7:42 countdown and manual override', () => {
    const farther = learningCard({ problemId: 'lc-2', dueAt: NOW + 1_200_000 });
    const soon = relearningCard({ dueAt: NOW + 462_000 });
    const result = buildQueue([farther, soon], problems, NOW, DEFAULT_SETTINGS, 'UTC');
    expect(result.nextLearningDueAt! - NOW).toBe(7 * 60_000 + 42_000);
    expect(result.learnAheadCandidates).toEqual([soon]);
    expect(schedule(soon, 3, NOW, DEFAULT_SETTINGS, 'UTC').early).toBe(true);
    expect(schedule(farther, 3, NOW, DEFAULT_SETTINGS, 'UTC').early).toBe(true);
  });

  it('timezone changes affect day cards without changing absolute step eligibility', () => {
    const now = Date.parse('2026-10-24T08:00:00Z');
    const cards = [reviewCard(), learningCard({ problemId: 'lc-2', dueAt: now })];
    expect(ids(buildQueue(cards, problems, now, DEFAULT_SETTINGS, 'Asia/Tokyo').ready)).toEqual(['lc-2', 'lc-1']);
    expect(ids(buildQueue(cards, problems, now, DEFAULT_SETTINGS, 'America/Los_Angeles').ready)).toEqual(['lc-2']);
  });
});

describe('queue validation', () => {
  it.each([-1, 0.5, NaN])('rejects invalid completed count %s', (count) => {
    expect(() => buildQueue([], [], NOW, DEFAULT_SETTINGS, 'UTC', count)).toThrow();
  });
  it('rejects duplicate/missing identities and invalid timing instead of losing cards', () => {
    expect(() => buildQueue([reviewCard(), reviewCard()], problems, NOW, DEFAULT_SETTINGS, 'UTC')).toThrow('Duplicate card');
    expect(() => buildQueue([reviewCard()], [], NOW, DEFAULT_SETTINGS, 'UTC')).toThrow('missing');
    expect(() => buildQueue([], [...problems, problems[0]!], NOW, DEFAULT_SETTINGS, 'UTC')).toThrow('Duplicate problem');
    expect(() => buildQueue([learningCard({ dueAt: NaN })], problems, NOW, DEFAULT_SETTINGS, 'UTC')).toThrow();
  });
  it.each([
    { id: '', difficulty: 'easy' },
    { id: 'lc-1', difficulty: 'expert' },
    { id: 'lc-1', difficulty: ['hard'] },
  ])('rejects malformed problem metadata', (problem) => {
    expect(() => buildQueue([], [problem as Pick<Problem, 'id' | 'difficulty'>], NOW, DEFAULT_SETTINGS, 'UTC')).toThrow();
  });
});
