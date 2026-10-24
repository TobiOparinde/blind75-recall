import { describe, expect, it } from 'vitest';
import { problems } from '../data';
import { DEFAULT_SETTINGS } from '../scheduler/config';
import { learningCard, newCard, NOW, relearningCard, reviewCard, TODAY } from '../scheduler/testFixtures';
import { libraryGroups, librarySummary, schedulingStatus } from './model';

const cards = [newCard({ problemId: 'lc-217' }), reviewCard({ problemId: 'lc-49' }), reviewCard({ problemId: 'lc-76', archived: true })];

describe('library grouping, progress and combined filters', () => {
  it('uses all 18 live categories in seed order with the correct totals', () => {
    const groups = libraryGroups(problems, [], 'all', 'all');
    expect(groups).toHaveLength(18);
    expect(groups.map((group) => group.problems.length)).toEqual([8,3,4,2,6,1,11,3,2,1,6,1,10,2,2,5,5,3]);
    expect(groups[0]?.category).toBe('Arrays & Hashing');
    expect(groups.at(-1)?.category).toBe('Math & Geometry');
    expect(groups.flatMap((group) => group.problems.map((problem) => problem.order))).toEqual(Array.from({ length: 75 }, (_, i) => i + 1));
  });

  it('progress counts active cards by difficulty, excluding archives and unknown IDs', () => {
    expect(librarySummary(problems, [...cards, newCard({ problemId: 'other-list' })]))
      .toEqual({ completed: 2, total: 75, byDifficulty: { easy: 1, medium: 1, hard: 0 } });
  });

  it.each([
    ['all', 'all', 75], ['all', 'easy', 19], ['all', 'medium', 49], ['all', 'hard', 7],
    ['completed', 'all', 2], ['completed', 'easy', 1], ['completed', 'medium', 1], ['completed', 'hard', 0],
    ['remaining', 'all', 73], ['remaining', 'easy', 18], ['remaining', 'medium', 48], ['remaining', 'hard', 7],
  ] as const)('%s / %s shows %i problems', (completion, difficulty, count) => {
    const groups = libraryGroups(problems, cards, completion, difficulty);
    expect(groups.flatMap((group) => group.problems)).toHaveLength(count);
    expect(groups.every((group) => group.problems.length > 0)).toBe(true);
  });

  it('category counts remain global while rows are filtered', () => {
    const group = libraryGroups(problems, cards, 'completed', 'easy')[0]!;
    expect(group.completed).toBe(2);
    expect(group.allProblems).toHaveLength(8);
    expect(group.problems.map((problem) => problem.id)).toEqual(['lc-217']);
  });
});

describe('row scheduling status', () => {
  it.each([
    [undefined, 'Not in deck'], [reviewCard({ archived: true }), 'Not in deck'],
    [newCard(), 'New · Due today'], [newCard({ dueDay: TODAY + 1 }), 'New · Due tomorrow'],
    [reviewCard(), 'Due today'], [reviewCard({ dueDay: TODAY + 5 }), 'Due in 5d'],
    [reviewCard({ dueDay: TODAY - 5 }), 'Overdue by 5d'],
    [learningCard({ dueAt: NOW + 600_000, dueDay: TODAY - 100 }), 'Learning · Due in 10m'],
    [learningCard({ dueAt: NOW + 1 }), 'Learning · Due in 1m'],
    [relearningCard(), 'Relearning · Due now'],
  ] as const)('renders %s as %s', (card, expected) => {
    expect(schedulingStatus(card, NOW, DEFAULT_SETTINGS, 'UTC')).toBe(expected);
  });
});
