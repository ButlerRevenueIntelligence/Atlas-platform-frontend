import GraphIQMonitoring from './GraphIQMonitoring';
import React, { useEffect, useRef, useState } from 'react';
import { apiGet, apiPost, apiPut, getActiveOrgId, publishGraphIQNotification } from '../api';
import './GraphIQResearch.css';
const when = value => value ? new Date(value).toLocaleString() : 'Not supplied';
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
  const selected = check?.searches?.find(s => s.kind === kind);
  return <section className="gqr-panel" aria-label="GraphIQ company research and news"><div className="gqr-heading"><div><div className="gqr-eyebrow">GRAPHIQ MCP</div><h2>Company research & news</h2><p>Look up external reporting and company context, then inspect the source before acting.</p></div><button type="button" disabled={busy || status?.configured === false} onClick={() => run('/graphiq/mcp/check', {}, true)}>Check connection</button></div>
{['market-signals', 'account-intelligence'].includes(sourcePage) && <div className="gqr-slack"><h3>GraphIQ → Slack</h3><p>{!slack ? 'Loading Slack destination…' : slack.connected ? `Destination: ${slack.channel || 'connected Slack channel'} · ${slack.enabled ? 'Notifications on' : 'Notifications off'}` : 'Connect Slack in Data Connectors to receive GraphIQ notifications.'}</p>{slack?.canManage && slack.connected && <label><input type="checkbox" checked={slack.enabled} disabled={busy} onChange={async e => {
          const enabled = e.target.checked,
            org = getActiveOrgId();
          setBusy(true);
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
        }} /> Notify Slack when these pages retrieve new GraphIQ results</label>}{(delivery || slack?.lastDelivery) && <p role="status">{(delivery || slack.lastDelivery).state === 'sent' ? 'Slack accepted the GraphIQ notification.' : (delivery || slack.lastDelivery).state === 'uncertain' ? 'Slack delivery could not be confirmed. Atlas will not automatically resend an uncertain notification.' : (delivery || slack.lastDelivery).state === 'failed' ? 'Slack notification failed. The GraphIQ research is still available in Atlas.' : (delivery || slack.lastDelivery).reason === 'already_notified_or_in_progress' ? 'No duplicate Slack notification sent.' : (delivery || slack.lastDelivery).reason === 'disabled' ? 'GraphIQ notifications are turned off.' : (delivery || slack.lastDelivery).reason === 'slack_not_connected' ? 'Slack is not connected for this workspace.' : 'No structured new results to notify.'}</p>}</div>}
  {status?.configured === false && <p className="gqr-notice">The backend GraphIQ API key needs to be configured before MCP searches can run.</p>}
 {check && <p className="gqr-meta">MCP connection checked {when(check.checkedAt)} · {check.toolCount} tools discovered · {check.protocolVersion}. Companies: {check.searches?.find(s => s.kind === 'companies')?.available ? 'available' : 'adapter/access check needed'} · News: {check.searches?.find(s => s.kind === 'news')?.available ? 'available' : 'adapter/access check needed'}.</p>}
 {selected && !selected.available && <p className="gqr-notice">{selected.message}</p>}
 {error && <p role="alert" className="gqr-notice">{error}</p>}
 <form className="gqr-form" onSubmit={e => {
      e.preventDefault();
      run('/graphiq/mcp/research', {
        kind,
        query: query.trim()
      });
    }}><label>Research type<select value={kind} disabled={busy} onChange={e => setKind(e.target.value)}><option value="news">Company news</option><option value="companies">Company research</option></select></label><label>Search<input value={query} disabled={busy} onChange={e => setQuery(e.target.value)} required maxLength={500} placeholder={kind === 'news' ? 'Company name, topic and timeframe' : 'Companies, capabilities or market'} /></label><button disabled={busy || !query.trim() || status?.configured === false}>{busy ? 'Working…' : 'Search GraphIQ'}</button></form>
 {['market-signals', 'account-intelligence'].includes(sourcePage) && <GraphIQMonitoring sourcePage={sourcePage} kind={kind} query={query} slack={slack} configured={status?.configured} />}
 {busy && <p role="status">Contacting GraphIQ MCP…</p>}
 {research && <div className="gqr-results"><div className="gqr-heading"><div><h3>{research.kind === 'news' ? 'News search' : 'Company search'}: {research.query}</h3><p className="gqr-meta">Source: GraphIQ MCP · Retrieved {when(research.asOf)}</p></div>{research.kind === 'news' && onUseNews && <button type="button" onClick={() => onUseNews(research)}>Use this news in Atlas answers</button>}</div>
 {!research.records?.length && !research.text && <p>No results were returned for this search.</p>}
 {research.records?.map((record, n) => <article className="gqr-result" key={`${record.id}-${n}`}><h4>{record.title || record.name}</h4>{(record.summary || record.description) && <p>{record.summary || record.description}</p>}{research.kind === 'news' && <p className="gqr-meta">{record.publisher || 'Publisher not supplied'} · Published {when(record.publishedAt)}</p>}{/^https?:\/\//i.test(record.url || record.website || '') && <a href={record.url || record.website} target="_blank" rel="noopener noreferrer">Open original source ↗</a>}</article>)}
 {research.text && <details><summary>Inspect provider response</summary><pre>{research.text}</pre></details>}</div>}
 <p className="gqr-meta">Showing up to 20 records per search. Searches run when requested. New results from Market Signals and Account Intelligence can notify the connected Slack channel. Saved searches can also run on a schedule while you are away. Reporting and company profiles do not establish buying intent or a verified match to a CRM account.</p>
 </section>;
}
