import React, { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import { getDashboard } from "../api";
import mapboxgl from "mapbox-gl";
import Map, { Marker, NavigationControl } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";

const rawMapToken = import.meta.env.VITE_MAPBOX_TOKEN || "";
const GLOBAL_MAPBOX_TOKEN =
  rawMapToken && rawMapToken !== "YOUR_MAPBOX_PUBLIC_TOKEN" ? rawMapToken : "";

if (GLOBAL_MAPBOX_TOKEN) {
  mapboxgl.accessToken = GLOBAL_MAPBOX_TOKEN;
}

const hasGlobalMapToken = Boolean(GLOBAL_MAPBOX_TOKEN);

const fallbackMapStyle = {
  version: 8,
  sources: {
    "carto-dark": {
      type: "raster",
      tiles: [
        "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
        "https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
        "https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
        "https://d.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
      ],
      tileSize: 256,
      attribution: "&copy; OpenStreetMap contributors &copy; CARTO",
    },
  },
  layers: [
    {
      id: "carto-dark-layer",
      type: "raster",
      source: "carto-dark",
      minzoom: 0,
      maxzoom: 22,
    },
  ],
};

const axisTick = { fill: "#9fb0d0", fontSize: 11 };

const tooltipStyle = {
  background: "rgba(7,11,24,0.97)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: "14px",
  color: "#fff",
  boxShadow: "0 14px 40px rgba(0,0,0,0.35)",
};

const safeNum = (v, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const moneyCompact = (num) => {
  const n = safeNum(num);
  if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `$${(n / 1000).toFixed(0)}K`;
  return `$${n}`;
};

const REGION_META = {
  "North America": { lng: -100, lat: 39, color: "#67e8f9" },
  "Latin America": { lng: -58, lat: -16, color: "#34d399" },
  Europe: { lng: 12, lat: 50, color: "#a7f3d0" },
  Africa: { lng: 20, lat: 5, color: "#fbbf24" },
  "Middle East": { lng: 46, lat: 25, color: "#fb923c" },
  Asia: { lng: 103, lat: 35, color: "#fde047" },
  Oceania: { lng: 134, lat: -25, color: "#c4b5fd" },
};

const regionDataKey = (name) =>
  String(name || "region")
    .replace(/[^a-zA-Z0-9]+(.)/g, (_, character) => character.toUpperCase())
    .replace(/^[A-Z]/, (character) => character.toLowerCase());

function parseRegionFromText(value = "") {
  const s = String(value || "").toLowerCase();

  if (!s.trim()) return null;

  if (
    s.includes("united states") ||
    s.includes("usa") ||
    s.includes("canada") ||
    s.includes("north america") ||
    s.includes("mexico")
  ) {
    return "North America";
  }

  if (
    s.includes("brazil") ||
    s.includes("argentina") ||
    s.includes("colombia") ||
    s.includes("chile") ||
    s.includes("peru") ||
    s.includes("latin america") ||
    s.includes("south america")
  ) {
    return "Latin America";
  }

  if (
    s.includes("germany") ||
    s.includes("france") ||
    s.includes("uk") ||
    s.includes("united kingdom") ||
    s.includes("europe") ||
    s.includes("netherlands") ||
    s.includes("spain") ||
    s.includes("italy")
  ) {
    return "Europe";
  }

  if (
    s.includes("united arab emirates") ||
    s.includes("uae") ||
    s.includes("saudi arabia") ||
    s.includes("israel") ||
    s.includes("qatar") ||
    s.includes("middle east")
  ) {
    return "Middle East";
  }

  if (
    s.includes("south africa") ||
    s.includes("nigeria") ||
    s.includes("kenya") ||
    s.includes("egypt") ||
    s.includes("ghana") ||
    s.includes("africa")
  ) {
    return "Africa";
  }

  if (
    s.includes("singapore") ||
    s.includes("japan") ||
    s.includes("india") ||
    s.includes("china") ||
    s.includes("asia") ||
    s.includes("hong kong")
  ) {
    return "Asia";
  }

  if (
    s.includes("australia") ||
    s.includes("new zealand") ||
    s.includes("oceania")
  ) {
    return "Oceania";
  }

  return null;
}

function getDealRegion(deal = {}) {
  const source = deal?.sourcePayload || {};
  const address =
    source?.billing_address ||
    source?.shipping_address ||
    source?.customer?.default_address ||
    source?.default_address ||
    {};

  return parseRegionFromText(
    [
      deal?.region,
      deal?.country,
      deal?.location,
      deal?.territory,
      source?.region,
      source?.country,
      source?.country_code,
      source?.billing_country,
      source?.shipping_country,
      address?.country,
      address?.country_code,
      address?.province,
      address?.city,
    ]
      .filter(Boolean)
      .join(" ")
  );
}

function toneStyle(tone) {
  const map = {
    Strong: {
      border: "1px solid rgba(16,185,129,0.22)",
      background: "rgba(16,185,129,0.12)",
      color: "#bbf7d0",
    },
    Stable: {
      border: "1px solid rgba(56,189,248,0.22)",
      background: "rgba(56,189,248,0.12)",
      color: "#bae6fd",
    },
    Emerging: {
      border: "1px solid rgba(245,158,11,0.22)",
      background: "rgba(245,158,11,0.12)",
      color: "#fde68a",
    },
  };

  return {
    display: "inline-flex",
    alignItems: "center",
    padding: "6px 10px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 800,
    whiteSpace: "nowrap",
    ...(map[tone] || map.Stable),
  };
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
    <div style={styles.statCard}>
      <div style={styles.statLabel}>{label}</div>
      <div style={styles.statValue}>{value}</div>
      {note ? <div style={styles.statNote}>{note}</div> : null}
    </div>
  );
}

function EmptyState({ text }) {
  return <div style={styles.emptyState}>{text}</div>;
}

function RegionMarker({ region, selected, maxValue, onSelect }) {
  const meta = REGION_META[region.name] || REGION_META["North America"];
  const total = safeNum(region.revenueNum) + safeNum(region.pipelineNum);
  const size = 16 + Math.sqrt(total / maxValue) * 16;

  return (
    <Marker longitude={meta.lng} latitude={meta.lat} anchor="center">
      <button
        type="button"
        title={`View ${region.name}`}
        aria-label={`View ${region.name}`}
        onClick={(event) => {
          event.stopPropagation();
          onSelect(region.name);
        }}
        style={{
          ...styles.regionMarker,
          width: size,
          height: size,
          borderColor: selected ? "#ffffff" : "rgba(255,255,255,0.82)",
          background: `radial-gradient(circle at 35% 35%, #ffffff, ${meta.color} 48%, rgba(8,145,178,0.95) 100%)`,
          boxShadow: selected
            ? `0 0 0 9px ${meta.color}24, 0 0 30px ${meta.color}b8`
            : `0 0 0 6px ${meta.color}18, 0 0 20px ${meta.color}85`,
          transform: selected ? "scale(1.12)" : "scale(1)",
        }}
      />
    </Marker>
  );
}

function InteractiveWorldMap({ regions, selectedRegion, onSelect }) {
  const active =
    regions.find((region) => region.name === selectedRegion) || regions[0];
  const [viewState, setViewState] = useState({
    longitude: 8,
    latitude: 18,
    zoom: 0.8,
  });
  const maxValue = Math.max(
    1,
    ...regions.map(
      (region) => safeNum(region.revenueNum) + safeNum(region.pipelineNum)
    )
  );

  return (
    <div style={styles.worldMapPanel}>
      <div style={styles.mapStage}>
        <Map
          {...viewState}
          onMove={(event) => setViewState(event.viewState)}
          mapboxAccessToken={GLOBAL_MAPBOX_TOKEN || undefined}
          mapStyle={
            hasGlobalMapToken
              ? "mapbox://styles/mapbox/dark-v11"
              : fallbackMapStyle
          }
          projection={hasGlobalMapToken ? "globe" : "mercator"}
          attributionControl
          style={{ width: "100%", height: "100%" }}
          onLoad={(event) => {
            const map = event.target;
            if (hasGlobalMapToken) {
              try {
                map.setFog({
                  color: "rgb(10, 15, 35)",
                  "high-color": "rgb(36, 92, 223)",
                  "horizon-blend": 0.08,
                  "space-color": "rgb(3, 7, 18)",
                  "star-intensity": 0.25,
                });
              } catch {}
            }
            map.resize();
          }}
        >
          <NavigationControl position="top-right" />
          {regions.map((region) => (
            <RegionMarker
              key={region.name}
              region={region}
              selected={active?.name === region.name}
              maxValue={maxValue}
              onSelect={onSelect}
            />
          ))}
        </Map>

        <div style={styles.mapHud}>
          <div style={styles.mapHudEyebrow}>Atlas Live Region Monitor</div>
          <div style={styles.mapHudTitle}>{active?.name || "Global view"}</div>
          <div style={styles.mapHudText}>
            Select a revenue marker or rotate the globe to inspect territory performance.
          </div>
          {active ? (
            <div style={styles.mapHudMetrics}>
              <div style={styles.mapHudMetric}>
                <span style={styles.mapHudMetricLabel}>Revenue</span>
                <strong style={styles.mapHudMetricValue}>{active.revenue}</strong>
              </div>
              <div style={styles.mapHudMetric}>
                <span style={styles.mapHudMetricLabel}>Pipeline</span>
                <strong style={styles.mapHudMetricValue}>{active.pipeline}</strong>
              </div>
            </div>
          ) : null}
        </div>

        {!hasGlobalMapToken ? (
          <div style={styles.mapStatus}>
            Fallback map active — add VITE_MAPBOX_TOKEN for the 3D globe
          </div>
        ) : null}
      </div>

      {active ? (
        <div style={styles.mapDetailCard}>
            <div style={styles.mapDetailTop}>
              <div>
                <div style={styles.mapDetailEyebrow}>Selected territory</div>
                <div style={styles.mapDetailName}>{active.name}</div>
              </div>
              <div style={toneStyle(active.tone)}>{active.tone}</div>
            </div>
            <div style={styles.mapDetailMetrics}>
              <div style={styles.mapMetric}>
                <span style={styles.mapMetricLabel}>Revenue</span>
                <strong style={styles.mapMetricValue}>{active.revenue}</strong>
              </div>
              <div style={styles.mapMetric}>
                <span style={styles.mapMetricLabel}>Pipeline</span>
                <strong style={styles.mapMetricValue}>{active.pipeline}</strong>
              </div>
              <div style={styles.mapMetric}>
                <span style={styles.mapMetricLabel}>Close rate</span>
                <strong style={styles.mapMetricValue}>{active.closeRate}</strong>
              </div>
            </div>
            <div style={styles.mapDetailAccounts}>
              Top accounts: {active.accounts.slice(0, 3).join(", ") || "None recorded"}
            </div>
        </div>
      ) : null}
    </div>
  );
}

export default function GlobalRevenueMap() {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedRegion, setSelectedRegion] = useState("North America");

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
        console.error("GlobalRevenueMap load error:", err);
        if (!mounted) return;
        setError(err?.message || "Failed to load Global Revenue Map");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, []);

  const workspaceMode = String(dashboard?.workspaceMode || "demo").toLowerCase();
  const isDemo = workspaceMode === "demo";
  const orgName = dashboard?.activeWorkspace?.name || "Workspace";
  const deals = Array.isArray(dashboard?.deals) ? dashboard.deals : [];
  const revenue = safeNum(dashboard?.summary?.revenue, 0);
  const pipelineValue = safeNum(dashboard?.summary?.pipelineValue, 0);

  const mapRegions = useMemo(() => {
    if (isDemo) {
      return [
        {
          name: "North America",
          key: regionDataKey("North America"),
          revenue: "$3.8M",
          pipeline: "$9.2M",
          closeRate: "36%",
          tone: "Strong",
          accounts: ["Apex Manufacturing", "Nova Healthcare", "Titan Logistics"],
          revenueNum: 3800000,
          pipelineNum: 9200000,
        },
        {
          name: "Europe",
          key: regionDataKey("Europe"),
          revenue: "$1.4M",
          pipeline: "$4.7M",
          closeRate: "29%",
          tone: "Stable",
          accounts: ["EuroMed Systems", "Vertex Industrial", "BlueCore Energy"],
          revenueNum: 1400000,
          pipelineNum: 4700000,
        },
        {
          name: "Asia",
          key: regionDataKey("Asia"),
          revenue: "$600K",
          pipeline: "$2.1M",
          closeRate: "22%",
          tone: "Emerging",
          accounts: ["Sakura Robotics", "Pacific Health Tech", "Orion Supply Group"],
          revenueNum: 600000,
          pipelineNum: 2100000,
        },
      ];
    }

    const grouped = new Map();

    deals.forEach((deal) => {
      const regionName = getDealRegion(deal);
      if (!regionName) return;

      if (!grouped.has(regionName)) {
        grouped.set(regionName, {
          name: regionName,
          revenueNum: 0,
          pipelineNum: 0,
          accounts: [],
          wonCount: 0,
          dealCount: 0,
        });
      }

      const row = grouped.get(regionName);
      const amount =
        safeNum(deal?.amount, 0) ||
        safeNum(deal?.value, 0) ||
        safeNum(deal?.pipelineValue, 0);

      const stage = String(deal?.stage || "").toLowerCase();
      row.dealCount += 1;

      if (stage === "closed won") {
        row.revenueNum += amount;
        row.wonCount += 1;
      } else if (stage !== "closed lost") {
        row.pipelineNum += amount;
      }

      const accountName =
        deal?.accountName || deal?.company || deal?.clientName || deal?.name || "Account";

      if (!row.accounts.includes(accountName)) {
        row.accounts.push(accountName);
      }
    });

    return Array.from(grouped.values()).map((row) => {
      const closeRate =
        row.dealCount > 0 ? `${Math.round((row.wonCount / row.dealCount) * 100)}%` : "0%";

      let tone = "Emerging";
      if (row.revenueNum + row.pipelineNum >= 250000) tone = "Strong";
      else if (row.revenueNum + row.pipelineNum >= 75000) tone = "Stable";

      return {
        ...row,
        key: regionDataKey(row.name),
        revenue: moneyCompact(row.revenueNum),
        pipeline: moneyCompact(row.pipelineNum),
        closeRate,
        tone,
      };
    });
  }, [isDemo, deals]);

  const topRegion = useMemo(() => {
    if (!mapRegions.length) return null;
    return [...mapRegions].sort(
      (a, b) => safeNum(b.revenueNum, 0) - safeNum(a.revenueNum, 0)
    )[0];
  }, [mapRegions]);

  const regionStats = useMemo(() => {
    if (isDemo) {
      return [
        { label: "Tracked Regions", value: "3", note: "Active territory groups" },
        { label: "Global Revenue", value: "$5.8M", note: "Current regional output" },
        { label: "Global Pipeline", value: "$16.0M", note: "Open opportunity value" },
        { label: "Top Region", value: "North America", note: "Highest density today" },
      ];
    }

    return [
      {
        label: "Tracked Regions",
        value: String(mapRegions.length),
        note: "Live territory groups",
      },
      {
        label: "Global Revenue",
        value: moneyCompact(revenue),
        note: "Live closed-won revenue",
      },
      {
        label: "Global Pipeline",
        value: moneyCompact(pipelineValue),
        note: "Live open opportunity value",
      },
      {
        label: "Top Region",
        value: topRegion?.name || "No Data",
        note: topRegion ? "Highest live concentration" : "No active territory yet",
      },
    ];
  }, [isDemo, mapRegions.length, revenue, pipelineValue, topRegion]);

  const summaryPoints = useMemo(() => {
    if (isDemo) {
      return [
        "North America remains the strongest current revenue and pipeline concentration zone.",
        "Europe has healthy pipeline depth but still needs stronger close efficiency.",
        "Asia is earlier-stage, but emerging opportunity flow supports long-term expansion interest.",
        "Regional execution should remain concentrated where near-term close probability is strongest.",
      ];
    }

    if (!mapRegions.length) {
      return [
        "No live regional revenue map data is available for this workspace yet.",
        "Atlas will populate territory intelligence once deals begin carrying region, country, location, or territory data.",
        "This live workspace is no longer using hardcoded demo regional numbers.",
        "Once opportunities are distributed by geography, leadership will see real territory performance here.",
      ];
    }

    return [
      `${topRegion?.name || "A leading region"} is currently the strongest live concentration zone.`,
      `${moneyCompact(revenue)} in revenue and ${moneyCompact(
        pipelineValue
      )} in pipeline are being tracked across ${mapRegions.length} live regions.`,
      "Regional execution should remain concentrated where live opportunity density and close performance are strongest.",
      "Atlas is using workspace deal distribution to map territory-level revenue and pipeline concentration.",
    ];
  }, [isDemo, mapRegions.length, topRegion, revenue, pipelineValue]);

  const revenueByRegion = useMemo(() => {
    return mapRegions.map((r) => ({
      name: r.name,
      revenue: safeNum(r.revenueNum, 0),
    }));
  }, [mapRegions]);

  const pipelineByRegion = useMemo(() => {
    return mapRegions.map((r) => ({
      name: r.name,
      pipeline: safeNum(r.pipelineNum, 0),
    }));
  }, [mapRegions]);

  const trendData = useMemo(() => {
    if (isDemo) {
      return [
        { quarter: "Q1", northAmerica: 2900000, europe: 980000, asia: 320000 },
        { quarter: "Q2", northAmerica: 3200000, europe: 1130000, asia: 430000 },
        { quarter: "Q3", northAmerica: 3520000, europe: 1270000, asia: 520000 },
        { quarter: "Q4", northAmerica: 3800000, europe: 1400000, asia: 600000 },
      ];
    }

    const periods = [];
    const now = new Date();

    for (let offset = 3; offset >= 0; offset -= 1) {
      const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1));
      const monthId = date.toISOString().slice(0, 7);
      const row = {
        monthId,
        quarter: date.toLocaleDateString("en-US", {
          month: "short",
          timeZone: "UTC",
        }),
      };
      mapRegions.forEach((region) => {
        row[region.key] = 0;
      });
      periods.push(row);
    }

    const byMonth = new Map(periods.map((row) => [row.monthId, row]));

    deals.forEach((deal) => {
      if (String(deal?.stage || "").toLowerCase() !== "closed won") return;
      const regionName = getDealRegion(deal);
      if (!regionName) return;
      const closedDate = new Date(
        deal?.closedAt || deal?.closeDate || deal?.updatedAt || deal?.createdAt
      );
      if (Number.isNaN(closedDate.getTime())) return;
      const row = byMonth.get(closedDate.toISOString().slice(0, 7));
      if (!row) return;
      const key = regionDataKey(regionName);
      row[key] = safeNum(row[key]) + safeNum(deal?.amount || deal?.value);
    });

    return periods;
  }, [isDemo, deals, mapRegions]);

  const hasTrendData = useMemo(
    () =>
      isDemo ||
      trendData.some((row) =>
        mapRegions.some((region) => safeNum(row[region.key]) > 0)
      ),
    [isDemo, trendData, mapRegions]
  );

  if (loading) {
    return (
      <div style={styles.page}>
        <div style={styles.wrap}>
          <div style={styles.hero}>
            <h1 style={styles.h1}>Loading Global Revenue Map...</h1>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.page}>
        <div style={styles.wrap}>
          <div style={styles.errorBox}>{error}</div>
        </div>
      </div>
    );
  }

  const noLiveGeoData = !isDemo && !mapRegions.length;

  return (
    <div style={styles.page}>
      <div style={styles.wrap}>
        <div style={styles.hero}>
          <div style={styles.eyebrow}>Revenue & Opportunity Distribution</div>
          <h1 style={styles.h1}>Global Revenue Map</h1>
          <div style={styles.heroText}>
            Atlas shows where revenue is being generated, where pipeline is building,
            and which regions deserve tighter leadership attention for <b>{orgName}</b>.
          </div>

          <div style={styles.badgeWrap}>
            {[
              isDemo ? "Demo Territory Mode" : "Live Territory Mode",
              noLiveGeoData ? "No Geo Data Yet" : "Revenue Mapping Synced",
              "Atlas AI Monitoring",
            ].map((item) => (
              <div key={item} style={styles.badge}>
                {item}
              </div>
            ))}
          </div>
        </div>

        <div style={styles.statsGrid}>
          {regionStats.map((item) => (
            <SmallStat
              key={item.label}
              label={item.label}
              value={item.value}
              note={item.note}
            />
          ))}
        </div>

        <Section title="Global Revenue Intelligence Map" subtitle="Live Territory View">
          <div style={styles.mapShell}>
            {noLiveGeoData ? (
              <EmptyState text="No live geographic opportunity data yet. Add region, country, location, or territory fields to live deals to activate the map." />
            ) : (
              <InteractiveWorldMap
                regions={mapRegions}
                selectedRegion={selectedRegion}
                onSelect={setSelectedRegion}
              />
            )}
          </div>

          <div style={styles.summaryStrip}>
            {summaryPoints.slice(0, 4).map((point, index) => (
              <div key={point} style={styles.summarySignal}>
                <span style={styles.summaryNumber}>{String(index + 1).padStart(2, "0")}</span>
                <span>{point}</span>
              </div>
            ))}
          </div>
        </Section>

        <div style={styles.twoCol}>
          <Section title="Revenue by Region" subtitle="Performance">
            <div style={styles.chartShell}>
              {noLiveGeoData ? (
                <EmptyState text="No live regional revenue values yet." />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={revenueByRegion}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                    <XAxis dataKey="name" tick={axisTick} stroke="#94a3b8" />
                    <YAxis
                      tick={axisTick}
                      stroke="#94a3b8"
                      tickFormatter={(v) => moneyCompact(v)}
                    />
                    <Tooltip
                      formatter={(value) => [moneyCompact(value), "Revenue"]}
                      contentStyle={tooltipStyle}
                      labelStyle={{ color: "#fff" }}
                    />
                    <Bar
                      dataKey="revenue"
                      fill="#8bf3ff"
                      radius={[10, 10, 0, 0]}
                      animationDuration={1400}
                      animationEasing="ease-out"
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </Section>

          <Section title="Pipeline by Region" subtitle="Coverage">
            <div style={styles.chartShell}>
              {noLiveGeoData ? (
                <EmptyState text="No live regional pipeline values yet." />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={pipelineByRegion}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                    <XAxis dataKey="name" tick={axisTick} stroke="#94a3b8" />
                    <YAxis
                      tick={axisTick}
                      stroke="#94a3b8"
                      tickFormatter={(v) => moneyCompact(v)}
                    />
                    <Tooltip
                      formatter={(value) => [moneyCompact(value), "Pipeline"]}
                      contentStyle={tooltipStyle}
                      labelStyle={{ color: "#fff" }}
                    />
                    <Bar
                      dataKey="pipeline"
                      fill="#c4fbff"
                      radius={[10, 10, 0, 0]}
                      animationDuration={1500}
                      animationEasing="ease-out"
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </Section>
        </div>

        <div style={styles.twoCol}>
          <Section title="Regional Revenue Trend" subtitle="Momentum">
            <div style={styles.chartShell}>
              {!hasTrendData ? (
                <EmptyState text="No live revenue trend data yet." />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                    <XAxis dataKey="quarter" tick={axisTick} stroke="#94a3b8" />
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
                    {mapRegions.map((region, index) => {
                      const color =
                        REGION_META[region.name]?.color || "#8bf3ff";
                      return (
                        <Line
                          key={region.name}
                          type="monotone"
                          dataKey={region.key}
                          name={region.name}
                          stroke={color}
                          strokeWidth={3}
                          dot={{ r: 3, fill: color }}
                          activeDot={{ r: 6 }}
                          animationDuration={1400 + index * 180}
                        />
                      );
                    })}
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </Section>

          <Section title="Regional Opportunity Radar" subtitle="Territories">
            <div style={styles.radarList}>
              {mapRegions.length ? (
                mapRegions.map((region) => (
                  <div key={region.name} style={styles.radarCard}>
                    <div style={styles.radarTop}>
                      <div>
                        <div style={styles.radarName}>{region.name}</div>
                        <div style={styles.radarMeta}>
                          Top accounts: {region.accounts.join(", ") || "None"}
                        </div>
                      </div>
                      <div style={toneStyle(region.tone)}>{region.tone}</div>
                    </div>

                    <div style={styles.radarGrid}>
                      <div style={styles.mini}>
                        <div style={styles.miniLabel}>Revenue</div>
                        <div style={styles.miniValue}>{region.revenue}</div>
                      </div>
                      <div style={styles.mini}>
                        <div style={styles.miniLabel}>Pipeline</div>
                        <div style={styles.miniValue}>{region.pipeline}</div>
                      </div>
                      <div style={styles.mini}>
                        <div style={styles.miniLabel}>Close Rate</div>
                        <div style={styles.miniValue}>{region.closeRate}</div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <EmptyState text="No live territory radar data yet." />
              )}
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}

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
      "linear-gradient(135deg, rgba(30,64,175,0.18), rgba(37,99,235,0.10), rgba(255,255,255,0.02))",
    boxShadow: "0 12px 30px rgba(0,0,0,0.18)",
  },
  eyebrow: {
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: "0.18em",
    color: "rgba(125,211,252,0.9)",
    fontWeight: 800,
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
    color: "rgba(226,232,240,0.9)",
  },
  badgeWrap: {
    marginTop: 12,
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
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
    minHeight: 126,
    background: "rgba(255,255,255,0.032)",
    boxShadow: "0 8px 20px rgba(0,0,0,0.12)",
  },
  statLabel: {
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: "0.14em",
    color: "rgba(148,163,184,0.88)",
    fontWeight: 800,
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
    gridTemplateColumns: "1.08fr 0.92fr",
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
  mapShell: {
    height: 520,
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 16,
    overflow: "hidden",
    background: "rgba(4,10,24,0.72)",
    position: "relative",
    padding: 0,
  },
  worldMapPanel: {
    height: "100%",
    background:
      "radial-gradient(circle at 50% 10%, rgba(56,189,248,0.10), transparent 42%), rgba(2,6,18,0.75)",
    display: "flex",
    flexDirection: "column",
  },
  mapStage: {
    flex: 1,
    minHeight: 0,
    position: "relative",
    overflow: "hidden",
    background: "#030712",
  },
  mapHud: {
    position: "absolute",
    zIndex: 3,
    top: 14,
    left: 14,
    width: 250,
    padding: 14,
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.11)",
    background:
      "linear-gradient(180deg, rgba(8,14,28,0.92), rgba(5,9,18,0.86))",
    backdropFilter: "blur(12px)",
    boxShadow: "0 18px 42px rgba(0,0,0,0.36)",
    pointerEvents: "none",
  },
  mapHudEyebrow: {
    fontSize: 9,
    textTransform: "uppercase",
    letterSpacing: "0.16em",
    color: "rgba(125,211,252,0.82)",
    fontWeight: 800,
  },
  mapHudTitle: {
    marginTop: 6,
    fontSize: 22,
    lineHeight: 1.05,
    color: "#fff",
    fontWeight: 900,
  },
  mapHudText: {
    marginTop: 7,
    fontSize: 11,
    lineHeight: 1.5,
    color: "rgba(203,213,225,0.74)",
  },
  mapHudMetrics: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 8,
    marginTop: 12,
  },
  mapHudMetric: {
    display: "grid",
    gap: 3,
    padding: "8px 9px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.04)",
  },
  mapHudMetricLabel: {
    fontSize: 8,
    textTransform: "uppercase",
    letterSpacing: "0.12em",
    color: "rgba(148,163,184,0.78)",
    fontWeight: 800,
  },
  mapHudMetricValue: {
    color: "#fff",
    fontSize: 13,
    fontWeight: 900,
  },
  mapStatus: {
    position: "absolute",
    zIndex: 3,
    left: 14,
    bottom: 12,
    padding: "7px 10px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(7,11,24,0.88)",
    color: "#cbd5e1",
    fontSize: 10,
    fontWeight: 700,
  },
  regionMarker: {
    padding: 0,
    borderRadius: 999,
    borderWidth: 2,
    borderStyle: "solid",
    cursor: "pointer",
    transition: "transform 160ms ease, box-shadow 160ms ease",
  },
  demoMapTitle: {
    fontSize: 18,
    fontWeight: 900,
    color: "#fff",
  },
  mapHeaderRow: {
    minHeight: 68,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
    padding: "13px 16px",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
  },
  mapInstruction: {
    marginTop: 4,
    fontSize: 12,
    color: "rgba(203,213,225,0.72)",
  },
  mapLegend: {
    display: "flex",
    alignItems: "center",
    gap: 7,
    fontSize: 11,
    color: "rgba(203,213,225,0.72)",
    whiteSpace: "nowrap",
  },
  legendDot: {
    width: 9,
    height: 9,
    borderRadius: "50%",
    background: "#67e8f9",
    boxShadow: "0 0 14px rgba(103,232,249,0.85)",
  },
  mapDetailCard: {
    minHeight: 104,
    borderTop: "1px solid rgba(103,232,249,0.18)",
    padding: "11px 16px",
    background: "rgba(5,10,24,0.91)",
    display: "grid",
    gridTemplateColumns: "0.8fr 1.15fr 1.15fr",
    alignItems: "center",
    gap: 14,
  },
  mapDetailTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  mapDetailEyebrow: {
    fontSize: 9,
    textTransform: "uppercase",
    letterSpacing: "0.15em",
    color: "rgba(125,211,252,0.78)",
    fontWeight: 800,
  },
  mapDetailName: {
    marginTop: 3,
    fontSize: 17,
    fontWeight: 900,
  },
  mapDetailMetrics: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 7,
    marginTop: 0,
  },
  mapMetric: {
    minWidth: 0,
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 10,
    padding: "8px 7px",
    background: "rgba(255,255,255,0.035)",
    display: "grid",
    gap: 4,
  },
  mapMetricLabel: {
    fontSize: 9,
    textTransform: "uppercase",
    letterSpacing: "0.09em",
    color: "rgba(148,163,184,0.78)",
  },
  mapMetricValue: {
    fontSize: 13,
    color: "#ffffff",
  },
  mapDetailAccounts: {
    marginTop: 0,
    fontSize: 11,
    lineHeight: 1.45,
    color: "rgba(203,213,225,0.72)",
  },
  summaryStrip: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 8,
    marginTop: 10,
  },
  summarySignal: {
    minHeight: 70,
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    border: "1px solid rgba(255,255,255,0.07)",
    background: "rgba(4,10,24,0.34)",
    borderRadius: 14,
    padding: "11px 12px",
    fontSize: 12,
    lineHeight: 1.5,
    color: "#dbe4f0",
  },
  summaryNumber: {
    color: "#67e8f9",
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: "0.12em",
    paddingTop: 2,
  },
  radarList: {
    display: "grid",
    gap: 10,
  },
  radarCard: {
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 16,
    padding: 13,
    background: "rgba(4,10,24,0.34)",
  },
  radarTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    alignItems: "center",
    flexWrap: "wrap",
  },
  radarName: {
    fontSize: 16,
    fontWeight: 800,
    color: "#fff",
  },
  radarMeta: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 1.5,
    color: "rgba(203,213,225,0.78)",
  },
  radarGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 8,
    marginTop: 12,
  },
  mini: {
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 14,
    padding: 10,
    background: "rgba(255,255,255,0.03)",
  },
  miniLabel: {
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: "0.14em",
    color: "rgba(148,163,184,0.86)",
    fontWeight: 700,
  },
  miniValue: {
    marginTop: 8,
    fontSize: 18,
    fontWeight: 800,
    color: "#fff",
  },
  emptyState: {
    height: "100%",
    minHeight: 220,
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
