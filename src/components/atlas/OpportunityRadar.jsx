import React, { useMemo } from "react";

const safeNum = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const money = (value) =>
  safeNum(value).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

export default function OpportunityRadar({
  openPipeline = 0,
  weightedPipeline = 0,
  revenue = 0,
  spend = 0,
  coverage = 0,
}) {
  const opportunities = useMemo(() => {
    const pipeline = safeNum(openPipeline);
    const weighted = safeNum(weightedPipeline);
    const currentRevenue = safeNum(revenue);
    const marketingSpend = safeNum(spend);
    const pipelineCoverage = safeNum(coverage);

    const items = [];

    if (pipeline > 0) {
      items.push({
        title: "Pipeline Conversion Upside",
        impact: money(pipeline * 0.05),
        label: "Scenario value",
        description:
          "A five-percentage-point improvement in pipeline conversion would create this estimated upside.",
      });
    }

    if (marketingSpend > 0) {
      items.push({
        title: "Marketing Efficiency Opportunity",
        impact: money(marketingSpend * 0.1),
        label: "Recoverable spend",
        description:
          "Reducing inefficient marketing spend by 10% would recover this estimated amount for reinvestment.",
      });
    }

    if (
      currentRevenue > 0 &&
      pipelineCoverage > 0 &&
      pipelineCoverage < 3
    ) {
      const requiredPipeline = Math.max(
        0,
        currentRevenue * 3 - pipeline
      );

      items.push({
        title: "Pipeline Coverage Gap",
        impact: money(requiredPipeline),
        label: "Additional pipeline needed",
        description:
          "This is the estimated pipeline required to reach 3x coverage against current revenue.",
      });
    }

    if (weighted > 0 && pipeline > weighted) {
      items.push({
        title: "Forecast Qualification Gap",
        impact: money(pipeline - weighted),
        label: "Unweighted exposure",
        description:
          "This portion of open pipeline is not currently supported by deal-stage probability.",
      });
    }

    return items.slice(0, 3);
  }, [
    openPipeline,
    weightedPipeline,
    revenue,
    spend,
    coverage,
  ]);

  if (!opportunities.length) {
    return (
      <div
        style={{
          minHeight: 180,
          display: "grid",
          placeItems: "center",
          padding: 20,
          border: "1px dashed rgba(255,255,255,0.12)",
          borderRadius: 14,
          color: "rgba(203,213,225,0.72)",
          textAlign: "center",
        }}
      >
        No measurable strategic opportunities are available from the
        current workspace data.
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 10 }}>
      {opportunities.map((opportunity) => (
        <div
          key={opportunity.title}
          style={{
            padding: 14,
            borderRadius: 13,
            border: "1px solid rgba(255,255,255,0.08)",
            background: "rgba(255,255,255,0.03)",
          }}
        >
          <div
            style={{
              color: "#ffffff",
              fontSize: 15,
              fontWeight: 900,
            }}
          >
            {opportunity.title}
          </div>

          <div
            style={{
              marginTop: 6,
              color: "rgba(203,213,225,0.82)",
              fontSize: 13,
              lineHeight: 1.55,
            }}
          >
            {opportunity.description}
          </div>

          <div
            style={{
              marginTop: 9,
              color: "#7dd3fc",
              fontSize: 13,
              fontWeight: 900,
            }}
          >
            {opportunity.label}: {opportunity.impact}
          </div>
        </div>
      ))}
    </div>
  );
}
