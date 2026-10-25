import { problems } from '../data';
import { statsModel } from '../stats/model';
import type { ReviewSnapshot } from '../storage/reviewRepository';

export function Stats({ data, now, timeZone }: { data: ReviewSnapshot | null; now: number; timeZone: string }) {
  if (!data) return <p role="status">Loading stats…</p>;
  const stats = statsModel(data, problems, now, timeZone);
  const maximum = Math.max(1, ...stats.forecast.map((day) => day.count));
  return <section className="utility-screen" aria-labelledby="stats-title"><h2 id="stats-title" tabIndex={-1}>Stats</h2>
    <dl className="stat-grid"><div><dt>Due today</dt><dd>{stats.dueToday}</dd></div><div><dt>Streak</dt><dd>{stats.streak} days</dd></div>
      <div><dt>30-day retention</dt><dd>{stats.retention === null ? 'No reviews yet' : `${Math.round(stats.retention * 100)}%`}</dd></div></dl>
    <p>Retention: Good + Easy / all ratings across the last 30 review days ({stats.retentionReviews} ratings), including early practice and archived history.</p>
    <section aria-labelledby="forecast-title"><h3 id="forecast-title">7-day forecast</h3><p>Existing deadlines, today through six days ahead. Overdue cards appear today; future ratings are not predicted.</p>
      <ol className="forecast">{stats.forecast.map((day, index) => <li key={day.day} aria-label={`${index === 0 ? 'Today' : `In ${index} days`}: ${day.count} cards`}>
        <span>{day.count}</span><div className="forecast-track" aria-hidden="true"><i style={{ height: `${100 * day.count / maximum}%` }} /></div><span>{index === 0 ? 'Today' : `+${index}d`}</span>
      </li>)}</ol></section>
    <section><h3>Cards by maturity</h3><dl className="stat-grid">{Object.entries(stats.maturity).map(([label, count]) => <div key={label}><dt>{label}</dt><dd>{count}</dd></div>)}</dl><p>Learning includes relearning. Young: under 21 days. Mature: 21 days or more. Archived cards are excluded.</p></section>
    <section><h3>Weakest categories</h3><p>Lapses (Again from Review) / review-state ratings, over all history.</p>{stats.weakest.length ? <ul className="utility-list">{stats.weakest.map((row) => <li key={row.category}><span>{row.category}</span><span>{Math.round(row.rate * 100)}% · {row.lapses}/{row.reviews}</span></li>)}</ul> : <p>No review-state history yet.</p>}</section>
    <section><h3>Leeches</h3><p>Active cards with {data.settings.leechThreshold} or more lapses. These remain in the review queue.</p>{stats.leeches.length ? <ul className="utility-list">{stats.leeches.map((card) => <li key={card.problemId}><span>{problems.find((problem) => problem.id === card.problemId)?.title}</span><span>{card.lapses} lapses</span></li>)}</ul> : <p>No leeches.</p>}</section>
  </section>;
}
