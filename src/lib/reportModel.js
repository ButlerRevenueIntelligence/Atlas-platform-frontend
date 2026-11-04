export const reportTypes = [{
  id: 'executive',
  title: 'Executive briefing',
  audience: 'Leadership & board',
  description: 'Revenue, pipeline and the decisions to take into your next review.'
}, {
  id: 'revenue',
  title: 'Revenue performance',
  audience: 'Finance & operations',
  description: 'Recorded revenue, the operating run rate and accounting context.'
}, {
  id: 'sales',
  title: 'Sales & pipeline',
  audience: 'Sales leadership',
  description: 'Open opportunities, stage concentration and deal priorities.'
}, {
  id: 'marketing',
  title: 'Marketing performance',
  audience: 'Growth & marketing',
  description: 'Spend, leads and activity reported by your connected channels.'
}];
const names = {
  stripe: 'Stripe',
  shopify: 'Shopify',
  metrics_daily: 'Imported daily metrics',
  none: 'No recorded source',
  google_ads: 'Google Ads',
  linkedin_ads: 'LinkedIn Ads',
  meta_ads: 'Meta Ads',
  ga4: 'Google Analytics 4',
  advertising_leads: 'Advertising platforms',
  ga4_generate_lead: 'GA4 generate_lead events'
};
export const sourceName = value => names[value] || value || 'Not recorded';
const number = value => value === null || value === undefined || value === '' || !Number.isFinite(Number(value)) ? null : Number(value);
export const money = (value, currency = 'USD') => value === null ? 'Not available' : new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency,
  maximumFractionDigits: 0
}).format(value);
export const count = value => value === null ? 'Not available' : value.toLocaleString('en-US');
const sum = (rows, key) => rows.reduce((total, row) => total + (number(row[key]) ?? 0), 0);
const stage = row => String(row.stage || 'Unspecified').trim();
const closed = row => ['closed won', 'closed lost'].includes(stage(row).toLowerCase());
const amount = row => number(row.amount ?? row.value ?? row.pipelineValue) ?? 0;
export function buildReportModel(data = {}, id = 'executive') {
  const report = reportTypes.find(item => item.id === id) || reportTypes[0];
  id = report.id;
  const demo = data.workspaceMode === 'demo';
  const summary = data.summary || {};
  const metrics = Array.isArray(data.metrics) ? data.metrics : [];
  const deals = (Array.isArray(data.deals) ? data.deals : []).filter(row => row && !closed(row));
  const integrations = Array.isArray(data.integrations) ? data.integrations : [];
  const channels = Array.isArray(data.channelMetrics) ? data.channelMetrics : [];
  const revenueSource = data.dataSources?.revenue;
  const revenueAvailable = demo || !!revenueSource && revenueSource !== 'none';
  const pipelineAvailable = demo || deals.length > 0 || (number(summary.pipelineValue) ?? 0) > 0 || integrations.some(item => ['hubspot', 'salesforce', 'zoho_crm', 'pipedrive', 'bitrix24'].includes(item.provider || item.id) && item.lastSyncStatus === 'success');
  const marketingAvailable = demo || channels.length > 0 || metrics.some(row => (number(row.spend) ?? 0) !== 0 || (number(row.leads) ?? 0) !== 0) || revenueSource === 'metrics_daily' && metrics.length > 0;
  const revenue = revenueAvailable ? number(summary.revenue) : null;
  const pipeline = pipelineAvailable ? number(summary.pipelineValue) : null;
  const open = pipelineAvailable ? number(summary.openDeals) : null;
  const spend = marketingAvailable ? sum(metrics, 'spend') : null;
  const leads = marketingAvailable ? sum(metrics, 'leads') : null;
  const runRate = revenue === null ? null : revenue * 3;
  const workspace = data.activeWorkspace?.name || data.activeOrg?.name || data.org?.name || 'Your workspace';
  const dates = metrics.map(row => String(row.dateISO || row.date || '').slice(0, 10)).filter(value => /^\d{4}-\d{2}-\d{2}$/.test(value)).sort();
  const period = dates.length ? `${dates[0]} to ${dates.at(-1)}` : 'Last 30 days';
  const rows = [['Recorded revenue', money(revenue), `Last 30 days · ${sourceName(revenueSource || (demo ? 'Demo workspace' : null))}`], ['Open pipeline', money(pipeline), 'Current open opportunity snapshot'], ['90-day revenue run rate', money(runRate), 'Modeled: trailing 30-day revenue × 3; not a committed forecast'], ['Open opportunities', count(open), 'Current open opportunity count']];
  const notes = [];
  if (revenue !== null) notes.push({
    title: 'Revenue baseline',
    body: `${money(revenue)} recorded over the reporting window. The ${money(runRate)} 90-day run rate assumes this pace continues; it does not incorporate future deal outcomes.`
  });
  if (pipeline !== null) notes.push({
    title: 'Pipeline to review',
    body: `${money(pipeline)} across ${count(open)} open opportunities. Review expected closes and next steps in Deal War Room; this total is not probability-weighted.`
  });
  if (spend !== null) notes.push({
    title: 'Marketing context',
    body: `${money(spend)} in recorded spend and ${count(leads)} reported leads. Channel activity does not establish revenue attribution.`
  });
  const gaps = [...(Array.isArray(data.warnings) ? data.warnings : [])];
  if (['executive', 'revenue'].includes(id) && !revenueAvailable) gaps.push('Connect a revenue source or import daily revenue to include recorded revenue and the run rate.');
  if (['executive', 'sales'].includes(id) && !pipelineAvailable) gaps.push('Connect a CRM or import opportunities to include pipeline and sales reporting.');
  if (['executive', 'marketing'].includes(id) && !marketingAvailable) gaps.push('Connect advertising or analytics, or import daily spend and leads, to include marketing performance.');
  const sections = [];
  const add = (title, columns, values) => sections.push({
    title,
    columns,
    values
  });
  if (id === 'executive' || id === 'revenue') add('Revenue snapshot', ['Measure', 'Value', 'Basis'], id === 'revenue' ? [rows[0], rows[2]] : rows);
  if (id === 'sales') add('Pipeline snapshot', ['Measure', 'Value', 'Basis'], [rows[1], rows[3]]);
  if (id === 'executive' || id === 'marketing') add('Marketing snapshot', ['Measure', 'Value', 'Basis'], [['Recorded spend', money(spend), 'Last 30 days · USD'], ['Reported leads', count(leads), sourceName(data.dataSources?.leads)], ['Cost per reported lead', spend !== null && leads > 0 ? money(spend / leads) : 'Not available', 'Spend ÷ reported leads; not customer acquisition cost']]);
  if (id === 'sales') {
    const stages = new Map();
    for (const deal of deals) {
      const key = stage(deal);
      const value = stages.get(key) || {
        count: 0,
        total: 0
      };
      value.count++;
      value.total += amount(deal);
      stages.set(key, value);
    }
    add('Pipeline by stage', ['Stage', 'Opportunities', 'Value (USD)'], [...stages].sort((a, b) => b[1].total - a[1].total).map(([key, value]) => [key, count(value.count), money(value.total)]));
    add('Largest open opportunities', ['Opportunity', 'Stage', 'Value (USD)'], [...deals].sort((a, b) => amount(b) - amount(a)).slice(0, 10).map(row => [row.name || row.title || 'Unnamed opportunity', stage(row), money(amount(row))]));
  }
  if (id === 'marketing') add('Channel-reported activity', ['Channel', 'Spend (USD)', 'Leads', 'Conversions', 'Clicks'], channels.map(row => [sourceName(row.provider || row.name), money(number(row.spend)), count(number(row.leads)), count(number(row.conversions)), count(number(row.clicks))]));
  if ((id === 'revenue' || id === 'executive') && data.financials) {
    const f = data.financials;
    add('QuickBooks accounting context', ['Measure', 'Value', 'Accounting period'], [['Accounting revenue', 'revenue'], ['Expenses', 'expenses'], ['Net income', 'netIncome'], ['Cash', 'cash']].map(([label, key]) => [label, money(number(f[key]), f.currency || 'USD'), `${f.periodStart?.slice(0, 10) || 'Not recorded'} to ${f.periodEnd?.slice(0, 10) || 'Not recorded'}`]));
  }
  if (['executive', 'revenue', 'marketing'].includes(id) && metrics.length) add('Daily activity', ['Date', 'Revenue (USD)', 'Spend (USD)', 'Reported leads'], metrics.map(row => [String(row.dateISO || row.date || '').slice(0, 10), money(revenueAvailable ? number(row.revenue) : null), money(marketingAvailable ? number(row.spend) : null), count(marketingAvailable ? number(row.leads) : null)]));
  const relevantNotes = id === 'revenue' ? notes.filter(n => n.title === 'Revenue baseline') : id === 'sales' ? notes.filter(n => n.title === 'Pipeline to review') : id === 'marketing' ? notes.filter(n => n.title === 'Marketing context') : notes;
  return {
    ...report,
    workspace,
    demo,
    period,
    rows,
    sections,
    notes: relevantNotes,
    gaps: [...new Set(gaps)],
    metrics,
    revenueAvailable,
    marketingAvailable,
    revenueSource,
    loadedAt: data.lastUpdated || null,
    limitations: id === 'marketing' ? 'Channel leads and conversions can overlap. Channel totals are provider-reported and are not deduplicated attribution. Non-USD amounts are excluded by the workspace data service; no currency conversion is applied.' : 'Revenue, pipeline and accounting use different bases. Pipeline is a current snapshot; QuickBooks uses the accounting period shown. No historical pipeline movement or validated confidence score is inferred.'
  };
}
function cell(value) {
  let text = String(value ?? '');
  // Spreadsheet software must not execute a customer-supplied name as a formula.
  if (/^[\s]*[=+@-]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}
export function reportCsv(model) {
  const rows = [[model.title], ['Workspace', model.workspace], ['Data mode', model.demo ? 'Demo' : 'Live'], ['Reporting window', model.period], ['Snapshot loaded', model.loadedAt || 'Not recorded'], []];
  for (const section of model.sections) rows.push([section.title], section.columns, ...section.values, []);
  rows.push(['Observations'], ...model.notes.map(note => [note.title, note.body]), [], ['Data gaps'], ...model.gaps.map(gap => [gap]), ['Methodology', model.limitations]);
  return '\uFEFF' + rows.map(row => row.map(cell).join(',')).join('\r\n');
}
