import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { apiGet, apiPost, apiPatch } from '../api';
const money = value => Number(value || 0).toLocaleString(undefined, {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0
});
const when = value => value ? new Date(value).toLocaleString(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short'
}) : 'Not recorded';
const assessments = {
  improved: 'Improved',
  unchanged: 'Unchanged',
  worsened: 'Worsened',
  insufficient_evidence: 'Insufficient evidence'
};
const fieldLabel = {
  amount: 'Deal value',
  probability: 'Recorded probability',
  stage: 'CRM stage',
  closeDate: 'Expected close',
  lastActivityAt: 'Last activity',
  nextAction: 'CRM next action',
  nextActionDueAt: 'Next action due',
  owner: 'CRM owner'
};
const valueLabel = (key, value) => value == null || value === '' ? 'Not recorded' : key === 'amount' ? money(value) : key === 'probability' ? `${Math.round(value * 100)}%` : /Date$|At$/.test(key) ? when(value) : String(value);
export function MeetingChanges({
  changes,
  onShowDecisions,
  onShowActions
}) {
  if (!changes?.available) return <p className="lb-empty">{changes?.reason || 'Save a new checkpoint to track leadership execution between meetings.'}</p>;
  const labels = {
    added: 'New in this comparison',
    completed: 'Completed since meeting',
    unblocked: 'Previously blocked; now moving',
    status_changed: 'Status changed',
    outcome_updated: 'Outcome updated',
    deadline_changed: 'Deadline changed',
    reviewed: 'Outcome reviewed',
    review_due: 'Review due',
    objective_changed: 'Objective changed',
    owner_changed: 'Owner changed',
    review_date_changed: 'Review date changed',
    blockers_resolved: 'Blockers resolved',
    blockers_opened: 'New or reopened blockers'
  };
  return <div className="do-meeting"><div className="do-summary"><span><b>{changes.counts.overdue}</b> overdue actions</span><span><b>{changes.counts.completed}</b> completed</span><span><b>{changes.counts.reviewsDue}</b> decisions to review</span><span><b>{changes.counts.resolvedBlockers}</b> blockers resolved</span></div>
    <p className="lb-footnote">Overdue actions include commitments already overdue at the meeting. Completion is action status, not revenue recovered.</p>
    {changes.limited && <p className="lb-demo">Partial comparison: one view exceeds the latest 100 actions, decisions, or plans. Missing records are not treated as resolved.</p>}
    {!changes.plansCompared && <p className="lb-footnote">Account-plan comparison needs account access and a checkpoint saved with that access.</p>}
    {changes.riskChanges?.length > 0 && <details className="do-section"><summary>{changes.riskChanges.length} opportunities with new review flags</summary>{changes.riskChanges.map(d => <article className="lb-change" key={d.dealId}><strong>{d.name}</strong>{d.newlyVisible && <p>Newly visible record; risk may predate this meeting.</p>}<ul>{d.reasons.map(r => <li key={r}>{r}</li>)}</ul></article>)}</details>}
    <details className="do-section"><summary>Commitments · {changes.actionChanges.length} with changes or overdue work</summary>{changes.actionChanges.length ? changes.actionChanges.map(a => <article className="lb-change" key={a.id}><strong>{a.title}</strong><p>{a.ownerName} · Due {when(a.dueAt)}</p><p>{a.events.map(e => e === 'overdue' ? a.alreadyOverdueAtMeeting ? 'Still overdue from meeting' : 'Currently overdue' : labels[e]).join(' · ')}</p>{a.before && <p>{a.before.status.replaceAll('_', ' ')} → {a.status.replaceAll('_', ' ')}</p>}{a.outcome && <p>{a.outcome}</p>}</article>) : <p>No recorded action changes or overdue commitments in this view.</p>}<button type="button" onClick={onShowActions}>Open recovery actions</button></details>
    <details className="do-section"><summary>Decisions · {changes.decisionChanges.length} added, reviewed, or due</summary>{changes.decisionChanges.map(d => <article className="lb-change" key={d.id}><strong>{d.text}</strong><p>{d.events.map(e => labels[e]).join(' · ')} · {d.ownerName}</p></article>)}<button type="button" onClick={onShowDecisions}>Open decisions & results</button></details>
    {changes.plansCompared && <details className="do-section"><summary>Account plans · {changes.planChanges.length} changed</summary>{changes.planChanges.length ? changes.planChanges.map(p => <article className="lb-change" key={p.accountKey}><strong>{p.objective}</strong><p>{p.events.map(e => labels[e]).join(' · ')}</p>{p.opened?.map(b => <p key={'open-' + b.text}>Open: {b.text}{b.count > 1 ? ` (${b.count})` : ''}</p>)}{p.resolved.map(b => <p key={b.text}>Resolved: {b.text}{b.count > 1 ? ` (${b.count})` : ''}</p>)}<Link to={`/account-plans/${encodeURIComponent(p.accountKey)}`}>Open account plan →</Link></article>) : <p>No recorded account-plan changes.</p>}</details>}
  </div>;
}
function DecisionCard({
  decision: d,
  data,
  busy,
  run,
  refresh,
  onAssign
}) {
  const [assessment, setAssessment] = useState('insufficient_evidence'),
    [note, setNote] = useState('');
  const [reviewHistory, setReviewHistory] = useState(d.reviews || []),
    [fullHistory, setFullHistory] = useState(false);
  const [links, setLinks] = useState((d.actionIds || []).map(String));
  const canEdit = !d.isDemoRecord && (data.canManage || String(d.ownerId) === String(data.userId) && data.members.find(m => m.id === data.userId)?.role !== 'viewer');
  const due = new Date(d.reviewAt) < new Date() && (!d.latestReviewAt || new Date(d.latestReviewAt) < new Date(d.reviewAt));
  const candidates = data.actions.filter(a => !a.isDemoRecord && a.dealId === d.dealId);
  const latest = d.reviews?.at(-1);
  return <article className="do-card" id={`decision-${d._id}`}><div className="lb-row"><strong>{d.dealName}</strong><span className="lb-badge">{due ? 'Review due' : latest ? `Team assessment: ${assessments[latest.assessment]}` : 'Awaiting first review'}</span></div>
    <p>{d.ownerName} · Review {when(d.reviewAt)}</p><h4>Decision</h4><p className="do-text">{d.text}</p><h4>Expected result</h4><p className="do-text">{d.expectedResult}</p>
    <details className="do-section"><summary>Reasoning & original evidence</summary><p className="do-text">{d.reasoning}</p><p>Recorded by {d.authorName} · Tracking began {when(d.createdAt)}{d.sourceDecidedAt ? ` · Account decision recorded ${when(d.sourceDecidedAt)}${d.sourceAuthorName ? ` by ${d.sourceAuthorName}` : ''}` : ''}</p><p>At tracking start: {d.evidence.stage} · {money(d.evidence.amount)} · Expected close {when(d.evidence.closeDate)}</p>{d.sourceAccountKey && data.canReadAccountPlans && <Link to={`/account-plans/${encodeURIComponent(d.sourceAccountKey)}`}>Original account plan →</Link>}</details>
    <details className="do-section"><summary>Linked actions · {d.actionIds?.length || 0}</summary>{d.linkedActions.map(a => <p key={a._id}><b>{a.title}</b> · {a.ownerName} · {a.status.replaceAll('_', ' ')}{a.outcome ? ` · ${a.outcome}` : ''}</p>)}{d.missingActionCount > 0 && <p>{d.missingActionCount} linked actions are outside the current view or unavailable.</p>}{canEdit && <><form onSubmit={e => {
          e.preventDefault();
          run(async () => {
            await apiPatch(`/leadership/decisions/${d._id}`, {
              version: d.__v,
              actionIds: links
            });
            await refresh();
          });
        }}><fieldset disabled={busy}><legend>Connect existing actions for this opportunity</legend>{(d.actionIds || []).map(String).filter(id => !candidates.some(a => String(a._id) === id)).map(id => <label className="do-checkbox" key={id}><input type="checkbox" checked={links.includes(id)} onChange={e => setLinks(e.target.checked ? [...links, id] : links.filter(v => v !== id))} />Previously linked action (outside current view)</label>)}{candidates.map(a => <label className="do-checkbox" key={a._id}><input type="checkbox" checked={links.includes(String(a._id))} onChange={e => setLinks(e.target.checked ? [...links, String(a._id)] : links.filter(v => v !== String(a._id)))} />{a.title}</label>)}<button disabled={busy || JSON.stringify([...links].sort()) === JSON.stringify((d.actionIds || []).map(String).sort())}>Save action links</button></fieldset></form><button type="button" disabled={busy || !d.currentDeal} onClick={() => onAssign(d.currentDeal)}>Assign a recovery action</button><p className="lb-footnote">After assigning, return here to link the new action to this decision.</p></>}</details>
    <div className="do-observation"><h4>Observed since tracking began</h4>{!d.comparisonAvailable ? <p>Current opportunity evidence is unavailable. No win, loss, or improvement is inferred.</p> : <><p>Current CRM stage: <b>{d.currentDeal.stage}</b> · Recorded deal value: {money(d.currentDeal.amount)}</p>{d.dealChanges.length ? <ul>{d.dealChanges.flatMap(c => c.fields).map(f => <li key={f.field}>{fieldLabel[f.field]}: {valueLabel(f.field, f.before)} → {valueLabel(f.field, f.after)}</li>)}</ul> : <p>No recorded opportunity-field changes.</p>}</>}<p className="lb-footnote">Observed changes do not establish that this decision caused them. CRM deal value is not collected cash or verified revenue impact.</p></div>
    <details className="do-section"><summary>Outcome reviews · {d.reviewCount || 0}{latest ? ` · Latest: ${assessments[latest.assessment]}` : ''}</summary>{canEdit && <form onSubmit={e => {
        e.preventDefault();
        run(async () => {
          await apiPatch(`/leadership/decisions/${d._id}`, {
            version: d.__v,
            assessment,
            note
          });
          await refresh();
        });
      }}><fieldset disabled={busy}><label>Team assessment<select value={assessment} onChange={e => setAssessment(e.target.value)}>{Object.entries(assessments).map(([v, label]) => <option key={v} value={v}>{label}</option>)}</select></label><label>Supporting observations<textarea required maxLength={2000} value={note} onChange={e => setNote(e.target.value)} placeholder="What changed? Which evidence supports the assessment?" /></label><button disabled={busy}>Record outcome review</button></fieldset></form>}{[...reviewHistory].reverse().map((r, i) => <article className="lb-change" key={r._id || i}><strong>{assessments[r.assessment]} · Team assessment</strong><p className="do-text">{r.note}</p><p>{r.authorName} · {when(r.at)}</p><p>{r.evidence.unavailable ? 'Opportunity unavailable at review' : `CRM stage at review: ${r.evidence.stage} · Deal value ${money(r.evidence.amount)}`}</p></article>)}{!latest && <p>No outcome review recorded yet.</p>}{!fullHistory && (d.reviewCount || 0) > reviewHistory.length && <button type="button" disabled={busy} onClick={() => run(async () => {
        const result = await apiGet(`/leadership/decisions/${d._id}/reviews`);
        if (result.version !== d.__v) throw new Error('This decision changed. Refresh the briefing before loading its history.');
        setReviewHistory(result.reviews);
        setFullHistory(true);
      })}>Load retained review history</button>}<p className="lb-footnote">Showing {reviewHistory.length} reviews. Latest 100 retained; total review count shown above.</p></details>
  </article>;
}
export default function DecisionOutcomes({
  data,
  busy,
  run,
  refresh,
  onAssign
}) {
  const [params, setParams] = useSearchParams();
  const [source, setSource] = useState(null),
    [sourceError, setSourceError] = useState('');
  const [showForm, setShowForm] = useState(Boolean(params.get('entryId') || params.get('actionId')));
  const [form, setForm] = useState({
    dealId: params.get('dealId') || '',
    text: '',
    reasoning: '',
    expectedResult: '',
    ownerId: '',
    reviewAt: '',
    actionIds: params.get('actionId') ? [params.get('actionId')] : []
  });
  const [filter, setFilter] = useState('all'),
    [visibleCount, setVisibleCount] = useState(5);
  const sourceKey = params.get('accountKey'),
    entryId = params.get('entryId');
  useEffect(() => {
    let alive = true;
    setSource(null);
    setSourceError('');
    if (sourceKey && entryId) apiGet(`/leadership/decisions/source?accountKey=${encodeURIComponent(sourceKey)}&entryId=${encodeURIComponent(entryId)}`).then(s => {
      if (!alive) return;
      setSource(s);
      setForm(f => ({
        ...f,
        text: s.text,
        dealId: s.deals[0]?.id || '',
        actionIds: []
      }));
      setShowForm(true);
    }).catch(e => {
      if (alive) setSourceError(e.message);
    });
    return () => {
      alive = false;
    };
  }, [sourceKey, entryId]);
  const deals = source ? source.deals : data.deals;
  const decisions = (data.decisions || []).filter(d => filter === 'mine' ? String(d.ownerId) === String(data.userId) : filter === 'due' ? new Date(d.reviewAt) < new Date() && (!d.latestReviewAt || new Date(d.latestReviewAt) < new Date(d.reviewAt)) : true);
  const set = (key, value) => setForm(f => ({
    ...f,
    [key]: value
  }));
  return <div className="lb-body"><div className="lb-row"><div><h3>Decisions & results</h3><p>What we decided, who acted, and what the records show afterward.</p></div>{data.canManage && <button type="button" disabled={busy} onClick={() => setShowForm(!showForm)}>{showForm ? 'Close decision form' : 'Track a decision'}</button>}</div>
    {sourceError && <p role="alert" className="lb-error">{sourceError} <Link to="/account-plans">Return to account plans</Link></p>}
    {showForm && data.canManage && <form className="lb-assignment" onSubmit={e => {
      e.preventDefault();
      run(async () => {
        await apiPost('/leadership/decisions', {
          ...form,
          reviewAt: new Date(form.reviewAt).toISOString(),
          ...(source ? {
            accountKey: source.accountKey,
            entryId: source.entryId
          } : {})
        });
        setShowForm(false);
        setSource(null);
        const nextParams = new URLSearchParams(params);
        ['accountKey', 'entryId', 'actionId', 'dealId'].forEach(k => nextParams.delete(k));
        setParams(nextParams, {
          replace: true
        });
        setForm({
          dealId: '',
          text: '',
          reasoning: '',
          expectedResult: '',
          ownerId: '',
          reviewAt: '',
          actionIds: []
        });
        await refresh();
      });
    }}><fieldset disabled={busy || Boolean(sourceKey && entryId && !source)}><h4>{source ? 'Track an account decision' : 'Record a leadership decision'}</h4><label>Opportunity<select required value={form.dealId} onChange={e => setForm({
            ...form,
            dealId: e.target.value,
            actionIds: []
          })}><option value="">Choose an opportunity</option>{deals.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label><label>Decision<textarea required maxLength={4000} value={form.text} readOnly={Boolean(source)} onChange={e => set('text', e.target.value)} /></label><label>Why this decision?<textarea required maxLength={2000} value={form.reasoning} onChange={e => set('reasoning', e.target.value)} /></label><label>What result will we look for?<textarea required maxLength={1000} value={form.expectedResult} onChange={e => set('expectedResult', e.target.value)} placeholder="e.g. Signed legal approval before the next forecast review" /></label><div className="lb-grid"><label>Accountable owner<select required value={form.ownerId} onChange={e => set('ownerId', e.target.value)}><option value="">Choose a workspace member</option>{data.members.filter(m => m.role !== 'viewer').map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label><label>Review date (your local time)<input required type="datetime-local" value={form.reviewAt} onChange={e => set('reviewAt', e.target.value)} /></label></div><details className="do-section"><summary>Link existing recovery actions (optional)</summary>{data.actions.filter(a => !a.isDemoRecord && a.dealId === form.dealId).map(a => <label className="do-checkbox" key={a._id}><input type="checkbox" checked={form.actionIds.includes(String(a._id))} onChange={e => set('actionIds', e.target.checked ? [...form.actionIds, String(a._id)] : form.actionIds.filter(id => id !== String(a._id)))} />{a.title}</label>)}</details><button disabled={busy}>Start outcome tracking</button><p className="lb-footnote">The decision and its original evidence are preserved. Future reviews add observations; they do not rewrite the original decision.</p></fieldset></form>}
    <label>Show decisions<select value={filter} onChange={e => {
        setFilter(e.target.value);
        setVisibleCount(5);
      }}><option value="all">All tracked decisions</option><option value="due">Review due</option><option value="mine">Owned by me</option></select></label>
    {data.decisionsLimited && <p className="lb-demo">Showing the latest 100 decisions in this workspace data mode.</p>}
    {decisions.length ? decisions.slice(0, visibleCount).map(d => <DecisionCard key={`${d._id}-${d.__v}`} decision={d} data={data} busy={busy} run={run} refresh={refresh} onAssign={onAssign} />) : <p className="lb-empty">No decisions in this view. Start with an account decision or recovery action, name the expected result, and set a review date.</p>}
    {decisions.length > visibleCount && <button type="button" onClick={() => setVisibleCount(n => n + 5)}>Show more decisions ({decisions.length - visibleCount} remaining)</button>}

  </div>;
}
