import React, { useMemo } from "react";

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

function createPoints(values, maxValue) {
  const left = 74;
  const right = 620;
  const top = 28;
  const bottom = 232;
  const width = right - left;
  const height = bottom - top;

  return values
    .map((value, index) => {
      const x = left + (width / (values.length - 1)) * index;
      const y =
        bottom -
        (safeNum(value) / Math.max(maxValue, 1)) * height;

      return `${x},${y}`;
    })
    .join(" ");
}

export default function RevenueTimeline({
  revenue30 = 0,
  weightedPipeline = 0,
  confidence = 0,
}) {
  const chart = useMemo(() => {
    const monthlyRunRate = safeNum(revenue30);
    const weightedUpside = safeNum(weightedPipeline);
    const confidenceRate = Math.min(
      1,
      Math.max(0, safeNum(confidence) / 100)
    );

    const baseline = [
      0,
      monthlyRunRate,
      monthlyRunRate * 2,
      monthlyRunRate * 3,
    ];

    /*
     * Directional outlook:
     * - Existing 30-day revenue run rate continues for 90 days.
     * - Confidence-adjusted weighted pipeline is phased in gradually.
     * - This is a scenario, not a committed forecast.
     */
    const adjustedUpside = weightedUpside * confidenceRate;

    const outlook = [
      0,
      monthlyRunRate + adjustedUpside * 0.2,
      monthlyRunRate * 2 + adjustedUpside * 0.5,
      monthlyRunRate * 3 + adjustedUpside * 0.8,
    ];

    const maxValue = Math.max(
      ...baseline,
      ...outlook,
      1
    );

    const roundedMax =
      Math.ceil(maxValue / 100000) * 100000 || 100000;

    return {
      baseline,
      outlook,
      maxValue: roundedMax,
      baseline90: baseline[3],
      outlook90: outlook[3],
    };
  }, [revenue30, weightedPipeline, confidence]);

  if (
    safeNum(revenue30) <= 0 &&
    safeNum(weightedPipeline) <= 0
  ) {
    return (
      <div
        style={{
          minHeight: 260,
          display: "grid",
          placeItems: "center",
          padding: 20,
          border: "1px dashed rgba(255,255,255,0.12)",
          borderRadius: 14,
          color: "rgba(203,213,225,0.72)",
          textAlign: "center",
        }}
      >
        Revenue and pipeline data are required to build the
        90-day outlook.
      </div>
    );
  }

  const baselinePoints = createPoints(
    chart.baseline,
    chart.maxValue
  );

  const outlookPoints = createPoints(
    chart.outlook,
    chart.maxValue
  );

  const yLabels = [
    chart.maxValue,
    chart.maxValue * 0.75,
    chart.maxValue * 0.5,
    chart.maxValue * 0.25,
    0,
  ];

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: 12,
          marginBottom: 12,
        }}
      >
        <div>
          <div
            style={{
              color: "#ffffff",
              fontSize: 15,
              fontWeight: 900,
            }}
          >
            90-Day Revenue Outlook
          </div>

          <div
            style={{
              marginTop: 4,
              color: "rgba(203,213,225,0.68)",
              fontSize: 11,
              lineHeight: 1.45,
            }}
          >
            Directional scenario based on current run rate and
            confidence-adjusted weighted pipeline.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 12,
            color: "rgba(226,232,240,0.78)",
            fontSize: 11,
          }}
        >
          <Legend color="#64748b" label="Run-rate baseline" />
          <Legend color="#38bdf8" label="Weighted outlook" />
        </div>
      </div>

      <div
        style={{
          width: "100%",
          overflowX: "auto",
        }}
      >
        <svg
          viewBox="0 0 650 275"
          role="img"
          aria-label="Ninety-day revenue outlook chart"
          style={{
            display: "block",
            width: "100%",
            minWidth: 560,
            height: "auto",
          }}
        >
          <defs>
            <linearGradient
              id="outlookArea"
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop
                offset="0%"
                stopColor="#38bdf8"
                stopOpacity="0.24"
              />
              <stop
                offset="100%"
                stopColor="#38bdf8"
                stopOpacity="0"
              />
            </linearGradient>
          </defs>

          {yLabels.map((label, index) => {
            const y = 28 + (204 / 4) * index;

            return (
              <g key={index}>
                <line
                  x1="74"
                  y1={y}
                  x2="620"
                  y2={y}
                  stroke="rgba(148,163,184,0.14)"
                  strokeWidth="1"
                />

                <text
                  x="62"
                  y={y + 4}
                  textAnchor="end"
                  fill="rgba(148,163,184,0.72)"
                  fontSize="11"
                >
                  {moneyCompact(label)}
                </text>
              </g>
            );
          })}

          {[74, 256, 438, 620].map((x, index) => (
            <line
              key={x}
              x1={x}
              y1="28"
              x2={x}
              y2="232"
              stroke="rgba(148,163,184,0.08)"
              strokeWidth="1"
            />
          ))}

          <polygon
            points={`74,232 ${outlookPoints} 620,232`}
            fill="url(#outlookArea)"
          />

          <polyline
            points={baselinePoints}
            fill="none"
            stroke="#64748b"
            strokeWidth="2"
            strokeDasharray="6 6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          <polyline
            points={outlookPoints}
            fill="none"
            stroke="#38bdf8"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {chart.outlook.map((value, index) => {
            const x = 74 + (546 / 3) * index;
            const y =
              232 -
              (value / Math.max(chart.maxValue, 1)) * 204;

            return (
              <circle
                key={index}
                cx={x}
                cy={y}
                r="4"
                fill="#07111f"
                stroke="#38bdf8"
                strokeWidth="3"
              />
            );
          })}

          {["Today", "30 days", "60 days", "90 days"].map(
            (label, index) => {
              const x = 74 + (546 / 3) * index;

              return (
                <text
                  key={label}
                  x={x}
                  y="257"
                  textAnchor="middle"
                  fill="rgba(203,213,225,0.78)"
                  fontSize="11"
                >
                  {label}
                </text>
              );
            }
          )}
        </svg>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 9,
          marginTop: 5,
        }}
      >
        <ProjectionMetric
          label="90-day baseline"
          value={moneyCompact(chart.baseline90)}
        />

        <ProjectionMetric
          label="Weighted outlook"
          value={moneyCompact(chart.outlook90)}
          highlight
        />

        <ProjectionMetric
          label="Model confidence"
          value={`${Math.round(safeNum(confidence))}%`}
        />
      </div>

      <div
        style={{
          marginTop: 10,
          color: "rgba(148,163,184,0.62)",
          fontSize: 10,
          lineHeight: 1.5,
        }}
      >
        This outlook is directional and should not be treated as a
        committed financial forecast.
      </div>
    </div>
  );
}

function Legend({ color, label }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
      }}
    >
      <span
        style={{
          width: 18,
          height: 3,
          borderRadius: 99,
          background: color,
        }}
      />

      {label}
    </span>
  );
}

function ProjectionMetric({ label, value, highlight }) {
  return (
    <div
      style={{
        padding: "10px 11px",
        borderRadius: 11,
        border: highlight
          ? "1px solid rgba(56,189,248,0.22)"
          : "1px solid rgba(255,255,255,0.07)",
        background: highlight
          ? "rgba(56,189,248,0.07)"
          : "rgba(255,255,255,0.025)",
      }}
    >
      <div
        style={{
          color: "rgba(148,163,184,0.72)",
          fontSize: 9,
          fontWeight: 800,
          textTransform: "uppercase",
          letterSpacing: "0.1em",
        }}
      >
        {label}
      </div>

      <div
        style={{
          marginTop: 5,
          color: highlight ? "#7dd3fc" : "#ffffff",
          fontSize: 16,
          fontWeight: 900,
        }}
      >
        {value}
      </div>
    </div>
  );
}
