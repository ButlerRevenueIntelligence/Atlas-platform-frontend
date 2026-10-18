import React, { useEffect, useRef, useState } from 'react';
import { apiGet, apiPut, getActiveOrgId } from '../api';
const when = value => value ? new Date(value).toLocaleString() : 'Not yet';
const reasons = {
  graphiq_access_check_required: 'Monitoring stopped. Check GraphIQ access and tool compatibility, then start monitoring again.',
  workspace_inactive: 'Workspace access must be active.',
  manager_access_required: 'An active workspace manager must save this monitor again.',
  slack_unavailable_or_disabled: 'Connect Slack and turn GraphIQ notifications on to resume checks.',
  graphiq_check_failed: 'GraphIQ could not complete the check. Atlas will retry with backoff.',
  monitor_processing_failed: 'The check could not finish. Atlas will retry.'
};
export function monitoringLabel(monitor) {
  if (!monitor?.enabled) return 'Monitoring paused';
  if (monitor.lastState === 'never' || !monitor.lastState) return 'Search saved · Awaiting first check';
  if (monitor.lastState === 'running') return 'Checking GraphIQ…';
  if (monitor.lastState === 'error') return 'Monitoring enabled · Last check failed';
  if (monitor.lastState === 'paused') return 'Monitoring waiting';
  if (monitor.lastState === 'superseded') return 'Settings changed · Awaiting next check';
  return 'Monitoring enabled · Last check completed';
}
export default function GraphIQMonitoring({
  sourcePage,
  kind,
  query,
  slack,
  configured
}) {
  const [monitor, setMonitor] = useState(null),
    [canManage, setCanManage] = useState(false),
    [saving, setSaving] = useState(false),
    [error, setError] = useState('');
  const alive = useRef(true),
    request = useRef(0),
    savingRef = useRef(false);
  async function load() {
    const id = ++request.current,
      org = getActiveOrgId();
    try {
      const result = await apiGet('/graphiq/mcp/monitoring');
      if (alive.current && id === request.current && org === getActiveOrgId()) {
        setMonitor(result.monitor);
        setCanManage(result.canManage);
      }
    } catch (e) {
      if (alive.current && id === request.current && org === getActiveOrgId()) setError(e.message || 'Unable to load monitoring.');
    }
  }
  useEffect(() => {
    alive.current = true;
    load();
    const timer = setInterval(() => {
      if (!savingRef.current) load();
    }, 60000);
    return () => {
      alive.current = false;
      request.current++;
      clearInterval(timer);
    };
  }, []);
  async function save(changes) {
    if (savingRef.current || !monitor) return;
    savingRef.current = true;
    setSaving(true);
    setError('');
    const org = getActiveOrgId();
    ++request.current;
    try {
      const result = await apiPut('/graphiq/mcp/monitoring', {
        ...monitor,
        ...changes
      });
      if (alive.current && org === getActiveOrgId()) {
        setMonitor(result.monitor);
        setCanManage(result.canManage);
      }
    } catch (e) {
      if (alive.current && org === getActiveOrgId()) {
        setError(e.message || 'Unable to save monitoring.');
        await load();
      }
    } finally {
      savingRef.current = false;
      if (alive.current && org === getActiveOrgId()) setSaving(false);
    }
  }
  const searches = monitor?.searches || [],
    duplicate = searches.some(s => s.kind === kind && s.query.toLowerCase() === query.trim().toLowerCase());
  const badge = !monitor ? 'Loading…' : !searches.length ? 'Not set' : !monitor.enabled ? 'Paused' : monitor.lastState === 'error' ? 'Check failed' : monitor.lastState === 'never' ? 'Pending' : monitor.lastState === 'running' ? 'Checking…' : monitor.lastState === 'paused' ? 'Waiting' : `${searches.length} saved`;
  return <div className="gqr-monitor-wrap"><details className="gqr-disclosure" aria-label="Continuous GraphIQ monitoring">
    <summary><span>Monitoring</span><span className="gqr-summary-value">{badge}</span></summary>
    <div className="gqr-settings-body">
      {!monitor ? <p role="status">Loading monitoring…</p> : <>
        <p className="gqr-monitor-status" role="status">{monitoringLabel(monitor)} · {searches.length}/5 searches</p>
        <p className="gqr-meta">Saved searches run while you are away and share new results in Slack.</p>
        {monitor.enabled && (!slack?.connected || !slack?.enabled) && <p className="gqr-inline-warning">Connect Slack and turn alerts on to resume checks.</p>}
        <dl className="gqr-check-times"><div><dt>Last check</dt><dd>{when(monitor.lastCompletedAt)}</dd></div><div><dt>Next check</dt><dd>{monitor.enabled ? when(monitor.nextRunAt) : 'Paused'}</dd></div></dl>
        {monitor.enabled && monitor.nextRunAt && Date.now() - new Date(monitor.nextRunAt).getTime() > 180000 && monitor.lastState !== 'running' && <p role="status" className="gqr-inline-warning">The next check is delayed. Refresh status or review the connection.</p>}
        {monitor.lastReason && <p className="gqr-inline-warning">{reasons[monitor.lastReason] || 'Review the connection before the next check.'}</p>}
        {canManage && <>
          <div className="gqr-monitor-actions"><label>Check frequency<select value={monitor.intervalMinutes} disabled={saving} onChange={e => save({
                  intervalMinutes: Number(e.target.value)
                })}><option value={60}>Every hour</option><option value={360}>Every 6 hours</option><option value={1440}>Every day</option></select></label>
          <button type="button" disabled={saving || !searches.length || !monitor.enabled && (configured === false || !slack?.connected || !slack?.enabled)} onClick={() => save({
                enabled: !monitor.enabled
              })}>{monitor.enabled ? 'Pause monitoring' : 'Start monitoring'}</button></div>
          <div className="gqr-save-search"><div><span className="gqr-meta">Current search</span><p>{query.trim() || 'Enter a company or topic above.'}</p></div><button type="button" disabled={saving || !query.trim() || duplicate || searches.length >= 5 || configured === false || !slack?.connected || !slack?.enabled} onClick={() => save({
                enabled: true,
                searches: [...searches, {
                  kind,
                  query: query.trim(),
                  sourcePage
                }]
              })}>{duplicate ? 'Already saved' : 'Monitor this search'}</button></div>
        </>}
        {!canManage && <p className="gqr-meta">A workspace owner, admin or manager can manage saved searches.</p>}
        {!!searches.length && <ul className="gqr-monitor-searches">{searches.map((s, i) => <li key={s.kind + '-' + s.query}><span><strong>{s.query}</strong><small>{s.kind === 'news' ? 'News' : 'Companies'} · {s.sourcePage === 'market-signals' ? 'Market Signals' : 'Account Intelligence'}</small></span>{canManage && <button type="button" disabled={saving} aria-label={'Remove ' + s.query} onClick={() => save({
                searches: searches.filter((_, n) => n !== i),
                enabled: monitor.enabled && searches.length > 1
              })}>Remove</button>}</li>)}</ul>}
        {!!monitor.lastResults?.length && <details className="gqr-run-history"><summary>Last check results</summary><ul>{monitor.lastResults.map((r, i) => <li key={i}>{r.query}: {r.error ? `GraphIQ check failed (${[r.diagnostic?.code || r.error, r.diagnostic?.networkCode, r.diagnostic?.stage].filter(Boolean).join(' · ')})` : `${r.count} result(s) · Slack ${r.delivery?.state || 'not attempted'}`}</li>)}</ul></details>}
        <div className="gqr-monitor-bottom"><button type="button" disabled={saving} onClick={load}>Refresh status</button><details><summary>Schedule details</summary><p className="gqr-meta">Checks use GraphIQ credits and run on a schedule, not as an instant news feed. Results depend on coverage and search limits. The first check can share existing articles. Duplicate results are suppressed.</p></details></div>
      </>}
      {error && <p role="alert" className="gqr-inline-warning">{error}</p>}{saving && <p role="status">Saving monitoring…</p>}
    </div>
  </details>{monitor?.lastState === 'error' && <p className="gqr-settings-warning">Last check failed. Open Monitoring for details.</p>}</div>;
}
