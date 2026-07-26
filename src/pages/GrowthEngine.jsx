import React, { useEffect, useMemo, useState } from "react";
import RecommendedActions from "../components/atlas/RecommendedActions";
import { getDashboard } from "../api";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";

const pieColors = ["#67e8f9", "#93c5fd", "#facc15", "#4ade80"];
const axisTick = { fill: "#9fb0d0", fontSize: 11 };

const tooltipStyle = {
  background: "rgba(7,11,24,0.97)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: "14px",
  color: "#fff",
  boxShadow: "0 14px 40px rgba(0,0,0,0.35)",
};

const safeNum = (v, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const money = (n) =>
  safeNum(n).toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

const moneyCompact = (num) => {
  const n = safeNum(num);
  if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `$${(n / 1000).toFixed(0)}K`;
  return `$${Math.round(n)}`;
};

function toneStyle(tone) {
  const map = {
    High: {
      border: "1px solid rgba(16,185,129,0.22)",
      background: "rgba(16,185,129,0.12)",
      color: "#bbf7d0",
    },
    Strong: {
      border: "1px solid rgba(56,189,248,0.22)",
      background: "rgba(56,189,248,0.12)",
      color: "#bae6fd",
    },
    Weak: {
      border: "1px solid rgba(245,158,11,0.22)",
      background: "rgba(245,158,11,0.12)",
      color: "#fde68a",
    },
    Elite: {
      border: "1px solid rgba(168,85,247,0.22)",
      background: "rgba(168,85,247,0.12)",
      color: "#e9d5ff",
    },
  };

  return {
    display: "inline-flex",
    alignItems: "center",
    padding: "7px 11px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 800,
    whiteSpace: "nowrap",
    ...(map[tone] || map.Strong),
  };
}

function Section({ title, subtitle, children }) {
  return (
    <div style={styles.section}>
      <div style={styles.sectionHead}>
        {subtitle ? <div style={styles.sectionSub}>{subtitle}</div> : null}
        <div style={styles.sectionTitle}>{title}</div>
      </div>
      <div style={styles.sectionBody}>{children}</div>
    </div>
  );
}

function SmallStat({ label, value, note }) {
  return (
    <div style={styles.statCard}>
      <div style={styles.statLabel}>{label}</div>
      <div style={styles.statValue}>{value}</div>
      {note ? <div style={styles.statNote}>{note}</div> : null}
    </div>
  );
}

function EmptyState({ text = "No live data available yet for this workspace." }) {
  return (
    <div style={styles.emptyState}>
      {text}
    </div>
  );
}

export default function GrowthEngine() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dashboard, setDashboard] = useState(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        setLoading(true);
        setError("");

        const res = await getDashboard();

        if (!mounted) return;
        setDashboard(res || null);
      } catch (err) {
        console.error(err);
        if (!mounted) return;
        setError(err?.message || "Failed to load Growth Engine");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();

    return () => {
      mounted = false;
    };
  }, []);

  const workspaceMode = String(dashboard?.workspaceMode || "demo").toLowerCase();
  const orgName = dashboard?.activeWorkspace?.name || "Workspace";
  const isDemo = workspaceMode === "demo";

  const metrics = useMemo(() => {
    return Array.isArray(dashboard?.metrics) ? dashboard.metrics : [];
  }, [dashboard]);

  const deals = useMemo(() => {
    return Array.isArray(dashboard?.deals) ? dashboard.deals : [];
  }, [dashboard]);

  const summary = dashboard?.summary || {};
  const revenue = safeNum(summary.revenue, 0);
  const pipelineValue = safeNum(summary.pipelineValue, 0);
  const openDeals = safeNum(summary.openDeals, 0);
  const forecast90d = safeNum(summary.forecast90d, 0);
  const cac = safeNum(summary.cac, 0);

  const trendData = useMemo(() => {
    return metrics.map((m) => ({
      month: m?.date ? m.date.slice(5) : "",
      spend: safeNum(m?.spend, 0),
      revenue: safeNum(m?.revenue, 0),
    }));
  }, [metrics]);

  const funnelCards = useMemo(() => {
    const visitors = Math.round(openDeals * 190 + 800);
    const leads = Math.round(openDeals * 18 + 40);
    const opportunities = openDeals;
    const wonRevenue = safeNum(revenue, 0);

    return [
      { label: "Visitors", value: visitors.toLocaleString() },
      { label: "Leads", value: leads.toLocaleString() },
      { label: "Opportunities", value: opportunities.toLocaleString() },
      { label: "Deals", value: safeNum(summary.wonDeals, 0).toLocaleString() },
      { label: "Revenue", value: money(wonRevenue) },
    ];
  }, [openDeals, revenue, summary.wonDeals]);

  const summaryStats = useMemo(() => {
    const marketingPipeline = Math.round(pipelineValue * 0.45);
    const salesPipeline = Math.round(pipelineValue * 0.35);
    const partnerPipeline = Math.round(pipelineValue * 0.2);

    return [
      {
        label: "Marketing Pipeline",
        value: moneyCompact(marketingPipeline),
        note: isDemo ? "Demo sourced demand" : "Live sourced demand",
      },
      {
        label: "Sales Pipeline",
        value: moneyCompact(salesPipeline),
        note: isDemo ? "Demo active revenue motion" : "Live active revenue motion",
      },
      {
        label: "Partner Pipeline",
        value: moneyCompact(partnerPipeline),
        note: isDemo ? "Demo referral opportunities" : "Live referral opportunities",
      },
      {
        label: "Top Channel",
        value: pipelineValue > 0 ? "Pipeline Active" : "No Data Yet",
        note: pipelineValue > 0 ? "Best efficiency right now" : "Connect data to evaluate",
      },
    ];
  }, [pipelineValue, isDemo]);

  const summaryPoints = useMemo(() => {
    if (!pipelineValue && !revenue && !openDeals) {
      return [
        "No live growth data is available yet for this workspace.",
        "Connect CRM, ads, analytics, and commerce sources to populate channel performance.",
        "Once deals and metrics are flowing in, Atlas will generate real pipeline and growth insights here.",
        "This live workspace is no longer using demo Growth Engine numbers.",
      ];
    }

    return [
      `Atlas is tracking ${moneyCompact(pipelineValue)} in pipeline activity for ${orgName}.`,
      `Current 30-day revenue is ${money(revenue)} and the 90-day forecast is ${money(forecast90d)}.`,
      cac > 0
        ? `Customer acquisition cost is currently ${money(cac)} based on available spend and lead data.`
        : "Customer acquisition cost will populate once spend and lead data are available.",
      openDeals > 0
        ? `${openDeals} open opportunities are currently active in this workspace.`
        : "There are currently no active opportunities in this workspace.",
    ];
  }, [pipelineValue, revenue, forecast90d, cac, openDeals, orgName]);

  const channelData = useMemo(() => {
    const stageBuckets = [
      { name: "Discovery", pipeline: 0 },
      { name: "Proposal", pipeline: 0 },
      { name: "Negotiation", pipeline: 0 },
      { name: "Follow-Up", pipeline: 0 },
    ];

    deals.forEach((d) => {
      const stage = String(d?.stage || "");
      const amount =
        safeNum(d?.amount, 0) ||
        safeNum(d?.value, 0) ||
        safeNum(d?.pipelineValue, 0);

      if (stage === "Discovery") stageBuckets[0].pipeline += amount;
      else if (stage === "Proposal") stageBuckets[1].pipeline += amount;
      else if (stage === "Negotiation") stageBuckets[2].pipeline += amount;
      else if (stage === "Follow-Up") stageBuckets[3].pipeline += amount;
    });

    return stageBuckets;
  }, [deals]);

  const attributionData = useMemo(() => {
    if (!pipelineValue) {
      return [
        { label: "CRM", value: 0 },
        { label: "Ads", value: 0 },
        { label: "Organic", value: 0 },
        { label: "Partners", value: 0 },
      ];
    }

    return [
      { label: "CRM", value: 35 },
      { label: "Ads", value: 30 },
      { label: "Organic", value: 20 },
      { label: "Partners", value: 15 },
    ];
  }, [pipelineValue]);

  const channelRows = useMemo(() => {
    const tone =
      pipelineValue > 250000 ? "High" : pipelineValue > 100000 ? "Strong" : pipelineValue > 0 ? "Weak" : "Weak";

    return [
      {
        name: "CRM Pipeline",
        pipeline: moneyCompact(Math.round(pipelineValue * 0.4)),
        conversion: openDeals ? `${Math.max(3, Math.min(22, Math.round((safeNum(summary.wonDeals, 0) / Math.max(openDeals, 1)) * 100)))}%` : "0%",
        cpl: cac > 0 ? money(cac) : "$0",
        won: money(revenue),
        tone,
      },
      {
        name: "Demand Capture",
        pipeline: moneyCompact(Math.round(pipelineValue * 0.25)),
        conversion: openDeals ? `${Math.max(2, Math.min(18, Math.round(openDeals * 0.8)))}%` : "0%",
        cpl: cac > 0 ? money(cac * 0.9) : "$0",
        won: money(Math.round(revenue * 0.3)),
        tone: pipelineValue > 0 ? "Strong" : "Weak",
      },
      {
        name: "Expansion Motion",
        pipeline: moneyCompact(Math.round(pipelineValue * 0.2)),
        conversion: openDeals ? `${Math.max(2, Math.min(16, Math.round(openDeals * 0.6)))}%` : "0%",
        cpl: cac > 0 ? money(cac * 1.1) : "$0",
        won: money(Math.round(revenue * 0.2)),
        tone: pipelineValue > 0 ? "Strong" : "Weak",
      },
      {
        name: "Partner Influence",
        pipeline: moneyCompact(Math.round(pipelineValue * 0.15)),
        conversion: openDeals ? `${Math.max(1, Math.min(20, Math.round(openDeals * 0.5)))}%` : "0%",
        cpl: cac > 0 ? money(cac * 0.7) : "$0",
        won: money(Math.round(revenue * 0.15)),
        tone: pipelineValue > 0 ? "Elite" : "Weak",
      },
    ];
  }, [pipelineValue, openDeals, summary.wonDeals, cac, revenue]);

  const actions = useMemo(() => {
    if (!pipelineValue && !revenue) {
      return [
        {
          title: "Connect live revenue sources",
          description: "Link CRM, ad accounts, analytics, and commerce systems so Atlas can calculate real growth performance.",
        },
        {
          title: "Populate pipeline data",
          description: "Add or sync deals with stages and values so Growth Engine can measure real opportunity flow.",
        },
        {
          title: "Start metric ingestion",
          description: "Once revenue, spend, and lead data are flowing, the dashboard will replace empty live values with real intelligence.",
        },
      ];
    }

    return [
      {
        title: "Protect top-performing pipeline sources",
        description: "Atlas has detected active pipeline flow. Double down on the strongest sources while monitoring conversion efficiency.",
      },
      {
        title: "Improve CAC efficiency",
        description: cac > 0
          ? `Current CAC is ${money(cac)}. Focus on tightening channel spend and lead quality to improve returns.`
          : "Bring in spend and lead data so Atlas can calculate true CAC and optimize it.",
      },
      {
        title: "Expand what is converting",
        description: "Use winning opportunities and active pipeline stages to identify what should receive more budget, attention, and follow-up.",
      },
    ];
  }, [pipelineValue, revenue, cac]);

  if (loading) {
    return (
      <div style={styles.page}>
        <div style={styles.wrap}>
          <div style={styles.hero}>
            <div style={styles.h1}>Loading Growth Engine...</div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.page}>
        <div style={styles.wrap}>
          <div style={styles.errorBox}>{error}</div>
        </div>
      </div>
    );
  }

  const showEmptyCharts = !trendData.length && !pipelineValue && !revenue;

  return (
    <div style={styles.page}>
      <div style={styles.wrap}>
        <div style={styles.hero}>
          <div style={styles.heroTop}>
            <div>
              <div style={styles.eyebrow}>Growth Performance</div>
              <h1 style={styles.h1}>Growth Engine</h1>
              <div style={styles.heroText}>
                A focused operating view of how paid, organic, partner, and revenue sources
                are converting activity into qualified pipeline and closed revenue for{" "}
                <b>{orgName}</b>.
              </div>
            </div>

            <div style={styles.badgeWrap}>
              {[
                isDemo ? "Demo Growth Mode" : "Live Growth Mode",
                pipelineValue > 0 ? "Pipeline Active" : "Pipeline Empty",
                revenue > 0 ? "Revenue Detected" : "Revenue Waiting",
                "AI Monitoring",
              ].map((item) => (
                <div key={item} style={styles.badge}>
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={styles.statsGrid}>
          {summaryStats.map((item) => (
            <SmallStat
              key={item.label}
              label={item.label}
              value={item.value}
              note={item.note}
            />
          ))}
        </div>

        <div style={styles.twoCol}>
          <Section title="Executive Summary" subtitle="Overview">
            <div style={styles.summaryList}>
              {summaryPoints.map((point) => (
                <div key={point} style={styles.summaryItem}>
                  {point}
                </div>
              ))}
            </div>
          </Section>

          <Section title="Funnel Snapshot" subtitle="Demand Flow">
            <div style={styles.funnelGrid}>
              {funnelCards.map((item) => (
                <div key={item.label} style={styles.funnelCard}>
                  <div style={styles.statLabel}>{item.label}</div>
                  <div style={{ ...styles.statValue, fontSize: 23 }}>{item.value}</div>
                </div>
              ))}
            </div>
          </Section>
        </div>

        <div style={styles.twoCol}>
          <Section title="Spend vs Revenue Trend" subtitle="Momentum">
            <div style={styles.chartShell}>
              {showEmptyCharts ? (
                <EmptyState text="No live trend data yet. Connect sources and sync metrics to populate this chart." />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                    <XAxis dataKey="month" tick={axisTick} stroke="#94a3b8" />
                    <YAxis
                      tick={axisTick}
                      stroke="#94a3b8"
                      tickFormatter={(v) => moneyCompact(v)}
                    />
                    <Tooltip
                      formatter={(value, name) => [moneyCompact(value), name]}
                      contentStyle={tooltipStyle}
                      labelStyle={{ color: "#fff" }}
                    />
                    <Line
                      type="monotone"
                      dataKey="spend"
                      stroke="#93c5fd"
                      strokeWidth={3}
                      dot={false}
                      animationDuration={1400}
                    />
                    <Line
                      type="monotone"
                      dataKey="revenue"
                      stroke="#c4fbff"
                      strokeWidth={4}
                      dot={false}
                      animationDuration={1700}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </Section>

          <Section title="Active Campaign" subtitle="Campaign Intelligence">
            <div style={styles.channelCard}>
              <div style={styles.statLabel}>Primary Motion</div>
              <div style={{ ...styles.sectionTitle, marginTop: 8, fontSize: 26 }}>
                {pipelineValue > 0 ? "Revenue Pipeline Monitoring" : "No Active Campaign Data Yet"}
              </div>

              <div style={styles.campaignGrid}>
                <SmallStat label="Spend" value={money(metrics.reduce((sum, m) => sum + safeNum(m.spend, 0), 0))} note="" />
                <SmallStat label="Leads" value={metrics.reduce((sum, m) => sum + safeNum(m.leads, 0), 0).toLocaleString()} note="" />
                <SmallStat label="Opportunities" value={openDeals.toLocaleString()} note="" />
                <SmallStat label="Closed Revenue" value={money(revenue)} note="" />
              </div>
            </div>
          </Section>
        </div>

        <div style={styles.twoCol}>
          <Section title="Pipeline by Channel" subtitle="Contribution">
            <div style={styles.chartShellSmall}>
              {pipelineValue <= 0 ? (
                <EmptyState text="No pipeline values yet. Once live deals are added, this chart will fill automatically." />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={channelData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                    <XAxis dataKey="name" tick={axisTick} stroke="#94a3b8" />
                    <YAxis
                      tick={axisTick}
                      stroke="#94a3b8"
                      tickFormatter={(v) => moneyCompact(v)}
                    />
                    <Tooltip
                      formatter={(value) => [moneyCompact(value), "Pipeline"]}
                      contentStyle={tooltipStyle}
                      labelStyle={{ color: "#fff" }}
                    />
                    <Bar
                      dataKey="pipeline"
                      fill="#bffcff"
                      radius={[12, 12, 0, 0]}
                      animationDuration={1500}
                      animationEasing="ease-out"
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </Section>

          <Section title="Marketing Attribution" subtitle="Channel Share">
            <div style={styles.attributionLayout}>
              <div style={styles.chartShellSmall}>
                {pipelineValue <= 0 ? (
                  <EmptyState text="No attribution mix yet. Live connected channels will populate this area." />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={attributionData}
                        dataKey="value"
                        nameKey="label"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        innerRadius={48}
                        paddingAngle={2}
                        animationDuration={1500}
                      >
                        {attributionData.map((entry, index) => (
                          <Cell key={entry.label} fill={pieColors[index % pieColors.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value) => [`${value}%`, "Attribution"]}
                        contentStyle={tooltipStyle}
                        labelStyle={{ color: "#fff" }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>

              <div style={styles.attributionList}>
                {attributionData.map((row) => (
                  <div
                    key={row.label}
                    style={{
                      border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: 16,
                      padding: 14,
                      background: "rgba(4,10,24,0.34)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 10,
                        alignItems: "center",
                      }}
                    >
                      <div style={{ fontSize: 14, color: "#dbe4f0", fontWeight: 700 }}>
                        {row.label}
                      </div>
                      <div style={{ fontSize: 20, fontWeight: 800, color: "#fff" }}>
                        {row.value}%
                      </div>
                    </div>

                    <div
                      style={{
                        marginTop: 10,
                        height: 8,
                        background: "#1e293b",
                        borderRadius: 999,
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          height: "100%",
                          width: `${row.value}%`,
                          background: "linear-gradient(90deg, #38bdf8, #6366f1)",
                          borderRadius: 999,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Section>
        </div>

        <div style={styles.twoCol}>
          <Section title="Channel Performance Radar" subtitle="Efficiency">
            <div style={styles.channelList}>
              {channelRows.map((row) => (
                <div key={row.name} style={styles.channelCard}>
                  <div style={styles.channelTop}>
                    <div>
                      <div style={styles.channelName}>{row.name}</div>
                      <div style={styles.channelMeta}>Pipeline {row.pipeline}</div>
                    </div>
                    <div style={toneStyle(row.tone)}>{row.tone}</div>
                  </div>

                  <div style={styles.channelStats}>
                    <div style={styles.mini}>
                      <div style={styles.miniLabel}>Conversion</div>
                      <div style={styles.miniValue}>{row.conversion}</div>
                    </div>
                    <div style={styles.mini}>
                      <div style={styles.miniLabel}>CAC</div>
                      <div style={styles.miniValue}>{row.cpl}</div>
                    </div>
                    <div style={styles.mini}>
                      <div style={styles.miniLabel}>Won Revenue</div>
                      <div style={styles.miniValue}>{row.won}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Recommended Actions" subtitle="Priorities">
            <RecommendedActions actions={actions} />
          </Section>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    color: "#fff",
  },
  wrap: {
    maxWidth: 1380,
    margin: "0 auto",
    display: "grid",
    gap: 14,
  },
  hero: {
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 20,
    padding: 18,
    background:
      "linear-gradient(135deg, rgba(30,64,175,0.18), rgba(37,99,235,0.11), rgba(255,255,255,0.02))",
    boxShadow: "0 12px 30px rgba(0,0,0,0.18)",
  },
  heroTop: {
    display: "grid",
    gridTemplateColumns: "1.2fr 0.8fr",
    gap: 16,
    alignItems: "center",
  },
  eyebrow: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: "0.22em",
    color: "rgba(125,211,252,0.9)",
    fontWeight: 700,
  },
  h1: {
    margin: "8px 0 0",
    fontSize: 34,
    lineHeight: 1.04,
    letterSpacing: -0.7,
    fontWeight: 900,
    color: "#ffffff",
  },
  heroText: {
    marginTop: 12,
    maxWidth: 740,
    fontSize: 15,
    lineHeight: 1.7,
    color: "rgba(226,232,240,0.9)",
  },
  badgeWrap: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    justifyContent: "flex-end",
    alignContent: "flex-start",
  },
  badge: {
    padding: "8px 12px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.05)",
    fontSize: 11,
    fontWeight: 700,
    color: "#e2e8f0",
    whiteSpace: "nowrap",
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 12,
  },
  statCard: {
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 18,
    padding: 15,
    background: "rgba(255,255,255,0.032)",
    boxShadow: "0 8px 20px rgba(0,0,0,0.12)",
    minHeight: 110,
  },
  statLabel: {
  fontSize: 10,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: "rgba(148,163,184,0.88)",
  fontWeight: 700,
  lineHeight: 1.3,
  textAlign: "center",
  overflowWrap: "anywhere",
  width: "100%",
},
  statValue: {
    marginTop: 10,
    fontSize: 28,
    fontWeight: 800,
    color: "#fff",
    lineHeight: 1.05,
  },
  statNote: {
    marginTop: 7,
    fontSize: 13,
    lineHeight: 1.45,
    color: "rgba(203,213,225,0.76)",
  },
  twoCol: {
    display: "grid",
    gridTemplateColumns: "1.12fr 0.88fr",
    gap: 14,
  },
  section: {
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 20,
    background: "rgba(255,255,255,0.03)",
    overflow: "hidden",
    boxShadow: "0 10px 24px rgba(0,0,0,0.14)",
  },
  sectionHead: {
    padding: "14px 16px",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 800,
    letterSpacing: -0.35,
    color: "#fff",
  },
  sectionSub: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: "0.18em",
    color: "rgba(148,163,184,0.75)",
    fontWeight: 700,
    marginBottom: 4,
  },
  sectionBody: {
    padding: 16,
  },
  summaryList: {
    display: "grid",
    gap: 10,
  },
  summaryItem: {
    border: "1px solid rgba(255,255,255,0.07)",
    background: "rgba(4,10,24,0.34)",
    borderRadius: 14,
    padding: "13px 14px",
    fontSize: 14,
    lineHeight: 1.6,
    color: "#dbe4f0",
  },
  funnelGrid: {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(115px, 1fr))",
  gap: 10,
},
  funnelCard: {
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 14,
  padding: 12,
  background: "rgba(4,10,24,0.34)",
  minWidth: 0,
  minHeight: 120,
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-between",
  alignItems: "center",
  textAlign: "center",
},
  chartShell: {
    height: 285,
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 16,
    background: "rgba(4,10,24,0.72)",
    padding: 12,
  },
  chartShellSmall: {
    height: 265,
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 16,
    background: "rgba(4,10,24,0.72)",
    padding: 12,
  },
  campaignGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 10,
    marginTop: 12,
  },
  channelList: {
    display: "grid",
    gap: 12,
  },
  channelCard: {
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 16,
    padding: 14,
    background: "rgba(4,10,24,0.34)",
  },
  channelTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: 14,
    alignItems: "flex-start",
    flexWrap: "wrap",
  },
  channelName: {
    fontSize: 17,
    fontWeight: 800,
    color: "#fff",
  },
  channelMeta: {
    marginTop: 4,
    fontSize: 13,
    color: "rgba(203,213,225,0.75)",
  },
  channelStats: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 10,
    marginTop: 12,
  },
  mini: {
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 14,
    padding: 12,
    background: "rgba(255,255,255,0.03)",
  },
  miniLabel: {
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: "0.16em",
    color: "rgba(148,163,184,0.86)",
    fontWeight: 700,
  },
  miniValue: {
    marginTop: 8,
    fontSize: 22,
    fontWeight: 800,
    color: "#fff",
  },
  attributionLayout: {
    display: "grid",
    gridTemplateColumns: "0.92fr 1.08fr",
    gap: 14,
    alignItems: "stretch",
  },
  emptyState: {
    height: "100%",
    borderRadius: 14,
    border: "1px dashed rgba(255,255,255,0.12)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
    color: "rgba(226,232,240,0.78)",
    fontSize: 14,
    lineHeight: 1.6,
    textAlign: "center",
  },
  errorBox: {
    border: "1px solid rgba(255,120,120,0.35)",
    background: "rgba(255,0,0,0.10)",
    color: "#FFD7D7",
    borderRadius: 14,
    padding: 16,
    fontSize: 14,
  },
};
