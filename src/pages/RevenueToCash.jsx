import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiGet, apiPut, getActiveOrgId } from '../api';
import './RevenueToCash.css';
const money = n => typeof n === 'number' ? n.toLocaleString(undefined, {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2
}) : 'Unavailable';
const date = v => v ? new Date(v).toLocaleDateString(undefined, {
  dateStyle: 'medium',
  timeZone: 'UTC'
}) : 'Not recorded';
const providerName = p => p === 'stripe' ? 'Stripe' : 'QuickBooks';
export default function RevenueToCash() {
  const [data, setData] = useState(null),
    [provider, setProvider] = useState(''),
    [view, setView] = useState('all'),
    [search, setSearch] = useState(''),
    [offset, setOffset] = useState(0),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [draft, setDraft] = useState(null),
    [options, setOptions] = useState([]),
    [opSearch, setOpSearch] = useState(''),
    [optionTotal, setOptionTotal] = useState(0);
  const request = useRef(0),
    mounted = useRef(true),
    saving = useRef(false),
    reviewPanel = useRef(null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      request.current++;
    };
  }, []);
  useEffect(() => {
    if (draft) reviewPanel.current?.scrollIntoView?.({
      behavior: 'smooth',
      block: 'start'
    });
  }, [draft?.invoiceId]);
  async function load() {
    const seq = ++request.current,
      org = getActiveOrgId();
    setBusy(true);
    setError('');
    try {
      const result = await apiGet(`/revenue-to-cash?${new URLSearchParams({
        ...(provider ? {
          provider
        } : {}),
        view,
        search,
        offset: String(offset)
      })}`);
      if (mounted.current && seq === request.current && org === getActiveOrgId()) {
        setData(result);
      }
    } catch (e) {
      if (mounted.current && seq === request.current) setError(e.message || 'Unable to load financial evidence.');
    } finally {
      if (mounted.current && seq === request.current) setBusy(false);
    }
  }
  useEffect(() => {
    setData(null);
    load();
  }, [provider, view, search, offset]);
  useEffect(() => {
    if (!draft) return;
    let active = true;
    const org = getActiveOrgId();
    const timer = setTimeout(async () => {
      try {
        const result = await apiGet(`/revenue-to-cash/opportunities?${new URLSearchParams({
          search: opSearch
        })}`);
        if (active && mounted.current && org === getActiveOrgId()) {
          setOptions(result.opportunities);
          setOptionTotal(result.total);
        }
      } catch (e) {
        if (active) setError(e.message || 'Unable to search opportunities.');
      }
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [Boolean(draft), opSearch]);
  function begin(i) {
    setError('');
    setOptions([]);
    setOpSearch('');
    setDraft({
      invoiceId: i.id,
      number: i.number || i.id,
      dealId: i.deal?.id || '',
      selectedDeal: i.deal || null,
      note: '',
      version: i.review?.__v ?? null,
      generation: data.snapshot.generation,
      provider: data.provider
    });
  }
  async function save(state) {
    if (!draft || saving.current) return;
    saving.current = true;
    const org = getActiveOrgId();
    setBusy(true);
    setError('');
    try {
      await apiPut(`/revenue-to-cash/links/${encodeURIComponent(draft.invoiceId)}?provider=${encodeURIComponent(draft.provider)}`, {
        dealId: draft.dealId,
        state,
        note: draft.note,
        version: draft.version,
        generation: draft.generation
      });
      if (mounted.current && org === getActiveOrgId()) {
        setDraft(null);
        await load();
      }
    } catch (e) {
      if (mounted.current && org === getActiveOrgId()) setError(e.message || 'Unable to save the review.');
    } finally {
      saving.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  const ledger = data?.ledger,
    t = ledger?.totals;
  return <main className="rtc-page"><header className="rtc-header"><div><div className="rtc-eyebrow">REVENUE TO CASH</div><h1>From a won deal to a recorded receipt.</h1><p>See the invoice, inspect the payment evidence, and resolve the gaps.</p></div><Link to="/command-center">Command Center →</Link></header>
 {error && <p className="rtc-alert" role="alert">{error} {draft ? 'Your review draft is retained. If evidence or a teammate’s review changed, close this draft and refresh before reviewing again.' : <button onClick={load} disabled={busy}>Retry</button>}</p>}
 <section className="rtc-controls" aria-label="Financial source and invoice filters"><label>Financial source<select disabled={busy || Boolean(draft)} value={provider || data?.provider || 'quickbooks'} onChange={e => {
          setProvider(e.target.value);
          setOffset(0);
        }}>{(data?.providers || ['quickbooks', 'stripe']).map(p => <option key={p} value={p}>{providerName(p)}</option>)}</select></label><label>Invoices<select disabled={busy || Boolean(draft)} value={view} onChange={e => {
          setView(e.target.value);
          setOffset(0);
        }}><option value="all">All invoices</option><option value="unmatched">Needs opportunity link</option><option value="overdue">Overdue balance</option><option value="issues">Evidence to inspect</option></select></label><label>Find an invoice<input type="search" maxLength={100} disabled={Boolean(draft)} value={search} onChange={e => {
          setSearch(e.target.value);
          setOffset(0);
        }} placeholder="Customer, invoice or opportunity" /></label><button disabled={busy || Boolean(draft)} onClick={load}>Refresh evidence</button></section>
 {busy && <p role="status">Loading financial evidence…</p>}
 {data?.workspaceMode === 'demo' && <p className="rtc-banner">Atlas demo · fictional invoices and payments linked to sample opportunities. Reviews you save are real workspace records.</p>}
 {data && <p className="rtc-caption">{providerName(data.provider)} · connection: {data.source.status} · detail import: {data.source.detailStatus} · snapshot: {date(data.snapshot?.capturedAt)}. One financial source at a time; totals cover the imported snapshot, not a calendar reporting period.</p>}
 {data?.snapshot?.environment === 'test' && <p className="rtc-alert">Sandbox financial evidence · excluded from live opportunity matching.</p>}
 {data?.snapshot && data.workspaceMode !== 'demo' && (data.source.status !== 'connected' || data.source.detailStatus !== 'success' || Date.now() - new Date(data.snapshot.capturedAt).getTime() > 86400000) && <p className="rtc-alert">This is a previously captured snapshot. Check the connection and run a successful detail sync before relying on it for current balances.</p>}
 {data && !ledger && <section className="rtc-card"><h2>Import invoice and payment detail</h2><p>Run a {providerName(data.provider)} sync in Data Connectors. This view appears after the detail import succeeds. Existing daily totals alone cannot establish an invoice-to-payment trail.</p><Link to="/integrations">Open Data Connectors →</Link></section>}
 {ledger && <><section className="rtc-metrics" aria-label="Selected financial source totals">{[['Invoiced', t.invoiced], ['Outstanding balance', t.outstanding], ['Overdue balance', t.overdue], ['Gross recorded receipts', t.grossReceipts]].map(([label, value]) => <div className="rtc-card" key={label}><span>{label}</span><strong>{money(value)}</strong></div>)}</section>
 <p className="rtc-caption">USD only · {t.eligibleInvoices} supported invoices · {t.linkedInvoices} linked to opportunities · {t.unmatchedInvoices} need a link. Excluded from totals: {t.excludedInvoices} invoices, {t.excludedPayments} payments and {t.excludedRefunds} refunds.</p>
 <section className="rtc-card rtc-context"><div><h2>Keep the measures distinct</h2><p>{money(t.linkedWonValue)} in distinct linked Closed Won opportunities. Invoice and receipt totals above include all supported records from this source, including unmatched invoices and receipts.</p></div><div><p><b>{money(t.recordedRefunds)}</b> recorded refunds</p><p><b>{money(t.unallocatedReceipts)}</b> receipts without a verified invoice application</p></div><p className="rtc-caption">{ledger.receiptLimit}</p></section>
 {ledger.warnings.map((w, i) => <p className="rtc-banner" key={i}>{w}</p>)}
 <section aria-label="Invoice evidence"><div className="rtc-heading"><h2>The invoice trail</h2><span>{ledger.totalRows} matching invoices</span></div>{!ledger.invoices.length && <p className="rtc-card">No invoices match this filter.</p>}{ledger.invoices.map(i => <article className="rtc-card rtc-invoice" key={i.id}><div className="rtc-heading"><div><h3>{i.number || i.id}</h3><p>{i.customerName || 'Customer name not provided'}</p></div><span className={i.deal ? 'rtc-pill' : 'rtc-pill rtc-unmatched'}>{i.deal ? 'Linked' : 'Needs review'}{i.overdue ? ' · Overdue' : ''}</span></div><p>{i.deal ? `${i.deal.name} · ${i.deal.stage}` : i.match.reason}</p><div className="rtc-values"><div>Invoice total<strong>{i.currency === 'USD' ? money(i.amount) : `${i.currency} · excluded`}</strong></div><div>Provider balance<strong>{i.currency === 'USD' ? money(i.balance) : 'Excluded'}</strong></div><div>Linked gross receipts<strong>{money(i.receipts)}</strong></div><div>Due date<strong>{date(i.dueAt)}</strong></div></div><details><summary>Inspect source evidence{i.issues.length ? ` · ${i.issues.length} checks` : ''}</summary><p className="rtc-caption">Source invoice ID: {i.id} · {i.status} · issued {date(i.issuedAt)} · {i.match.reason}</p><p>Provider settlement / balance reduction: {i.currency === 'USD' ? money(i.reportedPaid) : 'Excluded'}. This can include credits and adjustments.</p>{i.linkedRefunds !== null && <p>Refunds traced to this invoice: {money(i.linkedRefunds)}</p>}{i.payments.length ? <ul>{i.payments.map((p, n) => <li key={`${p.id}-${n}`}>{p.id} · {date(p.date)} · {money(p.amount)} applied{p.disputed ? ' · disputed' : ''}</li>)}</ul> : <p>No verified payment application in this snapshot.</p>}{i.issues.length > 0 && <ul>{i.issues.map((v, n) => <li key={n}>{v}</li>)}</ul>}{i.review && <div><p>Last team review: {i.review.authorName} · {date(i.review.updatedAt)}</p><p>{i.review.note}</p><details><summary>Review history</summary><ul>{i.review.history.map((h, n) => <li key={n}>{date(h.at)} · {h.state} · {h.note}</li>)}</ul></details></div>}</details>{data.canManage && i.eligible && <button disabled={busy || Boolean(draft)} onClick={() => begin(i)}>Review opportunity link</button>}</article>)}<div className="rtc-pager"><button disabled={busy || Boolean(draft) || offset === 0} onClick={() => setOffset(Math.max(0, offset - 25))}>Previous</button><span>{ledger.totalRows ? offset + 1 : 0}–{Math.min(offset + 25, ledger.totalRows)} of {ledger.totalRows}</span><button disabled={busy || Boolean(draft) || offset + 25 >= ledger.totalRows} onClick={() => setOffset(offset + 25)}>Next</button></div></section>
 <details className="rtc-card"><summary>Closed Won opportunities without a linked invoice · {ledger.unmatchedWonCount}</summary><p>No supported invoice is linked in this source snapshot. This does not establish that an invoice was never issued.</p>{ledger.unmatchedWon.map(d => <p key={d.id}><b>{d.name}</b> · {d.account} · {money(d.amount)}</p>)}{ledger.unmatchedWonCount > 100 && <p>Showing the first 100 opportunities.</p>}</details>
 <details className="rtc-card"><summary>Payment application checks · {ledger.paymentIssueCount}</summary>{ledger.paymentIssues.map((p, n) => <p key={n}>{p.paymentId}: {p.reason}</p>)}{ledger.paymentIssueCount > 100 && <p>Showing the first 100 checks.</p>}</details></>}
 {draft && <section ref={reviewPanel} className="rtc-card rtc-review" aria-labelledby="rtc-review-title"><h2 id="rtc-review-title">Review invoice {draft.number}</h2><p>Confirm the association using the source records. A similar name or amount is not proof of a link.</p><label>Find an opportunity<input type="search" maxLength={100} value={opSearch} onChange={e => setOpSearch(e.target.value)} placeholder="Name, account or source ID" disabled={busy} /></label><label>Opportunity<select value={draft.dealId} disabled={busy} onChange={e => setDraft({
          ...draft,
          dealId: e.target.value,
          selectedDeal: options.find(d => d.id === e.target.value)
        })}><option value="">Select an opportunity</option>{draft.selectedDeal && !options.some(o => o.id === draft.dealId) && <option value={draft.dealId}>{draft.selectedDeal.name}</option>}{options.map(d => <option key={d.id} value={d.id}>{d.name} · {d.stage} · {money(d.amount)}</option>)}</select></label><p className="rtc-caption">Showing up to 50 of {optionTotal} matching opportunities. Search to narrow the list.</p><label>Evidence / reason<textarea maxLength={2000} value={draft.note} onChange={e => setDraft({
          ...draft,
          note: e.target.value
        })} disabled={busy} placeholder="Record how you verified the invoice and opportunity." /></label><div className="rtc-controls"><button disabled={busy || !draft.dealId || !draft.note.trim()} onClick={() => save('confirmed')}>Confirm association</button><button disabled={busy || !draft.note.trim()} onClick={() => save('blocked')}>Keep explicitly unlinked</button><button disabled={busy} onClick={() => setDraft(null)}>Close draft</button></div><p className="rtc-caption">This saves an Atlas review only. It does not modify invoices, payments or CRM opportunities.</p></section>}
 </main>;
}
