import { problems } from '../data';
import type { Card } from '../domain/scheduler';
import type { ReviewController, ReviewState } from '../review/controller';
import { countdown, todayModel } from '../review/model';
import { schedulingStatus } from '../library/model';

export function Today({ controller, state }: { controller: ReviewController; state: ReviewState }) {
  const { data, busy, error, now, timeZone } = state;
  if (!data) return <section aria-label="Today"><p role="status">Loading your reviews…</p></section>;
  const model = todayModel(data.cards, data.logs, problems, now, data.settings, timeZone);
  const byId = new Map(problems.map((problem) => [problem.id, problem]));
  const rows = (cards: readonly Card[]) => <ul className="queue-list">{cards.map((card) => {
    const problem = byId.get(card.problemId)!;
    return <li key={card.problemId}><button type="button" className="queue-row" disabled={busy || Boolean(error)} aria-label={`Review ${problem.title}`}
      onClick={() => controller.start(card.problemId)}><span className="queue-description"><span>#{problem.lcNumber} {problem.title}</span>
        <span className="row-status">{schedulingStatus(card, now, data.settings, timeZone)}</span></span>
      <span className={`difficulty-badge difficulty-${problem.difficulty}`}>{problem.difficulty.charAt(0).toUpperCase() + problem.difficulty.slice(1)}</span>
    </button></li>;
  })}</ul>;
  const waiting = model.ready.length === 0 && model.nextLearningDueAt !== null;
  return <section className="today" aria-labelledby="today-title">
    <h2 id="today-title">Today</h2>
    <div className="today-overview">
      <div className="goal-ring" role="img" aria-label={`Daily goal: ${model.completed} of ${data.settings.dailyGoal} ratings`}>
        <svg viewBox="0 0 120 120" aria-hidden="true"><circle className="ring-track" cx="60" cy="60" r="50" />
          <circle className="ring-value" cx="60" cy="60" r="50" strokeDasharray={2 * Math.PI * 50}
            strokeDashoffset={2 * Math.PI * 50 * (1 - Math.min(1, model.completed / data.settings.dailyGoal))} /></svg>
        <span>{model.completed} / {data.settings.dailyGoal}</span>
      </div>
      <div><p className="daily-progress" aria-live="polite">{model.completed} / {data.settings.dailyGoal} ratings today</p>
        {model.goalHit && <p className="goal-hit" role="status">Goal hit</p>}
        <p className="due-total">{model.ready.length} due</p>
        <dl className="due-breakdown"><div><dt>Learning</dt><dd>{model.learning}</dd></div><div><dt>Review</dt><dd>{model.review}</dd></div><div><dt>New</dt><dd>{model.fresh}</dd></div></dl>
        {model.streak > 0 && <p className="streak-chip">Streak: {model.streak} {model.streak === 1 ? 'day' : 'days'}</p>}
      </div>
    </div>
    {model.activeCount === 0 ? <div className="today-empty"><p>Tick the problems you have completed.</p><a className="action-link" href="#library">Open Library</a></div>
      : waiting ? <div className="waiting-state"><p role="timer" aria-live="off">Next card in {countdown(model.nextLearningDueAt!, now)}</p><p>Learning cards are waiting.</p></div>
        : model.ready.length === 0 && <p className="caught-up">All caught up. Next up tomorrow: {model.tomorrow} {model.tomorrow === 1 ? 'problem' : 'problems'}.</p>}
    {model.ready.length > 0 && <section aria-labelledby="up-next-title"><h2 id="up-next-title">Up next</h2>
      {model.picks.length > 0 && <div data-queue-group="picks"><h3>Today’s picks</h3>{rows(model.picks)}</div>}
      {model.upNext.length > 0 && <div data-queue-group="remaining"><h3>More due</h3>{rows(model.upNext)}</div>}
    </section>}
    {model.earlyCards.length > 0 && <details className="early-queue"><summary>Review early ({model.earlyCards.length})</summary>{rows(model.earlyCards)}</details>}
    {(model.ready.length > 0 || waiting) && <div className="today-action">
      {model.ready.length > 0 ? <button type="button" className="primary-action" disabled={busy || Boolean(error)} onClick={() => controller.start()}>{model.goalHit ? 'Keep going' : 'Start review'}</button>
        : <button type="button" className="primary-action" disabled={busy || Boolean(error)} onClick={() => {
          const card = data.cards.find((card) => (card.state === 'learning' || card.state === 'relearning') && !card.archived && card.dueAt === model.nextLearningDueAt);
          if (card) controller.start(card.problemId);
        }}>Show now</button>}
    </div>}
  </section>;
}
