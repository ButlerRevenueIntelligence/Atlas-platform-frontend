import React, { useEffect, useRef, useState } from 'react';
import { apiGet, apiPost, getActiveOrgId } from '../api';
import './GraphIQResearch.css';
const when = value => value ? new Date(value).toLocaleString() : 'Not supplied';
export default function GraphIQResearch({
  onUseNews,
  onUseCompanies
}) {
  const [status, setStatus] = useState(null),
    [check, setCheck] = useState(null),
    [research, setResearch] = useState(null),
    [kind, setKind] = useState('news'),
    [query, setQuery] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
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
    Promise.all([apiGet('/graphiq/mcp/status'), apiGet(`/graphiq/mcp/research?kind=${kind}`)]).then(([connection, result]) => {
      if (alive.current && id === sequence.current && org === getActiveOrgId()) {
        setStatus(connection);
        setResearch(result.research);
      }
    }).catch(e => {
      if (alive.current && id === sequence.current && org === getActiveOrgId()) setError(e.message || 'Unable to load GraphIQ research.');
    });
  }, [kind]);
  async function run(path, body, checking = false) {
    const id = ++sequence.current,
      org = getActiveOrgId();
    setBusy(true);
    setError('');
    if (!checking) setResearch(null);
    try {
      const result = await apiPost(path, body);
      if (!alive.current || id !== sequence.current || org !== getActiveOrgId()) return;
      if (checking) setCheck(result);else {
        setResearch(result.research);
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
 {busy && <p role="status">Contacting GraphIQ MCP…</p>}
 {research && <div className="gqr-results"><div className="gqr-heading"><div><h3>{research.kind === 'news' ? 'News search' : 'Company search'}: {research.query}</h3><p className="gqr-meta">Source: GraphIQ MCP · Retrieved {when(research.asOf)}</p></div>{research.kind === 'news' && onUseNews && <button type="button" onClick={() => onUseNews(research)}>Use this news in Atlas answers</button>}</div>
 {!research.records?.length && !research.text && <p>No results were returned for this search.</p>}
 {research.records?.map((record, n) => <article className="gqr-result" key={`${record.id}-${n}`}><h4>{record.title || record.name}</h4>{(record.summary || record.description) && <p>{record.summary || record.description}</p>}{research.kind === 'news' && <p className="gqr-meta">{record.publisher || 'Publisher not supplied'} · Published {when(record.publishedAt)}</p>}{/^https?:\/\//i.test(record.url || record.website || '') && <a href={record.url || record.website} target="_blank" rel="noopener noreferrer">Open original source ↗</a>}</article>)}
 {research.text && <details><summary>Inspect provider response</summary><pre>{research.text}</pre></details>}</div>}
 <p className="gqr-meta">Showing up to 20 records per search. Searches run when requested. Automatic news monitoring and alerts are not enabled. Reporting and company profiles do not establish buying intent or a verified match to a CRM account.</p>
 </section>;
}
