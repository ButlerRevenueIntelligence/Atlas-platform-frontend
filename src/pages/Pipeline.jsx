// frontend/src/pages/Pipeline.jsx
import React, { useEffect, useMemo, useState } from "react";
import { getDeals, moveDealStage, deleteDeal } from "../api";
import DealDrawer from "../components/DealDrawer";

const STAGES = [
  "Discovery",
  "Proposal",
  "Follow-Up",
  "Negotiation",
  "Closed Won",
  "Closed Lost",
];

const safeNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const money = (n) =>
  safeNum(n).toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

export default function Pipeline() {
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerDealId, setDrawerDealId] = useState("");
  const [drawerDeal, setDrawerDeal] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const res = await getDeals();
      const arr = Array.isArray(res?.deals)
        ? res.deals
        : Array.isArray(res)
        ? res
        : [];
      setDeals(arr);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function openDealDrawer(id, d) {
    setDrawerDealId(id);
    setDrawerDeal(d);
    setDrawerOpen(true);
  }

  function closeDrawer() {
    setDrawerOpen(false);
    setDrawerDeal(null);
    setDrawerDealId("");
  }

  async function onMoveDeal(id, stage) {
    const res = await moveDealStage(id, stage);
    const updated = res?.deal || res;

    setDeals((prev) =>
      prev.map((d) =>
        d._id === id || d.id === id ? { ...d, ...updated, stage } : d
      )
    );
  }

  async function onDeleteDeal(id) {
    if (!window.confirm("Delete deal?")) return;
    await deleteDeal(id);
    setDeals((prev) => prev.filter((d) => (d._id || d.id) !== id));
  }

  const columns = useMemo(() => {
    const map = new Map();
    STAGES.forEach((s) => map.set(s, []));
    deals.forEach((d) => {
      const stage = STAGES.includes(d.stage) ? d.stage : "Discovery";
      map.get(stage).push(d);
    });
    return map;
  }, [deals]);

  const weightedPipeline = useMemo(() => {
    return deals.reduce(
      (sum, d) => sum + safeNum(d.amount) * (safeNum(d.probability) / 100),
      0
    );
  }, [deals]);

  const rawPipeline = useMemo(() => {
    return deals.reduce((sum, d) => sum + safeNum(d.amount), 0);
  }, [deals]);

  const winRate = useMemo(() => {
    const won = deals.filter((d) => d.stage === "Closed Won").length;
    const lost = deals.filter((d) => d.stage === "Closed Lost").length;
    if (won + lost === 0) return 0;
    return Math.round((won / (won + lost)) * 100);
  }, [deals]);

  const avgDeal = useMemo(() => {
    if (!deals.length) return 0;
    return deals.reduce((sum, d) => sum + safeNum(d.amount), 0) / deals.length;
  }, [deals]);

  const avgProbability = useMemo(() => {
    if (!deals.length) return 0;
    return Math.round(
      deals.reduce((sum, d) => sum + safeNum(d.probability), 0) / deals.length
    );
  }, [deals]);

  const activeDeals = useMemo(() => {
    return deals.filter(
      (d) => d.stage !== "Closed Won" && d.stage !== "Closed Lost"
    ).length;
  }, [deals]);

  const stageStats = useMemo(() => {
    const obj = {};
    STAGES.forEach((stage) => {
      const stageDeals = columns.get(stage) || [];
      obj[stage] = {
        count: stageDeals.length,
        value: stageDeals.reduce((sum, d) => sum + safeNum(d.amount), 0),
      };
    });
    return obj;
  }, [columns]);

  const dealSignals = useMemo(() => {
    const items = [];

    if (activeDeals > 0) {
      items.push(`${activeDeals} active deals are currently moving through the pipeline.`);
    }

    if (winRate < 30 && deals.length > 3) {
      items.push("Win rate is below target and late-stage conversion should be reviewed.");
    } else if (winRate >= 30 && deals.length > 0) {
      items.push("Win rate is holding at a workable level across closed opportunities.");
    }

    if (avgProbability < 45 && activeDeals > 0) {
      items.push("Average close confidence is modest, suggesting qualification or deal-quality pressure.");
    } else if (avgProbability >= 45 && activeDeals > 0) {
      items.push("Average close confidence is stable across the active pipeline.");
    }

    const negotiationCount = stageStats["Negotiation"]?.count || 0;
    if (negotiationCount > 0) {
      items.push(`${negotiationCount} deals are currently in negotiation and require close-plan discipline.`);
    }

    return items.slice(0, 4);
  }, [activeDeals, winRate, avgProbability, deals.length, stageStats]);

  const dealRiskRadar = useMemo(() => {
    const negotiationCount = stageStats["Negotiation"]?.count || 0;
    const followupCount = stageStats["Follow-Up"]?.count || 0;
    const proposalCount = stageStats["Proposal"]?.count || 0;

    return [
      {
        label: "Late-Stage Dependence",
        value: negotiationCount,
        tone: negotiationCount >= 4 ? "warn" : "good",
        note: "Heavy deal clustering in negotiation can create forecast concentration risk.",
      },
      {
        label: "Follow-Up Bottleneck",
        value: followupCount,
        tone: followupCount >= 5 ? "bad" : followupCount >= 3 ? "warn" : "good",
        note: "Too many deals stalled in follow-up can reduce overall deal velocity.",
      },
      {
        label: "Proposal Load",
        value: proposalCount,
        tone: proposalCount >= 5 ? "warn" : "good",
        note: "A healthy proposal layer is positive, but overloaded volume needs progression.",
      },
    ];
  }, [stageStats]);

  const recommendedActions = useMemo(() => {
    const items = [];

    if ((stageStats["Follow-Up"]?.count || 0) >= 3) {
      items.push("Clear follow-up bottlenecks by prioritizing next-step outreach on stalled deals.");
    }

    if ((stageStats["Negotiation"]?.count || 0) > 0) {
      items.push("Push negotiation-stage deals toward a defined close plan and executive alignment.");
    }

    if (winRate < 30 && deals.length > 3) {
      items.push("Review qualification standards and reduce time spent on weak-fit opportunities.");
    }

    if (avgProbability < 45 && activeDeals > 0) {
      items.push("Improve deal confidence by tightening discovery quality and stakeholder alignment.");
    }

    if (!items.length) {
      items.push("Pipeline looks balanced. Focus on accelerating late-stage deals and keeping momentum high.");
    }

    return items.slice(0, 4);
  }, [stageStats, winRate, deals.length, avgProbability, activeDeals]);

  const signalStrip = useMemo(() => {
    return [
      `Weighted pipeline is currently ${money(weightedPipeline)}`,
      `Win rate is ${winRate}% across closed opportunities`,
      `Average deal confidence is ${avgProbability}%`,
      `${activeDeals} active deals are in flight`,
    ];
  }, [weightedPipeline, winRate, avgProbability, activeDeals]);

  const S = {
    page: {
      minHeight: "100vh",
      padding: 22,
      color: "#EAF0FF",
      background:
        "radial-gradient(1200px 700px at 15% 15%, rgba(124,92,255,0.22), transparent 60%), radial-gradient(1000px 650px at 85% 30%, rgba(56,189,248,0.18), transparent 60%), linear-gradient(180deg, rgba(5,8,18,1) 0%, rgba(7,12,28,1) 55%, rgba(5,8,18,1) 100%)",
    },
    header: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: 12,
      marginBottom: 14,
      flexWrap: "wrap",
    },
    titleWrap: {
      display: "grid",
      gap: 6,
    },
    title: {
      fontSize: 30,
      fontWeight: 900,
      margin: 0,
    },
    sub: {
      opacity: 0.82,
      fontSize: 13,
      lineHeight: 1.5,
      maxWidth: 820,
    },
    btn: {
      borderRadius: 999,
      padding: "10px 14px",
      border: "1px solid rgba(255,255,255,0.12)",
      background: "rgba(255,255,255,0.06)",
      color: "#EAF0FF",
      fontWeight: 900,
      fontSize: 12,
      cursor: "pointer",
      opacity: 0.98,
    },
    signalStrip: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
      gap: 10,
      marginBottom: 14,
    },
    signalPill: {
      borderRadius: 14,
      padding: "12px 14px",
      border: "1px solid rgba(255,255,255,0.08)",
      background: "rgba(255,255,255,0.04)",
      fontSize: 12,
      lineHeight: 1.45,
      opacity: 0.92,
    },
    kpiGrid: {
      display: "grid",
      gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
      gap: 12,
      marginBottom: 16,
    },
    kpi: {
      padding: 16,
      borderRadius: 16,
      background: "rgba(255,255,255,0.04)",
      border: "1px solid rgba(255,255,255,0.08)",
    },
    kpiLabel: {
      fontSize: 12,
      opacity: 0.7,
      letterSpacing: 0.8,
    },
    kpiValue: {
      marginTop: 6,
      fontSize: 24,
      fontWeight: 900,
    },
    kpiSub: {
      marginTop: 8,
      fontSize: 12,
      opacity: 0.78,
      lineHeight: 1.4,
    },
    mainGrid: {
      display: "grid",
      gridTemplateColumns: "minmax(0, 2.2fr) minmax(320px, 1fr)",
      gap: 14,
      alignItems: "start",
    },
    boardWrap: {
      display: "grid",
      gap: 14,
    },
    board: {
      display: "grid",
      gridTemplateColumns: "repeat(6, minmax(220px, 1fr))",
      gap: 12,
      overflowX: "auto",
    },
    column: {
      background: "rgba(10,16,35,0.4)",
      borderRadius: 16,
      padding: 12,
      border: "1px solid rgba(255,255,255,0.08)",
      minHeight: 420,
    },
    columnTitle: {
      fontWeight: 900,
      fontSize: 12,
      marginBottom: 6,
      letterSpacing: 0.7,
    },
    columnMeta: {
      fontSize: 11,
      opacity: 0.75,
      marginBottom: 10,
      lineHeight: 1.4,
    },
    dealCard: {
      background: "rgba(255,255,255,0.05)",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 12,
      padding: 10,
      marginBottom: 10,
      cursor: "pointer",
    },
    dealTitle: {
      fontWeight: 900,
      fontSize: 13,
      lineHeight: 1.35,
    },
    dealMeta: {
      fontSize: 12,
      opacity: 0.82,
      marginTop: 6,
      lineHeight: 1.45,
    },
    select: {
      width: "100%",
      marginTop: 10,
      borderRadius: 10,
      padding: "8px 10px",
      border: "1px solid rgba(255,255,255,0.10)",
      background: "rgba(0,0,0,0.22)",
      color: "#EAF0FF",
      outline: "none",
    },
    btnDelete: {
      marginTop: 8,
      fontSize: 11,
      opacity: 0.82,
      cursor: "pointer",
    },
    rightStack: {
      display: "grid",
      gap: 14,
    },
    sideCard: {
      borderRadius: 16,
      padding: 16,
      border: "1px solid rgba(255,255,255,0.08)",
      background: "rgba(255,255,255,0.04)",
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: 900,
      marginBottom: 10,
    },
    list: {
      display: "grid",
      gap: 10,
    },
    listItem: {
      borderRadius: 12,
      padding: 12,
      border: "1px solid rgba(255,255,255,0.08)",
      background: "rgba(255,255,255,0.04)",
    },
    listItemTitle: {
      fontWeight: 900,
      fontSize: 13,
      marginBottom: 6,
    },
    listItemBody: {
      fontSize: 12,
      opacity: 0.84,
      lineHeight: 1.5,
    },
    radarTone: (tone) => ({
      fontSize: 11,
      fontWeight: 900,
      padding: "4px 8px",
      borderRadius: 999,
      display: "inline-flex",
      alignItems: "center",
      background:
        tone === "bad"
          ? "rgba(251,113,133,0.12)"
          : tone === "warn"
          ? "rgba(245,158,11,0.12)"
          : "rgba(34,197,94,0.12)",
      color: tone === "bad" ? "#FB7185" : tone === "warn" ? "#F59E0B" : "#22C55E",
      border: "1px solid rgba(255,255,255,0.10)",
    }),
  };

  if (loading) {
    return (
      <div className="atlas-responsive-page" style={S.page}>
        <div style={S.titleWrap}>
          <h1 className="atlas-responsive-title" style={S.title}>Deal Room</h1>
          <div style={S.sub}>Loading pipeline intelligence…</div>
        </div>
      </div>
    );
  }

  return (
    <div className="atlas-responsive-page" style={S.page}>
      <div className="atlas-responsive-row" style={S.header}>
        <div style={S.titleWrap}>
          <h1 className="atlas-responsive-title" style={S.title}>Deal Room</h1>
          <div style={S.sub}>
            Manage pipeline movement, review deal pressure, and surface next best actions across the revenue board.
          </div>
        </div>

        <button  style={S.btn} onClick={load} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <div className="atlas-responsive-grid" style={S.signalStrip}>
        {signalStrip.map((item, idx) => (
          <div className="atlas-responsive-card" key={`${item}-${idx}`} style={S.signalPill}>
            {item}
          </div>
        ))}
      </div>

      <div className="atlas-responsive-metrics" style={S.kpiGrid}>
        <div className="atlas-responsive-card" style={S.kpi}>
          <div style={S.kpiLabel}>WEIGHTED PIPELINE</div>
          <div style={S.kpiValue}>{money(weightedPipeline)}</div>
          <div style={S.kpiSub}>
            Probability-adjusted value across all active and closed stages.
          </div>
        </div>

        <div className="atlas-responsive-card" style={S.kpi}>
          <div style={S.kpiLabel}>RAW PIPELINE</div>
          <div style={S.kpiValue}>{money(rawPipeline)}</div>
          <div style={S.kpiSub}>Total deal value represented across the board.</div>
        </div>

        <div className="atlas-responsive-card" style={S.kpi}>
          <div style={S.kpiLabel}>WIN RATE</div>
          <div style={S.kpiValue}>{winRate}%</div>
          <div style={S.kpiSub}>Closed won performance versus closed lost outcomes.</div>
        </div>

        <div className="atlas-responsive-card" style={S.kpi}>
          <div style={S.kpiLabel}>AVERAGE DEAL SIZE</div>
          <div style={S.kpiValue}>{money(avgDeal)}</div>
          <div style={S.kpiSub}>Average opportunity value across all deals in the system.</div>
        </div>

        <div className="atlas-responsive-card" style={S.kpi}>
          <div style={S.kpiLabel}>AVG CLOSE CONFIDENCE</div>
          <div style={S.kpiValue}>{avgProbability}%</div>
          <div style={S.kpiSub}>Average probability level across all opportunities.</div>
        </div>
      </div>

      <div className="atlas-responsive-grid" style={S.mainGrid}>
        <div style={S.boardWrap}>
          <div className="atlas-responsive-scroll" style={S.board}>
            {STAGES.map((stage) => {
              const list = columns.get(stage) || [];
              const stageValue = stageStats[stage]?.value || 0;
              const stageCount = stageStats[stage]?.count || 0;

              return (
                <div className="atlas-responsive-card" key={stage} style={S.column}>
                  <div style={S.columnTitle}>{stage}</div>
                  <div style={S.columnMeta}>
                    {stageCount} deals • {money(stageValue)}
                  </div>

                  {list.map((d) => {
                    const id = d._id || d.id;

                    return (
                      <div className="atlas-responsive-card"
                        key={id}
                        style={S.dealCard}
                        onClick={() => openDealDrawer(id, d)}
                      >
                        <div style={S.dealTitle}>{d.name || "Deal"}</div>

                        <div style={S.dealMeta}>
                          {money(d.amount)} • {safeNum(d.probability)}%
                        </div>

                        <select
                          style={S.select}
                          value={d.stage}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => {
                            e.stopPropagation();
                            onMoveDeal(id, e.target.value);
                          }}
                        >
                          {STAGES.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>

                        <div
                          style={S.btnDelete}
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteDeal(id);
                          }}
                        >
                          Delete
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>

        <div style={S.rightStack}>
          <div className="atlas-responsive-card" style={S.sideCard}>
            <div style={S.sectionTitle}>AI Deal Signals</div>
            <div style={S.list}>
              {dealSignals.map((item, idx) => (
                <div className="atlas-responsive-card" key={`${item}-${idx}`} style={S.listItem}>
                  <div style={S.listItemBody}>{item}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="atlas-responsive-card" style={S.sideCard}>
            <div style={S.sectionTitle}>Deal Risk Radar</div>
            <div style={S.list}>
              {dealRiskRadar.map((item, idx) => (
                <div className="atlas-responsive-card" key={`${item.label}-${idx}`} style={S.listItem}>
                  <div className="atlas-responsive-row"
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 10,
                      alignItems: "center",
                      marginBottom: 8,
                    }}
                  >
                    <div style={S.listItemTitle}>{item.label}</div>
                    <div style={S.radarTone(item.tone)}>{item.value}</div>
                  </div>
                  <div style={S.listItemBody}>{item.note}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="atlas-responsive-card" style={S.sideCard}>
            <div style={S.sectionTitle}>Recommended Actions</div>
            <div style={S.list}>
              {recommendedActions.map((item, idx) => (
                <div className="atlas-responsive-card" key={`${item}-${idx}`} style={S.listItem}>
                  <div style={S.listItemBody}>{item}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <DealDrawer
        open={drawerOpen}
        dealId={drawerDealId}
        initialDeal={drawerDeal}
        onClose={closeDrawer}
        onDealUpdated={load}
      />
    </div>
  );
}