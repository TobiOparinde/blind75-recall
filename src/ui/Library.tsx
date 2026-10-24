import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { problems } from '../data';
import type { Problem } from '../domain/problem';
import type { LibraryController } from '../library/controller';
import { libraryGroups, librarySummary, schedulingStatus, type CompletionFilter, type DifficultyFilter } from '../library/model';

const completions = [['all', 'All'], ['completed', 'Completed'], ['remaining', 'Remaining']] as const;
const difficulties = [['all', 'All'], ['easy', 'Easy'], ['medium', 'Medium'], ['hard', 'Hard']] as const;
const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

function RemoveDialog({ problem, returnFocusTo, onCancel, onConfirm }: { problem: Problem; returnFocusTo: HTMLInputElement; onCancel: () => void; onConfirm: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => {
      dialog?.close();
      if (returnFocusTo.isConnected) returnFocusTo.focus();
    };
  }, [returnFocusTo]);
  return (
    <dialog ref={ref} aria-labelledby="remove-title" aria-describedby="remove-description"
      onCancel={(event) => { event.preventDefault(); onCancel(); }}>
      <h2 id="remove-title">Remove from deck?</h2>
      <p id="remove-description">{problem.title}. History is kept.</p>
      <div className="dialog-actions">
        <button type="button" onClick={onCancel} autoFocus>Cancel</button>
        <button type="button" className="remove-button" onClick={onConfirm}>Remove</button>
      </div>
    </dialog>
  );
}

export function Library({ controller, now, timeZone }: { controller: LibraryController; now: number; timeZone: string }) {
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  useEffect(() => controller.connect(), [controller]);
  const [completion, setCompletion] = useState<CompletionFilter>('all');
  const [difficulty, setDifficulty] = useState<DifficultyFilter>('all');
  const [removing, setRemoving] = useState<{ problem: Problem; trigger: HTMLInputElement } | null>(null);
  const cards = state.data?.cards ?? [];
  const summary = librarySummary(problems, cards);
  const groups = libraryGroups(problems, cards, completion, difficulty);
  const cardMap = new Map(cards.map((card) => [card.problemId, card]));
  const disabled = !state.data || state.busy || Boolean(state.error);

  return (
    <section id="library" className="library" aria-labelledby="library-title" aria-busy={state.busy}>
      <div className="library-heading"><h2 id="library-title">Library</h2><span className="completion-count">Completed {summary.completed} / {summary.total}</span></div>
      <div className="completion-progress" role="progressbar" aria-label="Completed problems"
        aria-valuemin={0} aria-valuemax={summary.total} aria-valuenow={summary.completed}
        aria-valuetext={`${summary.completed} of ${summary.total}; Easy ${summary.byDifficulty.easy}, Medium ${summary.byDifficulty.medium}, Hard ${summary.byDifficulty.hard}`}>
        {(['easy', 'medium', 'hard'] as const).map((level) => (
          <span key={level} className={`progress-${level}`} style={{ width: `${summary.byDifficulty[level] / summary.total * 100}%` }} />
        ))}
      </div>
      <fieldset className="filter-group"><legend>Completion</legend><div className="filter-buttons">
        {completions.map(([value, label]) => <button key={value} type="button" aria-pressed={completion === value} onClick={() => setCompletion(value)}>{label}</button>)}
      </div></fieldset>
      <fieldset className="filter-group"><legend>Difficulty</legend><div className="filter-buttons">
        {difficulties.map(([value, label]) => <button key={value} type="button" aria-label={value === 'all' ? 'All difficulties' : label} aria-pressed={difficulty === value} onClick={() => setDifficulty(value)}>{label}</button>)}
      </div></fieldset>
      {!state.data && !state.error && <p role="status">Loading your library…</p>}
      {state.error && <div role="alert" className="library-error"><p>{state.error}</p><button type="button" disabled={state.busy} onClick={controller.retry}>Retry</button></div>}
      {state.busy && <span role="status" className="sr-only">Saving library…</span>}
      {state.data && groups.length === 0 && <p>No problems match these filters.</p>}
      {state.data && groups.map((group) => (
        <details className="category" key={group.category} data-category={group.category} open>
          <summary><span>{group.category}</span><span className="category-count">{group.completed} / {group.allProblems.length}</span></summary>
          <div className="category-actions"><button type="button" disabled={disabled || group.completed === group.allProblems.length}
            aria-label={`Mark all ${group.allProblems.length} problems in ${group.category}`}
            onClick={() => { void controller.setCompleted(group.allProblems.map((problem) => problem.id), true); }}>Mark all {group.allProblems.length}</button></div>
          <div className="problem-list">{group.problems.map((problem) => {
            const card = cardMap.get(problem.id);
            const completed = Boolean(card && !card.archived);
            return (
              <label key={problem.id} className="problem-row" data-problem-id={problem.id}>
                <span className="checkbox-target"><input type="checkbox" className="problem-checkbox" checked={completed} disabled={disabled}
                  aria-label={`Completed: ${problem.title}`} onChange={(event) => {
                    if (completed) setRemoving({ problem, trigger: event.currentTarget });
                    else void controller.setCompleted([problem.id], true);
                  }} /></span>
                <span className="problem-text"><span className="problem-heading"><span className="problem-number">#{problem.lcNumber}</span><span className="problem-title">{problem.title}</span></span>
                  <span className="row-status">{schedulingStatus(card, now, state.data!.settings, timeZone)}</span></span>
                <span className="row-badges"><span className={`difficulty-badge difficulty-${problem.difficulty}`}>{capitalize(problem.difficulty)}</span>
                  {problem.premium && <span className="premium-badge">Premium</span>}</span>
              </label>
            );
          })}</div>
        </details>
      ))}
      {state.notice && <aside className="undo-toast" aria-label="Library notification"><span role="status">{state.notice}</span>
        {state.undo && <button type="button" disabled={state.busy} onClick={() => { void controller.undo(); }}>Undo</button>}
        <button type="button" className="dismiss-toast" aria-label="Dismiss notification" disabled={state.busy} onClick={controller.dismissNotice}>×</button>
      </aside>}
      {removing && <RemoveDialog problem={removing.problem} returnFocusTo={removing.trigger} onCancel={() => setRemoving(null)} onConfirm={() => {
        const problem = removing.problem;
        setRemoving(null);
        void controller.setCompleted([problem.id], false);
      }} />}
    </section>
  );
}
