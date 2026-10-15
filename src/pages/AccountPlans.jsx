import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { apiGet, apiPut, apiPost, apiPatch } from '../api';
import { ActionCard } from '../components/LeadershipBriefing.jsx';
import './AccountPlans.css';
const money = n => Number(n || 0).toLocaleString(undefined, {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0
});
const when = value => value ? new Date(value).toLocaleString(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short'
}) : 'Not set';
const roles = {
  economic_buyer: 'Economic buyer',
  champion: 'Champion',
  technical: 'Technical evaluator',
  legal: 'Legal',
  procurement: 'Procurement',
  other: 'Other'
};
const engagement = {
  unknown: 'Unknown',
  not_contacted: 'Not contacted',
  engaged: 'Engaged',
  aligned: 'Aligned'
};
const localInput = value => {
  if (!value) return '';
  const d = new Date(value);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
const draftFor = plan => ({
  objective: plan?.objective || '',
  ownerId: String(plan?.ownerId || ''),
  reviewAt: localInput(plan?.reviewAt),
  stakeholders: (plan?.stakeholders || []).map(s => ({
    name: s.name,
    title: s.title || '',
    role: s.role,
    engagement: s.engagement,
    notes: s.notes || ''
  })),
  blockers: (plan?.blockers || []).map(b => ({
    text: b.text,
    ownerId: String(b.ownerId || ''),
    status: b.status
  }))
});
export default function AccountPlans() {
  const {
    accountKey
  } = useParams();
  const [params] = useSearchParams(),
    navigate = useNavigate();
  const [data, setData] = useState(null),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false),
    [search, setSearch] = useState(''),
    [tab, setTab] = useState('plan');
  const [editing, setEditing] = useState(false),
    [draft, setDraft] = useState(null),
    [editorVersion, setEditorVersion] = useState(null);
  const [update, setUpdate] = useState({
      kind: 'note',
      text: ''
    }),
    [assignment, setAssignment] = useState({
      dealId: '',
      title: '',
      assigneeId: '',
      dueAt: ''
    });
  const generation = useRef(0),
    query = params.toString();
  async function load() {
    const id = ++generation.current;
    const response = await apiGet(accountKey ? `/account-plans/${encodeURIComponent(accountKey)}` : `/account-plans${query ? `?${query}` : ''}`);
    if (id !== generation.current) return;
    if (accountKey && response.account.key !== accountKey) {
      navigate(`/account-plans/${encodeURIComponent(response.account.key)}`, {
        replace: true
      });
      return;
    }
    if (response.resolvedKey && !accountKey) {
      navigate(`/account-plans/${encodeURIComponent(response.resolvedKey)}`, {
        replace: true
      });
      return;
    }
    setData(response);
  }
  useEffect(() => {
    setData(null);
    setError('');
    setNotice('');
    setEditing(false);
    setDraft(null);
    setTab('plan');
    setUpdate({
      kind: 'note',
      text: ''
    });
    setAssignment({
      dealId: '',
      title: '',
      assigneeId: '',
      dueAt: ''
    });
    load().catch(e => setError(e.message));
    return () => {
      generation.current++;
    };
  }, [accountKey, query]);
  async function run(fn) {
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
  function begin() {
    setDraft(draftFor(data.plan));
    setEditorVersion(data.plan?.__v ?? null);
    setEditing(true);
    setNotice('');
  }
  function editStakeholder(i, key, value) {
    setDraft({
      ...draft,
      stakeholders: draft.stakeholders.map((s, n) => n === i ? {
        ...s,
        [key]: value
      } : s)
    });
  }
  function editBlocker(i, key, value) {
    setDraft({
      ...draft,
      blockers: draft.blockers.map((b, n) => n === i ? {
        ...b,
        [key]: value
      } : b)
    });
  }
  if (!data || accountKey && data.account?.key !== accountKey) return <main className="ap-page"><h1>Shared Account Plans</h1>{error ? <><p role="alert" className="ap-error">{error}</p><div className="ap-row"><button disabled={busy} onClick={() => run(load)}>Retry</button><Link to="/account-plans">Browse workspace accounts</Link><Link to="/accounts">Manage accounts</Link><Link to="/deal-room">Review opportunity links</Link></div></> : <p role="status">Loading shared account plans…</p>}</main>;
  if (!accountKey) {
    const needle = search.trim().toLowerCase(),
      accounts = data.accounts.filter(a => `${a.name} ${a.industry} ${a.plan?.ownerName || ''}`.toLowerCase().includes(needle));
    return <main className="ap-page"><header className="ap-header ap-row"><div><div className="ap-eyebrow">ACCOUNT EXECUTION</div><h1>One account. One shared plan.</h1><p>Bring the people, blockers, decisions, and next steps into the same conversation.</p></div><Link to="/accounts">Manage accounts →</Link></header>{data.workspaceMode === 'demo' && <p className="ap-demo">Shared Atlas sample accounts and opportunities. Plans you save belong to this workspace; reads do not create sample plans.</p>}<label>Find an account<input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search accounts or plan owners" /></label>{data.unlinkedDealCount > 0 && <p className="ap-small">{data.unlinkedDealCount} opportunities lack an unambiguous account record link. Names alone are not used to attach a plan.</p>}
  <div className="ap-directory">{accounts.map(a => <Link className="ap-account-card" key={a.key} to={`/account-plans/${encodeURIComponent(a.key)}`}><div className="ap-row"><h2>{a.name}</h2><span className="ap-badge">{a.plan ? 'Shared plan' : 'Plan not started'}</span></div><p>{a.industry || 'Industry not recorded'} · {a.source}</p><strong>{money(a.pipeline)} open pipeline</strong><p>{a.openCount} open opportunities · {money(a.weighted)} weighted</p><div className="ap-card-footer"><span>{a.plan?.ownerName || 'Plan owner not assigned'}</span><span>{a.plan ? `${a.plan.blockers?.filter(b => b.status === 'open').length || 0} open blockers` : 'Build an account plan →'}</span></div></Link>)}</div>{!accounts.length && <div className="ap-empty">No matching accounts. Add a customer or connect account records to get started.</div>}<p className="ap-small">Account identity uses record IDs or exact provider identities. Pipeline is USD opportunity value, not collected revenue.</p></main>;
  }
  const a = data.account,
    p = data.plan,
    members = data.members.filter(m => m.role !== 'viewer'),
    active = data.actions.filter(x => x.status !== 'completed'),
    overdueReview = p?.reviewAt && new Date(p.reviewAt) < new Date();
  const openDeals = data.deals.filter(d => !['closed won', 'closed lost'].includes(d.stage.toLowerCase()));
  const selectedDeal = openDeals.find(d => d.id === assignment.dealId);
  return <main className="ap-page"><header className="ap-header"><Link to="/account-plans">← All account plans</Link><div className="ap-row"><div><div className="ap-eyebrow">SHARED ACCOUNT PLAN</div><h1>{a.name}</h1><p>{a.industry || 'Industry not recorded'} · {a.source}</p></div><div className="ap-row"><button disabled={busy || editing} onClick={() => run(async () => {
            await load();
            setNotice('Account and shared action records refreshed.');
          })}>Refresh</button>{data.canEdit && !editing && <button onClick={begin}>{p ? 'Edit plan' : 'Start account plan'}</button>}</div></div></header>
 {data.workspaceMode === 'demo' && <p className="ap-demo">Fictional CRM accounts and owners. Account-plan owners and action assignees are real workspace members. Saved plans and notes are shared workspace records.</p>}
 {error && <p role="alert" className="ap-error">{error}</p>}{notice && <p role="status" className="ap-notice">{notice}</p>}
 <div className="ap-stats"><div><span>Open pipeline</span><strong>{money(a.pipeline)}</strong><small>{a.openCount} open opportunities</small></div><div><span>Accountable plan owner</span><strong>{p?.ownerName || 'Not assigned'}</strong><small>{p && !members.some(m => m.id === String(p.ownerId)) ? 'Owner is not an active editor; ask a manager to reassign.' : 'Shared ownership for this account plan'}</small></div><div><span>Next review</span><strong className={overdueReview ? 'ap-warning-text' : ''}>{when(p?.reviewAt)}</strong><small>{overdueReview ? 'Review date has passed' : `${active.length} active recovery actions`}</small></div></div>
 <div className="ap-tabs" role="group" aria-label="Account plan views">{[['plan', 'Account plan'], ['execution', `Opportunities & actions · ${active.length}`], ['updates', 'Decisions & updates']].map(([key, label]) => <button key={key} aria-pressed={tab === key} onClick={() => setTab(key)}>{label}</button>)}</div>
 {editing && <section className="ap-panel ap-editor"><h2>{p ? 'Edit the shared plan' : 'Start the shared plan'}</h2><p>Save the objective and responsibility first. CRM records and recovery actions stay linked rather than copied into this plan.</p><form onSubmit={e => {
        e.preventDefault();
        run(async () => {
          await apiPut(`/account-plans/${encodeURIComponent(a.key)}`, {
            ...draft,
            reviewAt: draft.reviewAt ? new Date(draft.reviewAt).toISOString() : null,
            version: editorVersion
          });
          setEditing(false);
          setDraft(null);
          await load();
          setNotice('Shared account plan saved.');
        });
      }}><fieldset disabled={busy}><label>Account objective<textarea required maxLength={2000} value={draft.objective} onChange={e => setDraft({
              ...draft,
              objective: e.target.value
            })} placeholder="What must the team achieve with this account?" /></label><div className="ap-two-col"><label>Accountable plan owner<select required disabled={!data.canReassign} value={draft.ownerId} onChange={e => setDraft({
                ...draft,
                ownerId: e.target.value
              })}><option value="">Choose a workspace member</option>{members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label><label>Next review (your local time)<input type="datetime-local" value={draft.reviewAt} onChange={e => setDraft({
                ...draft,
                reviewAt: e.target.value
              })} /></label></div>
 <details open><summary>Stakeholders · {draft.stakeholders.length}</summary><p className="ap-small">Roles and engagement are team-entered judgments, not verified buying intent.</p>{draft.stakeholders.map((s, i) => <div className="ap-editor-card" key={i}><h3>Stakeholder {i + 1}</h3><div className="ap-two-col"><label>Name<input required maxLength={150} value={s.name} onChange={e => editStakeholder(i, 'name', e.target.value)} /></label><label>Title<input maxLength={150} value={s.title} onChange={e => editStakeholder(i, 'title', e.target.value)} /></label><label>Buying role<select value={s.role} onChange={e => editStakeholder(i, 'role', e.target.value)}>{Object.entries(roles).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label>Team assessment<select value={s.engagement} onChange={e => editStakeholder(i, 'engagement', e.target.value)}>{Object.entries(engagement).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label></div><label>Notes<textarea maxLength={1000} value={s.notes} onChange={e => editStakeholder(i, 'notes', e.target.value)} /></label><button type="button" onClick={() => setDraft({
                ...draft,
                stakeholders: draft.stakeholders.filter((_, n) => n !== i)
              })}>Remove stakeholder</button></div>)}<button type="button" disabled={draft.stakeholders.length >= 30} onClick={() => setDraft({
              ...draft,
              stakeholders: [...draft.stakeholders, {
                name: '',
                title: '',
                role: 'other',
                engagement: 'unknown',
                notes: ''
              }]
            })}>Add stakeholder</button></details>
 <details open><summary>Blockers · {draft.blockers.length}</summary>{draft.blockers.map((b, i) => <div className="ap-editor-card" key={i}><label>Blocker {i + 1}<textarea required maxLength={1000} value={b.text} onChange={e => editBlocker(i, 'text', e.target.value)} /></label><div className="ap-two-col"><label>Responsible member<select value={b.ownerId} onChange={e => editBlocker(i, 'ownerId', e.target.value)}><option value="">Not assigned</option>{members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label><label>Status<select value={b.status} onChange={e => editBlocker(i, 'status', e.target.value)}><option value="open">Open</option><option value="resolved">Resolved</option></select></label></div><button type="button" onClick={() => setDraft({
                ...draft,
                blockers: draft.blockers.filter((_, n) => n !== i)
              })}>Remove blocker</button></div>)}<button type="button" disabled={draft.blockers.length >= 50} onClick={() => setDraft({
              ...draft,
              blockers: [...draft.blockers, {
                text: '',
                ownerId: '',
                status: 'open'
              }]
            })}>Add blocker</button></details>
 <div className="ap-row ap-form-actions"><button disabled={busy}>Save shared plan</button><button type="button" onClick={() => {
              setEditing(false);
              setDraft(null);
            }}>Cancel edits</button></div><p className="ap-small">Other teammates' changes are protected by version checks. Pending edits remain here if a save conflicts.</p></fieldset></form></section>}
 {tab === 'plan' && <section className="ap-panel"><h2>What are we trying to achieve?</h2>{p ? <p className="ap-objective">{p.objective}</p> : <div className="ap-empty">No plan has been saved for this account. A workspace manager can assign an owner and set the objective.</div>}<div className="ap-two-col"><div><h3>People involved</h3>{p?.stakeholders?.length ? p.stakeholders.map((s, i) => <article className="ap-item" key={s._id || i}><div className="ap-row"><strong>{s.name}</strong><span className="ap-badge">{roles[s.role]}</span></div><p>{s.title || 'Title not recorded'} · Team assessment: {engagement[s.engagement]}</p>{s.notes && <p className="ap-prewrap">{s.notes}</p>}</article>) : <p>No stakeholders recorded. Buyer roles and engagement remain unknown until the team adds evidence.</p>}{a.primaryContactName && <p className="ap-small">CRM reference contact: {a.primaryContactName}{a.primaryContactEmail ? ` · ${a.primaryContactEmail}` : ''}. This does not establish their buying role.</p>}</div><div><h3>Blockers to resolve</h3>{p?.blockers?.length ? p.blockers.map((b, i) => <article className="ap-item" key={b._id || i}><div className="ap-row"><strong className="ap-prewrap">{b.text}</strong><span className="ap-badge">{b.status === 'resolved' ? 'Resolved' : 'Open'}</span></div><p>Responsible: {b.ownerName || 'Not assigned'}</p></article>) : <p>No blockers have been recorded. This does not establish that the account is free of risk.</p>}</div></div><p className="ap-small">Stakeholders, blockers, and decisions are entered by your team. CRM opportunities and recovery actions are shown from their current source records.</p></section>}
 {tab === 'execution' && <section className="ap-panel"><div className="ap-row"><div><h2>Move the account forward</h2><p>Opportunity next steps and recovery actions stay connected across Atlas.</p></div><Link to="/command-center?leadership=actions">Open workspace recovery plan →</Link></div><details><summary>Current opportunities · {data.deals.length}</summary>{data.deals.map(d => <article className="ap-item" key={d.id}><div className="ap-row"><strong>{d.name}</strong><b>{money(d.amount)}</b></div><p>{d.stage} · Expected close {when(d.closeDate)} · CRM owner {d.owner || 'Not recorded'}</p><p>Recorded next step: {d.nextAction || 'Not recorded'} · Due {when(d.nextActionDueAt)}</p><p className="ap-small">Last recorded activity {when(d.lastActivityAt)} · Source {d.source}</p></article>)}{!data.deals.length && <p>No opportunities are linked to this account.</p>}</details>
 {data.canAssignActions && openDeals.length > 0 && <details className="ap-assignment"><summary>Assign a recovery action</summary><form onSubmit={e => {
          e.preventDefault();
          run(async () => {
            await apiPost('/leadership/actions', {
              ...assignment,
              dueAt: new Date(assignment.dueAt).toISOString()
            });
            setAssignment({
              dealId: '',
              title: '',
              assigneeId: '',
              dueAt: ''
            });
            await load();
            setNotice('Recovery action assigned. The same action is visible in Command Center.');
          });
        }}><fieldset disabled={busy}><label>Opportunity<select required value={assignment.dealId} onChange={e => {
                const d = openDeals.find(row => row.id === e.target.value);
                setAssignment({
                  ...assignment,
                  dealId: e.target.value,
                  title: d?.nextAction || ''
                });
              }}><option value="">Choose an opportunity</option>{openDeals.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label><label>Next action<textarea required maxLength={500} value={assignment.title} onChange={e => setAssignment({
                ...assignment,
                title: e.target.value
              })} /></label><div className="ap-two-col"><label>Accountable owner<select required value={assignment.assigneeId} onChange={e => setAssignment({
                  ...assignment,
                  assigneeId: e.target.value
                })}><option value="">Choose a workspace member</option>{members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label><label>Deadline (your local time)<input type="datetime-local" required value={assignment.dueAt} onChange={e => setAssignment({
                  ...assignment,
                  dueAt: e.target.value
                })} /></label></div><button disabled={busy || !selectedDeal}>Assign action</button></fieldset></form></details>}
 {!data.canAssignActions && <p className="ap-small">A workspace manager assigns recovery actions. Assignees can update their own actions.</p>}{data.actions.length ? data.actions.map(action => <ActionCard key={`${action._id}-${action.__v}`} action={action} members={data.members} busy={busy} showAccountLink={false} canEdit={data.role !== 'viewer' && (data.canAssignActions || String(action.assigneeId) === data.userId)} onSave={(item, payload) => run(async () => {
        await apiPatch(`/leadership/actions/${item._id}`, payload);
        await load();
        setNotice('Shared recovery action updated.');
      })} />) : <div className="ap-empty">No recovery actions for this account yet. Assign one to turn a next step into tracked work.</div>}<p className="ap-small">Showing the latest 100 related actions. Completion tracks follow-through, not recovered revenue.</p></section>}
 {tab === 'updates' && <section className="ap-panel"><h2>Decisions & team updates</h2><p>Keep the account's working history beside the plan. Latest 100 entries.</p>{data.canComment && p && <form onSubmit={e => {
        e.preventDefault();
        run(async () => {
          await apiPost(`/account-plans/${encodeURIComponent(a.key)}/updates`, update);
          setUpdate({
            kind: 'note',
            text: ''
          });
          await load();
          setNotice('Account update recorded with your name and timestamp.');
        });
      }}><fieldset disabled={busy}><label>Update type<select value={update.kind} onChange={e => setUpdate({
              ...update,
              kind: e.target.value
            })}><option value="note">Team note</option>{data.canEdit && <option value="decision">Account decision</option>}</select></label><label>{update.kind === 'decision' ? 'Decision and supporting reasoning' : 'Account update'}<textarea required maxLength={4000} value={update.text} onChange={e => setUpdate({
              ...update,
              text: e.target.value
            })} /></label><button disabled={busy}>Record update</button></fieldset></form>}{!p && <div className="ap-empty">Save an account plan before adding notes or decisions.</div>}{[...(p?.history || [])].reverse().map((h, i) => <article className="ap-item" key={h._id || i}><div className="ap-row"><strong>{h.kind === 'decision' ? 'Account decision' : h.kind === 'note' ? 'Team note' : 'Plan saved'}</strong><span className="ap-small">{h.authorName} · {when(h.at)}</span></div><p className="ap-prewrap">{h.text}</p></article>)}</section>}
 <footer className="ap-footer"><Link to="/account-intelligence">Account Intelligence →</Link><span>Read {when(data.asOf)} · Pipeline figures are USD potential value</span><Link to="/deal-war-room">Deal War Room →</Link></footer>{data.warnings.length > 0 && <details><summary>Data limits</summary>{data.warnings.map((w, i) => <p key={i}>{w}</p>)}</details>}
 </main>;
}
