import "./ExecutiveWorkspaces.css";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  getRevenueIntelBoard,
} from "../api";
import DealDrawer from "../components/DealDrawer.jsx";
import LeadershipBriefing from "../components/LeadershipBriefing.jsx";

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

const moneyCompact = (n) => {
  const num = safeNum(n);
  const abs = Math.abs(num);
  if (abs >= 1_000_000_000) return `$${(num / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `$${(num / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `$${Math.round(num / 1_000)}K`;
  return money(num);
};

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

const formatDate = (value) => {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString();
};

const toneColor = (tone) => {
  if (tone === "bad") return "#FB7185";
  if (tone === "warn") return "#F59E0B";
  return "#22C55E";
};

const sectionCount = (arr, fallbackCount) => {
  return safeNum(fallbackCount ?? arr?.length ?? 0);
};

function boardHasMeaningfulData(board) {
  const exec = board?.execution || {};
  const react = board?.reactivation || {};
  const wl = board?.winLoss || {};

  const overdue = sectionCount(exec.overdue, exec.counts?.overdue);
  const dueToday = sectionCount(exec.dueToday, exec.counts?.dueToday);
  const upcoming = sectionCount(exec.upcoming, exec.counts?.upcoming);
  const reactCount = safeNum(react.count ?? react.items?.length ?? 0);
  const won = safeNum(wl.won);
  const lost = safeNum(wl.lost);

  return overdue > 0 || dueToday > 0 || upcoming > 0 || reactCount > 0 || won > 0 || lost > 0;
}

export default function RevenueIntel() {
  const nav = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [reactivateAfterDays, setReactivateAfterDays] = useState(30);
  const [data, setData] = useState(null);
  const [executionView, setExecutionView] = useState("overdue");

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerDealId, setDrawerDealId] = useState("");
  const [drawerDeal, setDrawerDeal] = useState(null);

  const atlasDemoWorkspace = data?.workspaceMode === "demo";

  const openDealDrawerById = (id, dealObj = null) => {
    if (!id) return;
    setDrawerOpen(true);
    setDrawerDealId(id);
    setDrawerDeal(dealObj || null);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setDrawerDealId("");
    setDrawerDeal(null);
  };

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const res = await getRevenueIntelBoard({ reactivateAfterDays });
      setData(res || null);
    } catch (e) {
      setError(e?.message || "Failed to load Revenue Intelligence");
    } finally {
      setLoading(false);
    }
  }, [reactivateAfterDays]);

  useEffect(() => {
    load();
  }, [load]);

  const effectiveData = useMemo(() => {
    if (boardHasMeaningfulData(data)) return data;

    return {
      execution: {
        overdue: [],
        dueToday: [],
        upcoming: [],
        counts: { overdue: 0, dueToday: 0, upcoming: 0 },
      },
      reactivation: {
        items: [],
        count: 0,
        reactivateAfterDays,
      },
      winLoss: {
        won: 0,
        lost: 0,
        winRate: 0,
        avgWon: 0,
        avgLost: 0,
        avgCycleDaysWon: 0,
        avgCycleDaysLost: 0,
      },
    };
  }, [data, reactivateAfterDays]);

  const exec = effectiveData?.execution || {
    overdue: [],
    dueToday: [],
    upcoming: [],
    counts: {},
  };

  const react = effectiveData?.reactivation || {
    items: [],
    count: 0,
    reactivateAfterDays,
  };

  const wl = effectiveData?.winLoss || {
    won: 0,
    lost: 0,
    winRate: 0,
    avgWon: 0,
    avgLost: 0,
    avgCycleDaysWon: 0,
    avgCycleDaysLost: 0,
  };

  const overdueCount = sectionCount(exec.overdue, exec.counts?.overdue);
  const dueTodayCount = sectionCount(exec.dueToday, exec.counts?.dueToday);
  const upcomingCount = sectionCount(exec.upcoming, exec.counts?.upcoming);
  const reactCount = safeNum(react.count ?? react.items?.length ?? 0);

  const allExecutionDeals = useMemo(() => {
    return [...(exec.overdue || []), ...(exec.dueToday || []), ...(exec.upcoming || [])];
  }, [exec]);

  const weightedValue = useMemo(() => {
    return allExecutionDeals.reduce(
      (sum, d) => sum + safeNum(d.amount) * (safeNum(d.probability) / 100),
      0
    );
  }, [allExecutionDeals]);

  const totalPipeline = useMemo(() => {
    return allExecutionDeals.reduce((sum, d) => sum + safeNum(d.amount), 0);
  }, [allExecutionDeals]);

  const avgProbability = useMemo(() => {
    if (!allExecutionDeals.length) return 0;
    return (
      allExecutionDeals.reduce((sum, d) => sum + safeNum(d.probability), 0) /
      allExecutionDeals.length
    );
  }, [allExecutionDeals]);

  const executionPressureScore = useMemo(() => {
    return clamp(overdueCount * 12 + dueTodayCount * 7 + upcomingCount * 2, 0, 100);
  }, [overdueCount, dueTodayCount, upcomingCount]);

  const riskTone = useMemo(() => {
    if (executionPressureScore >= 70) return "bad";
    if (executionPressureScore >= 35) return "warn";
    return "good";
  }, [executionPressureScore]);

  const topRecommendations = useMemo(() => {
    const items = [];

    if (overdueCount > 0) {
      items.push({
        title: "Clear overdue deal actions",
        body: `${overdueCount} deal actions are overdue and need immediate attention.`,
      });
    }

    if (reactCount > 0) {
      items.push({
        title: "Launch reactivation outreach",
        body: `${reactCount} inactive open opportunities are ready for reactivation.`,
      });
    }

    if (safeNum(wl.winRate) > 0 && safeNum(wl.winRate) < 30) {
      items.push({
        title: "Improve deal quality and close strategy",
        body: `Current win rate is ${Math.round(safeNum(wl.winRate))}%. Review qualification and late-stage follow-up.`,
      });
    }

    if (avgProbability < 45 && allExecutionDeals.length > 0) {
      items.push({
        title: "Increase confidence in pipeline",
        body: "Average close probability is soft. Tighten next-step discipline and qualification.",
      });
    }

    if (items.length === 0 && allExecutionDeals.length > 0) {
      items.push({
        title: "Execution is stable",
        body: "No major workflow pressure detected. Focus on pipeline growth and faster conversions.",
      });
    }

    if (!allExecutionDeals.length && !reactCount) {
      items.push({
        title: "No live revenue board data yet",
        body: "Connect your live workflow or create deals and activities so Atlas can surface execution pressure, reactivation, and win/loss intelligence.",
      });
    }

    return items.slice(0, 4);
  }, [overdueCount, reactCount, wl, avgProbability, allExecutionDeals.length]);

  const executiveSummary = useMemo(() => {
    if (!allExecutionDeals.length && !reactCount && !safeNum(wl.won) && !safeNum(wl.lost)) {
      return "This workspace does not have live command-center activity yet. Once deals, next actions, and outcomes begin flowing into Atlas, this page will start showing execution pressure, reactivation candidates, and win/loss intelligence.";
    }

    if (overdueCount > 0) {
      return `Atlas detects elevated execution pressure with ${overdueCount} overdue actions and ${dueTodayCount} actions due today. Priority should be given to clearing stalled opportunities, protecting forecast movement, and restoring sales momentum.`;
    }

    if (reactCount > 0) {
      return `Execution pressure is under control. The biggest immediate opportunity is reactivation, with ${reactCount} closed-lost deals ready for outreach and near-term revenue recovery.`;
    }

    return `The revenue engine is operating with controlled execution pressure. Atlas recommends shifting focus toward opportunity creation, faster follow-up, and improving close rates across active pipeline.`;
  }, [overdueCount, dueTodayCount, reactCount, allExecutionDeals.length, wl]);

  const signals = useMemo(() => {
    const list = [];

    if (overdueCount > 0) list.push(`⚠ ${overdueCount} overdue deal actions detected`);
    if (dueTodayCount > 0) list.push(`⚠ ${dueTodayCount} actions due today`);
    if (reactCount > 0) list.push(`↺ ${reactCount} reactivation opportunities surfaced`);
    if (safeNum(wl.winRate) > 0) list.push(`✓ Current win rate is ${Math.round(safeNum(wl.winRate))}%`);
    if (allExecutionDeals.length > 0) {
      list.push(`• ${allExecutionDeals.length} active execution opportunities tracked`);
    }

    if (!list.length) {
      list.push("• No live execution signals detected yet");
    }

    return list.slice(0, 5);
  }, [overdueCount, dueTodayCount, reactCount, wl, allExecutionDeals.length]);

  const aiInsights = useMemo(() => {
    const items = [];

    if (weightedValue > 0) {
      items.push(`Probability-adjusted execution value currently sits at ${money(weightedValue)}.`);
    }
    if (totalPipeline > 0) {
      items.push(`Atlas is tracking ${money(totalPipeline)} in active execution pipeline.`);
    }
    if (avgProbability > 0) {
      items.push(`Average close confidence across the current board is ${Math.round(avgProbability)}%.`);
    }
    if (overdueCount > 0) {
      items.push(`Overdue actions are the biggest source of forecast friction right now.`);
    }
    if (reactCount > 0) {
      items.push(`The reactivation queue can unlock near-term revenue without net-new acquisition costs.`);
    }
    if (safeNum(wl.avgCycleDaysWon) > 0) {
      items.push(`Average closed-won sales cycle is ${wl.avgCycleDaysWon} days.`);
    }

    if (!items.length) {
      items.push("Atlas will begin surfacing execution intelligence here once live deal activity is present in the workspace.");
    }

    return items.slice(0, 5);
  }, [weightedValue, totalPipeline, avgProbability, overdueCount, reactCount, wl]);

  const systemHealthLabel = useMemo(() => {
    if (!allExecutionDeals.length && !reactCount) return "No Live Data";
    if (riskTone === "bad") return "High Pressure";
    if (riskTone === "warn") return "Watch Closely";
    return "Stable";
  }, [riskTone, allExecutionDeals.length, reactCount]);

  const pressureFillWidth = `${clamp(executionPressureScore, 0, 100)}%`;

  const toDrawerDeal = (d) => {
    if (!d) return null;
    return {
      _id: d.id || d._id,
      id: d.id || d._id,
      name: d.name,
      stage: d.stage,
      amount: d.amount,
      probability: d.probability,
      ownerName: d.ownerName,
      nextAction: d.nextAction || d.suggested,
      nextActionDueAt: d.dueAt || d.nextActionDueAt,
      lastActivityAt: d.lastActivityAt,
      clientId: d.clientId || (d.clientName ? { name: d.clientName } : undefined),
      clientName: d.clientName,
      closedReason: d.closedReason,
      competitor: d.competitor,
      reactivationAt: d.reactivationAt,
    };
  };

  const S = {
    page: {
      minHeight: "100vh",
      padding: 22,
      color: "#EAF0FF",
      background:
        "radial-gradient(1200px 700px at 15% 15%, rgba(124,92,255,0.22), transparent 60%), radial-gradient(1000px 650px at 85% 30%, rgba(56,189,248,0.18), transparent 60%), linear-gradient(180deg, rgba(5,8,18,1) 0%, rgba(7,12,28,1) 55%, rgba(5,8,18,1) 100%)",
    },
    statusBar: {
      display: "flex",
      gap: 12,
      flexWrap: "wrap",
      padding: "10px 14px",
      borderRadius: 14,
      border: "1px solid rgba(255,255,255,0.08)",
      background: "rgba(255,255,255,0.03)",
      marginBottom: 14,
      fontSize: 12,
      opacity: 0.95,
    },
    headerRow: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: 12,
      flexWrap: "wrap",
    },
    title: { margin: 0, fontSize: 30, fontWeight: 900 },
    subtitle: { marginTop: 6, fontSize: 13, opacity: 0.82, maxWidth: 820, lineHeight: 1.55 },
    pill: {
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      padding: "6px 10px",
      borderRadius: 999,
      border: "1px solid rgba(255,255,255,0.10)",
      background: "rgba(255,255,255,0.04)",
      fontSize: 12,
      opacity: 0.95,
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
    btnGhost: {
      borderRadius: 999,
      padding: "10px 14px",
      border: "1px solid rgba(255,255,255,0.10)",
      background: "rgba(0,0,0,0.16)",
      color: "#EAF0FF",
      fontWeight: 900,
      fontSize: 12,
      cursor: "pointer",
      opacity: 0.98,
    },
    heroCard: {
      marginTop: 14,
      borderRadius: 18,
      padding: 18,
      border: "1px solid rgba(255,255,255,0.08)",
      background:
        "linear-gradient(135deg, rgba(124,92,255,0.16), rgba(56,189,248,0.10), rgba(255,255,255,0.03))",
    },
    heroGrid: {
      display: "grid",
      gridTemplateColumns: "minmax(0, 1.8fr) minmax(280px, 1fr)",
      gap: 18,
      alignItems: "center",
    },
    pressureCard: {
      borderRadius: 16,
      padding: 14,
      border: "1px solid rgba(255,255,255,0.08)",
      background: "rgba(10,16,35,0.34)",
    },
    pressureTrack: {
      height: 10,
      borderRadius: 999,
      overflow: "hidden",
      background: "rgba(255,255,255,0.08)",
      marginTop: 12,
    },
    pressureFill: {
      height: "100%",
      borderRadius: 999,
      background: `linear-gradient(90deg, ${toneColor(riskTone)}, rgba(255,255,255,0.95))`,
      width: pressureFillWidth,
      transition: "width 250ms ease",
    },
    kpiGrid: {
      marginTop: 14,
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
      gap: 12,
    },
    kpiCard: {
      borderRadius: 16,
      padding: 16,
      border: "1px solid rgba(255,255,255,0.08)",
      background: "rgba(10, 16, 35, 0.35)",
    },
    kpiLabel: { fontSize: 12, opacity: 0.78, letterSpacing: 0.8 },
    kpiValue: { marginTop: 8, fontSize: 28, fontWeight: 900 },
    kpiSub: { marginTop: 8, fontSize: 12, opacity: 0.82, lineHeight: 1.45 },
    mainGrid: {
      marginTop: 14,
      display: "grid",
      gridTemplateColumns: "minmax(0, 2fr) minmax(320px, 1fr)",
      gap: 14,
      alignItems: "start",
    },
    leftStack: { display: "grid", gap: 14 },
    rightStack: { display: "grid", gap: 14 },
    card: {
      borderRadius: 16,
      padding: 16,
      border: "1px solid rgba(255,255,255,0.08)",
      background: "rgba(255,255,255,0.04)",
    },
    panelGrid: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
      gap: 12,
    },
    panel: {
      borderRadius: 16,
      padding: 14,
      border: "1px solid rgba(255,255,255,0.08)",
      background: "rgba(10, 16, 35, 0.35)",
      minHeight: 260,
    },
    panelTitle: { fontWeight: 900, fontSize: 13, letterSpacing: 0.7, opacity: 0.95 },
    row: {
      marginTop: 10,
      borderRadius: 12,
      padding: 10,
      border: "1px solid rgba(255,255,255,0.08)",
      background: "rgba(255,255,255,0.04)",
      cursor: "pointer",
    },
    rowStatic: {
      marginTop: 10,
      borderRadius: 12,
      padding: 10,
      border: "1px solid rgba(255,255,255,0.08)",
      background: "rgba(255,255,255,0.04)",
      cursor: "default",
    },
    small: { fontSize: 12, opacity: 0.85, lineHeight: 1.5 },
    badge: (tone) => ({
      display: "inline-flex",
      alignItems: "center",
      padding: "4px 10px",
      borderRadius: 999,
      border: "1px solid rgba(255,255,255,0.12)",
      background: "rgba(255,255,255,0.04)",
      fontSize: 11,
      fontWeight: 900,
      letterSpacing: 0.7,
      color: toneColor(tone),
    }),
    insightCard: {
      borderRadius: 16,
      padding: 14,
      border: "1px solid rgba(255,255,255,0.08)",
      background: "rgba(10,16,35,0.35)",
    },
    error: {
      marginTop: 12,
      borderRadius: 12,
      padding: 12,
      border: "1px solid rgba(255,0,0,0.25)",
      background: "rgba(255,0,0,0.10)",
    },
    input: {
      width: 90,
      borderRadius: 10,
      padding: "8px 10px",
      border: "1px solid rgba(255,255,255,0.10)",
      background: "rgba(0,0,0,0.20)",
      color: "#EAF0FF",
      outline: "none",
      fontWeight: 800,
    },
    divider: {
      height: 1,
      background: "rgba(255,255,255,0.08)",
      margin: "10px 0 0",
    },
    demoBanner: {
      marginTop: 12,
      borderRadius: 12,
      padding: 12,
      border: "1px solid rgba(56,189,248,0.24)",
      background: "rgba(56,189,248,0.08)",
      fontSize: 12,
      lineHeight: 1.5,
    },
  };

  return (
    <div className="atlas-responsive-page" style={S.page}>
      <div className="atlas-responsive-card atlas-responsive-row" style={S.statusBar}>
        <span>Systems Online</span>
        <span>Revenue Engine Active</span>
        <span>Forecast Model Running</span>
        <span>Atlas AI Monitoring</span>
        <span>⚠ {signals.length} Signals Detected</span>
      </div>

      <div className="atlas-responsive-row" style={S.headerRow}>
        <div>
          <h2 className="atlas-responsive-title" style={S.title}>Atlas Revenue Command Center</h2>
          <Link to="/revenue-planning" style={{color:"#9ee8f3",display:"inline-block",padding:"8px 0"}}>Review targets & forecast history →</Link>
          <Link to="/revenue-to-cash" style={{color:"#9ee8f3",display:"inline-block",padding:"8px 16px"}}>Trace revenue to cash →</Link>
          <div style={S.subtitle}>
            Real-time revenue execution, deal follow-up pressure, win/loss visibility, and reactivation intelligence across the active board.
          </div>
        </div>


      </div>

      <LeadershipBriefing onOpenDeal={openDealDrawerById} />



      {error ? <div className="atlas-responsive-card" style={S.error}>{error}</div> : null}

      <section className="executive-workspace execution-workspace" aria-label="Execution board">
        <header className="ew-heading">
          <div><span className="ew-eyebrow">EXECUTION BOARD</span><h2>Turn priorities into progress.</h2><p>Review the next buyer action, accountable owner, and due date.</p></div>
          <button className="ew-button" onClick={load} disabled={loading}>{loading ? "Refreshing…" : "Refresh board"}</button>
        </header>
        <div className="ew-metrics">
          <div><span>Queue value</span><strong>{moneyCompact(totalPipeline)}</strong></div>
          <div><span>Weighted queue</span><strong>{moneyCompact(weightedValue)}</strong></div>
          <div><span>Execution pressure</span><strong>{executionPressureScore}<small> / 100</small></strong><span>{systemHealthLabel}</span></div>
          <div><span>Win rate</span><strong>{Math.round(safeNum(wl.winRate))}%</strong></div>
        </div>
        <div className="ew-toolbar" role="group" aria-label="Choose execution queue">
          {[["overdue","Overdue",overdueCount],["today","Due today",dueTodayCount],["upcoming","Upcoming",upcomingCount],["reactivation","Reactivation",reactCount]].map(([key,label,count]) => <button key={key} className="ew-tab" aria-pressed={executionView===key} onClick={()=>setExecutionView(key)}>{label}<span>{count}</span></button>)}
        </div>
        <div className="ew-queue" aria-live="polite">
          <div className="ew-queue-label"><span>Opportunity / next action</span><span>Owner</span><span>Due / last activity</span><span>Deal value</span></div>
          {(executionView==="overdue" ? exec.overdue || [] : executionView==="today" ? exec.dueToday || [] : executionView==="upcoming" ? exec.upcoming || [] : react.items || []).map((d) => <button className="ew-queue-row" key={d.id || d._id} onClick={()=>openDealDrawerById(d.id || d._id,toDrawerDeal(d))}>
            <div><strong>{d.name || "Untitled opportunity"}</strong><span>{d.clientName || d.stage || "Account not recorded"}</span><p>{d.nextAction || d.suggested || "Next action not recorded"}</p></div>
            <div>{d.ownerName || "Owner not recorded"}</div>
            <div>{executionView==="reactivation" ? `${safeNum(d.lastTouchAgeDays)} days since activity` : formatDate(d.dueAt)}</div>
            <div className="ew-amount">{money(d.amount)} <span aria-hidden="true">↗</span></div>
          </button>)}
          {!(executionView==="overdue" ? exec.overdue || [] : executionView==="today" ? exec.dueToday || [] : executionView==="upcoming" ? exec.upcoming || [] : react.items || []).length && <div className="ew-empty"><strong>No {executionView==="today" ? "actions due today" : executionView==="reactivation" ? "reactivation candidates" : `${executionView} actions`}.</strong><p>Choose another queue to review its opportunities.</p></div>}
        </div>
        <div className="ew-two-column">
          <details className="ew-detail"><summary>Leadership notes <span>Summary & recommendations</span></summary><div className="ew-detail-body"><p>{executiveSummary}</p><details><summary>Supporting signals</summary><div className="ew-note">{signals.map((item,i)=><p key={i}>{item}</p>)}{aiInsights.map((item,i)=><p key={`insight-${i}`}>{item}</p>)}</div></details>{topRecommendations.map((item,i)=><div className="ew-note" key={i}><strong>{item.title}</strong><p>{item.body}</p></div>)}</div></details>
          <details className="ew-detail"><summary>Outcomes & rules <span>Win/loss & reactivation</span></summary><div className="ew-detail-body"><p>{wl.won} won · {wl.lost} lost · {Math.round(safeNum(wl.winRate))}% win rate</p><p>Average won: {money(wl.avgWon)} · Average lost: {money(wl.avgLost)}</p><label className="ew-rule">Reactivation after <input type="number" min="1" value={reactivateAfterDays} onChange={e=>setReactivateAfterDays(Math.max(1,Number(e.target.value)||1))} /> days without activity</label><button className="ew-button" onClick={load} disabled={loading}>Refresh with threshold</button></div></details>
        </div>
        <footer className="ew-links"><Link to="/deal-room">Deal Room →</Link><Link to="/board-mode">Executive Board →</Link><Link to="/atlas-ai-operator">Ask Atlas →</Link></footer>
      </section>

      {atlasDemoWorkspace ? (drawerOpen && <div role="dialog" aria-modal="true" aria-label="Sample opportunity details" style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,.75)", display: "grid", placeItems: "center", padding: 24 }} onClick={closeDrawer}>
        <div className="atlas-responsive-card" style={{ background: "#0b1730", color: "#fff", borderRadius: 16, padding: 24, maxWidth: 600, width: "100%" }} onClick={event => event.stopPropagation()}>
          <button  onClick={closeDrawer} style={S.btn}>Close</button>
          <h2>{drawerDeal?.name}</h2><p>Sample opportunity · read only</p>
          <p>{drawerDeal?.clientName} · {money(drawerDeal?.amount)} · {drawerDeal?.stage}</p>
          <p>Owner: {drawerDeal?.ownerName || "Owner not recorded"}</p>
          <p>Next action: {drawerDeal?.nextAction || drawerDeal?.suggested || "Review the buyer action plan."}</p>
          <p>Due: {formatDate(drawerDeal?.dueAt || drawerDeal?.nextActionDueAt)}</p>
        </div>
      </div>) : <DealDrawer
        open={drawerOpen}
        dealId={drawerDealId}
        initialDeal={drawerDeal}
        onClose={closeDrawer}
        onDealUpdated={load}
      />}
    </div>
  );
}