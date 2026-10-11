// Display-only examples, used only after the server identifies the demo workspace.
export function buildDemoMarketMetrics(dashboard, windowDays = 30, now = new Date()) {
  const source = dashboard.metrics || [];
  const count = Math.max(1, Math.min(90, Number(windowDays) || 30));
  const days = Array.from({ length: count }, (_, index) => {
    const date = new Date(now);
    date.setUTCDate(date.getUTCDate() - count + index + 1);
    const row = source[(source.length - count + index + source.length * 4) % source.length] || {};
    const wonRevenue = Number(row.revenue || 0);
    return { date: date.toISOString().slice(0, 10), dealsCreated: 2 + index % 4,
      weightedCreated: Math.round(wonRevenue * (1.3 + index % 5 * 0.12)),
      wonRevenue, wonCount: index % 3 === 0 ? 1 : 0 };
  });
  const deals = dashboard.deals || [];
  const open = deals.filter(deal => !["Closed Won", "Closed Lost"].includes(deal.stage));
  const raw = Number(dashboard.summary?.pipelineValue || 0);
  const weighted = open.reduce((sum, deal) => sum + Number(deal.amount || deal.value || 0) * Number(deal.probability ?? 0.5), 0);
  return { summary: { raw, weighted, wonRevenue: days.reduce((sum, row) => sum + row.wonRevenue, 0),
    winRate: 0.62, staleCount: 2, totalDeals: deals.length,
    wonCount: days.reduce((sum, row) => sum + row.wonCount, 0) }, days };
}
export const demoMarketCompanies = [
  ["Northstar Health Group", "Healthcare", "Multi-location patient services", "Orlando, FL"],
  ["Summit Clinical Systems", "Healthcare Technology", "Clinical workflow software", "Austin, TX"],
  ["Cedarbridge Analytics", "Software", "Revenue and patient analytics", "Atlanta, GA"],
  ["Harborview Care Partners", "Healthcare", "Outpatient care expansion", "Tampa, FL"],
  ["Meridian Medical Supply", "Medical Equipment", "Hospital procurement", "Charlotte, NC"],
  ["Bluecrest Digital Health", "Healthcare Technology", "Remote patient monitoring", "Denver, CO"],
  ["Oakline Revenue Systems", "Software", "Revenue cycle automation", "Chicago, IL"],
  ["Evergreen Wellness Network", "Healthcare", "Employer health programs", "Nashville, TN"],
  ["Brightpath Diagnostics", "Diagnostics", "Diagnostic testing services", "Dallas, TX"],
  ["Westhaven Advisory", "Professional Services", "Healthcare growth consulting", "Phoenix, AZ"],
].map(([name, industry, capability, location], index) => ({
  id: `demo-market-${index}`, name, industries: [industry], capabilities: [capability],
  locations: [location], description: `Fictional demo company. Example focus: ${capability.toLowerCase()}.`,
}));
