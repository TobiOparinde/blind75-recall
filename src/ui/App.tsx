import { problems } from '../data';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { browserLibrary, browserReview } from '../library/browser';
import { Library } from './Library';
import { Today } from './Today';
import { Review } from './Review';

export function App() {
  const state = useSyncExternalStore(browserReview.subscribe, browserReview.getSnapshot);
  const [page, setPage] = useState(() => location.hash === '#library' ? 'library' : 'today');
  useEffect(() => browserReview.connect(), []);
  useEffect(() => {
    const navigate = () => setPage(location.hash === '#library' ? 'library' : 'today');
    window.addEventListener('hashchange', navigate);
    window.addEventListener('focus', browserReview.tick);
    document.addEventListener('visibilitychange', browserReview.tick);
    return () => {
      window.removeEventListener('hashchange', navigate);
      window.removeEventListener('focus', browserReview.tick);
      document.removeEventListener('visibilitychange', browserReview.tick);
    };
  }, []);
  return (
    <div className={`app-shell${state.session ? ' is-review' : ''}`}>
      {!state.session && <header className="app-header"><span className="wordmark">Recall<span aria-hidden="true">.</span></span>
        {state.undo && <button type="button" disabled={state.busy || Boolean(state.error)} onClick={() => { void browserReview.undo(); }}>Undo rating</button>}</header>}
      <main className="app-content" id="main-content" aria-busy={state.busy}>
        {!state.session && <section className="welcome" aria-labelledby="app-title">
          <h1 id="app-title">Blind 75 Recall</h1>
          <p className="seed-count">{problems.length} problems in the collection.</p>
        </section>}
        {state.error && <div role="alert" className="library-error"><p>{state.error}</p><button type="button" onClick={browserReview.retry} disabled={state.busy}>Retry reviews</button></div>}
        {state.notice && <p role="status">{state.notice}</p>}
        {state.busy && <span className="sr-only" role="status">Saving review…</span>}
        {state.session ? <Review controller={browserReview} state={state} />
          : page === 'library' ? <Library controller={browserLibrary} now={state.now} timeZone={state.timeZone} />
            : <Today controller={browserReview} state={state} />}
      </main>
      {!state.session && <nav className="app-navigation" aria-label="Main navigation"><a href="#today" aria-current={page === 'today' ? 'page' : undefined} onClick={(event) => { if (state.busy) event.preventDefault(); }}>Today</a>
        <a href="#library" aria-current={page === 'library' ? 'page' : undefined} onClick={(event) => { if (state.busy) event.preventDefault(); }}>Library</a></nav>}
    </div>
  );
}
