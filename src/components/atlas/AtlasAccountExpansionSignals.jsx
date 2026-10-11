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

function scoreAccount(client) {
  const revenue = safeNum(client?.revenue || client?.value || 0);
  const engagement = safeNum(client?.engagementScore || 50);
  const health = safeNum(client?.healthScore || 60);

  let expansionScore = 50;

  if (revenue > 100000) expansionScore += 12;
  if (engagement > 65) expansionScore += 15;
  if (health > 70) expansionScore += 12;

  expansionScore = Number.isFinite(client?.expansionScore) ? client.expansionScore : Math.min(95, Math.round(expansionScore));

  let expansionPotential = revenue * 0.25;

  let signal = "Moderate Expansion Potential";

  if (expansionScore > 80) signal = "Strong Expansion Signal";
  else if (expansionScore < 55) signal = "Low Expansion Potential";

  return {
    id: client?.id || client?._id,
    name: client?.name || "Account",
    revenue,
    expansionScore,
    expansionPotential,
    signal,
  };
}

function signalColor(signal) {
  if (signal === "Strong Expansion Signal")
    return {
      bg: "rgba(34,197,94,0.15)",
      color: "#86efac",
      border: "1px solid rgba(34,197,94,0.25)",
    };

  if (signal === "Low Expansion Potential")
    return {
      bg: "rgba(239,68,68,0.12)",
      color: "#fca5a5",
      border: "1px solid rgba(239,68,68,0.22)",
    };

  return {
    bg: "rgba(245,158,11,0.12)",
    color: "#fde68a",
    border: "1px solid rgba(245,158,11,0.22)",
  };
}

export default function AtlasAccountExpansionSignals({ clients = [], sampleMode = false }) {
  const accounts = useMemo(() => {
    return clients
      .map(scoreAccount)
      .sort((a, b) => b.expansionScore - a.expansionScore)
      .slice(0, 6);
  }, [clients]);

  return (
    <div
      style={{
        borderRadius: 20,
        border: "1px solid rgba(255,255,255,0.08)",
        background:
          "linear-gradient(135deg, rgba(34,197,94,0.12), rgba(56,189,248,0.06))",
        padding: 18,
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 900,
          letterSpacing: 1.1,
          textTransform: "uppercase",
          color: "#86efac",
          marginBottom: 14,
        }}
      >
        Atlas Expansion Signals
      </div>

      <div style={{ display: "grid", gap: 12 }}>
        {accounts.map((account) => {
          const tone = signalColor(account.signal);

          return (
            <div
              key={account.id}
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
                  alignItems: "center",
                }}
              >
                <div style={{ fontWeight: 800, color: "#fff" }}>
                  {account.name}
                </div>

                <div
                  style={{
                    borderRadius: 999,
                    padding: "5px 10px",
                    fontSize: 11,
                    fontWeight: 900,
                    background: tone.bg,
                    color: tone.color,
                    border: tone.border,
                  }}
                >
                  {account.signal}
                </div>
              </div>

              <div
                style={{
                  marginTop: 10,
                  display: "grid",
                  gridTemplateColumns: "repeat(3,1fr)",
                  gap: 10,
                }}
              >
                <div>
                  <div style={{ fontSize: 10, color: "#94a3b8" }}>
                    {sampleMode ? "Open Pipeline" : "Current Revenue"}
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 800 }}>
                    {moneyCompact(account.revenue)}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 10, color: "#94a3b8" }}>
                    Expansion Score
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 800 }}>
                    {account.expansionScore}/100
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 10, color: "#94a3b8" }}>
                    {sampleMode ? "Illustrative 25% Upside Scenario" : "Potential Upside"}
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "#86efac" }}>
                    {moneyCompact(account.expansionPotential)}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}