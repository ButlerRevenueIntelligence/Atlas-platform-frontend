import React from "react";
export default function WorkspaceDataNotice({ dashboard }) {
  if (!dashboard || dashboard.workspaceMode === "demo") return null;
  const source = { stripe: "Stripe", shopify: "Shopify", metrics_daily: "Imported data", none: "No revenue source" }[dashboard.dataSources?.revenue];
  return <div style={{ padding: "10px 14px", marginBottom: 16, border: "1px solid #263247", borderRadius: 10, fontSize: 12, color: "#a9b6ca" }}>
    {source ? <div>Revenue: {source} · Last 30 days · USD</div> : null}
    {(dashboard.warnings || []).map(warning => <div role="status" key={warning} style={{ color: "#f3bf67", marginTop: 4 }}>{warning}</div>)}
  </div>;
}
