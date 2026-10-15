import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiGet } from '../api';
import '../pages/RevenuePlanning.css';
const money = n => n === null ? 'Not available' : Number(n).toLocaleString(undefined, {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0
});
export default function GoalTrackingSummary() {
  const [data, setData] = useState(null),
    [error, setError] = useState('');
  useEffect(() => {
    let alive = true;
    apiGet('/revenue-planning/summary').then(value => {
      if (alive) setData(value);
    }).catch(e => {
      if (alive) setError(e.message);
    });
    return () => {
      alive = false;
    };
  }, []);
  return <section className="rp-goal-summary"><h3>Targets & Forecasts</h3>{!data && !error && <p role="status">Loading calendar-period goals…</p>}{error && <p role="alert">Unable to load targets. Open the planner to retry.</p>}{data?.summaries.map(s => <article key={s.period}><p>{s.label} · {s.metricLabel}</p><div><strong>{money(s.actual)}</strong>{s.target === null ? ' · Target not set' : ` / ${money(s.target)}`}</div>{s.attainment !== null && <progress aria-label={`${s.label} actual target attainment`} max={100} value={Math.max(0, Math.min(100, s.attainment))} />}{s.targetIsSample && <small>Sample planning target · demo</small>}<p>{s.gap === null ? 'Set a target in Revenue Planning.' : `${money(s.gap)} remaining to target`}</p><Link to={`/revenue-planning?period=${s.period}&metric=${s.metric}`}>Review plan →</Link></article>)}<Link className="rp-summary-link" to="/revenue-planning">Open targets & forecast history →</Link><p>Calendar periods in UTC. Pipeline coverage is shown separately in the planner.</p></section>;
}
