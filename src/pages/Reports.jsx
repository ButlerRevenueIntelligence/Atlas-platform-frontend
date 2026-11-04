import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip } from 'recharts';
import { getDashboard } from '../api';
import { buildReportModel, reportTypes, reportCsv, money, sourceName } from '../lib/reportModel.js';
import './Reports.css';
export default function Reports() {
  const [data, setData] = useState(null);
  const [selected, setSelected] = useState('executive');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const request = useRef(0);
  async function load() {
    const current = ++request.current;
    setLoading(true);
    setError('');
    setNotice('');
    try {
      const next = await getDashboard();
      if (!next || next.ok === false) throw new Error('Report data is unavailable. Try refreshing.');
      if (current === request.current) setData(next);
    } catch (err) {
      if (current === request.current) setError(err.message || 'Unable to load reports.');
    } finally {
      if (current === request.current) setLoading(false);
    }
  }
  useEffect(() => {
    load();
    return () => {
      request.current++;
    };
  }, []);
  const model = useMemo(() => buildReportModel(data || {}, selected), [data, selected]);
  const trend = useMemo(() => model.metrics.map(row => ({
    date: String(row.dateISO || row.date || '').slice(0, 10),
    revenue: Number(row.revenue) || 0,
    spend: Number(row.spend) || 0
  })).filter(row => /^\d{4}-\d{2}-\d{2}$/.test(row.date)).sort((a, b) => a.date.localeCompare(b.date)), [model.metrics]);
  function download() {
    try {
      const blob = new Blob([reportCsv(model)], {
        type: 'text/csv;charset=utf-8'
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `atlas-${selected}-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice(`${model.title} CSV downloaded.`);
    } catch {
      setError('The CSV could not be downloaded. Please try again.');
    }
  }
  const ready = !!data && !loading && !error;
  return <main className="atlas-reports">
    <header className="reports-header reports-no-print">
      <div><p className="reports-eyebrow">Leadership workspace</p><h1>Reports</h1><p>Turn workspace performance into a clear leadership review.</p></div>
      <div className="reports-actions">
        <button className="reports-button" onClick={load} disabled={loading}>{loading ? 'Refreshing…' : 'Refresh data'}</button>
        <button className="reports-button" onClick={download} disabled={!ready}>Export CSV</button>
        <button className="reports-button primary" onClick={() => window.print()} disabled={!ready}>Print / Save PDF</button>
      </div>
    </header>
    {error && <div className="reports-alert reports-no-print" role="alert">{error} <button onClick={load}>Try again</button></div>}
    <div role="status" className="reports-no-print reports-notice">{notice}</div>
    {loading && !data ? <div className="reports-loading" role="status">Loading your report workspace…</div> : data && <>
      <div className="reports-context reports-no-print"><span className={`reports-badge ${model.demo ? 'demo' : ''}`}>{model.demo ? 'Demo workspace' : 'Live workspace'}</span><strong>{model.workspace}</strong><span>Activity window: {model.period}</span><span>{model.loadedAt ? `Snapshot loaded ${new Date(model.loadedAt).toLocaleString()}` : 'Snapshot time not recorded'}</span></div>
      <div className="reports-layout">
        <aside className="reports-library reports-no-print" aria-label="Choose report">
          <p className="reports-eyebrow">Report library</p>
          {reportTypes.map((report, index) => <button key={report.id} onClick={() => {
            setSelected(report.id);
            setNotice('');
          }} aria-pressed={selected === report.id} className={`reports-choice ${selected === report.id ? 'selected' : ''}`}><span className="reports-choice-number">0{index + 1}</span><span><strong>{report.title}</strong><small>{report.audience}</small></span><span aria-hidden="true">↗</span></button>)}
          <div className="reports-library-note"><strong>One consistent snapshot</strong><p>Preview and exports use the same workspace data. Refresh before sharing with your team.</p><Link to="/integrations">Manage data sources →</Link></div>
        </aside>
        <article className={`reports-preview ${loading || error ? 'reports-stale' : ''}`} aria-busy={loading}>
          <div className="reports-report-head"><div><p className="reports-eyebrow">{model.audience}</p><h2>{model.title}</h2><p>{model.description}</p></div><span className="reports-preview-tag reports-no-print">Report preview</span></div>
          <div className="reports-print-context">{model.workspace} · {model.demo ? 'Demo data' : 'Live workspace data'} · {model.period}<br />Snapshot loaded: {model.loadedAt || 'Not recorded'}</div>
          <div className="reports-kpis">{model.rows.map(([label, value, basis]) => <div key={label}><span>{label}</span><strong>{value}</strong><small>{basis}</small></div>)}</div>
          {model.notes.length > 0 && <section className="reports-section"><div className="reports-section-heading"><h3>What to take into the review</h3><span>From this snapshot</span></div><div className="reports-observations">{model.notes.map((note, index) => <div key={note.title}><span className="reports-note-number">{index + 1}</span><div><strong>{note.title}</strong><p>{note.body}</p></div></div>)}</div></section>}
          {['executive', 'revenue', 'marketing'].includes(selected) && <section className="reports-section"><div className="reports-section-heading"><h3>Daily activity</h3><div className="reports-legend">{model.revenueAvailable && <span className="revenue">Revenue</span>}{model.marketingAvailable && <span className="spend">Spend</span>}</div></div>
            {trend.length > 0 && (model.revenueAvailable || model.marketingAvailable) ? <div className="reports-chart" aria-label="Daily revenue and spend in US dollars"><ResponsiveContainer width="100%" height="100%"><LineChart data={trend} margin={{
                  left: 8,
                  right: 16,
                  top: 12
                }}><CartesianGrid vertical={false} stroke="rgba(148,163,184,.12)" /><XAxis dataKey="date" minTickGap={40} tickFormatter={date => date.slice(5)} tick={{
                    fill: '#9baec5',
                    fontSize: 11
                  }} axisLine={false} tickLine={false} /><YAxis width={65} tickFormatter={value => `$${Intl.NumberFormat('en-US', {
                    notation: 'compact'
                  }).format(value)}`} tick={{
                    fill: '#9baec5',
                    fontSize: 11
                  }} axisLine={false} tickLine={false} /><Tooltip formatter={(value, key) => [money(value), key === 'revenue' ? 'Revenue' : 'Spend']} contentStyle={{
                    background: '#131e30',
                    border: '1px solid #334155',
                    borderRadius: 8,
                    color: '#eef4ff'
                  }} />{model.revenueAvailable && <Line name="revenue" dataKey="revenue" type="linear" stroke="#65d4b1" dot={false} strokeWidth={2} isAnimationActive={false} />} {model.marketingAvailable && <Line name="spend" dataKey="spend" type="linear" stroke="#83adf5" dot={false} strokeWidth={2} isAnimationActive={false} />}</LineChart></ResponsiveContainer></div> : <p className="reports-empty">No daily activity is available for this report yet. Connect a source or import daily metrics to populate the trend.</p>}
            <p className="reports-footnote">USD · Daily recorded totals. Revenue source: {sourceName(model.revenueSource)}. No historical pipeline movement is inferred.</p>
          </section>}
          {model.sections.filter(section => section.title !== "Daily activity").map(section => <section key={section.title} className="reports-section"><h3>{section.title}</h3>{section.values.length ? <div className="reports-table-wrap"><table><thead><tr>{section.columns.map(column => <th key={column} scope="col">{column}</th>)}</tr></thead><tbody>{section.values.map((row, index) => <tr key={index}>{row.map((value, column) => <td key={column}>{value}</td>)}</tr>)}</tbody></table></div> : <p className="reports-empty">No {section.title.toLowerCase()} records are available in this snapshot.</p>}</section>)}
          <section className="reports-section reports-method"><h3>Sources & reporting basis</h3><p>{model.limitations}</p>{model.demo && <p>These values belong to the demo workspace and do not represent your company’s live performance.</p>}<p>Run rate is a simple projection, not a forecast confidence score. No external benchmark or revenue attribution is assumed.</p>{model.gaps.length > 0 && <div className="reports-gaps"><strong>Data coverage to complete</strong><ul>{model.gaps.map(gap => <li key={gap}>{gap}</li>)}</ul></div>}<div className="reports-source-links reports-no-print"><Link to="/revenue-planning">Review revenue planning →</Link><Link to="/deal-war-room">Review open opportunities →</Link></div></section>
        </article>
      </div>
    </>}
  </main>;
}
