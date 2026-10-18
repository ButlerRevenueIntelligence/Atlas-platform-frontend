import GraphIQMonitoring from './GraphIQMonitoring';
import React, { useEffect, useRef, useState } from 'react';
import { apiGet, apiPost, apiPut, getActiveOrgId, publishGraphIQNotification } from '../api';
import './GraphIQResearch.css';
const when = value => value ? new Date(value).toLocaleString() : 'Not supplied';
const published = value => value ? new Date(value).toLocaleDateString(undefined, {
  month: 'short',
  day: 'numeric',
  year: 'numeric'
}) : '';
const safeLink = value => {
  try {
    const u = new URL(value);
    return ['http:', 'https:'].includes(u.protocol) && !u.username && !u.password ? u.href : null;
  } catch {
    return null;
  }
};
const deliveryMessage = value => !value ? '' : value.state === 'sent' ? 'Slack accepted the notification.' : value.state === 'uncertain' ? 'Slack delivery is unconfirmed. Atlas will not automatically resend it.' : value.state === 'failed' ? 'Slack delivery failed. Your research is still available.' : value.reason === 'already_notified_or_in_progress' ? 'Already shared · No duplicate sent.' : value.reason === 'disabled' ? 'Slack notifications are off.' : value.reason === 'slack_not_connected' ? 'Connect Slack to receive notifications.' : 'No new structured results to share.';
export function resultWindow(records, page = 0) {
  const rows = Array.isArray(records) ? records : [],
    pages = Math.max(1, Math.ceil(rows.length / 5)),
    current = Math.min(Math.max(0, page), pages - 1);
  return {
    records: rows.slice(current * 5, current * 5 + 5),
    page: current,
    pages,
    total: rows.length,
    start: rows.length ? current * 5 + 1 : 0,
    end: Math.min(rows.length, current * 5 + 5)
  };
}
export default function GraphIQResearch({
  onUseNews,
  onUseCompanies,
  sourcePage = 'operator'
}) {
  const [status, setStatus] = useState(null),
    [check, setCheck] = useState(null),
    [research, setResearch] = useState(null),
    [kind, setKind] = useState('news'),
    [query, setQuery] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const [slack, setSlack] = useState(null),
    [delivery, setDelivery] = useState(null);
  const [page, setPage] = useState(0);
  useEffect(() => {
    setPage(0);
  }, [research?.snapshotId, research?.query]);
  const sequence = useRef(0),
    alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      sequence.current++;
    };
  }, []);
  useEffect(() => {
    const id = ++sequence.current,
      org = getActiveOrgId();
    setError('');
    setResearch(null);
    Promise.all([apiGet('/graphiq/mcp/status'), apiGet(`/graphiq/mcp/research?kind=${kind}`), apiGet('/graphiq/mcp/notifications')]).then(([connection, result, notifications]) => {
      if (alive.current && id === sequence.current && org === getActiveOrgId()) {
        setStatus(connection);
        setSlack(notifications);
        setResearch(result.research);
        setDelivery(result.slackNotification || null);
      }
    }).catch(e => {
      if (alive.current && id === sequence.current && org === getActiveOrgId()) setError(e.message || 'Unable to load GraphIQ research.');
    });
  }, [kind]);
  useEffect(() => {
    const listener = e => {
      if (e.detail?.orgId === getActiveOrgId()) setDelivery(e.detail.delivery);
    };
    window.addEventListener('atlas:graphiq-slack', listener);
    return () => window.removeEventListener('atlas:graphiq-slack', listener);
  }, []);
  async function run(path, body, checking = false) {
    const id = ++sequence.current,
      org = getActiveOrgId();
    setBusy(true);
    setError('');
    if (!checking) setResearch(null);
    try {
      const result = await apiPost(path, {
        ...body,
        sourcePage
      });
      if (!alive.current || id !== sequence.current || org !== getActiveOrgId()) return;
      if (checking) setCheck(result);else {
        setResearch(result.research);
        setDelivery(result.slackNotification || null);
        publishGraphIQNotification(result, org);
        if (result.research?.kind === 'news') onUseNews?.(result.research);
        if (result.companySnapshotId) onUseCompanies?.({
          snapshotId: result.companySnapshotId,
          query: result.research?.query
        });
      }
    } catch (e) {
      if (alive.current && id === sequence.current && org === getActiveOrgId()) setError(e.message || 'GraphIQ MCP request failed.');
    } finally {
      if (alive.current && id === sequence.current) setBusy(false);
    }
  }
  async function toggleSlack(enabled) {
    const org = getActiveOrgId();
    setBusy(true);
    setError('');
    try {
      const updated = await apiPut('/graphiq/mcp/notifications', {
        enabled
      });
      if (alive.current && org === getActiveOrgId()) setSlack(updated);
    } catch (e) {
      if (alive.current && org === getActiveOrgId()) setError(e.message);
    } finally {
      if (alive.current && org === getActiveOrgId()) setBusy(false);
    }
  }
  const selected = check?.searches?.find(s => s.kind === kind),
    notifying = ['market-signals', 'account-intelligence'].includes(sourcePage),
    latestDelivery = delivery || slack?.lastDelivery;
  const results = resultWindow(research?.records, page);
  return <section className="gqr-panel" aria-label="GraphIQ company research and news">
    <header className="gqr-heading"><div><div className="gqr-eyebrow">EXTERNAL INTELLIGENCE</div><h2>Company research & news</h2><p className="gqr-subtitle">Find company context and reporting from GraphIQ.</p></div><span className="gqr-badge">GraphIQ</span></header>
    {status?.configured === false && <p role="alert" className="gqr-notice">Configure GraphIQ in the backend to start searching.</p>}
    {selected && !selected.available && <p role="alert" className="gqr-notice">{selected.message}</p>}
    {error && <p role="alert" className="gqr-notice">{error}</p>}
    <form className="gqr-form" onSubmit={e => {
      e.preventDefault();
      setPage(0);
      run('/graphiq/mcp/research', {
        kind,
        query: query.trim()
      });
    }}>
      <label>Research type<select value={kind} disabled={busy} onChange={e => setKind(e.target.value)}><option value="news">Company news</option><option value="companies">Company research</option></select></label>
      <label>Search<input value={query} disabled={busy} onChange={e => setQuery(e.target.value)} required maxLength={500} placeholder={kind === 'news' ? 'Company name or news topic' : 'Company name'} /></label>
      <button className="gqr-primary" disabled={busy || !query.trim() || status?.configured === false}>{busy ? 'Working…' : 'Search GraphIQ'}</button>
    </form>
    <div className="gqr-settings">
      {notifying && <GraphIQMonitoring sourcePage={sourcePage} kind={kind} query={query} slack={slack} configured={status?.configured} />}
      {notifying && <details className="gqr-disclosure"><summary><span>Slack alerts</span><span className="gqr-summary-value">{!slack ? 'Loading…' : slack.connected ? slack.enabled ? 'On' : 'Off' : 'Not connected'}</span></summary><div className="gqr-settings-body">
        <p>{slack?.connected ? `Destination: ${slack.channel || 'Connected Slack channel'}` : 'Connect Slack in Data Connectors to receive notifications.'}</p>
        {slack?.canManage && slack.connected && <label className="gqr-toggle"><input type="checkbox" checked={slack.enabled} disabled={busy} onChange={e => toggleSlack(e.target.checked)} /> Share new GraphIQ results in Slack</label>}
        {latestDelivery && <p className="gqr-meta">{deliveryMessage(latestDelivery)}</p>}
      </div></details>}
      <details className="gqr-disclosure"><summary><span>Connection</span><span className="gqr-summary-value">{status?.configured === false ? 'Setup needed' : check ? 'Checked' : 'Details'}</span></summary><div className="gqr-settings-body">
        <button type="button" disabled={busy || status?.configured === false} onClick={() => run('/graphiq/mcp/check', {}, true)}>Check connection</button>
        {check ? <p className="gqr-meta">Checked {when(check.checkedAt)} · {check.toolCount} tools · {check.protocolVersion}<br />Companies: {check.searches?.find(s => s.kind === 'companies')?.available ? 'available' : 'review access'} · News: {check.searches?.find(s => s.kind === 'news')?.available ? 'available' : 'review access'}</p> : <p className="gqr-meta">Check GraphIQ access and available search tools.</p>}
      </div></details>
    </div>
    {latestDelivery && ['failed', 'uncertain'].includes(latestDelivery.state) && <p role="status" className="gqr-notice">{deliveryMessage(latestDelivery)}</p>}
    {busy && <p role="status" className="gqr-meta">Working on your request…</p>}
    {research && <div className="gqr-results">
      <div className="gqr-heading"><div><h3>{research.kind === 'news' ? 'News' : 'Companies'} <span className="gqr-query">· {research.query}</span></h3><p className="gqr-meta">{results.total ? `${results.start}–${results.end} of ${results.total} results · ` : ''}Retrieved {when(research.asOf)}</p></div>{research.kind === 'news' && onUseNews && <button type="button" onClick={() => onUseNews(research)}>Use in Atlas answers</button>}</div>
      {!results.total && !research.text && <p className="gqr-empty">No results found. Try a different company name or topic.</p>}
      <div className="gqr-result-grid">{results.records.map((record, n) => {
          const link = safeLink(record.url || record.website),
            summary = record.summary || record.description || '',
            date = published(record.publishedAt);
          return <article className="gqr-result" key={`${research.snapshotId}-${record.id}-${n}`}>
          {research.kind === 'news' && (record.publisher || date) && <p className="gqr-source">{[record.publisher, date].filter(Boolean).join(' · ')}</p>}
          <h4>{record.title || record.name}</h4>
          {summary && <p className="gqr-excerpt">{summary.length > 220 ? summary.slice(0, 220) + '…' : summary}</p>}
          {summary.length > 220 && <details className="gqr-full-summary"><summary>Read full summary</summary><p>{summary}</p></details>}
          {link && <a className="gqr-source-link" href={link} target="_blank" rel="noopener noreferrer">Open source ↗</a>}
        </article>;
        })}</div>
      {results.pages > 1 && <nav className="gqr-pagination" aria-label="Research result pages"><span className="gqr-meta">Page {results.page + 1} of {results.pages}</span><div><button type="button" disabled={results.page === 0} onClick={() => setPage(results.page - 1)}>Previous</button><button type="button" disabled={results.page === results.pages - 1} onClick={() => setPage(results.page + 1)}>Next</button></div></nav>}
      {research.text && <details className="gqr-provider"><summary>Provider response</summary><pre>{research.text}</pre></details>}
    </div>}
    <footer className="gqr-footer"><span>Source: GraphIQ</span><details><summary>About these results</summary><p>Up to 20 results per search. News uses text matching; company research uses company names. Reporting and profiles do not establish buying intent or a verified CRM account match. Saved searches can run on a schedule and notify Slack.</p></details></footer>
  </section>;
}
