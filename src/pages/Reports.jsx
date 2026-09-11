import React, { useEffect, useMemo, useState } from "react";
import MetricCard from "../components/atlas/MetricCard";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import { getDashboard } from "../api";

const axisTick = { fill: "#9fb0d0", fontSize: 11 };

const tooltipStyle = {
  background: "rgba(7,11,24,0.96)",
  border: "1px solid rgba(255,255,255,0.10)",
  borderRadius: "14px",
  color: "#fff",
};

const safeNum = (v, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const pct = (v, fallback = 0) => `${safeNum(v, fallback)}%`;

const moneyCompact = (num) => {
  const n = safeNum(num);
  if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `$${(n / 1000).toFixed(0)}K`;
  return `$${n}`;
};

const getMonthLabel = (raw) => {
  if (!raw) return "";
  try {
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString("en-US", { month: "short" });
    }
  } catch {}
  if (typeof raw === "string" && raw.length >= 7) return raw.slice(5, 7);
  return String(raw);
};

const downloadTextFile = (filename, content) => {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

const styles = {
  page: {
    minHeight: "100vh",
    color: "#EAF0FF",
    padding: "14px 16px 24px",
    background:
      "radial-gradient(900px 500px at 15% 0%, rgba(37,99,235,0.18), transparent 55%), radial-gradient(900px 500px at 85% 0%, rgba(124,92,255,0.14), transparent 55%), linear-gradient(180deg, #050814 0%, #070b18 100%)",
  },
  wrap: {
    maxWidth: 1380,
    margin: "0 auto",
    display: "grid",
    gap: 12,
  },
  hero: {
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 20,
    padding: "18px 20px",
    background:
      "linear-gradient(135deg, rgba(30,64,175,0.18), rgba(37,99,235,0.10), rgba(255,255,255,0.02))",
    boxShadow: "0 12px 30px rgba(0,0,0,0.18)",
  },
  heroTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
    alignItems: "flex-start",
  },
  eyebrow: {
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: "0.18em",
    color: "rgba(125,211,252,0.9)",
    fontWeight: 800,
  },
  h1: {
    margin: "6px 0 0",
    fontSize: 28,
    lineHeight: 1.05,
    letterSpacing: -0.6,
    fontWeight: 900,
    color: "#ffffff",
  },
  heroText: {
    marginTop: 8,
    maxWidth: 760,
    fontSize: 14,
    lineHeight: 1.55,
    color: "rgba(226,232,240,0.90)",
  },
  badgeWrap: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    justifyContent: "flex-end",
    alignContent: "flex-start",
  },
  badge: {
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.05)",
    fontSize: 11,
    fontWeight: 700,
    color: "#e2e8f0",
    whiteSpace: "nowrap",
  },
  signalGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 10,
  },
  signalCard: {
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 16,
    padding: 14,
    background: "rgba(255,255,255,0.032)",
    boxShadow: "0 8px 18px rgba(0,0,0,0.12)",
  },
  signalTitle: {
    fontSize: 16,
    fontWeight: 800,
    color: "#fff",
  },
  signalBody: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 1.55,
    color: "rgba(203,213,225,0.78)",
  },
  statsWrap: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 10,
  },
  twoCol: {
    display: "grid",
    gridTemplateColumns: "1.15fr 0.85fr",
    gap: 12,
  },
  section: {
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 18,
    background: "rgba(255,255,255,0.03)",
    overflow: "hidden",
    boxShadow: "0 10px 24px rgba(0,0,0,0.14)",
  },
  sectionHead: {
    padding: "12px 14px",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 800,
    letterSpacing: -0.4,
    color: "#fff",
  },
  sectionSub: {
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: "0.16em",
    color: "rgba(148,163,184,0.75)",
    fontWeight: 700,
    marginBottom: 4,
  },
  sectionBody: {
    padding: 14,
  },
  chartShell: {
    height: 260,
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 16,
    background: "rgba(4,10,24,0.72)",
    padding: 10,
  },
  insightStack: {
    display: "grid",
    gap: 10,
  },
  insightItem: {
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(4,10,24,0.34)",
    borderRadius: 14,
    padding: "13px 14px",
    fontSize: 13,
    lineHeight: 1.55,
    color: "#dbe4f0",
  },
  reportGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 12,
  },
  reportCard: {
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 16,
    padding: 14,
    background: "rgba(4,10,24,0.34)",
  },
  reportTitle: {
    fontSize: 16,
    fontWeight: 800,
    color: "#fff",
  },
  reportBody: {
    marginTop: 7,
    fontSize: 13,
    lineHeight: 1.55,
    color: "rgba(219,228,240,0.84)",
  },
  reportMeta: {
    marginTop: 8,
    fontSize: 12,
    color: "rgba(148,163,184,0.82)",
  },
  buttonRow: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    marginTop: 14,
  },
  primaryBtn: {
    border: "1px solid rgba(96,165,250,0.34)",
    borderRadius: 10,
    padding: "10px 14px",
    background: "#2563eb",
    color: "#fff",
    fontWeight: 800,
    fontSize: 13,
    cursor: "pointer",
  },
  secondaryBtn: {
    border: "1px solid rgba(255,255,255,0.10)",
    borderRadius: 10,
    padding: "10px 14px",
    background: "rgba(255,255,255,0.05)",
    color: "#fff",
    fontWeight: 700,
    fontSize: 13,
    cursor: "pointer",
  },
  disabledBtn: {
    opacity: 0.65,
    cursor: "not-allowed",
  },
  bulletStack: {
    display: "grid",
    gap: 10,
  },
  bulletRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: 12,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(4,10,24,0.34)",
    borderRadius: 14,
    padding: "12px 13px",
  },
  bulletDot: {
    width: 24,
    height: 24,
    borderRadius: 999,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(56,189,248,0.15)",
    color: "#7dd3fc",
    fontWeight: 800,
    fontSize: 12,
    flexShrink: 0,
    marginTop: 2,
  },
  useCaseGrid: {
    display: "grid",
    gap: 10,
  },
  useCaseCard: {
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 14,
    padding: "12px 13px",
    background: "rgba(4,10,24,0.34)",
  },
  useCaseTitle: {
    fontSize: 15,
    fontWeight: 800,
    color: "#fff",
  },
  useCaseBody: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 1.55,
    color: "rgba(219,228,240,0.84)",
  },
  emptyState: {
    minHeight: 180,
    border: "1px dashed rgba(255,255,255,0.12)",
    borderRadius: 14,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
    color: "rgba(226,232,240,0.78)",
    fontSize: 14,
    lineHeight: 1.6,
    textAlign: "center",
    background: "rgba(4,10,24,0.34)",
  },
  errorBox: {
    border: "1px solid rgba(255,120,120,0.35)",
    background: "rgba(255,0,0,0.10)",
    color: "#FFD7D7",
    borderRadius: 14,
    padding: 16,
    fontSize: 14,
  },
  benchmarkGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 12,
  },
  benchmarkCard: {
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 16,
    padding: 14,
    background:
      "linear-gradient(135deg, rgba(37,99,235,0.18), rgba(29,78,216,0.08), rgba(255,255,255,0.03))",
  },
  benchmarkLabel: {
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: "0.16em",
    color: "rgba(186,230,253,0.92)",
    fontWeight: 800,
    marginBottom: 10,
  },
  benchmarkRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 8,
    alignItems: "center",
  },
  benchmarkName: {
    color: "#e5edf8",
    fontSize: 13,
    fontWeight: 700,
  },
  benchmarkSub: {
    color: "rgba(203,213,225,0.76)",
    fontSize: 12,
  },
  benchmarkValue: {
    color: "#fff",
    fontSize: 14,
    fontWeight: 900,
    whiteSpace: "nowrap",
  },
  modalBackdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(2,6,23,0.72)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    zIndex: 1000,
  },
  modalCard: {
    width: "min(840px, 100%)",
    maxHeight: "88vh",
    overflowY: "auto",
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "linear-gradient(180deg, rgba(10,15,31,0.98), rgba(5,10,22,0.98))",
    boxShadow: "0 30px 80px rgba(0,0,0,0.45)",
    padding: 18,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 900,
    color: "#fff",
    marginBottom: 8,
  },
  modalSub: {
    color: "rgba(203,213,225,0.82)",
    fontSize: 14,
    lineHeight: 1.7,
    marginBottom: 18,
  },
  modalBlock: {
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 16,
    padding: 14,
    background: "rgba(255,255,255,0.03)",
    marginBottom: 12,
  },
  modalBlockTitle: {
    fontSize: 15,
    fontWeight: 800,
    color: "#fff",
    marginBottom: 8,
  },
  modalList: {
    margin: 0,
    paddingLeft: 18,
    color: "#dbe4f0",
    lineHeight: 1.8,
    fontSize: 14,
  },
  modalCloseRow: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 18,
  },
};

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

