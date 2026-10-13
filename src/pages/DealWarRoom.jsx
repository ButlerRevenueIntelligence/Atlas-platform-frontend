// frontend/src/pages/DealWarRoom.jsx
import React, { useEffect, useMemo, useState } from "react";
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
  AreaChart,
  Area,
} from "recharts";
import { getDashboard } from "../api";
import AtlasDealIntelligencePanel from "../components/atlas/AtlasDealIntelligencePanel";

const axisTick = { fill: "#9fb0d0", fontSize: 11 };

const tooltipStyle = {
  background: "rgba(7,11,24,0.98)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: "12px",
  color: "#fff",
  boxShadow: "0 14px 40px rgba(0,0,0,0.35)",
};

const styles = {
  page: {
    minHeight: "100vh",
    color: "#fff",
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
      "linear-gradient(135deg, rgba(30,64,175,0.18), rgba(37,99,235,0.11), rgba(255,255,255,0.02))",
    boxShadow: "0 12px 30px rgba(0,0,0,0.18)",
  },
  heroTop: {
    display: "grid",
    gridTemplateColumns: "1.35fr 0.65fr",
    gap: 16,
    alignItems: "start",
  },
  eyebrow: {
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: "0.18em",
    color: "rgba(125,211,252,0.9)",
    fontWeight: 700,
  },
  h1: {
    margin: "6px 0 0",
    fontSize: 28,
    lineHeight: 1.05,
    letterSpacing: -0.7,
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
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 10,
  },
  statCard: {
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 16,
    padding: "14px 14px 13px",
    background: "rgba(255,255,255,0.032)",
    boxShadow: "0 8px 20px rgba(0,0,0,0.12)",
    minHeight: 116,
  },
  statLabel: {
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: "0.14em",
    color: "rgba(148,163,184,0.88)",
    fontWeight: 700,
  },
  statValue: {
    marginTop: 10,
    fontSize: 26,
    fontWeight: 900,
    color: "#fff",
    lineHeight: 1.05,
  },
  statNote: {
    marginTop: 7,
    fontSize: 12,
    lineHeight: 1.45,
    color: "rgba(203,213,225,0.76)",
  },
  twoCol: {
    display: "grid",
    gridTemplateColumns: "1.12fr 0.88fr",
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
    letterSpacing: -0.35,
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
  summaryList: {
    display: "grid",
    gap: 8,
  },
  summaryItem: {
    border: "1px solid rgba(255,255,255,0.07)",
    background: "rgba(4,10,24,0.34)",
    borderRadius: 14,
    padding: "12px 13px",
    fontSize: 13,
    lineHeight: 1.55,
    color: "#dbe4f0",
  },
  chartShell: {
    height: 260,
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 16,
    background: "rgba(4,10,24,0.72)",
    padding: 10,
  },
  stageGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 12,
  },
  stageCard: {
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 16,
    padding: 14,
    background: "rgba(4,10,24,0.34)",
    minHeight: 136,
  },
  stageName: {
    fontSize: 17,
    fontWeight: 800,
    color: "#fff",
  },
  stageMeta: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 1.5,
    color: "rgba(203,213,225,0.78)",
  },
  stageValue: {
    marginTop: 8,
    fontSize: 24,
    fontWeight: 800,
    color: "#fff",
    lineHeight: 1.1,
  },
  queueList: {
    display: "grid",
    gap: 12,
  },
  queueCard: {
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 16,
    padding: 14,
    background: "rgba(4,10,24,0.34)",
  },
  queueTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
    flexWrap: "wrap",
  },
  queueTitle: {
    fontSize: 17,
    fontWeight: 800,
    color: "#fff",
    maxWidth: "78%",
  },
  queueBody: {
    marginTop: 9,
    fontSize: 14,
    lineHeight: 1.65,
    color: "rgba(219,228,240,0.84)",
  },
  tableWrap: {
    overflowX: "auto",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    minWidth: 880,
  },
  th: {
    textAlign: "left",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: "0.14em",
    color: "rgba(148,163,184,0.9)",
    padding: "12px 10px",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
  },
  td: {
    padding: "14px 10px",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
    color: "#e5edf8",
    fontSize: 14,
    lineHeight: 1.5,
    verticalAlign: "top",
  },
  noteCards: {
    display: "grid",
    gap: 10,
  },
  noteCard: {
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(4,10,24,0.34)",
    borderRadius: 14,
    padding: "13px 14px",
    fontSize: 14,
    lineHeight: 1.6,
    color: "#dbe4f0",
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
};

