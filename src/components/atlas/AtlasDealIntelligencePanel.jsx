import { Link } from "react-router-dom";
import React, { useMemo } from "react";

const safeNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const moneyCompact = (num) => {
  const n = safeNum(num);
  if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `$${(n / 1000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
};

function normalizeStage(stage) {
  const s = String(stage || "").toLowerCase();
  if (s.includes("disc")) return "Discovery";
  if (s.includes("prop")) return "Proposal";
  if (s.includes("follow")) return "Follow-Up";
  if (s.includes("neg")) return "Negotiation";
  if (s.includes("won")) return "Closed Won";
  if (s.includes("lost")) return "Closed Lost";
  return stage || "Unknown";
}

function scoreDeal(deal) {
  const amount = safeNum(deal?.amount ?? deal?.value ?? deal?.pipelineValue);
  const crmProb = safeNum(deal?.probability);
  const stage = normalizeStage(deal?.stage || deal?.status);

  let atlasProb = crmProb || 35;
  let readiness = 50;
  let slipRisk = "Medium";
  let nextAction = "Confirm next step and owner.";

  if (stage === "Negotiation") {
    atlasProb += 8;
    readiness += 18;
    nextAction = "Push toward close plan and executive alignment.";
  } else if (stage === "Proposal") {
    atlasProb += 2;
    readiness += 10;
    nextAction = "Tighten commercial follow-up and stakeholder alignment.";
  } else if (stage === "Follow-Up") {
    atlasProb -= 6;
    readiness -= 8;
    nextAction = "Re-engage the deal before momentum drops further.";
  } else if (stage === "Discovery") {
    atlasProb -= 10;
    readiness -= 14;
    nextAction = "Improve qualification and identify decision makers.";
  }

  if (amount >= 250000) {
    readiness += 6;
  }

  atlasProb = Math.max(5, Math.min(95, Math.round(atlasProb)));
  readiness = Math.max(10, Math.min(100, Math.round(readiness)));

  if (atlasProb < 35 || stage === "Follow-Up") {
    slipRisk = "High";
  } else if (atlasProb >= 60 && stage === "Negotiation") {
    slipRisk = "Low";
  }

  return {
    id: deal?._id || deal?.id || deal?.name,
    name: deal?.name || deal?.title || "Deal",
    stage,
    amount,
    crmProb,
    atlasProb,
    readiness,
    slipRisk,
    nextAction,
  };
}

function riskTone(risk) {
  if (risk === "High") {
    return {
      color: "#fca5a5",
      bg: "rgba(239,68,68,0.12)",
      border: "1px solid rgba(239,68,68,0.22)",
    };
  }
  if (risk === "Low") {
    return {
      color: "#86efac",
      bg: "rgba(34,197,94,0.12)",
      border: "1px solid rgba(34,197,94,0.22)",
    };
  }
  return {
    color: "#fde68a",
    bg: "rgba(245,158,11,0.12)",
    border: "1px solid rgba(245,158,11,0.22)",
  };
}

function progressColor(value) {
  if (value >= 75) return "#22c55e";
  if (value >= 50) return "#f59e0b";
  return "#ef4444";
}

export default function AtlasDealIntelligencePanel({ deals = [] }) {
  const scoredDeals = useMemo(() => {
    return deals
      .map(scoreDeal)
      .filter((d) => d.stage !== "Closed Won" && d.stage !== "Closed Lost")
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 6);
  }, [deals]);

  return (
    <div
      style={{
        borderRadius: 20,
        border: "1px solid rgba(255,255,255,0.08)",
        background:
          "linear-gradient(135deg, rgba(37,99,235,0.10), rgba(124,92,255,0.08), rgba(255,255,255,0.02))",
        padding: 18,
        boxShadow: "0 14px 34px rgba(0,0,0,0.18)",
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 900,
          letterSpacing: 1.1,
          textTransform: "uppercase",
          color: "rgba(125,211,252,0.92)",
          marginBottom: 14,
        }}
      >
        Atlas Deal Intelligence
      </div>

      <div style={{ display: "grid", gap: 12 }}>
        {scoredDeals.map((deal) => {
          const tone = riskTone(deal.slipRisk);
          const barColor = progressColor(deal.readiness);

          return (
            <div
              key={deal.id}
              style={{
                borderRadius: 16,
                padding: 14,
                border: "1px solid rgba(255,255,255,0.08)",
                background: "rgba(255,255,255,0.03)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  alignItems: "flex-start",
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: 16,
                      fontWeight: 800,
                      color: "#fff",
                    }}
                  >
                    {deal.name}
                  </div>
                  <Link to={`/account-plans?dealId=${encodeURIComponent(deal.id)}`} style={{color:"#a0e7f0",display:"inline-block",padding:"8px 0",fontSize:12}}>Open account action plan →</Link>

                  <div
                    style={{
                      marginTop: 6,
                      fontSize: 13,
                      color: "rgba(203,213,225,0.78)",
                    }}
                  >
                    {deal.stage} • {moneyCompact(deal.amount)}
                  </div>
                </div>

                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    padding: "6px 10px",
                    borderRadius: 999,
                    background: tone.bg,
                    border: tone.border,
                    color: tone.color,
                    fontSize: 11,
                    fontWeight: 900,
                    letterSpacing: 0.4,
                    textTransform: "uppercase",
                  }}
                >
                  Slip Risk: {deal.slipRisk}
                </div>
              </div>

              <div
                style={{
                  marginTop: 12,
                  display: "grid",
                  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                  gap: 10,
                }}
              >
                <div
                  style={{
                    borderRadius: 14,
                    padding: 12,
                    border: "1px solid rgba(255,255,255,0.08)",
                    background: "rgba(255,255,255,0.02)",
                  }}
                >
                  <div style={{ fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(148,163,184,0.82)" }}>
                    CRM Probability
                  </div>
                  <div style={{ marginTop: 8, fontSize: 22, fontWeight: 900, color: "#fff" }}>
                    {deal.crmProb}%
                  </div>
                </div>

                <div
                  style={{
                    borderRadius: 14,
                    padding: 12,
                    border: "1px solid rgba(255,255,255,0.08)",
                    background: "rgba(255,255,255,0.02)",
                  }}
                >
                  <div style={{ fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(148,163,184,0.82)" }}>
                    Atlas Probability
                  </div>
                  <div style={{ marginTop: 8, fontSize: 22, fontWeight: 900, color: "#7dd3fc" }}>
                    {deal.atlasProb}%
                  </div>
                </div>

                <div
                  style={{
                    borderRadius: 14,
                    padding: 12,
                    border: "1px solid rgba(255,255,255,0.08)",
                    background: "rgba(255,255,255,0.02)",
                  }}
                >
                  <div style={{ fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(148,163,184,0.82)" }}>
                    Close Readiness
                  </div>
                  <div style={{ marginTop: 8, fontSize: 22, fontWeight: 900, color: "#fff" }}>
                    {deal.readiness}/100
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 12 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 12,
                    color: "rgba(203,213,225,0.78)",
                    marginBottom: 6,
                  }}
                >
                  <span>Readiness Score</span>
                  <span>{deal.readiness}%</span>
                </div>

                <div
                  style={{
                    height: 10,
                    borderRadius: 999,
                    overflow: "hidden",
                    background: "rgba(255,255,255,0.08)",
                    border: "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${deal.readiness}%`,
                      borderRadius: 999,
                      background: `linear-gradient(90deg, ${barColor}, rgba(56,189,248,0.9))`,
                    }}
                  />
                </div>
              </div>

              <div
                style={{
                  marginTop: 12,
                  fontSize: 13,
                  lineHeight: 1.6,
                  color: "#dbe7f5",
                }}
              >
                <strong style={{ color: "#fff" }}>Next Action:</strong> {deal.nextAction}
              </div>
            </div>
          );
        })}

        {!scoredDeals.length ? (
          <div
            style={{
              borderRadius: 16,
              padding: 14,
              border: "1px solid rgba(255,255,255,0.08)",
              background: "rgba(255,255,255,0.03)",
              color: "rgba(203,213,225,0.8)",
            }}
          >
            No active deals available for Atlas Deal Intelligence yet.
          </div>
        ) : null}
      </div>
    </div>
  );
}