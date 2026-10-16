import React, { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { apiGet, apiPut, apiPost } from '../api';
import './RevenuePlanning.css';
const money = n => n === null || n === undefined ? 'Not available' : Number(n).toLocaleString(undefined, {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0
});
const date = value => value ? new Date(value).toLocaleDateString(undefined, {
  dateStyle: 'medium',
  timeZone: 'UTC'
}) : 'Not recorded';
const stamp = value => value ? new Date(value).toLocaleString() : 'Not recorded';
const methodName = {
  weighted_pipeline: 'CRM wins + weighted open pipeline',
  trailing_30_days: 'Recorded revenue + trailing 30-day run rate',
  leadership_estimate: 'Leadership estimate'
};
const fields = {
  amount: 'Value',
  probability: 'Probability',
  stage: 'Stage',
  closedAt: 'Recorded outcome date',
  closeDate: 'Expected close',
  lastActivityAt: 'Activity',
  nextAction: 'Next action',
  nextActionDueAt: 'Action deadline',
  owner: 'Owner'
};
const fieldValue = (field, value) => value === null || value === undefined || value === '' ? 'Not recorded' : field === 'amount' ? money(value) : field === 'probability' ? `${Math.round(value * 100)}%` : ['closeDate', 'closedAt', 'lastActivityAt', 'nextActionDueAt'].includes(field) ? date(value) : value;
export function periodOptions(now = new Date()) {
  const rows = [];
  for (let offset = -12; offset <= 6; offset++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1));
    rows.push({
      value: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`,
      label: d.toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC'
      })
    });
  }
  for (let offset = -4; offset <= 4; offset++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), Math.floor(now.getUTCMonth() / 3) * 3 + offset * 3, 1));
    rows.push({
      value: `${d.getUTCFullYear()}-Q${Math.floor(d.getUTCMonth() / 3) + 1}`,
      label: `Q${Math.floor(d.getUTCMonth() / 3) + 1} ${d.getUTCFullYear()}`
    });
  }
  return rows;
}
export function PlanEvidence({
  plan,
  integrations = [],
  warnings = []
}) {
  return <details className="rp-evidence"><summary>Sources, dates, and calculation rules</summary><p>{plan.historyCaveat} All figures are USD. QuickBooks accounting summaries are not added to payment or CRM totals.</p><p>{plan.metric === 'bookings' ? 'Actuals include Closed Won opportunities dated inside this period. Potential coverage uses open opportunities expected to close from today through period end. Overdue closes are excluded until reviewed and re-dated. These values do not establish collected or recognized revenue.' : 'Recorded revenue stays pinned to the selected source. Duplicate payment/commerce/import sources are never added together. Actuals include completed UTC days only. A model forecast requires all 30 original observation days in its baseline; generated zero-fill rows do not count as observations.'}</p><p>{plan.overdueCount} open opportunities have overdue close dates; {plan.missingClose} lack a close date; {plan.missingWonDate} won opportunities lack an outcome date.</p>{warnings.map((w, i) => <p key={i}>{w}</p>)}{integrations.map(i => <p key={i.provider}>{i.provider}: {i.status} · Last sync {stamp(i.lastSyncAt)}</p>)}{!integrations.length && <p>No live provider freshness is implied by this view.</p>}</details>;
}
export function TargetVisual({
  plan
}) {
  const actual = plan.target > 0 ? Math.max(0, Math.min(100, (plan.actual || 0) / plan.target * 100)) : 0;
  const potential = plan.metric === 'bookings' && plan.target > 0 ? Math.max(0, Math.min(100 - actual, plan.weightedOpen / plan.target * 100)) : 0;
  return <div className="rp-target-visual"><div className="rp-row"><span>Actual attainment</span><strong>{plan.target === null ? 'Target not set' : plan.actual === null ? 'Actuals unavailable' : plan.target === 0 ? 'Zero target' : `${Math.round(plan.attainment)}%`}</strong></div>
 <div className="rp-track" role="img" aria-label={`Actual ${money(plan.actual)} against target ${money(plan.target)}${plan.metric === 'bookings' ? `; potential weighted coverage ${money(plan.weightedOpen)}` : ''}`}><span className="rp-achieved" style={{
        width: `${actual}%`
      }} /><span className="rp-potential" style={{
        width: `${potential}%`
      }} /></div>
 <div className="rp-legend"><span><i className="rp-solid" />Actual recorded value</span>{plan.metric === 'bookings' && <span><i className="rp-striped" />Potential weighted coverage</span>}<span><i />Remaining exposure</span></div>
 {plan.metric === 'bookings' ? <p>Potential coverage is {money(plan.weightedOpen)} across {plan.candidates.length} open opportunities. It is separate from actual wins and is not committed revenue.</p> : <p>CRM pipeline is excluded from revenue attainment. Signed deal values do not establish payment timing.</p>}</div>;
}
export default function RevenuePlanning() {
  const [params, setParams] = useSearchParams();
  const now = new Date(),
    period = params.get('period') || `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`,
    metric = params.get('metric') || 'bookings';
  const [data, setData] = useState(null),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false),
    [tab, setTab] = useState('target');
  const [amount, setAmount] = useState(''),
    [label, setLabel] = useState(''),
    [manual, setManual] = useState(false),
    [estimate, setEstimate] = useState(''),
    [rationale, setRationale] = useState(''),
    [selected, setSelected] = useState('');
  const generation = useRef(0);
  async function load() {
    const id = ++generation.current;
    const response = await apiGet(`/revenue-planning/plan?period=${encodeURIComponent(period)}&metric=${encodeURIComponent(metric)}`);
    if (id !== generation.current) return;
    setData(response);
    setAmount(response.plan.target === null ? '' : String(response.plan.target));
  }
  useEffect(() => {
    setData(null);
    setError('');
    setNotice('');
    setSelected('');
    setManual(false);
    setEstimate('');
    setLabel('');
    setRationale('');
    load().catch(e => setError(e.message));
    return () => {
      generation.current++;
    };
  }, [period, metric]);
  async function run(fn) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await fn();
    } catch (e) {
      setError(e.message || 'Unable to save. Refresh and try again.');
    } finally {
      setBusy(false);
    }
  }
  function choose(nextPeriod, nextMetric) {
    setParams({
      period: nextPeriod,
      metric: nextMetric
    });
  }
  if (!data || data.plan.period !== period || data.plan.metric !== metric) return <main className="rp-page"><h1>Revenue Planning</h1>{error ? <><p className="rp-error" role="alert">{error}</p><button disabled={busy} onClick={() => run(load)}>Retry</button><Link to="/revenue-planning">Reset selection</Link></> : <p role="status">Loading targets and forecast history…</p>}</main>;
  const p = data.plan,
    booking = p.metric === 'bookings',
    demo = data.workspaceMode === 'demo';
  const snapshot = data.snapshots.find(s => String(s._id) === selected) || data.snapshots[0];
  const metrics = data.availableMetrics.some(m => m.key === metric) ? data.availableMetrics : [...data.availableMetrics, {
    key: metric,
    label: p.metricLabel
  }];
  const options = periodOptions();
  if (!options.some(o => o.value === period)) options.unshift({
    value: period,
    label: p.label
  });
  return <main className="rp-page"><header className="rp-header rp-row"><div><div className="rp-eyebrow">REVENUE PLANNING</div><h1>The target. The exposure. The result.</h1><p>Set a clear goal and keep a record of what you expected to happen.</p></div><Link to="/command-center?leadership=actions">Open recovery plan →</Link></header>

 <p><Link to="/revenue-to-cash">Trace opportunities, invoices & receipts →</Link></p>
 <section className="rp-controls" aria-label="Planning period and measure"><label>Calendar period<select disabled={busy} value={period} onChange={e => choose(e.target.value, metric)}>{options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label><label>Measure<select disabled={busy} value={metric} onChange={e => choose(period, e.target.value)}>{metrics.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}</select></label><button disabled={busy} onClick={() => run(async () => {
        await load();
        setNotice('Refreshed from current workspace records.');
      })}>Refresh</button></section>
 <div className="rp-tabs" role="group" aria-label="Planning views"><button aria-pressed={tab === 'target'} onClick={() => setTab('target')}>Target & coverage</button><button aria-pressed={tab === 'history'} onClick={() => setTab('history')}>Forecast vs actual · {data.snapshots.length}</button></div>
 {error && <p role="alert" className="rp-error">{error}</p>}{notice && <p role="status" className="rp-notice">{notice}</p>}
 {tab === 'target' && <section className="rp-panel"><div className="rp-row"><div><h2>{p.label}</h2><p>{p.metricLabel} · UTC calendar boundaries{p.status === 'ended' ? ' · Period ended' : p.status === 'future' ? ' · Upcoming period' : ''}</p></div><span className="rp-badge">{data.targetIsSample ? 'Planning target' : data.target ? 'Saved target' : 'Target not set'}</span></div>
 <div className="rp-stats"><div><span>Target</span><strong>{p.target === null ? "Not set" : money(p.target)}</strong></div><div><span>{booking ? 'Won value to date' : 'Recorded revenue through ' + date(p.actualThrough)}</span><strong>{money(p.actual)}</strong></div><div><span>Remaining to target</span><strong>{money(p.gap)}</strong></div></div>
 <TargetVisual plan={p} />
 <div className="rp-two-col"><div className="rp-callout"><h3>{booking ? p.target === null ? 'Current model period total' : 'What remains exposed?' : 'What does the current run rate suggest?'}</h3><strong>{money(booking && p.target !== null ? p.uncoveredGap : p.forecast)}</strong><p>{booking ? `Model period total: ${money(p.forecast)}. ${p.target === null ? 'Set a target to measure remaining exposure.' : 'Exposure is the target gap after actual wins and potential weighted coverage.'} This is not committed revenue.` : 'Period-total estimate: recorded revenue through yesterday plus the trailing 30-day daily average for remaining calendar days. This is a planning assumption, not a committed forecast.'}</p>{p.warning && <p className="rp-warning">{p.warning}</p>}{!p.available && <p className="rp-warning">Original revenue observations for this source and period are unavailable. Missing data is not treated as zero revenue.</p>}</div>
 <div><h3>{data.target ? 'Update target' : 'Set the target'}</h3>{data.canManage && p.status !== 'ended' ? <form onSubmit={e => {
            e.preventDefault();
            run(async () => {
              await apiPut('/revenue-planning/target', {
                period,
                metric,
                amount: Number(amount),
                version: data.target?.__v ?? null
              });
              await load();
              setNotice('Target saved for this period and measure.');
            });
          }}><label>Target in USD<input disabled={busy} type="number" min="0" max="1000000000000" step="0.01" required value={amount} onChange={e => setAmount(e.target.value)} /></label><button disabled={busy}>Save target</button><p className="rp-small">Targets are shared with this workspace. Changing a target does not rewrite saved forecasts.</p></form> : <p>{p.status === 'ended' ? 'Targets for completed periods are read-only.' : 'A workspace owner, admin, or manager can set the target.'}</p>}
 {data.target?.history?.length > 0 && <details><summary>Target changes</summary><ul>{[...data.target.history].reverse().map((h, i) => <li key={i}>{stamp(h.at)} · {money(h.amount)}</li>)}</ul></details>}</div></div>
 <details className="rp-evidence"><summary>{booking ? 'Opportunities behind this plan' : 'Recorded days behind this total'}</summary>{booking ? <><h4>Actual won opportunities</h4>{p.actualDeals.length ? p.actualDeals.map(d => <div className="rp-source-row" key={d.id}><strong>{d.name}</strong><span>{money(d.amount)} · Closed Won {date(d.outcomeDate)} · Source {d.source}</span></div>) : <p>No dated won opportunities in this period.</p>}<h4>Potential coverage</h4>{p.candidates.length ? p.candidates.map(d => <div className="rp-source-row" key={d.id}><strong>{d.name}</strong><span>{money(d.amount)} × {Math.round(d.probability * 100)}% = {money(d.amount * d.probability)} weighted · Expected {date(d.closeDate)}</span></div>) : <p>No dated open opportunities in the remaining period.</p>}</> : <>{p.daily.length ? <div className="rp-days">{p.daily.map(d => <div key={d.date}><span>{date(d.date)}</span><span>{d.observed ? money(d.value) : 'No source observation'}</span></div>)}</div> : <p>No recorded days in this period.</p>}<p>{p.observedBaselineDays} of 30 original baseline days available. Baseline total: {money(p.baselineTotal)}. Zero-filled display days do not establish source completeness.</p></>}</details>
 <PlanEvidence plan={p} integrations={data.integrations} warnings={data.warnings} />
 </section>}
 {tab === 'history' && <section className="rp-panel"><div className="rp-row"><div><h2>What did we expect—and what happened?</h2><p>Saved forecasts for {p.metricLabel.toLowerCase()}. Results use the same measure and calendar period.</p></div><span className="rp-badge">{data.snapshots.length} forecasts · latest 50 saved</span></div>
 {data.canManage && p.status !== 'ended' && <details className="rp-save-forecast"><summary>Save a forecast for {p.label}</summary><form onSubmit={e => {
          e.preventDefault();
          run(async () => {
            const payload = {
              period,
              metric,
              label,
              rationale,
              ...(manual ? {
                forecastOverride: Number(estimate)
              } : {})
            };
            const saved = await apiPost('/revenue-planning/snapshots', payload);
            await load();
            setSelected(String(saved.snapshot._id));
            setLabel('');
            setEstimate('');
            setRationale('');
            setNotice('Forecast saved with its source evidence. It cannot be edited or backdated.');
          });
        }}><fieldset disabled={busy}><div className="rp-two-col"><label>Forecast name<input required maxLength={120} value={label} onChange={e => setLabel(e.target.value)} placeholder="e.g. October leadership review" /></label><label>Method<select value={manual ? 'manual' : 'model'} onChange={e => setManual(e.target.value === 'manual')}><option value="model">{methodName[p.method]}</option><option value="manual">Explicit leadership estimate</option></select></label></div>
 {manual ? <label>Expected full-period total (USD)<input required type="number" min="0" max="1000000000000" step="0.01" value={estimate} onChange={e => setEstimate(e.target.value)} /></label> : <p className="rp-model-number">Current model: <strong>{money(p.forecast)}</strong></p>}
 <label>{manual ? 'Rationale and assumptions (required)' : 'Notes and assumptions (optional)'}<textarea required={manual} maxLength={2000} value={rationale} onChange={e => setRationale(e.target.value)} placeholder="What must happen for this forecast to hold?" /></label><button disabled={busy || !manual && p.forecast === null}>Save forecast snapshot</button><p className="rp-small">The server captures current evidence and the target at save time. Actuals and variances remain in progress until the period ends.</p></fieldset></form></details>}
 {!data.snapshots.length ? <div className="rp-empty">No forecasts saved for this measure yet. Save a snapshot now; Atlas will compare it with observed results as the period unfolds. Historical forecasts are never fabricated.</div> : <><div className="rp-history-head"><span>Forecast / period</span><span>Saved total</span><span>Observed result</span><span>Variance</span></div>{data.snapshots.map(s => <button key={s._id} className={`rp-history-row ${String(snapshot?._id) === String(s._id) ? 'is-selected' : ''}`} aria-pressed={String(snapshot?._id) === String(s._id)} onClick={() => setSelected(String(s._id))}><span><b>{s.label}</b><small>{s.periodLabel} · {s.isDemoRecord ? "As of" : "Saved"} {stamp(s.asOf)}</small></span><span><small className="rp-mobile-label">Saved total</small>{money(s.forecast)}</span><span><small className="rp-mobile-label">Observed result</small>{money(s.currentActual)}<small>{s.periodStatus === 'ended' ? 'Period ended · observed' : s.periodStatus === 'future' ? 'Period not started' : 'Period in progress'}</small></span><span><small className="rp-mobile-label">Variance</small>{s.periodStatus === 'ended' ? money(s.variance) : 'Pending period end'}{s.variancePct !== null && <small>{s.variancePct > 0 ? '+' : ''}{s.variancePct.toFixed(1)}% vs saved total</small>}</span></button>)}</>}
 {snapshot && <article className="rp-snapshot"><h3>{snapshot.label}</h3><p>{methodName[snapshot.method]} · {snapshot.periodLabel} · {snapshot.isDemoRecord ? "As of" : "Saved"} {stamp(snapshot.asOf)}</p><div className="rp-stats"><div><span>Actual at save</span><strong>{money(snapshot.actualAtSave)}</strong></div><div><span>Target at save</span><strong>{money(snapshot.targetAtSave)}</strong></div><div><span>Model at save</span><strong>{money(snapshot.modelForecast)}</strong></div></div>{snapshot.rationale && <p><b>Recorded assumptions:</b> {snapshot.rationale}</p>}<p>{snapshot.dataWarning} A completed period does not guarantee complete imports. Later corrections can change observed results, while the saved forecast stays fixed.</p><details><summary>Which opportunity records changed?</summary>{snapshot.changes.length ? snapshot.changes.map(c => <div className="rp-source-row" key={c.dealId}><strong>{c.name}</strong>{c.kind === 'no_longer_visible' ? <p>No longer visible in the current dataset; no outcome is inferred.</p> : <ul>{c.fields.map(f => <li key={f.field}>{fields[f.field]}: {fieldValue(f.field, f.before)} → {fieldValue(f.field, f.after)}</li>)}</ul>}</div>) : <p>No recorded changes among the opportunities captured with this forecast.</p>}</details><details><summary>Original forecast evidence</summary><p>Source: {snapshot.evidence.source} · {snapshot.metric !== "bookings" && <>{snapshot.evidence.observedBaselineDays}/{snapshot.evidence.baselineDays} observed baseline days · </>} Weighted open value at save {money(snapshot.evidence.weightedOpen)}</p>{snapshot.evidence.actualRows?.length > 0 && <><h4>Original revenue observations</h4><div className="rp-days">{snapshot.evidence.actualRows.map(row => <div key={row.date}><span>{date(row.date)}</span><span>{money(row.value)}</span></div>)}</div></>}{snapshot.evidence.deals.map(d => <div className="rp-source-row" key={d.id}><strong>{d.name}</strong><span>{d.stage} · {money(d.amount)} × {Math.round(d.probability * 100)}% · Expected {date(d.closeDate)}</span></div>)}</details></article>}
 </section>}
 <footer className="rp-footer"><Link to="/overview">← Overview</Link><span>Read {stamp(data.asOf)} · USD · Calendar boundaries in UTC</span><Link to="/deal-war-room">Review opportunities →</Link></footer>
 </main>;
}
