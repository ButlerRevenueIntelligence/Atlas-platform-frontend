import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import OpportunityRadar from "../components/atlas/OpportunityRadar";
import RevenueTimeline from "../components/atlas/RevenueTimeline";
import { getDashboard } from "../api";

const safeNum = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const moneyCompact = (value) => {
  const number = safeNum(value);

  if (number >= 1000000) {
    return `$${(number / 1000000).toFixed(1)}M`;
  }

  if (number >= 1000) {
    return `$${Math.round(number / 1000)}K`;
  }

  return `$${Math.round(number)}`;
};

const normalizeStage = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();

const isClosedStage = (stage) => {
  const normalized = normalizeStage(stage);

  return (
    normalized.includes("closed won") ||
    normalized.includes("closed lost") ||
    normalized === "won" ||
    normalized === "lost"
  );
};

const isWonStage = (stage) => {
  const normalized = normalizeStage(stage);

  return normalized.includes("closed won") || normalized === "won";
};

const isLostStage = (stage) => {
  const normalized = normalizeStage(stage);

  return normalized.includes("closed lost") || normalized === "lost";
};

const isLateStage = (stage) => {
  const normalized = normalizeStage(stage);

  return (
    normalized.includes("proposal") ||
    normalized.includes("negotiation") ||
    normalized.includes("contract") ||
    normalized.includes("commit")
  );
};

const dealValue = (deal) =>
  safeNum(deal?.amount ?? deal?.value ?? deal?.pipelineValue);

const dealProbability = (deal) => {
  const probability = safeNum(deal?.probability);

  if (probability > 1) {
    return Math.min(probability / 100, 1);
  }

  return Math.min(Math.max(probability, 0), 1);
};

