import DecisionOutcomes, { MeetingChanges } from './DecisionOutcomes.jsx';
import React, { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { apiGet, apiPost, apiPatch } from '../api';
import './LeadershipBriefing.css';
const money = n => Number(n || 0).toLocaleString(undefined, {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0
});
const when = value => value ? new Date(value).toLocaleString(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short'
}) : 'Not recorded';
const fieldNames = {
  amount: 'Deal value',
  probability: 'Probability',
  stage: 'Stage',
  closeDate: 'Expected close',
  lastActivityAt: 'Recorded activity',
  nextAction: 'Next action',
  nextActionDueAt: 'Next action deadline',
  owner: 'Owner'
};
const valueLabel = (field, value) => !value && value !== 0 ? 'Not recorded' : field === 'amount' ? money(value) : field === 'probability' ? `${Math.round(value * 100)}%` : field.endsWith('Date') || field === 'lastActivityAt' || field === 'nextActionDueAt' ? when(value) : value;
const states = {
  open: 'Open',
  in_progress: 'In progress',
  blocked: 'Blocked',
  completed: 'Completed'
};
function Evidence({
  deal,
  asOf,
  demo,
  onOpen
}) {
  return <details className="lb-evidence"><summary>Why is Atlas showing this?</summary>
    <p>{demo ? 'Source: Atlas' : `Source: ${deal.source || 'Atlas'}`} · Read {when(asOf)}</p>
    <dl><div><dt>Expected close</dt><dd>{when(deal.closeDate)}</dd></div><div><dt>Last recorded activity</dt><dd>{when(deal.lastActivityAt)}</dd></div>
      <div><dt>Deal value × probability</dt><dd>{money(deal.amount)} × {Math.round(deal.probability * 100)}% = {money(deal.amount * deal.probability)}</dd></div>
      <div><dt>Recorded owner</dt><dd>{deal.owner || 'Not recorded'}</dd></div></dl>
    <p>Recorded activity does not establish buyer intent. Weighted pipeline is potential value, not booked revenue.</p>
    {onOpen && !demo && <button type="button" onClick={() => onOpen(deal.id)}>Open source opportunity</button>}
  </details>;
}
export function ActionCard({
  action,
  members,
  canEdit,
  onSave,
  busy,
  showAccountLink = true
}) {
  const [status, setStatus] = useState(action.status);
  const [outcome, setOutcome] = useState(action.outcome || '');
  canEdit=canEdit && !action.isDemoRecord;
  const dirty = status !== action.status || outcome !== (action.outcome || '');
  const late = action.status !== 'completed' && new Date(action.dueAt) < new Date();
  return <article className="lb-action">
    <div className="lb-row"><strong>{action.title}</strong><span className={`lb-badge ${late ? 'lb-warn' : ''}`}>{late ? 'Overdue' : states[action.status]}</span></div>
    <p>{action.dealName} · {members.find(m => m.id === String(action.assigneeId))?.name || action.ownerName} · Due {when(action.dueAt)}</p>
    {showAccountLink && action.dealId && <Link to={`/account-plans?dealId=${encodeURIComponent(action.dealId)}`}>Open related account plan →</Link>}
    <Link className="do-track-link" to={`/command-center?leadership=decisions&dealId=${encodeURIComponent(action.dealId)}${action.isDemoRecord ? "" : `&actionId=${encodeURIComponent(action._id)}`}`}>Track the leadership decision behind this action →</Link>
    <details><summary>Update and outcome</summary>
      <form onSubmit={e => {
        e.preventDefault();
        onSave(action, {
          status,
          outcome,
          version: action.__v
        });
      }}>
        <label>Status<select disabled={!canEdit || busy} value={status} onChange={e => setStatus(e.target.value)}>{Object.entries(states).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <label>Outcome or blocker<textarea value={outcome} disabled={!canEdit || busy} onChange={e => setOutcome(e.target.value)} maxLength={2000} required={status === 'completed'} placeholder="Record what happened. Completing this action does not mark revenue as won." /></label>
        {canEdit && <button disabled={busy || !dirty} type="submit">Save update</button>}
      </form>
      <ul className="lb-history">{[...(action.history || [])].reverse().map((h, i) => <li key={i}>{when(h.at)} · {states[h.status]}{h.outcome ? ` · ${h.outcome}` : ''}</li>)}</ul>
    </details>
    <details className="lb-evidence"><summary>Deal progress since assignment</summary>
      {action.currentDeal ? <><p>Current CRM stage: <b>{action.currentDeal.stage}</b> · Value {money(action.currentDeal.amount)} · Expected close {when(action.currentDeal.closeDate)}</p>
        {action.dealChanges?.length ? <ul>{action.dealChanges.flatMap(c => c.fields || []).map(f => <li key={f.field}>{fieldNames[f.field]}: {valueLabel(f.field, f.before)} → {valueLabel(f.field, f.after)}</li>)}</ul> : <p>No recorded deal-field changes since assignment.</p>}
        <p>These changes are observations; they do not establish that this action caused the result.</p></> : <p>This opportunity is no longer visible in the current workspace dataset.</p>}
    </details>
    <Evidence deal={action.evidence} asOf={action.evidence?.capturedAt} demo={action.evidence?.source === 'demo'} />
  </article>;
}
export default function LeadershipBriefing({
  onOpenDeal
}) {
  const [data, setData] = useState(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const [params] = useSearchParams();
  const [tab, setTab] = useState(['actions', 'decisions', 'scenario', 'context'].includes(params.get('leadership')) ? params.get('leadership') : 'briefing'),
    [checkpointId, setCheckpointId] = useState(''),
    [label, setLabel] = useState('');
  const [notice, setNotice] = useState(''),
    [actionFor, setActionFor] = useState(null),
    [actionTitle, setActionTitle] = useState(''),
    [assignee, setAssignee] = useState(''),
    [due, setDue] = useState('');
  const [filter, setFilter] = useState('active');
  const [allPriorities, setAllPriorities] = useState(false);
  const [scenario, setScenario] = useState({
      dealId: '',
      delayDays: 30,
      horizon: 30,
      target: ''
    }),
    [result, setResult] = useState(null);
  useEffect(() => {
    if (['actions', 'decisions', 'scenario', 'context'].includes(params.get('leadership'))) setTab(params.get('leadership'));
  }, [params]);
  const generation = useRef(0);
  async function load(selected = checkpointId) {
    const id = ++generation.current;
    const next = await apiGet(`/leadership/briefing${selected ? `?checkpointId=${encodeURIComponent(selected)}` : ''}`);
    if (id === generation.current) setData(next);
  }
  useEffect(() => {
    load().catch(e => setError(e.message));
    return () => {
      generation.current++;
    };
  }, []);
  async function mutate(fn) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await fn();
    } catch (e) {
      setError(e.message || 'Unable to save. Please try again.');
    } finally {
      setBusy(false);
    }
  }
  if (!data) return <section className="lb-shell" aria-label="Leadership briefing">{error ? <><p role="alert">{error}</p><button onClick={() => mutate(() => load())} disabled={busy}>Retry briefing</button></> : <p role="status">Loading leadership briefing…</p>}</section>;
  const demo = data.workspaceMode === 'demo';
  const openDeals = data.deals.filter(d => !['closed won', 'closed lost'].includes(d.stage.toLowerCase()));
  const active = data.actions.filter(a => a.status !== 'completed');
  const completed = data.actions.filter(a => a.status === 'completed');
  const shown = data.actions.filter(a => filter === 'completed' ? a.status === 'completed' : filter === 'mine' ? String(a.assigneeId) === data.userId : a.status !== 'completed');
  const chosen = scenario.dealId || openDeals.find(d => d.closeDate)?.id || '';
  return <section className="lb-shell" aria-labelledby="lb-title">
    <div className="lb-row lb-header"><div><div className="lb-eyebrow">LEADERSHIP WORKSPACE {demo ? '· DEMO' : ''}</div><h2 id="lb-title">Know what changed. Own the next move.</h2><p>From meeting decisions to accountable follow-through.</p></div>
      <button disabled={busy} onClick={() => mutate(async () => {
        await load();
        setResult(null);
        setNotice('Briefing refreshed from current workspace records.');
      })}>Refresh briefing</button></div>

    <div className="lb-tabs" role="group" aria-label="Leadership views">{[['briefing', 'Meeting briefing'], ['actions', `Recovery plan · ${active.length}`], ['decisions', 'Decisions & results'], ['scenario', 'Deal-slip scenario'], ['context', 'Account context']].map(([key, title]) => <button key={key} type="button" aria-pressed={tab === key} onClick={() => {
        setTab(key);
        setNotice('');
      }}>{title}</button>)}</div>
    {error && <p role="alert" className="lb-error">{error}</p>}{notice && <p role="status" className="lb-notice">{notice}</p>}
    {tab === 'briefing' && <div className="lb-body">
      <div className="lb-metrics"><div><span>Open pipeline</span><strong>{money(data.summary.pipeline)}</strong><small>{data.summary.openCount} open opportunities</small></div><div><span>90-day weighted pipeline</span><strong>{money(data.summary.weighted)}</strong><small>Includes overdue expected closes</small></div><div><span>Recovery follow-through</span><strong>{completed.length} completed · {active.length} active</strong><small>Action status, not revenue recovered</small></div></div>
      <div className="lb-grid">
        <div><h3>What changed since our last meeting?</h3>
          <label>Compare with<select disabled={busy} value={checkpointId} onChange={e => {
              const value = e.target.value;
              setCheckpointId(value);
              mutate(() => load(value));
            }}><option value="">{demo && !data.checkpoints.length ? 'Weekly revenue review' : 'Latest saved meeting'}</option>{data.checkpoints.map(c => <option key={c._id} value={c._id}>{c.label} · {when(c.createdAt)}</option>)}</select></label>
          {!data.checkpoint ? <p className="lb-empty">Save your first meeting checkpoint to begin tracking changes. Atlas will compare future workspace records against that saved view.</p> : <>
            <p>{data.checkpoint.label} · {when(data.checkpoint.createdAt)}</p>
            {data.pipelineComparisonAvailable === false ? <p className="lb-empty">This checkpoint belongs to a different data mode. Save a new checkpoint before comparing pipeline or execution.</p> : <><p className="lb-delta">Open pipeline change: <b>{money(data.summary.pipeline - data.previousSummary.pipeline)}</b> · 90-day weighted change: <b>{money(data.summary.weighted - data.previousSummary.weighted)}</b></p>
            {data.changes.length === 0 ? <p className="lb-empty">No recorded deal changes since this checkpoint.</p> : <div className="lb-change-list">{data.changes.map(c => <article key={c.dealId} className="lb-change"><strong>{c.name}</strong><span>{money(c.amount)}</span>
              {c.kind === 'added' ? <p>Newly visible since the saved meeting.</p> : c.kind === 'no_longer_visible' ? <p>No longer visible in the current dataset; this does not establish a win or loss.</p> : <ul>{c.fields.map(f => <li key={f.field}><b>{fieldNames[f.field]}:</b> {valueLabel(f.field, f.before)} → {valueLabel(f.field, f.after)}</li>)}</ul>}
              {data.deals.find(d => d.id === c.dealId) && <Evidence deal={data.deals.find(d => d.id === c.dealId)} asOf={data.asOf} demo={demo} onOpen={onOpenDeal} />}
            </article>)}</div>}</>}
          </>}
          {data.checkpoint && <MeetingChanges changes={data.meetingChanges} onShowActions={() => setTab('actions')} onShowDecisions={() => setTab('decisions')} />}
          {data.canManage && <form className="lb-checkpoint" onSubmit={e => {
            e.preventDefault();
            mutate(async () => {
              const saved = await apiPost('/leadership/checkpoints', {
                label
              });
              setCheckpointId(String(saved.checkpoint._id));
              setLabel('');
              await load(String(saved.checkpoint._id));
              setNotice('Meeting checkpoint saved. Future changes will appear against this view.');
            });
          }}><label>Save this meeting<input maxLength={120} required value={label} onChange={e => setLabel(e.target.value)} placeholder="e.g. Monday revenue review" /></label><button disabled={busy}>Save checkpoint</button></form>}
        </div>
        <div><h3>Decisions that need an owner</h3><p>Prioritized by near-term closing window, then deal value. These are record-based review prompts.</p>
          {data.priorities.length === 0 ? <p className="lb-empty">No open opportunities meet the current review rules.</p> : data.priorities.slice(0, allPriorities ? 6 : 3).map((d, i) => <article className="lb-priority" key={d.id}><div className="lb-row"><strong><span className="lb-rank">{i + 1}</span>{d.name}</strong><b>{money(d.amount)}</b></div><p>{d.account} · {d.stage}</p><div className="lb-reasons">{d.reasons.map(reason => <span key={reason}>{reason}</span>)}</div><p>{d.suggestedAction}</p>
            <Evidence deal={d} asOf={data.asOf} demo={demo} onOpen={onOpenDeal} />
            {data.canManage && <button disabled={busy} onClick={() => {
              setActionFor(d);
              setActionTitle(d.suggestedAction);
              setAssignee('');
              setDue('');
              setTab('actions');
            }}>Assign recovery action</button>}
          </article>)}
          {data.priorities.length > 3 && <button type="button" onClick={() => setAllPriorities(!allPriorities)}>{allPriorities ? "Show top three" : `Show all ${data.priorities.length} priorities`}</button>}
        </div>
      </div>
      <details className="lb-evidence"><summary>Data freshness and limits</summary><p>Read from Atlas on {when(data.asOf)}. A successful sync does not guarantee every provider field is present. {data.summary.undatedCount} open opportunities lack a close date and are excluded from the dated outlook.</p>{data.integrations.length ? data.integrations.map(i => <p key={i.provider}>{i.provider}: {i.status} · Last sync {when(i.lastSyncAt)} · Result {i.lastSyncStatus || 'Not recorded'}</p>) : <p>{demo ? 'Workspace scenario refreshed for this review.' : 'No provider sync metadata available.'}</p>}<p>Changes compare saved Atlas records, not a complete provider audit log. Both snapshots use the current 90-day cutoff. Monetary totals include USD opportunity records only.</p></details>
    </div>}
    {tab === 'decisions' && <DecisionOutcomes data={data} busy={busy} run={mutate} refresh={load} onAssign={deal => {
      setActionFor(deal);
      setActionTitle(deal.nextAction || '');
      setAssignee('');
      setDue('');
      setTab('actions');
    }} />}
    {tab === 'actions' && <div className="lb-body">
      <div className="lb-row"><div><h3>Revenue recovery plan</h3><p>Assign a real workspace member, record the outcome, and review progress at the next meeting.</p></div><label>Show<select value={filter} onChange={e => setFilter(e.target.value)}><option value="active">Active actions</option><option value="mine">Assigned to me</option><option value="completed">Completed actions</option></select></label></div>
      {actionFor && <form className="lb-assignment" onSubmit={e => {
        e.preventDefault();
        mutate(async () => {
          await apiPost('/leadership/actions', {
            dealId: actionFor.id,
            title: actionTitle,
            assigneeId: assignee,
            dueAt: new Date(due).toISOString()
          });
          setActionFor(null);
          setFilter('active');
          await load();
          setNotice('Recovery action assigned in Atlas.');
        });
      }}><h3>Assign action · {actionFor.name}</h3><label>Next action<textarea required maxLength={500} value={actionTitle} onChange={e => setActionTitle(e.target.value)} /></label><div className="lb-grid"><label>Accountable owner<select required value={assignee} onChange={e => setAssignee(e.target.value)}><option value="">Select a workspace member</option>{data.members.filter(m => m.role !== 'viewer').map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label><label>Deadline (your local time)<input required type="datetime-local" value={due} onChange={e => setDue(e.target.value)} /></label></div><div className="lb-row"><button disabled={busy}>Assign action</button><button disabled={busy} type="button" onClick={() => setActionFor(null)}>Cancel</button></div><p>Recorded CRM owner: {actionFor.owner || 'Not recorded'}. This assignment is tracked in Atlas.</p></form>}
      {shown.length === 0 ? <div className="lb-empty">No actions in this view. Choose “Assign recovery action” from a briefing priority to create one.</div> : shown.map(action => <ActionCard key={`${action._id}-${action.__v}`} action={action} members={data.members} canEdit={data.canManage || String(action.assigneeId) === data.userId && data.members.find(m => m.id === data.userId)?.role !== 'viewer'} busy={busy} onSave={(item, payload) => mutate(async () => {
        await apiPatch(`/leadership/actions/${item._id}`, payload);
        await load();
        setNotice('Action updated.');
      })} />)}
      <p className="lb-footnote">Showing the latest 100 workspace actions. Completion records follow-through; only a recorded deal outcome can establish a win.</p>
    </div>}
    {tab === 'scenario' && <div className="lb-body"><h3>If a deal slips, what changes?</h3><p>Move one expected close date and see its effect on the selected window. CRM records remain unchanged.</p>
      <form onSubmit={e => {
        e.preventDefault();
        mutate(async () => {
          setResult(null);
          setResult(await apiPost('/leadership/scenario', {
            ...scenario,
            dealId: chosen,
            target: Number(scenario.target || 0)
          }));
        });
      }} onChange={() => setResult(null)}>
        <fieldset className="lb-scenario-inputs" disabled={busy}><label>Opportunity<select required value={chosen} onChange={e => setScenario({
              ...scenario,
              dealId: e.target.value
            })}>{openDeals.filter(d => d.closeDate).map(d => <option key={d.id} value={d.id}>{d.name} · {money(d.amount)}</option>)}</select></label><label>Delay by<select value={scenario.delayDays} onChange={e => setScenario({
              ...scenario,
              delayDays: Number(e.target.value)
            })}>{[14, 30, 60, 90].map(n => <option key={n} value={n}>{n} days</option>)}</select></label><label>Outlook window<select value={scenario.horizon} onChange={e => setScenario({
              ...scenario,
              horizon: Number(e.target.value)
            })}>{[30, 60, 90].map(n => <option key={n} value={n}>Next {n} days</option>)}</select></label><label>Planning target (optional)<input type="number" min="0" step="0.01" value={scenario.target} onChange={e => setScenario({
              ...scenario,
              target: e.target.value
            })} placeholder="Enter a target" /></label></fieldset><button disabled={busy || !chosen}>Run scenario</button></form>
      {result && <div className="lb-scenario-result"><div className="lb-metrics"><div><span>Baseline weighted pipeline</span><strong>{money(result.baseline.weighted)}</strong></div><div><span>After the slip</span><strong>{money(result.scenario.weighted)}</strong></div><div><span>Weighted value leaving window</span><strong>{money(result.weightedImpact)}</strong></div></div><p>Revised expected close: <b>{when(result.revisedCloseDate)}</b>. {result.weightedImpact === 0 ? 'The delayed date does not remove weighted value from this window.' : ''}</p>{result.target > 0 && <p>Gap to your planning target: <b>{money(result.gap)}</b> (baseline gap {money(result.baselineGap)}). This compares a user-entered target to weighted pipeline, not recognized revenue or a committed forecast.</p>}
        <h4>Other opportunities to review</h4><p>These deals are dated beyond this window. They are outside the baseline; none is assumed to close sooner.</p>{result.alternatives.length ? result.alternatives.map(d => <article key={d.id} className="lb-change"><strong>{d.name}</strong><p>{money(d.amount)} · {money(d.amount * d.probability)} weighted · Expected {when(d.closeDate)}</p><Evidence deal={d} asOf={result.asOf} demo={demo} onOpen={onOpenDeal} /></article>) : <p>No other dated open opportunities beyond this window.</p>}
      </div>}
      <details className="lb-evidence"><summary>Scenario assumptions</summary><p>Only the selected close date changes. Deal value and probability stay fixed. Open opportunities with past close dates remain in the baseline and require review. Missing close dates are excluded. Figures are pipeline scenarios in USD, not revenue predictions.</p></details>
    </div>}
    {tab === 'context' && <div className="lb-body"><h3>Company context connected to your pipeline</h3><p>{demo ? 'Company background and buying priorities connected to your active opportunities.' : 'Exact account-name matches from unexpired GraphIQ search results. Profile context is not evidence of a buying event or purchase intent.'}</p>
      {data.externalContext.length ? data.externalContext.map(c => <article key={c.snapshotId + c.name} className="lb-priority"><strong>{c.name}</strong><p>{c.description || 'No company description supplied.'}</p><p>{c.source} · Retrieved {when(c.asOf)}</p>{/^https?:\/\//i.test(c.website) && <a href={c.website} target="_blank" rel="noopener noreferrer">Company website ↗</a>}<h4>Related opportunities</h4>{c.accountKey && data.canReadAccountPlans && <Link to={`/account-plans/${encodeURIComponent(c.accountKey)}`}>Open shared account plan →</Link>}{c.deals.map(d => <p key={d.id}>{d.name} · {money(d.amount)}</p>)}<p>Suggested review: validate this company context with the opportunity owner before changing the buying plan.</p></article>) : <p className="lb-empty">No verified company-profile matches for your open pipeline yet. Search company intelligence in Atlas AI Operator, then refresh this briefing.</p>}
      {data.newsContext && <article className="lb-priority"><h4>Latest workspace news search: {data.newsContext.query}</h4><p>GraphIQ MCP · Retrieved {when(data.newsContext.asOf)}. Results belong to this search; no CRM account match is inferred.</p>{data.newsContext.records.map((n,i)=><div key={i}><strong>{n.title}</strong><p>{n.summary}</p><p>Published {when(n.publishedAt)} · {n.publisher || 'Publisher not supplied'}</p>{/^https?:\/\//i.test(n.url) && <a href={n.url} target="_blank" rel="noopener noreferrer">Read original source ↗</a>}</div>)}{data.newsContext.text && <details><summary>Provider response</summary><p style={{whiteSpace:'pre-wrap'}}>{data.newsContext.text}</p></details>}</article>}
      <Link to="/atlas-ai-operator">Open Atlas AI Operator →</Link> · <Link to="/market-signals">Search company news →</Link><p className="lb-footnote">GraphIQ MCP news searches run on request. Automatic monitoring and external event alerts are not enabled.</p>
    </div>}
  </section>;
}
