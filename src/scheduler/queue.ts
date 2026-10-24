import type { Problem } from '../domain/problem';
import type { Card, LearningCard, QueueResult, RelearningCard, SchedulerSettings } from '../domain/scheduler';
import { dayIndex } from './calendar';
import { integer, requireValue, validateSettings } from './config';
import { hash32 } from './random';
import { validateCard } from './validateCard';

const textOrder = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
const byId = (a: Card, b: Card) => textOrder(a.problemId, b.problemId);
const difficultyOrder = { hard: 0, medium: 1, easy: 2 } as const;

export function buildQueue(
  cards: readonly Card[], problems: readonly Pick<Problem, 'id' | 'difficulty'>[], now: number,
  settings: SchedulerSettings, timeZone: string, completedRatingsToday = 0,
): QueueResult {
  validateSettings(settings);
  requireValue(integer(completedRatingsToday, 0), 'completedRatingsToday must be a nonnegative integer');
  const today = dayIndex(now, settings.rolloverHour, timeZone);
  const difficulties = new Map<string, number>();
  for (const problem of problems) {
    requireValue(typeof problem.id === 'string' && problem.id.trim().length > 0, 'Invalid problem ID');
    requireValue(!difficulties.has(problem.id), 'Duplicate problem ID');
    requireValue(typeof problem.difficulty === 'string' && Object.hasOwn(difficultyOrder, problem.difficulty), 'Invalid problem difficulty');
    difficulties.set(problem.id, difficultyOrder[problem.difficulty]);
  }
  const ids = new Set<string>();
  for (const card of cards) {
    validateCard(card, settings);
    requireValue(!ids.has(card.problemId), 'Duplicate card ID');
    requireValue(difficulties.has(card.problemId), 'Card problem is missing from the problem list');
    ids.add(card.problemId);
  }
  const active = cards.filter((card) => !card.archived);
  const learning = active.filter((card): card is LearningCard | RelearningCard => card.state === 'learning' || card.state === 'relearning')
    .sort((a, b) => a.dueAt - b.dueAt || byId(a, b));
  const ranks = new Map(active.map((card) => [card.problemId, hash32(`queue:v1|${today}|${card.problemId}`)]));
  const review = active.filter((card) => card.state === 'review' && card.dueDay <= today)
    .sort((a, b) => a.dueDay - b.dueDay
      || difficulties.get(a.problemId)! - difficulties.get(b.problemId)!
      || ranks.get(a.problemId)! - ranks.get(b.problemId)! || byId(a, b));
  const fresh = active.filter((card) => card.state === 'new' && card.dueDay <= today)
    .sort((a, b) => a.addedAt - b.addedAt || byId(a, b));
  const ready = [...learning.filter((card) => card.dueAt <= now), ...review, ...fresh];
  const waiting = learning.filter((card) => card.dueAt > now);
  const remainingGoal = Math.max(0, settings.dailyGoal - completedRatingsToday);
  return {
    ready, picks: ready.slice(0, remainingGoal), upNext: ready.slice(remainingGoal),
    learnAheadCandidates: ready.length === 0 ? waiting.filter((card) => card.dueAt - now <= settings.learnAheadMs) : [],
    nextLearningDueAt: waiting[0]?.dueAt ?? null,
  };
}
