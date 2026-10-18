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
  return <section className="gqr-monitor" aria-label="Continuous GraphIQ monitoring"><h3>Continuous monitoring</h3><p>Save company or news searches and Atlas checks them while you are away. New results use the connected Slack channel and the same duplicate suppression.</p>
 {!monitor ? <p role="status">Loading monitoring…</p> : <>
 <p role="status">{monitoringLabel(monitor)} · {searches.length}/5 saved searches</p>
 {monitor.enabled && (!slack?.connected || !slack?.enabled) && <p>Checks wait until Slack is connected and GraphIQ notifications are on.</p>}
 <p className="gqr-meta">Last check: {when(monitor.lastCompletedAt)} · Next eligible check: {monitor.enabled ? when(monitor.nextRunAt) : 'Paused'} · Status: {monitor.lastState === 'never' ? 'Awaiting first check' : monitor.lastState}</p>
 {monitor.enabled && monitor.nextRunAt && Date.now() - new Date(monitor.nextRunAt).getTime() > 180000 && monitor.lastState !== 'running' && <p role="status">The next check is overdue. Refresh status and check Render logs for the GraphIQ scheduler.</p>}
 {monitor.lastReason && <p>{reasons[monitor.lastReason] || 'Review the connection before the next check.'}</p>}
 {canManage && <div className="gqr-monitor-actions"><label>Check frequency<select value={monitor.intervalMinutes} disabled={saving} onChange={e => save({
            intervalMinutes: Number(e.target.value)
          })}><option value={60}>Every hour</option><option value={360}>Every 6 hours</option><option value={1440}>Every day</option></select></label>
 <button type="button" disabled={saving || !query.trim() || duplicate || searches.length >= 5 || configured === false || !slack?.connected || !slack?.enabled} onClick={() => save({
          enabled: true,
          searches: [...searches, {
            kind,
            query: query.trim(),
            sourcePage
          }]
        })}>{duplicate ? 'Search already monitored' : 'Monitor this search'}</button>
 <button type="button" disabled={saving || !searches.length || !monitor.enabled && (configured === false || !slack?.connected || !slack?.enabled)} onClick={() => save({
          enabled: !monitor.enabled
        })}>{monitor.enabled ? 'Pause monitoring' : 'Start monitoring'}</button></div>}
 {!canManage && <p className="gqr-meta">A workspace owner, admin or manager can change saved searches.</p>}
 <ul className="gqr-monitor-searches">{searches.map((s, i) => <li key={s.kind + '-' + s.query}><span><strong>{s.query}</strong><small>{s.kind === 'news' ? 'Company news' : 'Company research'} · {s.sourcePage === 'market-signals' ? 'Market Signals' : 'Account Intelligence'}</small></span>{canManage && <button type="button" disabled={saving} aria-label={'Remove ' + s.query} onClick={() => save({
            searches: searches.filter((_, n) => n !== i),
            enabled: monitor.enabled && searches.length > 1
          })}>Remove</button>}</li>)}</ul>
 {!!monitor.lastResults?.length && <details><summary>Last check results</summary><ul>{monitor.lastResults.map((r, i) => <li key={i}>{r.query}: {r.error ? `GraphIQ check failed (${[r.diagnostic?.code || r.error, r.diagnostic?.networkCode, r.diagnostic?.stage].filter(Boolean).join(' · ')})` : `${r.count} result(s) · Slack ${r.delivery?.state || 'not attempted'}`}</li>)}</ul></details>}
 <p className="gqr-meta">Checks use your GraphIQ access and may consume provider credits. Results depend on GraphIQ coverage and search limits. The first check can notify on existing articles. This is scheduled polling, not an instant news feed.</p>
 <button type="button" disabled={saving} onClick={load}>Refresh monitoring status</button>
 </>}{error && <p role="alert">{error}</p>}{saving && <p role="status">Saving monitoring…</p>}
 </section>;
}
