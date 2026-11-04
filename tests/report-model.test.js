import test from 'node:test';
import assert from 'node:assert/strict';
import { buildReportModel, reportCsv } from '../src/lib/reportModel.js';
const fixture = {
  workspaceMode: 'live',
  activeWorkspace: {
    name: 'Example Company'
  },
  lastUpdated: '2026-11-03T22:00:00Z',
  summary: {
    revenue: 12000,
    pipelineValue: 90000,
    openDeals: 2,
    forecastConfidence: 99
  },
  dataSources: {
    revenue: 'stripe',
    leads: 'ga4_generate_lead'
  },
  metrics: [{
    date: '2026-11-01',
    revenue: 7000,
    spend: 200,
    leads: 0
  }, {
    date: '2026-11-02',
    revenue: 5000,
    spend: 300,
    leads: 10
  }],
  deals: [{
    name: 'Open A',
    amount: 40000,
    stage: 'Proposal'
  }, {
    name: 'Open B',
    amount: 50000,
    stage: 'Negotiation'
  }, {
    name: 'Closed deal',
    amount: 80000,
    stage: 'Closed Won'
  }],
  channelMetrics: [{
    provider: 'google_ads',
    spend: 500,
    leads: 8,
    conversions: 3,
    clicks: 100
  }]
};
test('report types produce distinct source-backed sections and sales excludes closed opportunities', () => {
  const sales = buildReportModel(fixture, 'sales');
  assert.equal(sales.sections.find(s => s.title === 'Pipeline by stage').values.length, 2);
  assert.equal(sales.sections.find(s => s.title === 'Largest open opportunities').values[0][0], 'Open B');
  assert.ok(!reportCsv(sales).includes('Closed deal'));
  const marketing = buildReportModel(fixture, 'marketing');
  assert.equal(marketing.sections.find(s => s.title === 'Channel-reported activity').values[0][0], 'Google Ads');
  assert.notDeepEqual(sales.sections, marketing.sections);
});
test('run rate is calculated from recorded revenue without inventing confidence or benchmark scores', () => {
  const report = buildReportModel(fixture);
  assert.equal(report.rows[2][1], '$36,000');
  assert.match(report.rows[2][2], /not a committed forecast/);
  assert.ok(!reportCsv(report).includes('99%'));
  assert.match(reportCsv(buildReportModel(fixture, 'marketing')), /not customer acquisition cost/);
});
test('missing sources are unavailable, not fabricated zero performance', () => {
  const model = buildReportModel({
    workspaceMode: 'live',
    summary: {
      revenue: 0,
      pipelineValue: 0,
      openDeals: 0
    },
    dataSources: {
      revenue: 'none'
    },
    metrics: [{
      date: '2026-11-01',
      revenue: 0,
      spend: 0,
      leads: 0
    }]
  });
  assert.equal(model.rows[0][1], 'Not available');
  assert.equal(model.rows[1][1], 'Not available');
  assert.equal(model.rows[2][1], 'Not available');
  assert.equal(model.notes.length, 0);
  assert.equal(model.gaps.length, 3);
});
test('genuine zero revenue from a recorded source stays zero', () => {
  const model = buildReportModel({
    ...fixture,
    summary: {
      ...fixture.summary,
      revenue: 0
    }
  });
  assert.equal(model.rows[0][1], '$0');
  assert.equal(model.rows[2][1], '$0');
});
test('CSV protects formula-like customer content and escapes quotes, commas and newlines', () => {
  const model = buildReportModel({
    ...fixture,
    activeWorkspace: {
      name: '=IMPORTXML("url")'
    },
    deals: [{
      name: 'Acme, "North"\nAccount',
      amount: 5,
      stage: 'Proposal'
    }]
  }, 'sales');
  const csv = reportCsv(model);
  assert.ok(csv.includes("\"'=IMPORTXML(\"\"url\"\")\""));
  assert.ok(csv.includes('"Acme, ""North""\nAccount"'));
  assert.ok(csv.startsWith('\uFEFF'));
});
test('QuickBooks retains its own currency and period without conflating accounting and activity revenue', () => {
  const model = buildReportModel({
    ...fixture,
    financials: {
      revenue: 30000,
      expenses: 20000,
      netIncome: 10000,
      currency: 'EUR',
      periodStart: '2026-09-01',
      periodEnd: '2026-09-30'
    }
  }, 'revenue');
  const accounting = model.sections.find(s => s.title === 'QuickBooks accounting context');
  assert.equal(accounting.values[0][1], '€30,000');
  assert.equal(accounting.values[0][2], '2026-09-01 to 2026-09-30');
  assert.equal(accounting.values[3][1], 'Not available');
  assert.equal(model.rows[0][1], '$12,000');
});
test('demo reports use the supplied demo snapshot without injecting another set of numbers', () => {
  const model = buildReportModel({
    ...fixture,
    workspaceMode: 'demo',
    summary: {
      ...fixture.summary,
      revenue: 321
    }
  });
  assert.equal(model.rows[0][1], '$321');
  assert.match(reportCsv(model), /"Data mode","Demo"/);
});
test('connected CRM without a successful import does not imply zero pipeline', () => {
  const model = buildReportModel({
    workspaceMode: 'live',
    summary: {
      pipelineValue: 0,
      openDeals: 0
    },
    integrations: [{
      provider: 'salesforce',
      lastSyncStatus: 'never'
    }]
  }, 'sales');
  assert.equal(model.rows[1][1], 'Not available');
  assert.equal(model.gaps.length, 1);
});
test('CSV includes the daily values behind the report chart', () => {
  const csv = reportCsv(buildReportModel(fixture, 'revenue'));
  assert.match(csv, /Daily activity/);
  assert.ok(csv.includes('"2026-11-01","$7,000","$200","0"'));
});
