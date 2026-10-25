import { problems } from '../data';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { browserLibrary, browserManagement, browserReview } from '../library/browser';
import { Library } from './Library';
import { Today } from './Today';
import { Review } from './Review';
import { Stats } from './Stats';
import { Settings } from './Settings';

const currentPage = () => ['library', 'stats', 'settings'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'today';

export function App() {
  const state = useSyncExternalStore(browserReview.subscribe, browserReview.getSnapshot);
  const management = useSyncExternalStore(browserManagement.subscribe, browserManagement.getSnapshot);
  const [page, setPage] = useState(currentPage);
  const main = useRef<HTMLElement>(null);
  const inReview = Boolean(state.session);
  const loaded = Boolean(state.data);
  useEffect(() => {
    if (!inReview && loaded) main.current?.querySelector<HTMLElement>('h2')?.focus();
  }, [page, inReview, loaded]);
  useEffect(() => browserReview.connect(), []);
  useEffect(() => {
    void browserManagement.checkReminder();
    const check = () => { void browserManagement.checkReminder(); };
    const timer = setInterval(check, 60_000);
    window.addEventListener('focus', check);
    return () => { clearInterval(timer); window.removeEventListener('focus', check); };
  }, []);
  useEffect(() => {
    const navigate = () => setPage(currentPage());
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
      {!state.session && <a className="skip-link" href="#main-content" onClick={(event) => { event.preventDefault(); main.current?.focus(); }}>Skip to content</a>}
      {!state.session && <header className="app-header"><span className="wordmark">Recall<span aria-hidden="true">.</span></span>
        {page === 'today' && <a className="settings-link" href="#settings" aria-label="Settings"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m9 3-1 3-3 1-2 5 2 5 3 1 1 3h6l1-3 3-1 2-5-2-5-3-1-1-3Z" /><circle cx="12" cy="12" r="3" /></svg></a>}
        {state.undo && <button type="button" disabled={state.busy || Boolean(state.error)} onClick={() => { void browserReview.undo(); }}>Undo rating</button>}</header>}
      <main ref={main} tabIndex={0} className="app-content" id="main-content" aria-busy={state.busy}>
        {!state.session && <section className="welcome" aria-labelledby="app-title">
          <h1 id="app-title">Blind 75 Recall</h1>
          <p className="seed-count">{problems.length} problems in the collection.</p>
        </section>}
        {state.error && <div role="alert" className="library-error"><p>{state.error}</p><button type="button" onClick={browserReview.retry} disabled={state.busy}>Retry reviews</button></div>}
        {state.notice && <p role="status">{state.notice}</p>}
        {state.busy && <span className="sr-only" role="status">Saving review…</span>}
        {!state.session && page === 'today' && management.backupDue && <p role="status">Time for a backup. <a href="#settings">Export your data in Settings</a> to keep a safe copy outside this app.</p>}
        {state.session ? <Review controller={browserReview} state={state} />
          : page === 'library' ? <Library controller={browserLibrary} now={state.now} timeZone={state.timeZone} />
            : page === 'stats' ? <Stats data={state.data} now={state.now} timeZone={state.timeZone} />
              : page === 'settings' ? <Settings controller={browserManagement} data={state.data} />
            : <Today controller={browserReview} state={state} />}
      </main>
      {!state.session && <nav className="app-navigation" aria-label="Main navigation"><a href="#today" aria-current={page === 'today' ? 'page' : undefined} onClick={(event) => { if (state.busy) event.preventDefault(); }}>Today</a>
        <a href="#library" aria-current={page === 'library' ? 'page' : undefined} onClick={(event) => { if (state.busy) event.preventDefault(); }}>Library</a>
        <a href="#stats" aria-current={page === 'stats' ? 'page' : undefined} onClick={(event) => { if (state.busy) event.preventDefault(); }}>Stats</a></nav>}
    </div>
  );
}
