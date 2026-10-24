import { problems } from '../data';
import { useEffect, useState } from 'react';
import { browserLibrary } from '../library/browser';
import { Library } from './Library';

export function App() {
  const [calendar, setCalendar] = useState(() => ({ now: Date.now(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }));
  useEffect(() => {
    const refresh = () => setCalendar({ now: Date.now(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone });
    const timer = window.setInterval(refresh, 30_000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);
  return (
    <div className="app-shell">
      <header className="app-header"><span className="wordmark">Recall<span aria-hidden="true">.</span></span><a className="library-link" href="#library">Library</a></header>
      <main className="app-content" id="main-content">
        <section className="welcome" aria-labelledby="app-title">
          <h1 id="app-title">Blind 75 Recall</h1>
          <p className="seed-count">{problems.length} problems in the collection.</p>
        </section>
        <Library controller={browserLibrary} now={calendar.now} timeZone={calendar.timeZone} />
      </main>
    </div>
  );
}
