import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiGet, apiPut, apiPost, getActiveOrgId, getActiveOrgName } from '../api';
import './WorkspaceSetup.css';
const labels = {
  available: 'Available to inspect',
  partial: 'Needs review',
  missing: 'Data needed',
  restricted: 'Access needed',
  sample: 'Workspace scenario'
};
const money = n => Number(n || 0).toLocaleString(undefined, {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0
});
const when = value => value ? new Date(value).toLocaleString(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short'
}) : 'Not recorded';
const steps = ['Priorities', 'Connections', 'Coverage', 'First briefing'];
const startingStep = state => state.briefing ? 4 : state.coverageReviewedAt ? 4 : state.priorities?.length ? 2 : 1;
export default function WorkspaceSetup() {
  const navigate = useNavigate(),
    orgId = getActiveOrgId();
  const [data, setData] = useState(null),
    [step, setStep] = useState(1),
    [draft, setDraft] = useState({
      priorities: [],
      expectedSystems: []
    }),
    [editorVersion, setEditorVersion] = useState(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [ack, setAck] = useState(false),
    [showAll, setShowAll] = useState(false);
  const generation = useRef(0),
    heading = useRef(null);
  async function load(initialize = false) {
    const id = ++generation.current,
      scope = orgId;
    const next = await apiGet('/workspace-setup');
    if (id !== generation.current || scope !== getActiveOrgId() || next.orgId !== scope) return;
    setData(next);
    setAck(false);
    if (initialize) {
      setDraft({
        priorities: next.state.priorities,
        expectedSystems: next.state.expectedSystems
      });
      setEditorVersion(next.state.__v);
      setStep(startingStep(next.state));
    }
  }
  useEffect(() => {
    setData(null);
    setError('');
    setNotice('');
    setAck(false);
    load(true).catch(e => setError(e.message));
    return () => {
      generation.current++;
    };
  }, [orgId]);
  useEffect(() => {
    heading.current?.focus();
    setAck(false);
  }, [step]);
  const go = value => {
    setStep(value);
    setNotice('');
    setError('');
  };
  function editSystems() {
    setDraft({
      priorities: data.state.priorities,
      expectedSystems: data.state.expectedSystems
    });
    setEditorVersion(data.state.__v);
    go(2);
  }
  function editPreferences() {
    setDraft({
      priorities: data.state.priorities,
      expectedSystems: data.state.expectedSystems
    });
    setEditorVersion(data.state.__v);
    go(1);
  }
  async function run(fn) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      if (data && data.orgId !== getActiveOrgId()) throw new Error('Workspace changed. Reload setup before continuing.');
      await fn();
    } catch (e) {
      setError(e.message || 'Unable to update setup. Please try again.');
    } finally {
      setBusy(false);
    }
  }
  async function savePreferences(nextStep) {
    await apiPut('/workspace-setup', {
      ...draft,
      version: editorVersion
    });
    if (getActiveOrgId() !== orgId) throw new Error('Workspace changed. Reload setup before continuing.');
    await load(true);
    setStep(nextStep);
    setNotice('Workspace choices saved for your team.');
    window.dispatchEvent(new Event('atlas:setup-changed'));
  }
  async function progress(action) {
    const result = await apiPost(`/workspace-setup/${action}`, {
      version: data.state.__v,
      acknowledgeGaps: ack,
      readinessToken: data.readiness.reviewToken
    });
    if (getActiveOrgId() !== orgId) throw new Error('Workspace changed. Reload setup before continuing.');
    setData(d => ({
      ...d,
      state: result.state,
      readiness: result.readiness || d.readiness
    }));
    window.dispatchEvent(new Event('atlas:setup-changed'));
    return result;
  }
  function openConnection(event, href) {
    if (!data.canManage || !data.state.priorities.length || JSON.stringify(draft) === JSON.stringify({
      priorities: data.state.priorities,
      expectedSystems: data.state.expectedSystems
    })) return;
    event.preventDefault();
    run(async () => {
      await savePreferences(2);
      navigate(href);
    });
  }
  const toggle = (key, value) => setDraft(d => ({
    ...d,
    [key]: d[key].includes(value) ? d[key].filter(v => v !== value) : [...d[key], value]
  }));
  if (!data || data.orgId !== orgId) return <main className="ws-page"><h1>Set up your leadership workspace</h1>{error ? <><p role="alert" className="ws-error">{error}</p><button disabled={busy} onClick={() => run(() => load(true))}>Retry setup</button><Link to="/command-center">Open Command Center</Link></> : <p role="status">Checking saved progress and workspace records…</p>}</main>;
  const {
      state,
      readiness
    } = data,
    sourceMode = readiness.mode;
  const selected = readiness.systems.filter(s => s.expected || draft.expectedSystems.includes(s.id) || !['not_connected', 'sample_connection'].includes(s.state));
  const suggested = readiness.systems.filter(s => s.recommended && s.id !== 'excel_csv' && !selected.some(row => row.id === s.id)).slice(0, Math.max(0, 2 - selected.length));
  const manual = readiness.systems.find(s => s.id === 'excel_csv' && s.recommended);
  const visibleIds = new Set([...selected, ...suggested, ...(manual ? [manual] : [])].map(s => s.id));
  const systems = readiness.systems.filter(s => showAll || visibleIds.has(s.id));
  const briefing = state.briefing,
    modeMismatch = state.coverageReview && state.coverageReview.mode !== sourceMode;
  return <main className="ws-page"><header className="ws-header"><div><div className="ws-eyebrow">YOUR LEADERSHIP WORKSPACE</div><h1>Make Atlas useful for your team.</h1><p>{getActiveOrgName() || 'This workspace'} · Saved progress follows the workspace.</p></div><Link to="/command-center">Open Command Center →</Link></header>

  {!data.canManage && <p className="ws-note">You can inspect this workspace’s coverage and briefing. A workspace owner, admin, or manager saves shared setup choices.</p>}
  {state.status === 'completed' && <p className="ws-success">Setup flow completed {when(state.completedAt)}. Current data coverage is shown below and can still need attention.</p>}
  <nav className="ws-steps" aria-label="Workspace setup steps">{steps.map((title, i) => <button type="button" key={title} aria-current={step === i + 1 ? 'step' : undefined} disabled={busy} onClick={() => {
        if (i === 0) editPreferences();else if (i === 1) editSystems();else go(i + 1);
      }}><span>{i + 1}</span>{title}</button>)}</nav>
  {error && <p role="alert" className="ws-error">{error} <button type="button" disabled={busy} onClick={() => run(() => load(true))}>Reload saved choices</button></p>}{notice && <p role="status" className="ws-success">{notice}</p>}
  <section className="ws-panel" aria-labelledby="ws-step-title"><div className="ws-row"><div><div className="ws-eyebrow">STEP {step} OF 4</div><h2 id="ws-step-title" ref={heading} tabIndex={-1}>{steps[step - 1]}</h2></div>{step >= 3 && <button type="button" disabled={busy} onClick={() => run(async () => {
          await load();
          setNotice('Coverage refreshed from current workspace records. Saved choices were preserved.');
        })}>Refresh coverage</button>}</div>
  {step === 1 && <form onSubmit={e => {
        e.preventDefault();
        run(() => savePreferences(2));
      }}><p>Choose up to three priorities. These guide your setup recommendations; they do not change Atlas’s opportunity ranking rules.</p><fieldset disabled={busy || !data.canManage}><legend>What should Atlas help your team understand first?</legend><div className="ws-choices">{data.priorities.map(p => <label className={`ws-choice${draft.priorities.includes(p.id) ? ' is-selected' : ''}`} key={p.id}><input type="checkbox" checked={draft.priorities.includes(p.id)} disabled={!draft.priorities.includes(p.id) && draft.priorities.length >= 3} onChange={() => toggle('priorities', p.id)} /><span><strong>{p.label}</strong><small>{p.description}</small></span></label>)}</div><button className="ws-primary" disabled={busy || !data.canManage || !draft.priorities.length}>Save priorities & continue</button></fieldset></form>}
  {step === 2 && <><p>Choose the systems you expect to use. Connect them through Data Connectors, then return here to check the result. You can start with one source or decide later.</p>{!state.priorities.length && <p className="ws-note">Save a priority first to get connection recommendations.</p>}<div className="ws-systems">{systems.map(s => <article className="ws-system" id={`setup-${s.id}`} key={s.id}><div className="ws-row"><div><strong>{s.name}</strong><small>{s.category}{s.recommended ? ' · Suggested for your priorities' : ''}</small></div><label className="ws-expect"><input type="checkbox" disabled={busy || !data.canManage} checked={draft.expectedSystems.includes(s.id)} onChange={() => toggle('expectedSystems', s.id)} />Plan to use</label></div><p className="ws-source-status">{s.id === 'excel_csv' ? 'Manual import; inspect the resulting records in coverage.' : s.label}</p>{s.lastSyncAt && <small>Recorded sync: {when(s.lastSyncAt)}</small>}{readiness.canOpenConnectors && <Link to={s.href} onClick={event => openConnection(event, s.href)}>{s.id === 'excel_csv' ? 'Open import tools' : 'Manage connection'} →</Link>}</article>)}</div><button type="button" className="ws-text-button" onClick={() => setShowAll(!showAll)}>{showAll ? 'Show suggested systems' : 'Show all available systems'}</button><p className="ws-note">A successful sync confirms a sync result. Coverage checks below show which fields Atlas can actually inspect. Slack supplies notifications, not revenue data.</p><div className="ws-actions">{data.canManage && <button className="ws-primary" disabled={busy || !state.priorities.length} onClick={() => run(() => savePreferences(3))}>Save systems & check coverage</button>}<button disabled={busy} type="button" onClick={() => go(3)}>Inspect coverage</button><button disabled={busy} type="button" onClick={editPreferences}>Back to priorities</button></div></>}
  {step === 3 && <><p>These checks describe the records available now. “Available to inspect” does not certify a forecast or prove that source data is correct.</p><div className="ws-coverage">{readiness.cards.map(card => <article key={card.id}><div className="ws-row"><strong>{card.label}</strong><span className={`ws-badge ws-${card.state}`}>{labels[card.state]}</span></div><p>{card.detail}</p>{card.href && <Link to={card.href}>Inspect source records →</Link>}</article>)}</div><details className="ws-details"><summary>Connection checks & freshness</summary>{readiness.systems.filter(s => s.expected || !['not_connected', 'sample_connection'].includes(s.state)).map(s => <p key={s.id}><b>{s.name}:</b> {s.label}{s.lastSyncAt ? ` · ${when(s.lastSyncAt)}` : ''}</p>)}<p>Fresh means a successful sync timestamp within 24 hours of this check. It does not establish complete data.</p></details>{readiness.warnings.length > 0 && <details className="ws-details"><summary>Source limits</summary>{readiness.warnings.map((w, i) => <p key={i}>{w}</p>)}</details>}<GapReview readiness={readiness} ack={ack} setAck={setAck} disabled={busy || !data.canManage} />{modeMismatch && <p className="ws-note">Workspace data mode changed. Review this coverage again before building a briefing.</p>}<div className="ws-actions">{data.canManage && <button className="ws-primary" disabled={busy || !state.priorities.length || Boolean(readiness.gaps.length && !ack)} onClick={() => run(async () => {
            await progress('review');
            go(4);
            setNotice('Coverage review saved. Build your briefing from the available records.');
          })}>Confirm coverage & continue</button>}<button disabled={busy} onClick={editSystems}>Back to connections</button></div><small>Coverage read {when(readiness.asOf)} · Financial coverage is limited to the existing USD dataset.</small></>}
  {step === 4 && <><p>Start with what the workspace can support today, then use Command Center to assign actions and track decisions.</p>{!state.coverageReviewedAt || modeMismatch ? <div className="ws-empty"><p>Review current data coverage before building your first briefing.</p><button disabled={busy} onClick={() => go(3)}>Review coverage</button></div> : <>{data.canManage && <button disabled={busy} onClick={() => run(async () => {
            await progress('briefing');
            setNotice('Briefing built from the current workspace records.');
          })}>{briefing ? 'Rebuild from current records' : 'Build my first briefing'}</button>}{briefing && <div className="ws-briefing"><div className="ws-row"><h3>{briefing.mode === 'demo' ? 'Your leadership briefing' : briefing.kind === 'starter' ? 'Your starting point' : 'Your first leadership briefing'}</h3><span className="ws-badge">Saved {when(briefing.generatedAt)}</span></div><p>{briefing.message}</p><div className="ws-coverage">{(briefing.coverageHighlights || []).map(c => <article key={c.id}><div className="ws-row"><strong>{c.label}</strong><span className={`ws-badge ws-${c.state}`}>{labels[c.state]}</span></div><p>{c.detail}</p>{c.href && <Link to={c.href}>Open this view →</Link>}</article>)}</div>{briefing.kind === 'pipeline' && <><div className="ws-metrics"><div><span>Open opportunities</span><strong>{briefing.summary.openCount}</strong></div><div><span>Open pipeline</span><strong>{money(briefing.summary.pipeline)}</strong></div><div><span>90-day weighted pipeline</span><strong>{money(briefing.summary.weighted)}</strong></div></div><p className="ws-note">Potential USD opportunity value, not realized revenue or a committed forecast. Includes overdue expected closes.</p>{briefing.priorities.length ? briefing.priorities.map((p, i) => <article className="ws-priority" key={p.id}><strong>{i + 1}. {p.name}</strong><p>{p.reasons.join(' · ')}</p><p>{p.suggestedAction}</p></article>) : <p>No opportunities meet the current review rules.</p>}</>}<p>{briefing.kind === 'pipeline' ? 'Next: open Command Center’s meeting briefing to inspect evidence and assign a real workspace member to a next step.' : 'Open the relevant views above to inspect your records and set next steps. Command Center will show pipeline priorities when opportunity data is available.'}</p></div>}</>}
    {briefing && !modeMismatch && <><GapReview readiness={readiness} ack={ack} setAck={setAck} disabled={busy || !data.canManage} /><div className="ws-actions">{data.canManage && state.status !== 'completed' && <button className="ws-primary" disabled={busy || Boolean(readiness.gaps.length && !ack)} onClick={() => run(async () => {
              await progress('complete');
              setNotice('Setup flow completed. Remaining coverage gaps stay visible in Atlas.');
            })}>Finish setup</button>}<Link className="ws-link-button" to="/command-center">Open leadership briefing →</Link></div><p className="ws-note">Finishing records that your team reviewed setup. It does not mark missing data or failed connections as resolved.</p></>}
    <div className="ws-next"><Link to="/deal-war-room">Inspect opportunities →</Link>{readiness.canOpenConnectors && <Link to="/revenue-planning">Set calendar goals →</Link>}</div></>}
  </section><footer className="ws-footer"><span>Progress is shared with this workspace’s team.</span>{data.canManage && state.status !== 'completed' ? <button type="button" disabled={busy} onClick={() => run(async () => {
        await progress('defer');
        navigate('/command-center');
      })}>Continue later</button> : <Link to="/command-center">Return to Command Center</Link>}</footer>
 </main>;
}
function GapReview({
  readiness,
  ack,
  setAck,
  disabled
}) {
  if (!readiness.gaps.length) return <p className="ws-note">No gaps were flagged by these checks for your saved priorities and expected systems. Review the evidence before making decisions.</p>;
  return <div className="ws-gap-review"><details className="ws-details"><summary>{readiness.gaps.length} coverage items need attention</summary>{readiness.gaps.map(g => <article key={g.id}><strong>{g.label}</strong><p>{g.detail}</p></article>)}</details><label className="ws-ack"><input type="checkbox" checked={ack} disabled={disabled} onChange={e => setAck(e.target.checked)} /><span>I’ve reviewed these limits and want to continue with the available data.</span></label></div>;
}