function safeNum(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function moneyCompact(num) {
  const n = safeNum(num);
  if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `$${(n / 1000).toFixed(0)}K`;
  return `$${n}`;
}

function normalizeStage(stage = "") {
  const s = String(stage || "").toLowerCase();
  if (s.includes("disc")) return "Discovery";
  if (s.includes("prop")) return "Proposal";
  if (s.includes("neg")) return "Negotiation";
  if (s.includes("commit")) return "Commit";
  if (s.includes("won")) return "Closed Won";
  if (s.includes("lost")) return "Closed Lost";
  if (s.includes("follow")) return "Follow-Up";
  return stage || "Unknown";
}

function tonePill(tone) {
  const map = {
    high: {
      border: "1px solid rgba(239,68,68,0.22)",
      background: "rgba(239,68,68,0.12)",
      color: "#fecaca",
    },
    medium: {
      border: "1px solid rgba(245,158,11,0.22)",
      background: "rgba(245,158,11,0.12)",
      color: "#fde68a",
    },
    low: {
      border: "1px solid rgba(56,189,248,0.22)",
      background: "rgba(56,189,248,0.12)",
      color: "#bae6fd",
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
    ...(map[tone] || map.medium),
  };
}

function riskPill(risk) {
  const key = String(risk || "").toLowerCase();
  return tonePill(key === "high" ? "high" : key === "low" ? "low" : "medium");
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
    <div className="atlas-responsive-card" style={styles.statCard}>
      <div style={styles.statLabel}>{label}</div>
      <div style={styles.statValue}>{value}</div>
      {note ? <div style={styles.statNote}>{note}</div> : null}
    </div>
  );
}

function EmptyState({ text }) {
  return <div className="atlas-responsive-card atlas-responsive-row" style={styles.emptyState}>{text}</div>;
}

export default function DealWarRoom() {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
        setError(err?.message || "Failed to load Deal War Room");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, []);

 const workspaceMode = String(
  dashboard?.workspaceMode || "live"
).toLowerCase();

const orgName =
  dashboard?.activeWorkspace?.name || "Workspace";

const deals =
  Array.isArray(dashboard?.deals)
    ? dashboard.deals
    : [];

const isDemo = workspaceMode === "demo";

  const liveDeals = useMemo(() => {
    return deals.filter(deal => !deal.archived).map((deal, idx) => {
      const stage = normalizeStage(deal?.stage || "");
      const amount =
        safeNum(deal?.amount, 0) ||
        safeNum(deal?.value, 0) ||
        safeNum(deal?.pipelineValue, 0);

      const probabilityRaw =
        safeNum(deal?.probability, 0) ||
        safeNum(deal?.closeProbability, 0) ||
        safeNum(deal?.winProbability, 0);

      const probability =
        probabilityRaw > 1 ? probabilityRaw : Math.round(probabilityRaw * 100);

      const age = deal.lastActivityAt ? Math.max(0, Math.floor((Date.now() - new Date(deal.lastActivityAt).getTime()) / 86400000)) : null;
      const risk = age >= 7 || probability < 40 ? "High" : (deal.risk || probability < 65) ? "Medium" : "Low";

      return {
        name: deal?.name || `Deal ${idx + 1}`,
        owner:
          deal?.ownerName ||
          deal?.owner ||
          deal?.createdByName ||
          "Workspace Team",
        stage,
        valueNum: amount,
        value: moneyCompact(amount),
        close: `${safeNum(probability, 0)}%`,
        risk,
        nextAction: deal.nextAction || deal.nextStep || "Confirm the next buyer action.",
        daysToClose: deal.closeDate ? Math.ceil((new Date(deal.closeDate).getTime() - Date.now()) / 86400000) : null,
        probability: Math.max(0, Math.min(100, probability)),
        blocker:
          deal?.risk ||
          deal?.closedReason ||
          deal?.lastActivityNote ||
          "Needs next-step definition",
      };
    });
  }, [deals]);

  const openDeals = useMemo(() => {
    return liveDeals.filter(
      (d) => d.stage !== "Closed Won" && d.stage !== "Closed Lost"
    );
  }, [liveDeals]);

  const weightedPipelineNum = useMemo(() => {
    return deals.reduce((sum, deal) => {
      const stage = normalizeStage(deal?.stage || "");
      if (stage === "Closed Won" || stage === "Closed Lost") return sum;

      const amount =
        safeNum(deal?.amount, 0) ||
        safeNum(deal?.value, 0) ||
        safeNum(deal?.pipelineValue, 0);

      const probabilityRaw =
        safeNum(deal?.probability, 0) ||
        safeNum(deal?.closeProbability, 0) ||
        safeNum(deal?.winProbability, 0);

      const probability = probabilityRaw > 1 ? probabilityRaw / 100 : probabilityRaw || 0;
      return sum + amount * probability;
    }, 0);
  }, [deals]);

  const lateStageExposureNum = useMemo(() => {
    return deals.reduce((sum, deal) => {
      const stage = normalizeStage(deal?.stage || "");
      if (!["Negotiation", "Commit"].includes(stage)) return sum;

      const amount =
        safeNum(deal?.amount, 0) ||
        safeNum(deal?.value, 0) ||
        safeNum(deal?.pipelineValue, 0);

      return sum + amount;
    }, 0);
  }, [deals]);

  const avgCloseProbabilityNum = useMemo(() => {
    if (!openDeals.length) return 0;

    const total = deals.reduce((sum, deal) => {
      const stage = normalizeStage(deal?.stage || "");
      if (stage === "Closed Won" || stage === "Closed Lost") return sum;

      const probabilityRaw =
        safeNum(deal?.probability, 0) ||
        safeNum(deal?.closeProbability, 0) ||
        safeNum(deal?.winProbability, 0);

      const probability = probabilityRaw > 1 ? probabilityRaw : probabilityRaw * 100;
      return sum + safeNum(probability, 0);
    }, 0);

    return Math.round(total / openDeals.length);
  }, [deals, openDeals]);

  const dealsAtRiskNum = useMemo(() => {
    return openDeals.filter((d) => d.risk === "High").length;
  }, [openDeals]);

  const stageCards = useMemo(() => {


    const stageMap = new Map();

    openDeals.forEach((deal) => {
      const stage = deal.stage || "Unknown";
      if (!stageMap.has(stage)) {
        stageMap.set(stage, {
          stage,
          deals: 0,
          valueNum: 0,
        });
      }

      const row = stageMap.get(stage);
      row.deals += 1;
      row.valueNum += safeNum(deal.valueNum, 0);
    });

    return Array.from(stageMap.values())
      .map((row) => ({
        stage: row.stage,
        deals: row.deals,
        value: moneyCompact(row.valueNum),
        note:
          row.deals >= 3
            ? "Active opportunity concentration"
            : "Lighter deal density",
      }))
      .sort((a, b) => b.deals - a.deals);
  }, [isDemo, openDeals]);

  const stagePressure = useMemo(() => {


    return stageCards.map((stage) => ({
      name: stage.stage,
      value: Math.round(openDeals.filter(deal => deal.stage === stage.stage && deal.risk === "High").length / Math.max(stage.deals, 1) * 100),
    }));
  }, [stageCards, openDeals]);

  const forecastTrend = useMemo(() => [30, 60, 90, 120].map(days => {
    const rows = openDeals.filter(deal => Number.isFinite(deal.daysToClose) && deal.daysToClose <= days);
    return { period: `${days}D`, baseline: rows.reduce((sum, deal) => sum + deal.valueNum * deal.probability / 100, 0),
      commit: rows.reduce((sum, deal) => sum + deal.valueNum, 0) };
  }), [openDeals]);

  const executiveSignals = useMemo(() => {


    if (!openDeals.length) {
      return [
        "No open deals are currently loaded in this workspace.",
        "Once deals are added or synced from connected systems, the war room will show forecast concentration and stage pressure here.",
        "Leadership views will become more useful as opportunity ownership, stage movement, and next actions are added.",
        "Start by adding your first active deals so Atlas can model live pressure and close readiness.",
      ];
    }

    const highestValueDeal = [...openDeals].sort((a, b) => b.valueNum - a.valueNum)[0];
    const negotiationCount = openDeals.filter((d) => d.stage === "Negotiation").length;
    const proposalCount = openDeals.filter((d) => d.stage === "Proposal").length;

    return [
      `${openDeals.length} open deals are currently being tracked for ${orgName}.`,
      `${highestValueDeal?.name || "The top deal"} is the largest current opportunity in the board.`,
      `${negotiationCount} deal(s) are currently in negotiation and ${proposalCount} are in proposal-stage motion.`,
      "Leadership attention should stay focused on next actions, blocker removal, and owner accountability.",
    ];
  }, [isDemo, openDeals, orgName]);

  const interventionQueue = useMemo(() => {


    if (!openDeals.length) return [];

    return openDeals.slice(0, 4).map((deal) => ({
      title: `Review ${deal.name}`,
      detail:
        deal.nextAction
          ? `${deal.owner}: ${deal.nextAction}`
          : "Confirm next action, decision path, and close timing.",
      tone: deal.risk === "High" ? "high" : deal.risk === "Medium" ? "medium" : "low",
    }));
  }, [isDemo, openDeals]);

  const aiNotes = useMemo(() => {


    if (!openDeals.length) {
      return [
        "This workspace does not yet have live deal data in the war room.",
        "Once live opportunities are added, Atlas will surface pressure, risk, and next-best leadership moves here.",
        "The best next step is to add deals manually or connect a CRM source.",
        "After deal activity starts flowing, this page will become a true executive operating view.",
      ];
    }

    return [
      "Totals and stage charts are calculated from the same opportunity records.",
      "Executive visibility improves as deal owners, blockers, and next actions stay up to date.",
      "Forecast quality gets stronger when stages and close probabilities are actively maintained.",
      "Keep leadership focused on bottlenecks, pressure concentration, and deal movement velocity.",
    ];
  }, [isDemo, openDeals]);

  const topStats = useMemo(() => {


    return [
      {
        label: "Weighted Pipeline",
        value: moneyCompact(weightedPipelineNum),
        note: "Probability-adjusted open pipeline",
      },
      {
        label: "Late-Stage Exposure",
        value: moneyCompact(lateStageExposureNum),
        note: "Open negotiation and commit-stage value",
      },
      {
        label: "Win Probability",
        value: `${avgCloseProbabilityNum}%`,
        note: "Average recorded close probability",
      },
      {
        label: "Deals at Risk",
        value: String(dealsAtRiskNum),
        note: "Low probability or 7+ days without activity",
      },
    ];
  }, [
    isDemo,
    weightedPipelineNum,
    lateStageExposureNum,
    avgCloseProbabilityNum,
    dealsAtRiskNum,
  ]);

  const dealTable = useMemo(() => {


    return openDeals;
  }, [isDemo, openDeals]);

  if (loading) {
    return (
      <div className="atlas-responsive-page" style={styles.page}>
        <div style={styles.wrap}>
          <div className="atlas-responsive-card" style={styles.hero}>
            <h1 className="atlas-responsive-title" style={styles.h1}>Loading Deal War Room...</h1>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="atlas-responsive-page" style={styles.page}>
        <div style={styles.wrap}>
          <div className="atlas-responsive-card" style={styles.errorBox}>{error}</div>
        </div>
      </div>
    );
  }

  const noLiveDeals = !isDemo && !openDeals.length;

  return (
    <div className="atlas-responsive-page" style={styles.page}>
      <div style={styles.wrap}>
        <div className="atlas-responsive-card" style={styles.hero}>
          <div className="atlas-responsive-grid" style={styles.heroTop}>
            <div>
              <div style={styles.eyebrow}>Executive Command Center</div>
              <h1 className="atlas-responsive-title" style={styles.h1}>Deal War Room</h1>
              <div style={styles.heroText}>
                A focused operating view for leadership to manage late-stage deal
                movement, forecast concentration, blocker resolution, and next-best
                actions across the revenue board for <b>{orgName}</b>.
              </div>
            </div>

            <div className="atlas-responsive-row" style={styles.badgeWrap}>
              {[
                isDemo ? "Demo War Room" : "Live War Room",
                "Forecast Monitoring",
                isDemo ? "Sample deals · fictional owners" : "Deal Pressure Live",
                "Executive Review Active",
              ].map((item) => (
                <div className="atlas-responsive-card" key={item} style={styles.badge}>
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="atlas-responsive-metrics" style={styles.statsGrid}>
          {topStats.map((item) => (
            <SmallStat
              key={item.label}
              label={item.label}
              value={item.value}
              note={item.note}
            />
          ))}
        </div>

        <div className="atlas-responsive-grid" style={styles.twoCol}>
          <Section title="Executive Pressure Signals" subtitle="Board View">
            <div style={styles.summaryList}>
              {executiveSignals.map((point) => (
                <div className="atlas-responsive-card" key={point} style={styles.summaryItem}>
                  {point}
                </div>
              ))}
            </div>
          </Section>

          <Section title="Stage Distribution" subtitle="Pipeline Mix">
            {stageCards.length ? (
              <div className="atlas-responsive-grid" style={styles.stageGrid}>
                {stageCards.map((item) => (
                  <div className="atlas-responsive-card" key={item.stage} style={styles.stageCard}>
                    <div style={styles.stageName}>{item.stage}</div>
                    <div style={styles.stageMeta}>{item.deals} deals</div>
                    <div style={styles.stageValue}>{item.value}</div>
                    <div style={styles.stageMeta}>{item.note}</div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState text="No live stage distribution is available yet. Add or sync deals to populate the war room." />
            )}
          </Section>
        </div>

        <div className="atlas-responsive-grid" style={styles.twoCol}>
          <Section title="Forecast Trend" subtitle="Cumulative opportunity value by expected close date">
            {noLiveDeals ? (
              <EmptyState text="No live forecast trend yet. Add or sync deals to generate a forecast curve." />
            ) : (
              <div className="atlas-responsive-card" style={styles.chartShell}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={forecastTrend}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="rgba(255,255,255,0.08)"
                    />
                    <XAxis dataKey="period" tick={axisTick} stroke="#94a3b8" />
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
                      dataKey="baseline"
                      name="Probability-weighted value"
                      stroke="#93c5fd"
                      strokeWidth={3}
                      dot={{ r: 3, fill: "#93c5fd" }}
                      activeDot={{ r: 6 }}
                      animationDuration={1400}
                    />
                    <Line
                      type="monotone"
                      dataKey="commit"
                      name="Full pipeline scenario"
                      stroke="#86efac"
                      strokeWidth={3}
                      dot={{ r: 3, fill: "#86efac" }}
                      activeDot={{ r: 6 }}
                      animationDuration={1700}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </Section>

          <Section title="Stage Pressure" subtitle="Share of deals flagged for execution review">
            {noLiveDeals ? (
              <EmptyState text="No live stage pressure yet. Deal movement is required to model war-room pressure." />
            ) : (
              <div className="atlas-responsive-card" style={styles.chartShell}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={stagePressure}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="rgba(255,255,255,0.08)"
                    />
                    <XAxis dataKey="name" tick={axisTick} stroke="#94a3b8" />
                    <YAxis tick={axisTick} stroke="#94a3b8" domain={[0, 100]} />
                    <Tooltip
                      formatter={(value) => [`${value}/100`, "Pressure"]}
                      contentStyle={tooltipStyle}
                      labelStyle={{ color: "#fff" }}
                    />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="#facc15"
                      fill="#facc15"
                      fillOpacity={0.28}
                      strokeWidth={3}
                      animationDuration={1500}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </Section>
        </div>

        <AtlasDealIntelligencePanel deals={dealTable} />

        <div className="atlas-responsive-grid" style={styles.twoCol}>
          <Section title="Top Active Opportunities" subtitle="Deal Board">
            {dealTable.length ? (
              <div className="atlas-responsive-scroll" style={styles.tableWrap}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Deal</th>
                      <th style={styles.th}>Owner</th>
                      <th style={styles.th}>Stage</th>
                      <th style={styles.th}>Value</th>
                      <th style={styles.th}>Close</th>
                      <th style={styles.th}>Risk</th>
                      <th style={styles.th}>Primary Blocker</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dealTable.map((row) => (
                      <tr key={row.name}>
                        <td style={styles.td}>{row.name}</td>
                        <td style={styles.td}>{row.owner}</td>
                        <td style={styles.td}>{row.stage}</td>
                        <td style={styles.td}>{row.value}</td>
                        <td style={styles.td}>{row.close}</td>
                        <td style={styles.td}>
                          <span style={riskPill(row.risk)}>{row.risk}</span>
                        </td>
                        <td style={styles.td}>{row.blocker}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState text="No live opportunities are in the war room yet." />
            )}
          </Section>

          <Section title="Executive Intervention Queue" subtitle="Priorities">
            {interventionQueue.length ? (
              <div style={styles.queueList}>
                {interventionQueue.map((item) => (
                  <div className="atlas-responsive-card" key={item.title} style={styles.queueCard}>
                    <div className="atlas-responsive-row" style={styles.queueTop}>
                      <div style={styles.queueTitle}>{item.title}</div>
                      <div style={tonePill(item.tone)}>
                        {item.tone === "high"
                          ? "Immediate"
                          : item.tone === "low"
                          ? "Watch"
                          : "Priority"}
                      </div>
                    </div>
                    <div style={styles.queueBody}>{item.detail}</div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState text="No live intervention queue yet. Atlas will populate this once deal data is present." />
            )}
          </Section>
        </div>

        <div className="atlas-responsive-grid" style={styles.twoCol}>
          <Section title="AI Deal Notes" subtitle="Executive Intelligence">
            <div style={styles.noteCards}>
              {aiNotes.map((note) => (
                <div className="atlas-responsive-card" key={note} style={styles.noteCard}>
                  {note}
                </div>
              ))}
            </div>
          </Section>

          <Section title="Stage Pressure by Category" subtitle="Board Pressure">
            {noLiveDeals ? (
              <EmptyState text="No live board pressure is available yet." />
            ) : (
              <div className="atlas-responsive-card" style={styles.chartShell}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stagePressure}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="rgba(255,255,255,0.08)"
                    />
                    <XAxis dataKey="name" tick={axisTick} stroke="#94a3b8" />
                    <YAxis tick={axisTick} stroke="#94a3b8" domain={[0, 100]} />
                    <Tooltip
                      formatter={(value) => [`${value}/100`, "Pressure"]}
                      contentStyle={tooltipStyle}
                      labelStyle={{ color: "#fff" }}
                    />
                    <Bar
                      dataKey="value"
                      fill="#67e8f9"
                      radius={[10, 10, 0, 0]}
                      animationDuration={1400}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}
