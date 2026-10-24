import type { Problem } from '../domain/problem';
import type { Card, SchedulerSettings } from '../domain/scheduler';
import { dayIndex } from '../scheduler/calendar';

export type CompletionFilter = 'all' | 'completed' | 'remaining';
export type DifficultyFilter = 'all' | Problem['difficulty'];

export function librarySummary(problems: readonly Problem[], cards: readonly Card[]) {
  const active = new Set(cards.filter((card) => !card.archived).map((card) => card.problemId));
  const completed = problems.filter((problem) => active.has(problem.id));
  return {
    completed: completed.length, total: problems.length,
    byDifficulty: {
      easy: completed.filter((problem) => problem.difficulty === 'easy').length,
      medium: completed.filter((problem) => problem.difficulty === 'medium').length,
      hard: completed.filter((problem) => problem.difficulty === 'hard').length,
    },
  };
}

export function libraryGroups(problems: readonly Problem[], cards: readonly Card[], completion: CompletionFilter, difficulty: DifficultyFilter) {
  const active = new Set(cards.filter((card) => !card.archived).map((card) => card.problemId));
  const groups = new Map<string, { category: string; allProblems: Problem[]; problems: Problem[]; completed: number }>();
  for (const problem of [...problems].sort((a, b) => a.order - b.order)) {
    let group = groups.get(problem.category);
    if (!group) {
      group = { category: problem.category, allProblems: [], problems: [], completed: 0 };
      groups.set(problem.category, group);
    }
    group.allProblems.push(problem);
    const completed = active.has(problem.id);
    group.completed += Number(completed);
    if ((difficulty === 'all' || difficulty === problem.difficulty)
      && (completion === 'all' || (completion === 'completed' ? completed : !completed))) group.problems.push(problem);
  }
  return [...groups.values()].filter((group) => group.problems.length > 0);
}

export function schedulingStatus(card: Card | undefined, now: number, settings: SchedulerSettings, timeZone: string): string {
  if (!card || card.archived) return 'Not in deck';
  if (card.state === 'learning' || card.state === 'relearning') {
    const label = card.state === 'learning' ? 'Learning' : 'Relearning';
    return card.dueAt <= now ? `${label} · Due now` : `${label} · Due in ${Math.ceil((card.dueAt - now) / 60_000)}m`;
  }
  const days = card.dueDay - dayIndex(now, settings.rolloverHour, timeZone);
  const due = days < 0 ? `Overdue by ${-days}d` : days === 0 ? 'Due today' : days === 1 ? 'Due tomorrow' : `Due in ${days}d`;
  return card.state === 'new' ? `New · ${due}` : due;
}