function InsightStack({ items = [] }) {
  return (
    <div style={styles.insightStack}>
      {items.map((item) => (
        <div key={item} style={styles.insightItem}>
          {item}
        </div>
      ))}
    </div>
  );
}

function EmptyState({ text }) {
  return <div style={styles.emptyState}>{text}</div>;
}

function AtlasBenchmarksSection({ orgName, isDemo, hasLiveData, benchmarkCards }) {
  return (
    <Section title="Atlas Market Benchmarks" subtitle="Comparative View">
      {(!isDemo && !hasLiveData) ? (
        <EmptyState text="No live benchmark data yet. Once sales, revenue, and pipeline signals are flowing, Atlas will compare this workspace against market benchmark ranges." />
      ) : (
        <div style={styles.benchmarkGrid}>
          {benchmarkCards.map((card) => (
            <div key={card.title} style={styles.benchmarkCard}>
              <div style={styles.benchmarkLabel}>{card.title}</div>

              <div style={styles.benchmarkRow}>
                <div style={styles.benchmarkName}>{orgName}</div>
                <div style={styles.benchmarkValue}>{card.company}</div>
              </div>

              <div style={styles.benchmarkRow}>
                <div style={styles.benchmarkSub}>Industry Avg</div>
                <div style={styles.benchmarkSub}>{card.industry}</div>
              </div>

              <div style={styles.benchmarkRow}>
                <div style={styles.benchmarkSub}>Top Quartile</div>
                <div style={styles.benchmarkSub}>{card.topQuartile}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

export default function Reports() {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [previewReport, setPreviewReport] = useState(null);
  const [generatingTitle, setGeneratingTitle] = useState("");

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        setLoading(true);
        setLoadError("");
        const res = await getDashboard();
        if (!mounted) return;
        setDashboard(res || null);
      } catch (err) {
        console.error(err);
        if (!mounted) return;
        setLoadError(err?.message || "Failed to load Reports");
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
  const isDemo = workspaceMode === "demo";

  const orgName =
    dashboard?.activeWorkspace?.name ||
    dashboard?.activeOrg?.name ||
    dashboard?.organization?.name ||
    "Your Company";

  const summary = dashboard?.summary || {};
  const revenue = safeNum(summary.revenue, 0);
  const pipelineValue = safeNum(summary.pipelineValue, 0);
  const forecast90d = safeNum(summary.forecast90d, 0);
  const revenueHealth = safeNum(summary.revenueHealth, 0);
  const openDeals = safeNum(summary.openDeals, 0);
  const forecastConfidence = safeNum(
    summary.forecastConfidence,
    isDemo ? 78 : Math.max(0, Math.min(100, revenueHealth || 0))
  );
  const customerAcquisitionCost = safeNum(
    summary.customerAcquisitionCost ?? summary.cac,
    isDemo ? 740 : 0
  );
  const dealVelocityDays = safeNum(
    summary.dealVelocityDays ?? summary.dealVelocity,
    isDemo ? 34 : 0
  );

  const metrics = Array.isArray(dashboard?.metrics) ? dashboard.metrics : [];
  const hasLiveData =
    revenue > 0 ||
    pipelineValue > 0 ||
    forecast90d > 0 ||
    metrics.length > 0 ||
    openDeals > 0 ||
    revenueHealth > 0;

  const executiveSignals = useMemo(() => {
    if (isDemo) {
      return [
        {
          title: "Board-ready reporting",
          body: "Summaries built around revenue, risk, and decisions.",
        },
        {
          title: "Executive narrative",
          body: "Translate raw platform data into strategic reporting.",
        },
        {
          title: "Revenue-linked analysis",
          body: "Tie sales, marketing, pipeline, and forecast together.",
        },
      ];
    }

    if (!hasLiveData) {
      return [
        {
          title: "Live reporting active",
          body: "This workspace is in live mode and no longer using demo report values.",
        },
        {
          title: "Awaiting source data",
          body: "Connect revenue, pipeline, and forecast inputs to generate executive-grade reporting.",
        },
        {
          title: "Board output pending",
          body: "Once data is flowing, Atlas will assemble briefings and summaries from live workspace intelligence.",
        },
      ];
    }

    return [
      {
        title: "Board-ready reporting",
        body: `Atlas is compiling live summaries around ${moneyCompact(revenue)} in revenue and ${moneyCompact(pipelineValue)} in pipeline.`,
      },
      {
        title: "Executive narrative",
        body: `Live workspace reporting is translating current performance into leadership-ready language for ${orgName}.`,
      },
      {
        title: "Revenue-linked analysis",
        body: `Forecast, pipeline, and revenue signals are now being tied together from live workspace inputs.`,
      },
    ];
  }, [isDemo, hasLiveData, revenue, pipelineValue, orgName]);

  const reportTypes = [
    {
      key: "board-report",
      title: "Board Report",
      description:
        "High-level reporting focused on revenue trend, forecast confidence, risk concentration, and strategic action.",
      meta: "Best for board meetings and investor updates",
    },
    {
      key: "revenue-summary",
      title: "Revenue Summary",
      description:
        "A concise snapshot of pipeline coverage, current momentum, and modeled executive outlook.",
      meta: "Best for weekly and monthly revenue reviews",
    },
    {
      key: "sales-review",
      title: "Sales Review",
      description:
        "Deal movement, stage pressure, close readiness, and execution risks across the revenue board.",
      meta: "Best for sales leadership and forecast calls",
    },
    {
      key: "marketing-impact",
      title: "Marketing Impact",
      description:
        "Channel performance tied directly to opportunity creation, efficiency, and revenue contribution.",
      meta: "Best for growth and channel reporting",
    },
  ];

  const aiInsights = useMemo(() => {
    if (isDemo) {
      return [
        "Leadership reporting should lead with trend direction, risk concentration, and the decisions required next.",
        "Revenue summaries are strongest when they stay tight around forecast confidence, coverage, and momentum.",
        "Sales reviews should emphasize stage friction, blocker ownership, and next-step accountability.",
        "Marketing reporting should show pipeline and revenue influence, not just activity volume.",
      ];
    }

    if (!hasLiveData) {
      return [
        "This live workspace is not using hardcoded reporting demo numbers anymore.",
        "No live revenue and pipeline data has been detected yet for report generation.",
        "Once metrics and opportunities are flowing, Atlas will generate executive summaries from real workspace signals.",
        "Reporting quality improves when revenue, forecast, and pipeline inputs are connected together.",
      ];
    }

    return [
      `Leadership reporting for ${orgName} should lead with current revenue of ${moneyCompact(revenue)} and forecast of ${moneyCompact(forecast90d)}.`,
      `Pipeline coverage and stage pressure should remain central because ${openDeals} open opportunities are shaping near-term outcomes.`,
      `Board summaries are strongest when they stay tight around revenue health (${revenueHealth}/100), forecast confidence, and required decisions.`,
      "Atlas should present narrative around what is changing, what is at risk, and what leadership should do next.",
    ];
  }, [isDemo, hasLiveData, orgName, revenue, forecast90d, openDeals, revenueHealth]);

  const briefingSections = [
    "Revenue performance and direction",
    "Forecast confidence and stability",
    "Pipeline health and stage pressure",
    "Top risks impacting near-term outcomes",
    "Leadership priorities and next actions",
  ];

  const trendData = useMemo(() => {
    if (isDemo) {
      return [
        { month: "Jan", revenue: 420000, pipeline: 1800000 },
        { month: "Feb", revenue: 465000, pipeline: 2100000 },
        { month: "Mar", revenue: 510000, pipeline: 2350000 },
        { month: "Apr", revenue: 545000, pipeline: 2480000 },
        { month: "May", revenue: 590000, pipeline: 2720000 },
        { month: "Jun", revenue: 640000, pipeline: 3010000 },
      ];
    }

    return metrics.map((m) => ({
      month: getMonthLabel(m?.date),
      revenue: safeNum(m?.revenue, 0),
      pipeline: safeNum(m?.pipelineValue, 0) || Math.round(pipelineValue / Math.max(metrics.length || 1, 1)),
    }));
  }, [isDemo, metrics, pipelineValue]);

  const reportValueData = useMemo(() => {
    if (isDemo) {
      return [
        { name: "Board", value: 92 },
        { name: "Revenue", value: 86 },
        { name: "Sales", value: 81 },
        { name: "Marketing", value: 78 },
      ];
    }

    if (!hasLiveData) {
      return [
        { name: "Board", value: 0 },
        { name: "Revenue", value: 0 },
        { name: "Sales", value: 0 },
        { name: "Marketing", value: 0 },
      ];
    }

    return [
      { name: "Board", value: Math.max(55, Math.min(98, revenueHealth + 10)) },
      { name: "Revenue", value: Math.max(50, Math.min(96, revenueHealth + 4)) },
      { name: "Sales", value: Math.max(45, Math.min(92, 50 + openDeals * 4)) },
      { name: "Marketing", value: Math.max(40, Math.min(90, metrics.length ? 68 : 40)) },
    ];
  }, [isDemo, hasLiveData, revenueHealth, openDeals, metrics.length]);

  const summaryStats = useMemo(() => {
    if (isDemo) {
      return [
        { label: "Reports Ready", value: "4", subtext: "Prepared for export", accent: "sky" },
        { label: "Forecast Confidence", value: "78%", subtext: "Modeled executive outlook", accent: "emerald" },
        { label: "Revenue Stability", value: "82/100", subtext: "Current operating confidence", accent: "violet" },
        { label: "Board Readiness", value: "High", subtext: "Leadership briefing quality", accent: "amber" },
      ];
    }

    return [
      {
        label: "Reports Ready",
        value: hasLiveData ? "4" : "0",
        subtext: hasLiveData ? "Prepared from live data" : "Waiting for live inputs",
        accent: "sky",
      },
      {
        label: "Forecast Confidence",
        value: hasLiveData ? pct(forecastConfidence) : "0%",
        subtext: hasLiveData ? "Live executive outlook" : "No forecast signal yet",
        accent: "emerald",
      },
      {
        label: "Revenue Stability",
        value: hasLiveData ? `${revenueHealth}/100` : "0/100",
        subtext: hasLiveData ? "Current operating confidence" : "Waiting for revenue stability data",
        accent: "violet",
      },
      {
        label: "Board Readiness",
        value: hasLiveData ? "Live" : "Pending",
        subtext: hasLiveData ? "Leadership briefing quality" : "No live briefing yet",
        accent: "amber",
      },
    ];
  }, [isDemo, hasLiveData, revenueHealth, forecastConfidence]);

  const benchmarkCards = useMemo(() => {
    const pipelineCoverage =
      pipelineValue > 0 && forecast90d > 0
        ? `${(pipelineValue / Math.max(forecast90d, 1)).toFixed(1)}x`
        : isDemo
        ? "2.4x"
        : "0.0x";

    return [
      {
        title: "Pipeline Coverage",
        company: pipelineCoverage,
        industry: "2.9x",
        topQuartile: "4.1x",
      },
      {
        title: "Forecast Confidence",
        company: pct(forecastConfidence, 78),
        industry: "73%",
        topQuartile: "90%",
      },
      {
        title: "Customer Acquisition Cost",
        company: moneyCompact(customerAcquisitionCost),
        industry: "$610",
        topQuartile: "$420",
      },
      {
        title: "Deal Velocity",
        company: `${safeNum(dealVelocityDays, isDemo ? 34 : 0)} days`,
        industry: "41 days",
        topQuartile: "24 days",
      },
    ];
  }, [pipelineValue, forecast90d, isDemo, forecastConfidence, customerAcquisitionCost, dealVelocityDays]);

  const buildReportPreview = (report) => {
    const sections = {
      "Board Report": [
        `Current revenue stands at ${moneyCompact(revenue)} with pipeline at ${moneyCompact(pipelineValue)}.`,
        `Forecast confidence is ${pct(forecastConfidence)} and revenue health is ${revenueHealth}/100.`,
        `Leadership should focus on risk concentration, pipeline quality, and near-term execution pressure.`,
      ],
      "Revenue Summary": [
        `${orgName} currently shows ${moneyCompact(revenue)} in revenue and ${moneyCompact(forecast90d)} in 90-day forecast outlook.`,
        `Pipeline coverage is ${benchmarkCards[0]?.company} with ${openDeals} active open opportunities.`,
        "Momentum, coverage, and forecast stability should remain the center of this review.",
      ],
      "Sales Review": [
        `${openDeals} open deals are influencing short-term outcomes for ${orgName}.`,
        `Deal velocity is currently ${benchmarkCards[3]?.company} and forecast confidence is ${pct(forecastConfidence)}.`,
        "Focus the sales review on stage friction, close readiness, and blocked next steps.",
      ],
      "Marketing Impact": [
        `Atlas is connecting growth performance back to revenue and pipeline for ${orgName}.`,
        `Current pipeline influence is centered around ${moneyCompact(pipelineValue)} in visible opportunity value.`,
        "This report should show contribution to opportunity creation, efficiency, and revenue outcomes.",
      ],
    };

    return {
      title: report.title,
      description: report.description,
      meta: report.meta,
      sections: sections[report.title] || [],
    };
  };

  const handlePreviewReport = (report) => {
    setPreviewReport(buildReportPreview(report));
  };

  const handleGenerateReport = (report) => {
    try {
      setGeneratingTitle(report.title);

      const preview = buildReportPreview(report);
      const content = [
        `${report.title}`,
        `${orgName}`,
        `${new Date().toLocaleString()}`,
        "",
        `${report.description}`,
        `${report.meta}`,
        "",
        "Executive Summary",
        `Revenue: ${moneyCompact(revenue)}`,
        `Pipeline: ${moneyCompact(pipelineValue)}`,
        `90-Day Forecast: ${moneyCompact(forecast90d)}`,
        `Forecast Confidence: ${pct(forecastConfidence)}`,
        `Revenue Health: ${revenueHealth}/100`,
        `Open Deals: ${openDeals}`,
        "",
        "Benchmark View",
        `Pipeline Coverage: ${benchmarkCards[0]?.company}`,
        `Customer Acquisition Cost: ${benchmarkCards[2]?.company}`,
        `Deal Velocity: ${benchmarkCards[3]?.company}`,
        "",
        "Key Narrative",
        ...preview.sections.map((item, idx) => `${idx + 1}. ${item}`),
        "",
        "Recommended Briefing Structure",
        ...briefingSections.map((item, idx) => `${idx + 1}. ${item}`),
      ].join("\n");

      const cleanTitle = report.title.toLowerCase().replace(/\s+/g, "-");
      const cleanOrg = orgName.toLowerCase().replace(/\s+/g, "-");
      downloadTextFile(`${cleanOrg}-${cleanTitle}.txt`, content);
    } catch (err) {
      console.error("Failed to generate report:", err);
      window.alert("Report generation failed. Check console for details.");
    } finally {
      setTimeout(() => setGeneratingTitle(""), 300);
    }
  };

  if (loading) {
    return (
      <div style={styles.page}>
        <div style={styles.wrap}>
          <div style={styles.hero}>
            <h1 style={styles.h1}>Loading Reports...</h1>
          </div>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div style={styles.page}>
        <div style={styles.wrap}>
          <div style={styles.errorBox}>{loadError}</div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.wrap}>
        <div style={styles.hero}>
          <div style={styles.heroTop}>
            <div>
              <div style={styles.eyebrow}>Reporting Layer</div>
              <h1 style={styles.h1}>Reports & Executive Briefings</h1>
              <div style={styles.heroText}>
                Atlas transforms platform intelligence into leadership-ready reporting.
                Prepare board reports, revenue summaries, sales reviews, and marketing
                impact narratives with a cleaner executive view for <b>{orgName}</b>.
              </div>
            </div>

            <div style={styles.badgeWrap}>
              {[
                isDemo ? "Reporting Demo" : "Reporting Live",
                hasLiveData ? "Executive Briefing Ready" : "Briefing Pending",
                "Atlas AI Summarizing",
              ].map((item) => (
                <div key={item} style={styles.badge}>
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>

        <AtlasBenchmarksSection
          orgName={orgName}
          isDemo={isDemo}
          hasLiveData={hasLiveData}
          benchmarkCards={benchmarkCards}
        />

        <div style={styles.signalGrid}>
          {executiveSignals.map((item) => (
            <div key={item.title} style={styles.signalCard}>
              <div style={styles.signalTitle}>{item.title}</div>
              <div style={styles.signalBody}>{item.body}</div>
            </div>
          ))}
        </div>

        <div style={styles.statsWrap}>
          {summaryStats.map((stat) => (
            <MetricCard
              key={stat.label}
              title={stat.label}
              value={stat.value}
              subtext={stat.subtext}
              accent={stat.accent}
            />
          ))}
        </div>

        <div style={styles.twoCol}>
          <Section title="Revenue & Pipeline Snapshot" subtitle="Performance Trend">
            <div style={styles.chartShell}>
              {!isDemo && !hasLiveData ? (
                <EmptyState text="No live report trend data yet. Connect revenue and pipeline sources to generate executive reporting." />
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
                      dataKey="revenue"
                      stroke="#86efac"
                      strokeWidth={3}
                      dot={{ r: 3, fill: "#86efac" }}
                      activeDot={{ r: 6 }}
                      animationDuration={1400}
                    />
                    <Line
                      type="monotone"
                      dataKey="pipeline"
                      stroke="#67e8f9"
                      strokeWidth={3}
                      dot={{ r: 3, fill: "#67e8f9" }}
                      activeDot={{ r: 6 }}
                      animationDuration={1700}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </Section>

          <Section title="Atlas AI Reporting Insights" subtitle="Executive Guidance">
            <InsightStack items={aiInsights} />
          </Section>
        </div>

        <div style={styles.twoCol}>
          <Section title="Generate Reports" subtitle="Output Library">
            <div style={styles.reportGrid}>
              {reportTypes.map((report) => {
                const busy = generatingTitle === report.title;
                return (
                  <div key={report.title} style={styles.reportCard}>
                    <div style={styles.reportTitle}>{report.title}</div>
                    <div style={styles.reportBody}>{report.description}</div>
                    <div style={styles.reportMeta}>{report.meta}</div>

                    <div style={styles.buttonRow}>
                      <button
                        style={{
                          ...styles.primaryBtn,
                          ...(busy ? styles.disabledBtn : {}),
                        }}
                        onClick={() => handleGenerateReport(report)}
                        disabled={busy}
                        type="button"
                      >
                        {busy ? "Generating..." : "Generate"}
                      </button>

                      <button
                        style={styles.secondaryBtn}
                        onClick={() => handlePreviewReport(report)}
                        type="button"
                      >
                        Preview
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </Section>

          <Section title="Report Type Value" subtitle="Strategic Score">
            <div style={styles.chartShell}>
              {!isDemo && !hasLiveData ? (
                <EmptyState text="No live report scoring yet." />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={reportValueData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                    <XAxis dataKey="name" tick={axisTick} stroke="#94a3b8" />
                    <YAxis tick={axisTick} stroke="#94a3b8" domain={[0, 100]} />
                    <Tooltip
                      formatter={(value) => [`${value}/100`, "Strategic Value"]}
                      contentStyle={tooltipStyle}
                      labelStyle={{ color: "#fff" }}
                    />
                    <Bar
                      dataKey="value"
                      fill="#93c5fd"
                      radius={[10, 10, 0, 0]}
                      animationDuration={1400}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </Section>
        </div>

        <div style={styles.twoCol}>
          <Section title="Executive Briefing Structure" subtitle="Recommended Sections">
            <div style={styles.bulletStack}>
              {briefingSections.map((item, idx) => (
                <div key={item} style={styles.bulletRow}>
                  <div style={styles.bulletDot}>{idx + 1}</div>
                  <div style={{ color: "#e5edf8", fontSize: 15, lineHeight: 1.6 }}>
                    {item}
                  </div>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Recommended Reporting Use Cases" subtitle="Where To Use">
            <div style={styles.useCaseGrid}>
              <div style={styles.useCaseCard}>
                <div style={styles.useCaseTitle}>Board & Investor Meetings</div>
                <div style={styles.useCaseBody}>
                  Lead with performance direction, strategic risk, and the decisions leadership needs to make next.
                </div>
              </div>

              <div style={styles.useCaseCard}>
                <div style={styles.useCaseTitle}>Weekly Revenue Reviews</div>
                <div style={styles.useCaseBody}>
                  Keep reporting focused on pipeline coverage, close confidence, deal movement, and execution pressure.
                </div>
              </div>

              <div style={styles.useCaseCard}>
                <div style={styles.useCaseTitle}>Growth & Channel Reviews</div>
                <div style={styles.useCaseBody}>
                  Show which initiatives are influencing opportunity creation, efficiency, and closed revenue outcomes.
                </div>
              </div>
            </div>
          </Section>
        </div>
      </div>

      {previewReport ? (
        <div style={styles.modalBackdrop} onClick={() => setPreviewReport(null)}>
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalTitle}>{previewReport.title}</div>
            <div style={styles.modalSub}>
              {previewReport.description} <br />
              {previewReport.meta}
            </div>

            <div style={styles.modalBlock}>
              <div style={styles.modalBlockTitle}>Executive Snapshot</div>
              <ul style={styles.modalList}>
                <li>Workspace: {orgName}</li>
                <li>Revenue: {moneyCompact(revenue)}</li>
                <li>Pipeline: {moneyCompact(pipelineValue)}</li>
                <li>90-Day Forecast: {moneyCompact(forecast90d)}</li>
                <li>Forecast Confidence: {pct(forecastConfidence)}</li>
                <li>Revenue Health: {revenueHealth}/100</li>
                <li>Open Deals: {openDeals}</li>
              </ul>
            </div>

            <div style={styles.modalBlock}>
              <div style={styles.modalBlockTitle}>Preview Narrative</div>
              <ul style={styles.modalList}>
                {previewReport.sections.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>

            <div style={styles.modalBlock}>
              <div style={styles.modalBlockTitle}>Recommended Briefing Sections</div>
              <ul style={styles.modalList}>
                {briefingSections.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>

            <div style={styles.modalCloseRow}>
              <button
                style={styles.secondaryBtn}
                onClick={() => setPreviewReport(null)}
                type="button"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
