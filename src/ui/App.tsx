import { problems } from '../data';

export function App() {
  return (
    <div className="app-shell">
      <header className="app-header"><span className="wordmark">Recall<span aria-hidden="true">.</span></span></header>
      <main className="app-content" id="main-content">
        <section className="welcome" aria-labelledby="app-title">
          <p className="eyebrow">A little recall. Every day.</p>
          <h1 id="app-title">Blind 75 Recall</h1>
          <p>Keep your coding patterns fresh.</p>
          <p className="seed-count">{problems.length} problems in the collection.</p>
        </section>
      </main>
    </div>
  );
}
