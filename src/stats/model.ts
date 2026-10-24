import type { Problem } from '../domain/problem';
import type { ReviewSnapshot } from '../storage/reviewRepository';
import { dayIndex } from '../scheduler/calendar';
import { todayModel } from '../review/model';

/** Forecast is a snapshot of existing deadlines, not a prediction of future ratings. */
export function statsModel(data: ReviewSnapshot, problems: readonly Problem[], now: number, timeZone: string) {
  const { cards, logs, settings } = data;
  const today = dayIndex(now, settings.rolloverHour, timeZone);
  const active = cards.filter((card) => !card.archived);
  const current = todayModel(cards, logs, problems, now, settings, timeZone);
  const recent = logs.filter((log) => {
    const day = dayIndex(log.ratedAt, settings.rolloverHour, timeZone);
    return day >= today - 29 && day <= today;
  });
  const maturity = { New: 0, Learning: 0, Young: 0, Mature: 0 };
  const forecast = Array.from({ length: 7 }, (_, offset) => ({ day: today + offset, count: 0 }));
  for (const card of active) {
    const group = card.state === 'new' ? 'New' : card.state === 'learning' || card.state === 'relearning'
      ? 'Learning' : card.intervalDays < 21 ? 'Young' : 'Mature';
    maturity[group]++;
    const due = card.state === 'learning' || card.state === 'relearning'
      ? dayIndex(card.dueAt, settings.rolloverHour, timeZone) : card.dueDay;
    const offset = Math.max(0, due - today);
    if (offset < 7) forecast[offset]!.count++;
  }
  const categories = new Map<string, { category: string; lapses: number; reviews: number; rate: number }>();
  const byId = new Map(problems.map((problem) => [problem.id, problem]));
  for (const log of logs) {
    const category = byId.get(log.problemId)?.category;
    if (!category || log.stateBefore !== 'review') continue;
    const row = categories.get(category) ?? { category, lapses: 0, reviews: 0, rate: 0 };
    row.reviews++;
    if (log.rating === 1) row.lapses++;
    row.rate = row.lapses / row.reviews;
    categories.set(category, row);
  }
  return {
    dueToday: current.ready.length, streak: current.streak, forecast, maturity,
    retention: recent.length ? recent.filter((log) => log.rating >= 3).length / recent.length : null,
    retentionReviews: recent.length,
    weakest: [...categories.values()].sort((a, b) => b.rate - a.rate || b.reviews - a.reviews || a.category.localeCompare(b.category)),
    leeches: active.filter((card) => card.lapses >= settings.leechThreshold).sort((a, b) => b.lapses - a.lapses || a.problemId.localeCompare(b.problemId)),
  };
}