const formatDate = (value) => {
  if (!value) return "Unavailable";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unavailable";
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

export default function BoardMode() {
  const navigate = useNavigate();

  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [presenting, setPresenting] = useState(false);

  async function loadBoardMode() {
    try {
      setLoading(true);
      setLoadError("");

      const response = await getDashboard();
      setDashboard(response || null);
    } catch (error) {
      setLoadError(
        error?.message || "We couldn't load the board briefing."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBoardMode();
  }, []);

  useEffect(() => {
    function handleEscape(event) {
      if (event.key === "Escape") {
        setPresenting(false);
      }
    }

    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const workspaceMode = String(
    dashboard?.workspaceMode || "live"
  ).toLowerCase();

  const isDemo = workspaceMode === "demo";

  const orgName =
    dashboard?.activeWorkspace?.name ||
    dashboard?.org?.name ||
    "Workspace";

  const summary = dashboard?.summary || {};

  const metrics = useMemo(() => {
    const rows = Array.isArray(dashboard?.metrics)
      ? dashboard.metrics
      : [];

    return [...rows].sort((a, b) =>
      String(a?.date || "").localeCompare(String(b?.date || ""))
    );
  }, [dashboard]);

  const deals = useMemo(
    () => (Array.isArray(dashboard?.deals) ? dashboard.deals : []),
    [dashboard]
  );

  const liveCalculations = useMemo(() => {
    const revenue30 = safeNum(summary.revenue);

    const spend30 = metrics.reduce(
      (sum, metric) => sum + safeNum(metric?.spend),
      0
    );

    const leads30 = metrics.reduce(
      (sum, metric) => sum + safeNum(metric?.leads),
      0
    );

    const openDeals = deals.filter(
      (deal) => !isClosedStage(deal?.stage || deal?.status)
    );

    const wonDeals = deals.filter((deal) =>
      isWonStage(deal?.stage || deal?.status)
    );

    const lostDeals = deals.filter((deal) =>
      isLostStage(deal?.stage || deal?.status)
    );

    const lateStageDeals = openDeals.filter((deal) =>
      isLateStage(deal?.stage || deal?.status)
    );

    const openPipeline = openDeals.reduce(
      (sum, deal) => sum + dealValue(deal),
      0
    );

    const weightedPipeline = openDeals.reduce(
      (sum, deal) =>
        sum + dealValue(deal) * dealProbability(deal),
      0
    );

    const lateStagePipeline = lateStageDeals.reduce(
      (sum, deal) => sum + dealValue(deal),
      0
    );

    const largestDeal = openDeals.reduce(
      (largest, deal) =>
        dealValue(deal) > dealValue(largest) ? deal : largest,
      null
    );

    const largestDealValue = dealValue(largestDeal);

    const largestDealShare =
      openPipeline > 0 ? largestDealValue / openPipeline : 0;

    const coverage =
      revenue30 > 0 ? openPipeline / revenue30 : 0;

    const weightedCoverage =
      revenue30 > 0 ? weightedPipeline / revenue30 : 0;

    const costPerLead =
      leads30 > 0 ? spend30 / leads30 : 0;

    const probabilityConfidence =
      openPipeline > 0
        ? (weightedPipeline / openPipeline) * 100
        : 0;

    const confidence =
      openPipeline > 0
        ? Math.round(
            Math.min(
              95,
              Math.max(
                25,
                probabilityConfidence +
                  Math.min(coverage, 4) * 5
              )
            )
          )
        : 0;

    return {
      revenue30,
      spend30,
      leads30,
      openDeals,
      wonDeals,
      lostDeals,
      lateStageDeals,
      openPipeline,
      weightedPipeline,
      lateStagePipeline,
      largestDeal,
      largestDealValue,
      largestDealShare,
      coverage,
      weightedCoverage,
      costPerLead,
      confidence,
      revenueScore: safeNum(summary.revenueHealth),
    };
  }, [summary, metrics, deals]);

  const boardData = useMemo(() => {
    if (!isDemo) {
      return liveCalculations;
    }

    return {
      ...liveCalculations,
      revenue30: 1280000,
      spend30: 214000,
      leads30: 412,
      openPipeline: 4860000,
      weightedPipeline: 2940000,
      lateStagePipeline: 2180000,
      largestDealValue: 1240000,
      largestDealShare: 1240000 / 4860000,
      coverage: 3.8,
      weightedCoverage: 2.3,
      costPerLead: 519,
      confidence: 81,
      revenueScore: 84,
    };
  }, [isDemo, liveCalculations]);

  const hasData =
    boardData.revenue30 > 0 ||
    boardData.openPipeline > 0 ||
    boardData.openDeals.length > 0;

  const primaryRisk = useMemo(() => {
    if (!hasData) {
      return {
        label: "No Live Inputs",
        note: "Connect revenue and CRM data to activate board-level risk monitoring.",
      };
    }

    if (boardData.largestDealShare >= 0.35) {
      return {
        label: "Deal Concentration",
        note: `${Math.round(
          boardData.largestDealShare * 100
        )}% of open pipeline is concentrated in the largest opportunity.`,
      };
    }

    if (boardData.coverage < 2.5) {
      return {
        label: "Coverage Risk",
        note: `Open pipeline coverage is ${boardData.coverage.toFixed(
          1
        )}x against current 30-day revenue.`,
      };
    }

    if (
      boardData.lostDeals.length > boardData.wonDeals.length &&
      boardData.lostDeals.length > 0
    ) {
      return {
        label: "Loss Pressure",
        note: "Recent closed-lost volume is outpacing closed-won volume.",
      };
    }

    return {
      label: "Execution Timing",
      note: "Leadership attention should remain on deal movement and close timing.",
    };
  }, [boardData, hasData]);

  const risks = useMemo(() => {
    if (!hasData) {
      return [
        {
          priority: "High",
          title: "Insufficient board-level data",
          detail:
            "Revenue, pipeline, and opportunity inputs are not yet available.",
          exposure: "Not measurable",
        },
      ];
    }

    if (isDemo) {
      return [
        {
          priority: "High",
          title: "Late-stage deal concentration",
          detail:
            "Three late-stage opportunities carry a disproportionate share of the near-term outlook.",
          exposure: "$1.2M concentrated",
        },
        {
          priority: "Medium",
          title: "Weighted coverage remains exposed",
          detail:
            "Headline pipeline is healthy, but probability-weighted coverage is materially lower.",
          exposure: "$1.9M weighting gap",
        },
        {
          priority: "Medium",
          title: "Marketing efficiency pressure",
          detail:
            "A portion of spend remains allocated to channels producing below-target revenue efficiency.",
          exposure: "$21K recoverable spend",
        },
      ];
    }

    const items = [];

    if (boardData.largestDealShare >= 0.3) {
      items.push({
        priority: "High",
        title: "Deal concentration",
        detail: `${Math.round(
          boardData.largestDealShare * 100
        )}% of open pipeline depends on the largest opportunity.`,
        exposure: moneyCompact(boardData.largestDealValue),
      });
    }

    if (boardData.coverage > 0 && boardData.coverage < 3) {
      items.push({
        priority: boardData.coverage < 2 ? "High" : "Medium",
        title: "Pipeline coverage gap",
        detail: `Current open pipeline coverage is ${boardData.coverage.toFixed(
          1
        )}x, below the 3x planning benchmark.`,
        exposure: moneyCompact(
          Math.max(
            0,
            boardData.revenue30 * 3 -
              boardData.openPipeline
          )
        ),
      });
    }

    if (
      boardData.lostDeals.length > boardData.wonDeals.length &&
      boardData.lostDeals.length > 0
    ) {
      items.push({
        priority: "Medium",
        title: "Closed-lost pressure",
        detail: `${boardData.lostDeals.length} deals were lost compared with ${boardData.wonDeals.length} won.`,
        exposure: "Conversion impact",
      });
    }

    if (!items.length) {
      items.push({
        priority: "Low",
        title: "No critical risk elevated",
        detail:
          "Current workspace data does not show an immediate board-level revenue threat.",
        exposure: "Monitor",
      });
    }

    return items.slice(0, 3);
  }, [boardData, hasData, isDemo]);

  const actions = useMemo(() => {
    if (!hasData) {
      return [
        {
          priority: "Now",
          title: "Connect live revenue inputs",
          owner: "Revenue Operations",
          detail:
            "Connect CRM, revenue, and marketing data before relying on this briefing.",
        },
      ];
    }

    const items = [];

    if (boardData.largestDealShare >= 0.3) {
      items.push({
        priority: "Now",
        title: "Protect the largest opportunity",
        owner: "Executive Sponsor",
        detail:
          "Confirm decision criteria, executive alignment, and the next committed milestone.",
      });
    }

    if (boardData.coverage < 3) {
      items.push({
        priority: "Next 30 days",
        title: "Close the coverage gap",
        owner: "Revenue Leadership",
        detail:
          "Increase qualified mid-stage pipeline to reduce dependency on late-stage deals.",
      });
    }

    if (boardData.spend30 > 0) {
      items.push({
        priority: "Next review",
        title: "Reallocate inefficient spend",
        owner: "Marketing Leadership",
        detail:
          "Review channel-level revenue contribution before the next budget allocation.",
      });
    }

    if (!items.length) {
      items.push({
        priority: "Next review",
        title: "Preserve current momentum",
        owner: "Revenue Leadership",
        detail:
          "Maintain pipeline quality and monitor changes in deal probability and timing.",
      });
    }

    return items.slice(0, 3);
  }, [boardData, hasData]);

  const narrative = useMemo(() => {
    if (!hasData) {
      return `${orgName} does not yet have enough connected revenue and pipeline data to produce a reliable board briefing. Once data begins flowing, Atlas will summarize revenue health, pipeline protection, material risks, and the actions requiring leadership attention.`;
    }

    return `${orgName} is currently operating with ${moneyCompact(
      boardData.revenue30
    )} in tracked 30-day revenue and ${moneyCompact(
      boardData.openPipeline
    )} in open pipeline. Probability weighting reduces that pipeline outlook to ${moneyCompact(
      boardData.weightedPipeline
    )}, producing ${boardData.weightedCoverage.toFixed(
      1
    )}x weighted coverage. The primary board-level concern is ${primaryRisk.label.toLowerCase()}. Leadership should focus on protecting near-term deal movement while strengthening the quality and diversification of future pipeline.`;
  }, [boardData, hasData, orgName, primaryRisk]);

  const reportingPeriod = useMemo(() => {
    if (!metrics.length) {
      return "Latest available period";
    }

    const start = metrics[0]?.date;
    const end = metrics[metrics.length - 1]?.date;

    return `${formatDate(start)} – ${formatDate(end)}`;
  }, [metrics]);

  const lastUpdated = formatDate(
    dashboard?.dataAsOf || dashboard?.lastUpdated
  );

  if (loading) {
    return <PageMessage message="Preparing board briefing..." />;
  }

  if (loadError) {
    return (
      <PageMessage
        message={loadError}
        error
        onRetry={loadBoardMode}
      />
    );
  }

  return (
    <>
      <style>{`
        @media (max-width: 1050px) {
          .board-stat-grid,
          .board-two-column {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
        }

        @media (max-width: 680px) {
          .board-stat-grid,
          .board-two-column {
            grid-template-columns: 1fr !important;
          }

          .board-header {
            padding: 18px !important;
          }
        }

        @media print {
          body {
            background: #050814 !important;
          }

          .board-controls {
            display: none !important;
          }

          .board-print-root {
            position: static !important;
            overflow: visible !important;
          }

          .board-section {
            break-inside: avoid;
          }
        }
      `}</style>

      <div
        className="board-print-root"
        style={{
          ...styles.page,
          ...(presenting ? styles.presentationPage : {}),
        }}
      >
        <div style={styles.container}>
          <header className="board-header" style={styles.header}>
            <div>
              <div style={styles.eyebrow}>
                Atlas Executive Intelligence
              </div>

              <div style={styles.titleRow}>
                <h1 style={styles.title}>Board Briefing</h1>

                <span
                  style={
                    isDemo
                      ? styles.demoBadge
                      : styles.liveBadge
                  }
                >
                  {isDemo ? "Demo data" : "Live workspace"}
                </span>
              </div>

              <p style={styles.subtitle}>
                A concise view of revenue performance, forecast
                exposure, and the decisions requiring leadership
                attention for <strong>{orgName}</strong>.
              </p>

              <div style={styles.metaRow}>
                <span>Reporting period: {reportingPeriod}</span>
                <span>Data through: {lastUpdated}</span>
              </div>
            </div>

            <div className="board-controls" style={styles.controls}>
              <button
                type="button"
                onClick={loadBoardMode}
                style={styles.secondaryButton}
              >
                Refresh
              </button>

              <button
                type="button"
                onClick={() => window.print()}
                style={styles.secondaryButton}
              >
                Print / Save PDF
              </button>

              <button
                type="button"
                onClick={() => setPresenting(!presenting)}
                style={styles.primaryButton}
              >
                {presenting
                  ? "Exit Presentation"
                  : "Present Briefing"}
              </button>

              {!presenting ? (
                <button
                  type="button"
                  onClick={() => navigate("/overview")}
                  style={styles.secondaryButton}
                >
                  Exit
                </button>
              ) : null}
            </div>
          </header>

          <section className="board-stat-grid" style={styles.statGrid}>
            <StatCard
              label="Revenue Health"
              value={`${Math.round(boardData.revenueScore)} / 100`}
              note="Overall revenue-engine health based on available workspace inputs."
            />

            <StatCard
              label="30-Day Revenue"
              value={moneyCompact(boardData.revenue30)}
              note="Tracked revenue during the current reporting window."
            />

            <StatCard
              label="Open Pipeline"
              value={moneyCompact(boardData.openPipeline)}
              note={`${boardData.coverage.toFixed(
                1
              )}x coverage against current 30-day revenue.`}
            />

            <StatCard
              label="Weighted Pipeline"
              value={moneyCompact(boardData.weightedPipeline)}
              note={`${boardData.confidence}% directional confidence based on deal probability and coverage.`}
            />
          </section>

          <section className="board-section" style={styles.section}>
            <SectionHeading
              eyebrow="Executive summary"
              title="Board Narrative"
            />

            <p style={styles.narrative}>{narrative}</p>

            <div style={styles.riskCallout}>
              <div>
                <div style={styles.calloutLabel}>Primary risk</div>
                <div style={styles.calloutValue}>
                  {primaryRisk.label}
                </div>
              </div>

              <div style={styles.calloutNote}>
                {primaryRisk.note}
              </div>
            </div>
          </section>

          <div className="board-two-column" style={styles.twoColumn}>
            <section className="board-section" style={styles.section}>
              <SectionHeading
                eyebrow="What could change the outlook"
                title="Strategic Risks"
              />

              <div style={styles.list}>
                {risks.map((risk) => (
                  <RiskItem key={risk.title} risk={risk} />
                ))}
              </div>
            </section>

            <section className="board-section" style={styles.section}>
              <SectionHeading
                eyebrow="Leadership response"
                title="Executive Actions"
              />

              <div style={styles.list}>
                {actions.map((action) => (
                  <ActionItem key={action.title} action={action} />
                ))}
              </div>
            </section>
          </div>

          <div className="board-two-column" style={styles.twoColumn}>
            <section className="board-section" style={styles.section}>
              <SectionHeading
                eyebrow="Value creation scenarios"
                title="Strategic Opportunities"
              />

              <OpportunityRadar
                openPipeline={boardData.openPipeline}
                weightedPipeline={boardData.weightedPipeline}
                revenue={boardData.revenue30}
                spend={boardData.spend30}
                coverage={boardData.coverage}
              />
            </section>

            <section className="board-section" style={styles.section}>
              <SectionHeading
                eyebrow="Directional projection"
                title="Revenue Outlook"
              />

              <RevenueTimeline
                revenue30={boardData.revenue30}
                weightedPipeline={boardData.weightedPipeline}
                confidence={boardData.confidence}
              />
            </section>
          </div>

          <footer style={styles.footer}>
            <span>
              Generated by Atlas Revenue AI for {orgName}
            </span>

            <span>
              Directional intelligence—not a committed financial
              forecast.
            </span>
          </footer>
        </div>
      </div>
    </>
  );
}

function StatCard({ label, value, note }) {
  return (
    <div style={styles.statCard}>
      <div style={styles.statLabel}>{label}</div>
      <div style={styles.statValue}>{value}</div>
      <div style={styles.statNote}>{note}</div>
    </div>
  );
}

function SectionHeading({ eyebrow, title }) {
  return (
    <div style={styles.sectionHeading}>
      <div style={styles.sectionEyebrow}>{eyebrow}</div>
      <h2 style={styles.sectionTitle}>{title}</h2>
    </div>
  );
}

function RiskItem({ risk }) {
  const high = risk.priority === "High";
  const medium = risk.priority === "Medium";

  return (
    <div style={styles.listItem}>
      <div style={styles.listTop}>
        <span
          style={{
            ...styles.priorityBadge,
            color: high
              ? "#fca5a5"
              : medium
              ? "#fde68a"
              : "#86efac",
            background: high
              ? "rgba(239,68,68,0.12)"
              : medium
              ? "rgba(245,158,11,0.12)"
              : "rgba(34,197,94,0.12)",
          }}
        >
          {risk.priority}
        </span>

        <span style={styles.exposure}>{risk.exposure}</span>
      </div>

      <div style={styles.itemTitle}>{risk.title}</div>
      <div style={styles.itemDetail}>{risk.detail}</div>
    </div>
  );
}

function ActionItem({ action }) {
  return (
    <div style={styles.listItem}>
      <div style={styles.listTop}>
        <span style={styles.actionBadge}>{action.priority}</span>
        <span style={styles.owner}>{action.owner}</span>
      </div>

      <div style={styles.itemTitle}>{action.title}</div>
      <div style={styles.itemDetail}>{action.detail}</div>
    </div>
  );
}

function PageMessage({ message, error, onRetry }) {
  return (
    <div style={styles.page}>
      <div style={styles.messageCard}>
        <div
          style={{
            color: error ? "#fecaca" : "#ffffff",
            fontSize: 18,
            fontWeight: 900,
          }}
        >
          {message}
        </div>

        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            style={{
              ...styles.primaryButton,
              marginTop: 15,
            }}
          >
            Try Again
          </button>
        ) : null}
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    padding: "16px 16px 34px",
    color: "#eaf0ff",
    background:
      "radial-gradient(900px 500px at 15% 0%, rgba(37,99,235,0.17), transparent 55%), radial-gradient(900px 500px at 85% 0%, rgba(124,92,255,0.11), transparent 55%), linear-gradient(180deg, #050814 0%, #070b18 100%)",
  },

  presentationPage: {
    position: "fixed",
    inset: 0,
    zIndex: 9999,
    overflowY: "auto",
  },

  container: {
    width: "100%",
    maxWidth: 1380,
    margin: "0 auto",
    display: "grid",
    gap: 13,
  },

  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    flexWrap: "wrap",
    gap: 20,
    padding: "22px",
    borderRadius: 20,
    border: "1px solid rgba(255,255,255,0.09)",
    background:
      "linear-gradient(135deg, rgba(30,64,175,0.20), rgba(79,70,229,0.10), rgba(255,255,255,0.02))",
  },

  eyebrow: {
    color: "#7dd3fc",
    fontSize: 10,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.18em",
  },

  titleRow: {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 7,
  },

  title: {
    margin: 0,
    color: "#ffffff",
    fontSize: 29,
    lineHeight: 1.1,
  },

  demoBadge: {
    padding: "5px 9px",
    borderRadius: 999,
    border: "1px solid rgba(245,158,11,0.24)",
    background: "rgba(245,158,11,0.11)",
    color: "#fde68a",
    fontSize: 10,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },

  liveBadge: {
    padding: "5px 9px",
    borderRadius: 999,
    border: "1px solid rgba(34,197,94,0.24)",
    background: "rgba(34,197,94,0.11)",
    color: "#86efac",
    fontSize: 10,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },

  subtitle: {
    maxWidth: 760,
    margin: "9px 0 0",
    color: "rgba(226,232,240,0.82)",
    fontSize: 14,
    lineHeight: 1.55,
  },

  metaRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: "6px 18px",
    marginTop: 12,
    color: "rgba(148,163,184,0.78)",
    fontSize: 11,
  },

  controls: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
  },

  primaryButton: {
    padding: "10px 14px",
    border: "1px solid rgba(96,165,250,0.48)",
    borderRadius: 11,
    background: "linear-gradient(135deg, #2563eb, #4f46e5)",
    color: "#ffffff",
    fontSize: 12,
    fontWeight: 850,
    cursor: "pointer",
  },

  secondaryButton: {
    padding: "10px 13px",
    border: "1px solid rgba(255,255,255,0.11)",
    borderRadius: 11,
    background: "rgba(255,255,255,0.045)",
    color: "#eaf0ff",
    fontSize: 12,
    fontWeight: 800,
    cursor: "pointer",
  },

  statGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 11,
  },

  statCard: {
    minHeight: 125,
    padding: 16,
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.03)",
  },

  statLabel: {
    color: "rgba(148,163,184,0.85)",
    fontSize: 9,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.14em",
  },

  statValue: {
    marginTop: 10,
    color: "#ffffff",
    fontSize: 26,
    fontWeight: 900,
    lineHeight: 1.1,
  },

  statNote: {
    marginTop: 8,
    color: "rgba(203,213,225,0.69)",
    fontSize: 11,
    lineHeight: 1.5,
  },

  section: {
    padding: 17,
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.028)",
  },

  sectionHeading: {
    marginBottom: 14,
  },

  sectionEyebrow: {
    color: "rgba(148,163,184,0.72)",
    fontSize: 9,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.15em",
  },

  sectionTitle: {
    margin: "5px 0 0",
    color: "#ffffff",
    fontSize: 18,
  },

  narrative: {
    maxWidth: 1120,
    margin: 0,
    color: "#e3ebf7",
    fontSize: 14,
    lineHeight: 1.75,
  },

  riskCallout: {
    display: "grid",
    gridTemplateColumns: "minmax(150px, 0.3fr) minmax(260px, 1fr)",
    alignItems: "center",
    gap: 18,
    marginTop: 16,
    padding: 13,
    borderRadius: 13,
    border: "1px solid rgba(245,158,11,0.17)",
    background: "rgba(245,158,11,0.055)",
  },

  calloutLabel: {
    color: "#fde68a",
    fontSize: 9,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.12em",
  },

  calloutValue: {
    marginTop: 5,
    color: "#ffffff",
    fontSize: 17,
    fontWeight: 900,
  },

  calloutNote: {
    color: "rgba(226,232,240,0.78)",
    fontSize: 12,
    lineHeight: 1.55,
  },

  twoColumn: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 13,
  },

  list: {
    display: "grid",
    gap: 9,
  },

  listItem: {
    padding: 13,
    borderRadius: 13,
    border: "1px solid rgba(255,255,255,0.07)",
    background: "rgba(2,6,18,0.32)",
  },

  listTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },

  priorityBadge: {
    padding: "4px 8px",
    borderRadius: 999,
    fontSize: 9,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },

  actionBadge: {
    padding: "4px 8px",
    borderRadius: 999,
    background: "rgba(59,130,246,0.12)",
    color: "#93c5fd",
    fontSize: 9,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },

  exposure: {
    color: "#fca5a5",
    fontSize: 10,
    fontWeight: 800,
  },

  owner: {
    color: "rgba(148,163,184,0.78)",
    fontSize: 10,
    fontWeight: 800,
  },

  itemTitle: {
    marginTop: 9,
    color: "#ffffff",
    fontSize: 14,
    fontWeight: 850,
  },

  itemDetail: {
    marginTop: 5,
    color: "rgba(203,213,225,0.72)",
    fontSize: 11,
    lineHeight: 1.55,
  },

  footer: {
    display: "flex",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 8,
    padding: "5px 2px",
    color: "rgba(148,163,184,0.52)",
    fontSize: 9,
  },

  messageCard: {
    maxWidth: 720,
    margin: "60px auto",
    padding: 24,
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.03)",
    textAlign: "center",
  },
};
