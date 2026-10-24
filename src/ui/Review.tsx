import { useEffect, useRef } from 'react';
import { problems } from '../data';
import type { Rating } from '../domain/scheduler';
import type { ReviewController, ReviewState } from '../review/controller';
import { countdown, previewLabel, previewNeedsRefresh, todayModel } from '../review/model';

const ratings = [[1, 'Again', 'again'], [2, 'Hard', 'hard'], [3, 'Good', 'good'], [4, 'Easy', 'easy']] as const;

export function Review({ controller, state }: { controller: ReviewController; state: ReviewState }) {
  const root = useRef<HTMLElement>(null);
  const session = state.session;
  const sessionId = session?.kind === 'card' ? session.id : 0;
  useEffect(() => { root.current?.focus(); }, [sessionId]);
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat || event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return;
      if (event.target instanceof Element && event.target.closest('button,a,input,textarea,select,summary,[contenteditable],[role="dialog"]')) return;
      const current = controller.getSnapshot();
      if (current.busy || current.error || current.session?.kind !== 'card') return;
      if (event.key === ' ' && !current.session.answer) { event.preventDefault(); controller.reveal(); }
      if (/^[1-4]$/.test(event.key) && current.session.answer) { event.preventDefault(); void controller.rate(Number(event.key) as Rating); }
    };
    document.addEventListener('keydown', shortcut);
    return () => document.removeEventListener('keydown', shortcut);
  }, [controller]);
  if (!state.data || !session) return null;
  const model = todayModel(state.data.cards, state.data.logs, problems, state.now, state.data.settings, state.timeZone);
  const disabled = state.busy || Boolean(state.error);
  const expired = session.kind === 'card' && session.answer ? previewNeedsRefresh(session.answer, state.now, session.settings, state.timeZone) : false;
  const problem = session.kind === 'card' ? problems.find((problem) => problem.id === session.card.problemId)! : null;
  return <section ref={root} tabIndex={-1} className="review-screen" aria-label="Review session">
    <div className="review-topbar"><button type="button" onClick={controller.close} disabled={state.busy}>Close review</button>
      <span aria-live="polite">{model.completed} / {state.data.settings.dailyGoal} ratings today</span>
      {state.undo && <button type="button" onClick={() => { void controller.undo(); }} disabled={disabled}>Undo rating</button>}
    </div>
    {session.kind === 'waiting' ? <div className="review-waiting"><h1>Learning cards are waiting</h1>
      {model.nextLearningDueAt !== null && <><p role="timer" aria-live="off">Next card in {countdown(model.nextLearningDueAt, state.now)}</p>
        <button type="button" className="primary-action" disabled={disabled} onClick={() => {
          const card = state.data!.cards.find((card) => !card.archived && (card.state === 'learning' || card.state === 'relearning') && card.dueAt === model.nextLearningDueAt);
          if (card) controller.start(card.problemId);
        }}>Show now</button></>}
    </div> : problem && <div className="review-columns">
      <div className="review-problem"><p>LeetCode #{problem.lcNumber}</p><h1>{problem.title}</h1>
        <span className={`difficulty-badge difficulty-${problem.difficulty}`}>{problem.difficulty.charAt(0).toUpperCase() + problem.difficulty.slice(1)}</span>
        <a className="action-link" href={problem.leetcodeUrl} target="_blank" rel="noopener noreferrer">Open on LeetCode</a>
      </div>
      <div className="review-answer">
        {!session.answer ? <button type="button" className="primary-action reveal-answer" disabled={disabled} onClick={() => controller.reveal()}>Show answer</button>
          : <><div className="answer-links"><a className="action-link" href={problem.neetcodeUrl ?? problem.leetcodeUrl} target="_blank" rel="noopener noreferrer">NeetCode</a>
            <a className="action-link" href={problem.leetcodeUrl} target="_blank" rel="noopener noreferrer">LeetCode</a></div>
          {expired && <p className="preview-expired" role="status">The review day, timezone or waiting interval changed. Refresh intervals to continue.</p>}
          <button type="button" className="refresh-intervals" disabled={disabled} onClick={() => controller.reveal(true)}>Refresh intervals</button>
          <details className="rating-guide"><summary>Rating guide</summary><dl>
            <dt>Again</dt><dd>Could not solve it, or had to read the solution.</dd>
            <dt>Hard</dt><dd>Solved with big hints, a long struggle, or slow pattern recall.</dd>
            <dt>Good</dt><dd>Solved cleanly, recognised the pattern and reached the optimal approach.</dd>
            <dt>Easy</dt><dd>Instant recall of the pattern and optimal solution.</dd>
          </dl></details>
          <div className="rating-buttons">{ratings.map(([rating, label, color]) => <button key={rating} type="button" className={`rating-button rating-${color}`} disabled={disabled || expired}
            aria-label={`${label} ${previewLabel(session.answer!.previews[rating], session.answer!.now, session.settings, session.answer!.timeZone)}`}
            onClick={() => { void controller.rate(rating); }}><span>{label}</span><span className="interval-preview">{previewLabel(session.answer!.previews[rating], session.answer!.now, session.settings, session.answer!.timeZone)}</span></button>)}</div>
          </>}
      </div>
    </div>}
  </section>;
}
