import React, { useEffect, useMemo, useState } from "react";
import mapboxgl from "mapbox-gl";
import Map, { Layer, Marker, NavigationControl, Popup, Source } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getDashboard } from "../api";

const rawMapToken = import.meta.env.VITE_MAPBOX_TOKEN || "";
const MAPBOX_TOKEN =
  rawMapToken && rawMapToken !== "YOUR_MAPBOX_PUBLIC_TOKEN" ? rawMapToken : "";

if (MAPBOX_TOKEN) mapboxgl.accessToken = MAPBOX_TOKEN;

const fallbackMapStyle = {
  version: 8,
  sources: {
    carto: {
      type: "raster",
      tiles: ["https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap © CARTO",
    },
  },
  layers: [{ id: "carto", type: "raster", source: "carto", minzoom: 0, maxzoom: 20 }],
};

const REGION_META = {
  "North America": { latitude: 39, longitude: -101, color: "#4f8cff" },
  Europe: { latitude: 50, longitude: 11, color: "#54b89a" },
  Asia: { latitude: 34, longitude: 105, color: "#d7a84b" },
};

const DEMO_REGIONS = [
  {
    name: "North America",
    revenueNum: 3800000,
    pipelineNum: 9200000,
    closeRateNum: 36,
    status: "Strong",
    accounts: ["Apex Manufacturing", "Nova Healthcare", "Titan Logistics"],
  },
  {
    name: "Europe",
    revenueNum: 1400000,
    pipelineNum: 4700000,
    closeRateNum: 29,
    status: "Stable",
    accounts: ["EuroMed Systems", "Vertex Industrial", "BlueCore Energy"],
  },
  {
    name: "Asia",
    revenueNum: 600000,
    pipelineNum: 2100000,
    closeRateNum: 22,
    status: "Developing",
    accounts: ["Sakura Robotics", "Pacific Health Tech", "Orion Supply Group"],
  },
];

const safeNum = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const money = (value) => {
  const number = safeNum(value);
  if (number >= 1000000) return `$${(number / 1000000).toFixed(1)}M`;
  if (number >= 1000) return `$${Math.round(number / 1000)}K`;
  return `$${number.toLocaleString()}`;
};

function regionFrom(value = "") {
  const text = String(value).toLowerCase();
  if (/germany|france|uk|united kingdom|europe|spain|italy|netherlands/.test(text)) {
    return "Europe";
  }
  if (/singapore|japan|india|china|asia|hong kong|korea/.test(text)) return "Asia";
  return "North America";
}

function statusFor(revenue, pipeline) {
  const total = revenue + pipeline;
  if (total >= 250000) return "Strong";
  if (total >= 75000) return "Stable";
  return "Developing";
}

function buildRegions(dashboard) {
  const mode = String(dashboard?.workspaceMode || "demo").toLowerCase();
  if (mode === "demo") return DEMO_REGIONS;

  const deals = Array.isArray(dashboard?.deals) ? dashboard.deals : [];
  const grouped = new globalThis.Map();

  deals.forEach((deal) => {
    const name = regionFrom(
      deal?.region || deal?.country || deal?.location || deal?.territory || ""
    );
    const row = grouped.get(name) || {
      name,
      revenueNum: 0,
      pipelineNum: 0,
      won: 0,
      total: 0,
      accounts: [],
    };
    const amount = safeNum(deal?.amount || deal?.value || deal?.pipelineValue);
    const stage = String(deal?.stage || deal?.status || "");
    row.total += 1;
    if (stage === "Closed Won") {
      row.revenueNum += amount;
      row.won += 1;
    } else if (stage !== "Closed Lost") {
      row.pipelineNum += amount;
    }
    const account = deal?.accountName || deal?.company || deal?.clientName || deal?.name;
    if (account && !row.accounts.includes(account)) row.accounts.push(account);
    grouped.set(name, row);
  });

  return Array.from(grouped.values()).map((row) => ({
    ...row,
    closeRateNum: row.total ? Math.round((row.won / row.total) * 100) : 0,
    status: statusFor(row.revenueNum, row.pipelineNum),
  }));
}

function RevenueMarker({ region, selected, onSelect }) {
  const meta = REGION_META[region.name] || REGION_META["North America"];
  const size = Math.max(14, Math.min(28, 12 + region.revenueNum / 350000));

  return (
    <Marker latitude={meta.latitude} longitude={meta.longitude} anchor="center">
      <button
        type="button"
        className={`grm-marker${selected ? " is-selected" : ""}`}
        style={{ width: size, height: size, background: meta.color }}
        onClick={(event) => {
          event.stopPropagation();
          onSelect(region);
        }}
        aria-label={`View ${region.name}`}
      />
    </Marker>
  );
}

function Metric({ label, value, detail }) {
  return (
    <div className="grm-metric">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

function ChartTooltip({ active, payload, label, suffix = "" }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="grm-tooltip">
      <strong>{label}</strong>
      {payload.map((item) => (
        <div key={item.dataKey} style={{ color: item.color }}>
          {item.name}: {suffix ? `${item.value}${suffix}` : money(item.value)}
        </div>
      ))}
    </div>
  );
}

export default function GlobalRevenueMap() {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedRegion, setSelectedRegion] = useState(null);
  const [viewState, setViewState] = useState({
    latitude: 24,
    longitude: 8,
    zoom: 1.2,
    bearing: 0,
    pitch: 0,
  });

  useEffect(() => {
    let mounted = true;
    getDashboard()
      .then((result) => {
        if (!mounted) return;
        setDashboard(result?.data || result || null);
      })
      .catch((err) => {
        if (!mounted) return;
        setError(err?.message || "Unable to load regional revenue data.");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const regions = useMemo(() => buildRegions(dashboard), [dashboard]);
  const rankedRegions = useMemo(
    () => [...regions].sort((a, b) => b.revenueNum + b.pipelineNum - (a.revenueNum + a.pipelineNum)),
    [regions]
  );
  const topRegion = rankedRegions[0];
  const totalRevenue = regions.reduce((sum, region) => sum + region.revenueNum, 0);
  const totalPipeline = regions.reduce((sum, region) => sum + region.pipelineNum, 0);
  const maxOpportunity = Math.max(
    ...regions.map((region) => region.revenueNum + region.pipelineNum),
    1
  );

  useEffect(() => {
    if (!selectedRegion && topRegion) setSelectedRegion(topRegion);
  }, [selectedRegion, topRegion]);

  const flowData = useMemo(() => {
    if (regions.length < 2) return { type: "FeatureCollection", features: [] };
    const origin = REGION_META[regions[0]?.name] || REGION_META["North America"];
    return {
      type: "FeatureCollection",
      features: regions.slice(1).map((region) => {
        const destination = REGION_META[region.name] || REGION_META["North America"];
        return {
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates: [
              [origin.longitude, origin.latitude],
              [destination.longitude, destination.latitude],
            ],
          },
        };
      }),
    };
  }, [regions]);

  if (loading) return <div className="grm-state">Loading regional performance…</div>;
  if (error) return <div className="grm-state grm-error">{error}</div>;

  return (
    <main className="grm-page">
      <style>{pageStyles}</style>

      <header className="grm-header">
        <div>
          <p className="grm-kicker">Global performance</p>
          <h1>Revenue by region</h1>
          <p className="grm-description">
            A geographic view of revenue concentration, open pipeline, and regional conversion.
          </p>
        </div>
        <div className="grm-header-status">
          <span className="grm-status-dot" />
          {String(dashboard?.workspaceMode || "demo").toLowerCase() === "demo"
            ? "Demo data"
            : "Live workspace data"}
        </div>
      </header>

      <section className="grm-metrics">
        <Metric label="Tracked regions" value={regions.length} detail="Active territories" />
        <Metric label="Revenue" value={money(totalRevenue)} detail="Closed-won value" />
        <Metric label="Open pipeline" value={money(totalPipeline)} detail="Current opportunity value" />
        <Metric label="Leading region" value={topRegion?.name || "—"} detail="By total opportunity" />
      </section>

      <section className="grm-map-card">
        <div className="grm-map-heading">
          <div>
            <p className="grm-section-label">Geographic distribution</p>
            <h2>Regional portfolio</h2>
          </div>
          <div className="grm-legend">
            <span><i className="na" /> North America</span>
            <span><i className="eu" /> Europe</span>
            <span><i className="as" /> Asia</span>
          </div>
        </div>

        <div className="grm-map-layout">
          <div className="grm-map-canvas">
            <Map
              {...viewState}
              onMove={(event) => setViewState(event.viewState)}
              mapboxAccessToken={MAPBOX_TOKEN || undefined}
              mapStyle={MAPBOX_TOKEN ? "mapbox://styles/mapbox/dark-v11" : fallbackMapStyle}
              projection={MAPBOX_TOKEN ? "globe" : "mercator"}
              attributionControl={false}
              onClick={() => setSelectedRegion(null)}
              onLoad={(event) => {
                if (MAPBOX_TOKEN) {
                  try {
                    event.target.setFog({
                      color: "rgb(18, 24, 33)",
                      "high-color": "rgb(42, 58, 78)",
                      "horizon-blend": 0.08,
                      "space-color": "rgb(7, 10, 15)",
                      "star-intensity": 0.05,
                    });
                  } catch {}
                }
                event.target.resize();
              }}
            >
              <NavigationControl position="bottom-right" showCompass={false} />
              <Source id="regional-connections" type="geojson" data={flowData}>
                <Layer
                  id="regional-lines"
                  type="line"
                  paint={{
                    "line-color": "#64748b",
                    "line-width": 1,
                    "line-opacity": 0.42,
                    "line-dasharray": [3, 3],
                  }}
                />
              </Source>
              {regions.map((region) => (
                <RevenueMarker
                  key={region.name}
                  region={region}
                  selected={selectedRegion?.name === region.name}
                  onSelect={setSelectedRegion}
                />
              ))}
              {selectedRegion ? (
                <Popup
                  latitude={(REGION_META[selectedRegion.name] || REGION_META["North America"]).latitude}
                  longitude={(REGION_META[selectedRegion.name] || REGION_META["North America"]).longitude}
                  anchor="bottom"
                  offset={18}
                  closeButton={false}
                  closeOnClick={false}
                  className="grm-popup"
                >
                  <div className="grm-popup-content">
                    <strong>{selectedRegion.name}</strong>
                    <div><span>Revenue</span>{money(selectedRegion.revenueNum)}</div>
                    <div><span>Pipeline</span>{money(selectedRegion.pipelineNum)}</div>
                    <div><span>Close rate</span>{selectedRegion.closeRateNum}%</div>
                  </div>
                </Popup>
              ) : null}
            </Map>
          </div>

          <aside className="grm-ranking">
            <div className="grm-ranking-head">
              <p className="grm-section-label">Regional ranking</p>
              <span>Revenue + pipeline</span>
            </div>
            {rankedRegions.map((region, index) => {
              const meta = REGION_META[region.name] || REGION_META["North America"];
              const total = region.revenueNum + region.pipelineNum;
              return (
                <button
                  type="button"
                  key={region.name}
                  className={`grm-rank-row${selectedRegion?.name === region.name ? " is-active" : ""}`}
                  onClick={() => setSelectedRegion(region)}
                >
                  <div className="grm-rank-top">
                    <span className="grm-rank-number">0{index + 1}</span>
                    <strong>{region.name}</strong>
                    <span>{money(total)}</span>
                  </div>
                  <div className="grm-progress">
                    <i style={{ width: `${(total / maxOpportunity) * 100}%`, background: meta.color }} />
                  </div>
                  <small>{region.status} · {region.closeRateNum}% close rate</small>
                </button>
              );
            })}
          </aside>
        </div>
      </section>

      <section className="grm-chart-grid">
        <article className="grm-chart-card">
          <div className="grm-card-heading">
            <div><p className="grm-section-label">Performance</p><h2>Revenue and pipeline</h2></div>
            <span>Current period</span>
          </div>
          <div className="grm-chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={regions} barGap={8} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="#202938" strokeDasharray="2 4" vertical={false} />
                <XAxis dataKey="name" stroke="#657083" tick={{ fill: "#96a0b2", fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis stroke="#657083" tick={{ fill: "#96a0b2", fontSize: 11 }} tickFormatter={money} tickLine={false} axisLine={false} width={58} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(255,255,255,.025)" }} />
                <Bar dataKey="revenueNum" name="Revenue" fill="#4f8cff" radius={[3, 3, 0, 0]} maxBarSize={38} />
                <Bar dataKey="pipelineNum" name="Pipeline" fill="#5e6d83" radius={[3, 3, 0, 0]} maxBarSize={38} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="grm-chart-card">
          <div className="grm-card-heading">
            <div><p className="grm-section-label">Efficiency</p><h2>Close rate</h2></div>
            <span>By region</span>
          </div>
          <div className="grm-chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={regions} layout="vertical" margin={{ top: 8, right: 24, left: 12, bottom: 0 }}>
                <CartesianGrid stroke="#202938" strokeDasharray="2 4" horizontal={false} />
                <XAxis type="number" domain={[0, 50]} tickFormatter={(value) => `${value}%`} stroke="#657083" tick={{ fill: "#96a0b2", fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="name" width={92} stroke="#657083" tick={{ fill: "#d5dae3", fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip content={<ChartTooltip suffix="%" />} cursor={{ fill: "rgba(255,255,255,.025)" }} />
                <Bar dataKey="closeRateNum" name="Close rate" radius={[0, 3, 3, 0]} maxBarSize={24}>
                  {regions.map((region) => (
                    <Cell key={region.name} fill={(REGION_META[region.name] || REGION_META["North America"]).color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>
      </section>

      <section className="grm-table-card">
        <div className="grm-card-heading">
          <div><p className="grm-section-label">Territory detail</p><h2>Regional opportunities</h2></div>
          <span>{regions.length} active regions</span>
        </div>
        <div className="grm-table-wrap">
          <table>
            <thead><tr><th>Region</th><th>Status</th><th>Revenue</th><th>Pipeline</th><th>Close rate</th><th>Priority accounts</th></tr></thead>
            <tbody>
              {rankedRegions.map((region) => (
                <tr key={region.name}>
                  <td><strong>{region.name}</strong></td>
                  <td><span className={`grm-status grm-${region.status.toLowerCase()}`}>{region.status}</span></td>
                  <td>{money(region.revenueNum)}</td>
                  <td>{money(region.pipelineNum)}</td>
                  <td>{region.closeRateNum}%</td>
                  <td className="grm-accounts">{region.accounts.slice(0, 3).join(", ") || "No accounts assigned"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

const pageStyles = `
  .grm-page{min-height:100vh;padding:22px;color:#f4f7fb;background:#080c13;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
  .grm-header{display:flex;align-items:flex-end;justify-content:space-between;gap:24px;max-width:1420px;margin:0 auto 18px;padding:6px 2px 18px;border-bottom:1px solid #222b38}
  .grm-kicker,.grm-section-label{margin:0 0 6px;color:#8190a5;font-size:10px;font-weight:700;letter-spacing:.14em;text-transform:uppercase}
  .grm-header h1{margin:0;font-size:30px;line-height:1.15;letter-spacing:-.035em;font-weight:700}
  .grm-description{margin:7px 0 0;color:#96a0b2;font-size:13px;line-height:1.55}
  .grm-header-status{display:flex;align-items:center;gap:8px;color:#aeb7c6;font-size:12px;white-space:nowrap}
  .grm-status-dot{width:7px;height:7px;border-radius:50%;background:#46b985}
  .grm-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;max-width:1420px;margin:0 auto 12px}
  .grm-metric{min-height:104px;padding:16px 17px;border:1px solid #222b38;border-radius:10px;background:#0e141e}
  .grm-metric span{display:block;color:#7f8b9f;font-size:10px;font-weight:700;letter-spacing:.11em;text-transform:uppercase}
  .grm-metric strong{display:block;margin-top:10px;color:#f7f9fc;font-size:24px;line-height:1.1;font-weight:700;letter-spacing:-.025em}
  .grm-metric small{display:block;margin-top:7px;color:#727f92;font-size:11px}
  .grm-map-card,.grm-chart-card,.grm-table-card{max-width:1420px;margin:0 auto 12px;border:1px solid #222b38;border-radius:12px;background:#0e141e;overflow:hidden}
  .grm-map-heading,.grm-card-heading{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:16px 18px;border-bottom:1px solid #222b38}
  .grm-map-heading h2,.grm-card-heading h2{margin:0;color:#edf1f7;font-size:16px;font-weight:650;letter-spacing:-.015em}
  .grm-card-heading>span,.grm-ranking-head>span{color:#707d90;font-size:11px}
  .grm-legend{display:flex;align-items:center;gap:16px;color:#8f9bad;font-size:10px}
  .grm-legend span{display:flex;align-items:center;gap:6px}.grm-legend i{width:7px;height:7px;border-radius:50%}
  .grm-legend .na{background:#4f8cff}.grm-legend .eu{background:#54b89a}.grm-legend .as{background:#d7a84b}
  .grm-map-layout{display:grid;grid-template-columns:minmax(0,1fr) 330px;min-height:490px}
  .grm-map-canvas{position:relative;min-height:490px;border-right:1px solid #222b38;background:#0a0f17}
  .grm-marker{display:block;padding:0;border:2px solid rgba(255,255,255,.82);border-radius:50%;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.45);transition:transform .16s ease,border-color .16s ease}
  .grm-marker:hover,.grm-marker.is-selected{transform:scale(1.18);border-color:#fff}
  .grm-popup .mapboxgl-popup-content{padding:0!important;border:0!important;border-radius:8px!important;background:transparent!important;box-shadow:0 12px 30px rgba(0,0,0,.36)!important}
  .grm-popup .mapboxgl-popup-tip{border-top-color:#121a26!important}
  .grm-popup-content{min-width:190px;padding:13px 14px;color:#eef2f7;background:#121a26;border:1px solid #2d3848;border-radius:8px}
  .grm-popup-content>strong{display:block;margin-bottom:9px;font-size:13px}
  .grm-popup-content>div{display:flex;justify-content:space-between;gap:18px;padding:4px 0;color:#e2e7ef;font-size:11px}.grm-popup-content span{color:#7f8b9f}
  .grm-ranking{padding:6px 16px 12px;background:#0c121b}
  .grm-ranking-head{display:flex;align-items:center;justify-content:space-between;padding:14px 2px 8px}
  .grm-rank-row{width:100%;padding:15px 2px;text-align:left;color:inherit;background:transparent;border:0;border-bottom:1px solid #202936;cursor:pointer}
  .grm-rank-row.is-active{background:linear-gradient(90deg,rgba(79,140,255,.08),transparent)}
  .grm-rank-top{display:grid;grid-template-columns:28px 1fr auto;align-items:center;gap:8px}.grm-rank-top strong{font-size:12px}.grm-rank-top>span:last-child{color:#c7ced9;font-size:11px}
  .grm-rank-number{color:#626f82;font-size:10px;font-variant-numeric:tabular-nums}
  .grm-progress{height:3px;margin:10px 0 8px 36px;background:#202936;border-radius:10px;overflow:hidden}.grm-progress i{display:block;height:100%;border-radius:10px}
  .grm-rank-row small{display:block;margin-left:36px;color:#6f7c8e;font-size:10px}
  .grm-chart-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;max-width:1420px;margin:0 auto}.grm-chart-card{margin:0 0 12px}
  .grm-chart{height:300px;padding:16px 12px 10px 6px}.grm-tooltip{padding:10px 12px;color:#dce2eb;background:#111925;border:1px solid #2b3646;border-radius:8px;font-size:11px;box-shadow:0 10px 28px rgba(0,0,0,.3)}.grm-tooltip strong{display:block;margin-bottom:6px;color:#fff}
  .grm-table-wrap{overflow-x:auto}.grm-table-card table{width:100%;border-collapse:collapse;min-width:820px}.grm-table-card th,.grm-table-card td{padding:14px 18px;text-align:left;border-bottom:1px solid #202936;font-size:12px}.grm-table-card th{color:#718094;background:#0b111a;font-size:9px;letter-spacing:.1em;text-transform:uppercase}.grm-table-card td{color:#c2cad6}.grm-table-card tbody tr:last-child td{border-bottom:0}.grm-accounts{color:#8995a7!important;max-width:360px}
  .grm-status{display:inline-flex;padding:4px 8px;border-radius:99px;font-size:9px;font-weight:700}.grm-strong{color:#88d8b8;background:rgba(70,185,133,.11)}.grm-stable{color:#8db4ff;background:rgba(79,140,255,.11)}.grm-developing{color:#dfbd78;background:rgba(215,168,75,.11)}
  .grm-state{min-height:55vh;display:grid;place-items:center;color:#9aa5b5;background:#080c13}.grm-error{color:#f3a4a4}
  @media(max-width:980px){.grm-map-layout{grid-template-columns:1fr}.grm-map-canvas{border-right:0;border-bottom:1px solid #222b38}.grm-chart-grid{grid-template-columns:1fr}.grm-metrics{grid-template-columns:repeat(2,1fr)}}
  @media(max-width:620px){.grm-page{padding:14px}.grm-header{align-items:flex-start;flex-direction:column}.grm-header h1{font-size:25px}.grm-metrics{grid-template-columns:1fr 1fr}.grm-metric{min-height:90px;padding:14px}.grm-metric strong{font-size:19px}.grm-map-heading{align-items:flex-start;flex-direction:column}.grm-legend{flex-wrap:wrap}.grm-map-canvas{min-height:410px}.grm-map-layout{min-height:410px}}
`;
