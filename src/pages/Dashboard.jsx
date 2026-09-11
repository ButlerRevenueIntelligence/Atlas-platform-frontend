  import React, { useEffect, useMemo, useState } from "react";
import {
  apiGet,
  getDashboard,
  getIntegrations,
  getPipeline,
  getAttributionSummary,
  getRevenueStability,
  getForecastScenarios,
  seedDemoData,
  getClients,
  createClient,
  createDeal,
  getStripeRevenueDaily,
} from "../api";

import { useNavigate } from "react-router-dom";
import mapboxgl from "mapbox-gl";
import Map, {
  Marker,
  Popup,
  NavigationControl,
  Source,
  Layer,
} from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";

import OrgSwitcher from "../components/OrgSwitcher";
import AnimatedCounter from "../components/AnimatedCounter";
import AITicker from "../components/AITicker";
import CommandBar from "../components/CommandBar";
import ForecastConfidence from "../components/ForecastConfidence";
import SystemStatus from "../components/SystemStatus";
import ExecutiveBriefing from "../components/ExecutiveBriefing";
import RevenueLeakDetector from "../components/RevenueLeakDetector";
import PipelineVelocity from "../components/PipelineVelocity";
import OpportunityRadar from "../components/atlas/OpportunityRadar";
import RevenueTimeline from "../components/atlas/RevenueTimeline";
import LiveRevenueSnapshot from "../components/atlas/LiveRevenueSnapshot";
import DealRiskDetectionAI from "../components/atlas/DealRiskDetectionAI";
import PaywallModal from "../components/PaywallModal";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  AreaChart,
  Area,
} from "recharts";

/** ---------------- Mapbox setup ---------------- */
const rawMapToken = import.meta.env.VITE_MAPBOX_TOKEN || "";
const DASHBOARD_MAPBOX_TOKEN =
  rawMapToken && rawMapToken !== "YOUR_MAPBOX_PUBLIC_TOKEN" ? rawMapToken : "";

if (DASHBOARD_MAPBOX_TOKEN) {
  mapboxgl.accessToken = DASHBOARD_MAPBOX_TOKEN;
}

const hasDashboardMapToken = Boolean(DASHBOARD_MAPBOX_TOKEN);

const dashboardFallbackMapStyle = {
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

/** ---------------- Helpers ---------------- */
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
  if (abs >= 1_000_000) return `$${(num / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `$${(num / 1_000).toFixed(0)}K`;
  return money(num);
};

const dateLabel = (v, mode = "date") => {
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  return mode === "datetime" ? d.toLocaleString() : d.toLocaleDateString();
};

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

const calcWoW = (metrics) => {
  if (!Array.isArray(metrics) || metrics.length < 14) return null;
  const sorted = [...metrics].sort((a, b) => new Date(a.date) - new Date(b.date));
  const sumRev = (arr) => arr.reduce((acc, m) => acc + safeNum(m.revenue), 0);
  const last7 = sumRev(sorted.slice(-7));
  const prev7 = sumRev(sorted.slice(-14, -7));
  if (prev7 <= 0) return null;
  return ((last7 - prev7) / prev7) * 100;
};

const riskFromCoverage = (coverage) => {
  if (coverage >= 4) return { label: "Strong", tone: "good" };
  if (coverage >= 2) return { label: "Moderate", tone: "warn" };
  return { label: "At Risk", tone: "bad" };
};

const normalizeStage = (s) => {
  const val = (s || "").toString().trim().toLowerCase();
  if (!val) return "Unknown";
  if (val.includes("disc")) return "Discovery";
  if (val.includes("prop")) return "Proposal";
  if (val.includes("follow")) return "Follow-Up";
  if (val.includes("neg")) return "Negotiation";
  if (val.includes("close") || val.includes("won")) return "Closed Won";
  if (val.includes("lost")) return "Closed Lost";
  return s?.toString?.() || "Unknown";
};

const prettyProvider = (i) => {
  const raw = (i?.provider || i?.name || i?.key || "").toString().trim();
  if (!raw) return "Integration";
  return raw
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
};

const prettyStatus = (i) => {
  const s = (i?.status || i?.state || "connected").toString().trim();
  return s || "connected";
};

const integrationMeta = (i) => {
  const last =
    i?.updatedAt ||
    i?.lastSync ||
    i?.last_synced_at ||
    i?.connectedAt ||
    i?.createdAt ||
    null;

  if (!last) return null;

  const d = new Date(last);
  if (Number.isNaN(d.getTime())) return null;
  return `Last sync: ${d.toLocaleString()}`;
};

const buildLocalInsights = (kpis, seed = 0) => {
  const jitter = (base, range = 6) => {
    const r = Math.sin((seed + base) * 999) * 10000;
    const frac = r - Math.floor(r);
    const delta = (frac - 0.5) * range * 2;
    return clamp(Math.round(base + delta), 60, 97);
  };

  const items = [];

  if (kpis.spend30 > 0 && kpis.revenue30 > 0) {
    const roi = (kpis.revenue30 - kpis.spend30) / kpis.spend30;

    if (roi >= 1) {
      items.push({
        type: "OPPORTUNITY",
        impact: "HIGH IMPACT",
        confidence: jitter(92),
        title: "Marketing efficiency is strong",
        body: "ROI is trending positive. Increase budget carefully in the best-performing channels to compound growth.",
      });
    } else if (roi < 0) {
      items.push({
        type: "WARNING",
        impact: "MEDIUM IMPACT",
        confidence: jitter(84),
        title: "Paid efficiency drift detected",
        body: "Spend is outpacing revenue. Tighten targeting, remove weak ad sets, and improve conversion rate on the highest-traffic pages.",
      });
    } else {
      items.push({
        type: "OPPORTUNITY",
        impact: "MEDIUM IMPACT",
        confidence: jitter(80),
        title: "Performance is stable",
        body: "Run controlled experiments (landing page + offer tests) to lift conversion rate while maintaining CAC.",
      });
    }
  } else {
    items.push({
      type: "OPPORTUNITY",
      impact: "HIGH IMPACT",
      confidence: jitter(78),
      title: "Connect data sources to unlock attribution",
      body: "Once ads + CRM are connected, the platform will show true revenue attribution and predictable pipeline forecasting.",
    });
  }

  if (kpis.coverage >= 4) {
    items.push({
      type: "SUCCESS",
      impact: "HIGH IMPACT",
      confidence: jitter(90),
      title: "Pipeline coverage is healthy",
      body: "Coverage suggests strong revenue protection. Prioritize closing motions and remove deal friction to accelerate wins.",
    });
  } else if (kpis.coverage >= 2) {
    items.push({
      type: "OPPORTUNITY",
      impact: "MEDIUM IMPACT",
      confidence: jitter(82),
      title: "Pipeline is workable, but needs lift",
      body: "Aim for 4x coverage to stabilize forecasting and reduce revenue volatility.",
    });
  } else {
    items.push({
      type: "WARNING",
      impact: "HIGH IMPACT",
      confidence: jitter(88),
      title: "Pipeline coverage is low",
      body: "Coverage is under target. Increase top-of-funnel volume and reactivation to build pipeline before forecasting becomes unstable.",
    });
  }

  if (kpis.cac > 500) {
    items.push({
      type: "WARNING",
      impact: "MEDIUM IMPACT",
      confidence: jitter(81),
      title: "CAC is elevated",
      body: "Reduce CAC by tightening ICP targeting, adding retargeting, and improving landing page conversion rate.",
    });
  } else {
    items.push({
      type: "SUCCESS",
      impact: "MEDIUM IMPACT",
      confidence: jitter(86),
      title: "CAC is under control",
      body: "Maintain efficiency while scaling budget in channels that drive the highest close-rate leads.",
    });
  }

  return items.slice(0, 3);
};

const FALLBACK_SCENARIOS = [
  {
    key: "current",
    label: "Baseline Reality",
    note: "What’s happening right now",
    multipliers: { revenue: 1.0, spend: 1.0, leads: 1.0, pipeline: 1.0 },
  },
  {
    key: "expansion",
    label: "Global Expansion",
    note: "Scale spend with controlled lift",
    multipliers: { revenue: 1.12, spend: 1.18, leads: 1.15, pipeline: 1.1 },
  },
  {
    key: "precision",
    label: "Precision Efficiency",
    note: "Cut waste, protect margin, optimize conversion",
    multipliers: { revenue: 1.06, spend: 0.9, leads: 0.98, pipeline: 1.02 },
  },
  {
    key: "domination",
    label: "Market Domination",
    note: "Speed-first scaling strategy",
    multipliers: { revenue: 1.2, spend: 1.35, leads: 1.25, pipeline: 1.15 },
  },
];

function normalizeScenarios(res) {
  const raw =
    (Array.isArray(res) && res) ||
    (Array.isArray(res?.scenarios) && res.scenarios) ||
    (Array.isArray(res?.data?.scenarios) && res.data.scenarios) ||
    null;

  if (!raw || !raw.length) return null;

  const rename = {
    scenario_0: { label: "Baseline Reality", note: "What’s happening right now" },
    scenario_1: { label: "Global Expansion", note: "Scale spend with controlled lift" },
    scenario_2: { label: "Precision Efficiency", note: "Cut waste, protect margin" },
    scenario_3: { label: "Market Domination", note: "Speed-first scaling strategy" },
  };

  const prettifyIfScenarioKey = (key, label, note) => {
    const k = String(key || "").trim();
    const l = String(label || "").trim();
    const picked = rename[k] || rename[l];
    if (!picked) return { label: label || key, note: note || "" };
    return { label: picked.label, note: note && note.length ? note : picked.note };
  };

  const list = raw
    .map((s, idx) => {
      const key = (s?.key || s?.id || s?.slug || `scenario_${idx}`).toString();
      const label = (s?.label || s?.name || s?.title || key).toString();
      const note = (s?.note || s?.description || "").toString();

      const m = s?.multipliers || s?.mult || {};
      const multipliers = {
        revenue: safeNum(m.revenue ?? s?.revenue ?? 1) || 1,
        spend: safeNum(m.spend ?? s?.spend ?? 1) || 1,
        leads: safeNum(m.leads ?? s?.leads ?? 1) || 1,
        pipeline: safeNum(m.pipeline ?? s?.pipeline ?? 1) || 1,
      };

      const renamed = prettifyIfScenarioKey(key, label, note);
      return { key, label: renamed.label, note: renamed.note, multipliers };
    })
    .filter((s) => s.key && s.label);

  return list.length ? list : null;
}

function MiniRegionMarker({ region, onClick }) {
  const size = Math.max(
    14,
    Math.min(26, Math.round((safeNum(region.pipeline) / 1_000_000) * 1.4 + 10))
  );

  return (
    <Marker longitude={region.lng} latitude={region.lat} anchor="center">
      <button
        type="button"
        title={region.region}
        onClick={(e) => {
          e.stopPropagation();
          onClick(region);
        }}
        style={{
          width: size,
          height: size,
          borderRadius: 999,
          border: "2px solid rgba(255,255,255,0.92)",
          cursor: "pointer",
          animation: "atlasPulse 2.2s infinite",
          background:
            region.signal >= 60
              ? "radial-gradient(circle at 35% 35%, #d8fbff, #22c55e 58%, #0891b2 100%)"
              : region.signal >= 35
              ? "radial-gradient(circle at 35% 35%, #fef3c7, #f59e0b 58%, #d97706 100%)"
              : "radial-gradient(circle at 35% 35%, #cbd5e1, #64748b 58%, #334155 100%)",
          boxShadow: "0 0 0 8px rgba(56,189,248,0.10), 0 10px 24px rgba(0,0,0,0.35)",
        }}
      />
    </Marker>
  );
}

export default function Dashboard() {
  const nav = useNavigate();

  useEffect(() => {
    if (
      !localStorage.getItem("atlas_onboarded") &&
      window.location.pathname !== "/welcome"
    ) {
      window.location.href = "/welcome";
    }
  }, []);

   useEffect(() => {
  async function loadStripeRevenue() {
    try {
      const data = await getStripeRevenueDaily();
      setStripeData(data);
    } catch (err) {
      console.error("Stripe error:", err);
    }
  }

  loadStripeRevenue();
}, []);

  const [dashboard, setDashboard] = useState(null);
  const [integrations, setIntegrations] = useState([]);
  const [pipeline, setPipeline] = useState({ deals: [], pipelineValue: 0 });
  const [attribution, setAttribution] = useState(null);
  const [rss, setRss] = useState(null);
  const [stripeData, setStripeData] = useState(null);

  const [serverScenarios, setServerScenarios] = useState(null);
  const [scenarioKey, setScenarioKey] = useState("current");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [aiInsights, setAiInsights] = useState([]);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightSeed, setInsightSeed] = useState(Date.now());

  const isDev = !!import.meta.env.DEV;
  const [demoLoading, setDemoLoading] = useState(false);
  const [demoMsg, setDemoMsg] = useState("");

  const [selectedMiniRegion, setSelectedMiniRegion] = useState(null);
  const [miniMapView, setMiniMapView] = useState({
    longitude: 10,
    latitude: 18,
    zoom: 0.9,
  });

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("analyst");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteMsg, setInviteMsg] = useState("");
  const [inviteErr, setInviteErr] = useState("");
  const [showPaywall, setShowPaywall] = useState(false);

  const [clients, setClients] = useState([]);
  const [clientsLoading, setClientsLoading] = useState(false);

  const [showClientModal, setShowClientModal] = useState(false);
  const [showDealModal, setShowDealModal] = useState(false);

  const [clientForm, setClientForm] = useState({
    name: "",
    website: "",
    industry: "",
    primaryContactName: "",
    primaryContactEmail: "",
    primaryContactPhone: "",
    status: "active",
    notes: "",
  });

  const [dealForm, setDealForm] = useState({
    name: "",
    amount: "",
    stage: "Discovery",
    probability: "0.5",
    clientId: "",
    closeDate: "",
    nextAction: "",
    nextActionDueAt: "",
    closedReason: "",
    competitor: "",
    reactivationAt: "",
  });

  const [clientSubmitting, setClientSubmitting] = useState(false);
  const [dealSubmitting, setDealSubmitting] = useState(false);
  const [clientModalMsg, setClientModalMsg] = useState("");
  const [clientModalErr, setClientModalErr] = useState("");
  const [dealModalMsg, setDealModalMsg] = useState("");
  const [dealModalErr, setDealModalErr] = useState("");

  async function checkAccess() {
    const me = await apiGet("/me");

    const trialStatus =
      me?.trial?.status ||
      me?.organization?.trial?.status ||
      me?.org?.trial?.status;

    if (trialStatus === "expired") {
      setShowPaywall(true);
      return false;
    }

    return true;
  }

  async function loadDashboardData() {
    try {
      setLoading(true);
      setError("");

      const [dash, ints, pipe, attrib, rssRes, scenRes] = await Promise.all([
        getDashboard(),
        getIntegrations(),
        getPipeline(),
        getAttributionSummary(),
        getRevenueStability().catch(() => null),
        typeof getForecastScenarios === "function"
          ? getForecastScenarios().catch(() => null)
          : Promise.resolve(null),
      ]);

      setRss(rssRes?.ok ? rssRes : null);
      setDashboard(dash || {});

      const intsArr = Array.isArray(ints)
        ? ints
        : Array.isArray(ints?.integrations)
        ? ints.integrations
        : [];
      setIntegrations(intsArr);

      setPipeline(pipe || { deals: [], pipelineValue: 0 });
      setAttribution(attrib || null);

      const normalized = scenRes ? normalizeScenarios(scenRes) : null;
      setServerScenarios(normalized);

      if (normalized?.length) {
        const exists = normalized.some((s) => s.key === scenarioKey);
        if (!exists) setScenarioKey(normalized[0].key);
      }

      setAiInsights([]);
      setInsightSeed(Date.now());
    } catch (e) {
      console.error("Dashboard load error:", e);
      setError(e?.message || "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }

  async function loadClients() {
    try {
      setClientsLoading(true);
      const res = await getClients();
      const list = Array.isArray(res?.clients)
        ? res.clients
        : Array.isArray(res)
        ? res
        : [];
      setClients(list);
      return list;
    } catch (e) {
      console.error("Clients load error:", e);
      return [];
    } finally {
      setClientsLoading(false);
    }
  }

  useEffect(() => {
    let alive = true;

    (async () => {
      if (!alive) return;
      await Promise.all([loadDashboardData(), loadClients()]);
    })();

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setMiniMapView((prev) => ({
        ...prev,
        longitude: prev.longitude >= 180 ? -180 : prev.longitude + 0.08,
      }));
    }, 70);

    return () => clearInterval(interval);
  }, []);

  function resetClientForm() {
    setClientForm({
      name: "",
      website: "",
      industry: "",
      primaryContactName: "",
      primaryContactEmail: "",
      primaryContactPhone: "",
      status: "active",
      notes: "",
    });
    setClientModalMsg("");
    setClientModalErr("");
  }

  function resetDealForm(nextClientId = "") {
    setDealForm({
      name: "",
      amount: "",
      stage: "Discovery",
      probability: "0.5",
      clientId: nextClientId,
      closeDate: "",
      nextAction: "",
      nextActionDueAt: "",
      closedReason: "",
      competitor: "",
      reactivationAt: "",
    });
    setDealModalMsg("");
    setDealModalErr("");
  }

  async function openClientModal() {
    resetClientForm();
    setShowClientModal(true);
  }

  async function openDealModal() {
    const list = clients.length ? clients : await loadClients();
    const firstClientId = list?.[0]?._id || list?.[0]?.id || "";
    resetDealForm(firstClientId);
    setShowDealModal(true);
  }

  async function handleCreateClientSubmit(e) {
    e.preventDefault();
    setClientModalMsg("");
    setClientModalErr("");

    if (!clientForm.name.trim()) {
      setClientModalErr("Client name is required.");
      return;
    }

    try {
      setClientSubmitting(true);

      const res = await createClient({
        ...clientForm,
        name: clientForm.name.trim(),
        website: clientForm.website.trim(),
        industry: clientForm.industry.trim(),
        primaryContactName: clientForm.primaryContactName.trim(),
        primaryContactEmail: clientForm.primaryContactEmail.trim(),
        primaryContactPhone: clientForm.primaryContactPhone.trim(),
        notes: clientForm.notes.trim(),
      });

      const createdClient = res?.client || null;
      const freshClients = await loadClients();
      await loadDashboardData();

      setClientModalMsg("Client created successfully.");

      const createdClientId =
        createdClient?._id ||
        createdClient?.id ||
        freshClients?.[0]?._id ||
        freshClients?.[0]?.id ||
        "";

      setShowClientModal(false);
      resetClientForm();

      if (createdClientId) {
        resetDealForm(createdClientId);
      }
    } catch (e) {
      console.error("Create client error:", e);
      setClientModalErr(e?.message || "Failed to create client.");
    } finally {
      setClientSubmitting(false);
    }
  }

  async function handleCreateDealSubmit(e) {
    e.preventDefault();
    setDealModalMsg("");
    setDealModalErr("");

    if (!dealForm.name.trim()) {
      setDealModalErr("Deal name is required.");
      return;
    }

    if (!dealForm.clientId) {
      setDealModalErr("Please select a client.");
      return;
    }

    try {
      setDealSubmitting(true);

      await createDeal({
        name: dealForm.name.trim(),
        amount: Number(dealForm.amount || 0),
        stage: dealForm.stage,
        probability: Number(dealForm.probability || 0.5),
        clientId: dealForm.clientId,
        closeDate: dealForm.closeDate || null,
        nextAction: dealForm.nextAction.trim(),
        nextActionDueAt: dealForm.nextActionDueAt || null,
        closedReason: dealForm.closedReason.trim(),
        competitor: dealForm.competitor.trim(),
        reactivationAt: dealForm.reactivationAt || null,
      });

      await loadDashboardData();
      setShowDealModal(false);
      resetDealForm(clients?.[0]?._id || clients?.[0]?.id || "");
      setDealModalMsg("Deal created successfully.");
    } catch (e) {
      console.error("Create deal error:", e);
      setDealModalErr(e?.message || "Failed to create deal.");
    } finally {
      setDealSubmitting(false);
    }
  }

  async function onLoadDemoData() {
    if (demoLoading) return;

    const orgId = dashboard?.org?._id || dashboard?.orgId || "default";
    const guardKey = `atlas_demo_seeded_${orgId}`;
    const alreadySeeded = localStorage.getItem(guardKey) === "1";

    const ok = window.confirm(
      alreadySeeded
        ? "Demo data was already loaded for this workspace.\n\nLoad it again anyway? (This can create duplicates unless the backend clears first.)"
        : "Load demo data into this workspace?\n\nThis will create sample clients + deals for demo purposes."
    );
    if (!ok) return;

    try {
      setDemoLoading(true);
      setDemoMsg("");
      setError("");

      await seedDemoData({ clients: 10, deals: 25 });

      localStorage.setItem(guardKey, "1");
      setDemoMsg("✅ Demo data loaded. Refreshing…");
      await Promise.all([loadDashboardData(), loadClients()]);
      setDemoMsg("✅ Demo data loaded successfully.");
      setTimeout(() => setDemoMsg(""), 3500);
    } catch (e) {
      console.error("seed demo error:", e);
      setDemoMsg("");
      setError(e?.message || "Failed to load demo data");
    } finally {
      setDemoLoading(false);
    }
  }

  async function handleQuickInvite() {
    setInviteMsg("");
    setInviteErr("");

    const email = inviteEmail.trim().toLowerCase();

    if (!email) {
      setInviteErr("Please enter an email address.");
      return;
    }

    try {
      setInviteLoading(true);

      const token =
        localStorage.getItem("butler_token") ||
        localStorage.getItem("token") ||
        "";

      const orgId =
        localStorage.getItem("x-org-id") ||
        localStorage.getItem("orgId") ||
        localStorage.getItem("butler_org_id") ||
        "";

      const res = await fetch("https://atlas-revenue-backend.onrender.com/api/invites", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          ...(orgId ? { "x-org-id": orgId } : {}),
        },
        body: JSON.stringify({
          email,
          role: inviteRole,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.message || "Failed to send invite.");
      }

      setInviteMsg(`Invite sent to ${email}.`);
      setInviteEmail("");
      setInviteRole("analyst");
    } catch (e) {
      setInviteErr(e?.message || "Failed to send invite.");
    } finally {
      setInviteLoading(false);
    }
  }

  const channelRows = useMemo(() => {
    const arr = attribution?.channels;
    return Array.isArray(arr) ? arr : [];
  }, [attribution]);

  const channelChart = useMemo(() => {
    return channelRows
      .map((c) => ({
        channel: c.channel || c.source || c.name || "Channel",
        spend: safeNum(c.spend),
        revenue: safeNum(c.revenue),
        leads: safeNum(c.leads),
        roiPct:
          safeNum(c.spend) > 0
            ? ((safeNum(c.revenue) - safeNum(c.spend)) / safeNum(c.spend)) * 100
            : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [channelRows]);

  const metrics = useMemo(() => {
    const arr = Array.isArray(dashboard?.metrics) ? dashboard.metrics : [];
    const normalized = arr
      .map((m) => ({
        date: m?.date || m?.day || m?.createdAt || m?.ts || null,
        revenue: safeNum(m?.revenue),
        spend: safeNum(m?.spend),
        leads: safeNum(m?.leads),
      }))
      .filter((m) => m.date)
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    return normalized.map((m) => ({
      ...m,
      x: new Date(m.date).toLocaleDateString(undefined, {
        month: "short",
        day: "2-digit",
      }),
    }));
  }, [dashboard]);

  const deals = useMemo(
    () => (Array.isArray(pipeline?.deals) ? pipeline.deals : []),
    [pipeline]
  );

  const hasLiveData = useMemo(() => {
    const hasMetrics = metrics.some(
      (m) => safeNum(m.revenue) > 0 || safeNum(m.spend) > 0 || safeNum(m.leads) > 0
    );

    const hasDeals = deals.some(
      (d) => safeNum(d?.amount ?? d?.value ?? d?.pipelineValue) > 0
    );

    const hasAttribution = channelChart.some(
      (c) => safeNum(c.revenue) > 0 || safeNum(c.spend) > 0 || safeNum(c.leads) > 0
    );

    return hasMetrics || hasDeals || hasAttribution;
  }, [metrics, deals, channelChart]);

  const scenarioList = useMemo(() => {
    if (Array.isArray(serverScenarios) && serverScenarios.length) return serverScenarios;
    return FALLBACK_SCENARIOS;
  }, [serverScenarios]);

  const activeScenario = useMemo(() => {
    const found = scenarioList.find((s) => s.key === scenarioKey);
    return found || scenarioList[0] || FALLBACK_SCENARIOS[0];
  }, [scenarioList, scenarioKey]);

  const kpis = useMemo(() => {
    if (!hasLiveData) {
      return {
        revenue30: 0,
        spend30: 0,
        leads30: 0,
        pipelineValue: 0,
        cac: 0,
        forecast90: 0,
        coverage: 0,
        wow: null,
        healthScore: 0,
        risk: { label: "No Data Yet", tone: "warn" },
        scenario: activeScenario,
      };
    }

    const m = activeScenario?.multipliers || {
      revenue: 1,
      spend: 1,
      leads: 1,
      pipeline: 1,
    };

    const rawRevenue30 =
      (dashboard?.revenue ?? dashboard?.revenue30d ?? null) ??
      metrics.reduce((acc, mm) => acc + safeNum(mm.revenue), 0);

    const rawSpend30 = metrics.reduce((acc, mm) => acc + safeNum(mm.spend), 0);
    const rawLeads30 = metrics.reduce((acc, mm) => acc + safeNum(mm.leads), 0);

    const rawPipelineValue =
      (dashboard?.pipelineValue ?? pipeline?.pipelineValue ?? null) ??
      deals.reduce((acc, d) => acc + safeNum(d?.amount ?? d?.value ?? d?.pipelineValue), 0);

    const revenue30 = safeNum(rawRevenue30) * safeNum(m.revenue || 1);
    const spend30 = safeNum(rawSpend30) * safeNum(m.spend || 1);
    const leads30 = safeNum(rawLeads30) * safeNum(m.leads || 1);
    const pipelineValue = safeNum(rawPipelineValue) * safeNum(m.pipeline || 1);

    const cac = leads30 > 0 ? spend30 / leads30 : 0;

    const forecast90 =
      (dashboard?.forecast90d ?? dashboard?.forecast ?? null) ??
      (metrics.length ? (safeNum(rawRevenue30) / metrics.length) * 90 : 0);

    const forecast90Scenario = safeNum(forecast90) * safeNum(m.revenue || 1);

    const coverage = revenue30 > 0 ? pipelineValue / revenue30 : 0;
    const wow = calcWoW(metrics);

    const base = clamp(coverage * 25, 20, 100);
    const boost = wow == null ? 0 : clamp(wow, -10, 10);
    const healthScore = clamp(base + boost, 0, 100);

    const risk = riskFromCoverage(coverage);

    return {
      revenue30,
      spend30,
      leads30,
      pipelineValue,
      cac,
      forecast90: forecast90Scenario,
      coverage,
      wow,
      healthScore,
      risk,
      scenario: activeScenario,
    };
  }, [dashboard, metrics, pipeline, deals, activeScenario, hasLiveData]);

  const lastUpdatedLabel = dashboard?.lastUpdated
    ? new Date(dashboard.lastUpdated).toLocaleString()
    : new Date().toLocaleString();

  const dataAsOfLabel = dashboard?.dataAsOf
    ? new Date(dashboard.dataAsOf).toLocaleDateString()
    : metrics?.length
    ? dateLabel(metrics[metrics.length - 1].date, "date")
    : new Date().toLocaleDateString();

  const isDemo =
    dashboard?.org?.isDemo ||
    dashboard?.org?.slug === "demo" ||
    (dashboard?.org?.name || "").toLowerCase().includes("butler");

  const orgName = dashboard?.org?.name || dashboard?.orgName || "Atlas Workspace";

  const targets = useMemo(() => {
    const monthlyRevenueGoal =
      safeNum(dashboard?.targets?.monthlyRevenueGoal) ||
      safeNum(dashboard?.monthlyGoal) ||
      0;

    const quarterlyRevenueGoal =
      safeNum(dashboard?.targets?.quarterlyRevenueGoal) ||
      (monthlyRevenueGoal > 0 ? monthlyRevenueGoal * 3 : 0);

    const currentMonthRevenue = safeNum(kpis.revenue30);
    const currentQuarterForecast = safeNum(kpis.forecast90);

    const monthPct =
      monthlyRevenueGoal > 0 ? (currentMonthRevenue / monthlyRevenueGoal) * 100 : 0;
    const quarterPct =
      quarterlyRevenueGoal > 0 ? (currentQuarterForecast / quarterlyRevenueGoal) * 100 : 0;

    return {
      monthlyRevenueGoal,
      quarterlyRevenueGoal,
      currentMonthRevenue,
      currentQuarterForecast,
      monthPct: clamp(monthPct, 0, 200),
      quarterPct: clamp(quarterPct, 0, 200),
    };
  }, [dashboard, kpis]);

  const liveRevenueSnapshot = useMemo(() => {
    if (!hasLiveData) {
      return {
        projectedRevenue: 0,
        pipelineValue: 0,
        dealsAtRisk: 0,
        activeOpportunities: 0,
        forecastConfidence: 0,
      };
    }

    const projectedRevenue = Math.max(
      safeNum(kpis.forecast90),
      safeNum(kpis.revenue30) * 3
    );

    const pipelineValue = safeNum(kpis.pipelineValue);
    const dealsAtRisk = Math.max(
      0,
      Math.round((safeNum(rss?.score) < 70 ? 3 : 1) + safeNum(dashboard?.staleDeals || 0))
    );
    const activeOpportunities = Array.isArray(deals) ? deals.length : 0;

    const forecastConfidence = clamp(
      Math.round((safeNum(rss?.score) || safeNum(kpis.healthScore)) * 0.95),
      55,
      98
    );

    return {
      projectedRevenue,
      pipelineValue,
      dealsAtRisk,
      activeOpportunities,
      forecastConfidence,
    };
  }, [kpis, rss, dashboard, deals, hasLiveData]);

  const dealRiskItems = useMemo(() => {
    if (!hasLiveData) return [];

    const sortedDeals = [...(Array.isArray(deals) ? deals : [])]
      .map((d, idx) => {
        const value = safeNum(d?.amount ?? d?.value ?? d?.pipelineValue);
        const stage = normalizeStage(d?.stage || d?.status);
        const staleDays = safeNum(d?.daysInStage ?? d?.staleDays ?? d?.ageDays);
        const probability = safeNum(d?.probability ?? d?.closeProbability ?? 0);

        let risk = "Watch";
        let reason = "Atlas AI suggests this deal should be monitored closely.";

        if (staleDays > 30 || probability < 35) {
          risk = "High";
          reason =
            "Atlas AI detected stalled movement, weak next-step clarity, and elevated close risk.";
        } else if (staleDays > 18 || probability < 50) {
          risk = "Medium";
          reason =
            "Opportunity is aging in stage longer than expected and follow-up velocity is slowing.";
        } else {
          reason =
            "Multiple timing and activity signals suggest this opportunity should remain on the watchlist.";
        }

        return {
          title: d?.name || d?.title || `Opportunity ${idx + 1}`,
          stage,
          risk,
          value,
          reason,
        };
      })
      .sort((a, b) => {
        const riskWeight = { High: 3, Medium: 2, Watch: 1 };
        return (riskWeight[b.risk] || 0) - (riskWeight[a.risk] || 0) || b.value - a.value;
      });

    return sortedDeals.slice(0, 4);
  }, [deals, hasLiveData]);

  async function onGenerateInsights() {
    try {
      setInsightsLoading(true);
      setError("");
      const seed = Date.now();
      setAiInsights([]);
      setInsightSeed(seed);
    } catch (e) {
      console.error("Generate insights error:", e);
      setError("Failed to generate insights");
    } finally {
      setInsightsLoading(false);
    }
  }

  async function handleGenerateBoardReport() {
    const allowed = await checkAccess();
    if (!allowed) return;
    nav("/reports");
  }

  async function handleRunAiAnalysis() {
    const allowed = await checkAccess();
    if (!allowed) return;

    onGenerateInsights();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSimulateForecast() {
    const allowed = await checkAccess();
    if (!allowed) return;

    const currentIndex = scenarioList.findIndex((s) => s.key === scenarioKey);
    const nextIndex = currentIndex >= scenarioList.length - 1 ? 0 : currentIndex + 1;
    const nextScenario = scenarioList[nextIndex];

    if (nextScenario?.key) {
      setScenarioKey(nextScenario.key);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  async function handleExportRevenueModel() {
    const allowed = await checkAccess();
    if (!allowed) return;

    const exportData = {
      exportedAt: new Date().toISOString(),
      orgName,
      scenario: kpis.scenario?.label || "Baseline Reality",
      kpis: {
        revenue30: kpis.revenue30,
        spend30: kpis.spend30,
        leads30: kpis.leads30,
        pipelineValue: kpis.pipelineValue,
        cac: kpis.cac,
        forecast90: kpis.forecast90,
        coverage: kpis.coverage,
        healthScore: kpis.healthScore,
        revenueStabilityIndex: rsi.score,
        revenueStabilityTier: rsi.tier,
      },
      overviewSignals,
      channelAttribution: channelChart,
      pipelineByStage,
      recentDeals: deals.slice(0, 10),
      integrations,
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json",
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${orgName.replace(/\s+/g, "-").toLowerCase()}-revenue-model.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const pipelineByStage = useMemo(() => {
    const map = new window.Map();

    for (const d of deals) {
      const stage = normalizeStage(d?.stage || d?.status);
      const val = safeNum(d?.amount ?? d?.value ?? d?.pipelineValue);
      map.set(stage, (map.get(stage) || 0) + val);
    }

    return [...map.entries()]
      .map(([name, value]) => ({ name, value }))
      .filter((x) => x.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [deals]);

  const insights = useMemo(() => {
    if (!hasLiveData) return [];
    return buildLocalInsights(kpis, insightSeed);
  }, [kpis, insightSeed, hasLiveData]);

  const displayedInsights = aiInsights?.length ? aiInsights : insights;

  const donutColors = ["#7C5CFF", "#22C55E", "#F59E0B", "#38BDF8", "#FB7185", "#A3A3A3"];

  const rsi = useMemo(() => {
    if (!hasLiveData) {
      return { score: 0, tier: "No Data Yet" };
    }

    const score =
      rss?.ok && Number.isFinite(Number(rss.score))
        ? Number(rss.score)
        : clamp(Math.round(kpis.healthScore), 0, 100);

    const tier =
      score >= 85
        ? "Strong"
        : score >= 70
        ? "Controlled Volatility"
        : score >= 55
        ? "Watchlist"
        : "High Risk";

    return { score, tier };
  }, [rss, kpis, hasLiveData]);

  const overviewSignals = useMemo(() => {
    if (!hasLiveData) return [];

    const items = [];

    if (kpis.wow != null) {
      items.push(
        kpis.wow >= 0
          ? `Revenue momentum is up ${Math.abs(kpis.wow).toFixed(1)}% week over week`
          : `Revenue momentum is down ${Math.abs(kpis.wow).toFixed(1)}% week over week`
      );
    }

    if (kpis.coverage < 2) {
      items.push("Pipeline coverage is below target and needs immediate lift");
    } else if (kpis.coverage < 4) {
      items.push("Pipeline coverage is workable but not yet elite");
    } else {
      items.push("Pipeline coverage is strong and protecting forecast stability");
    }

    if (channelChart.length) {
      items.push(
        `${channelChart[0]?.channel || "Top channel"} is currently leading attributed revenue`
      );
    }

    if (integrations.length < 2) {
      items.push("More integrations should be connected to unlock fuller attribution visibility");
    }

    if (safeNum(kpis.cac) > 500) {
      items.push("Customer acquisition cost is elevated and should be reviewed");
    }

    return items.slice(0, 5);
  }, [kpis, channelChart, integrations, hasLiveData]);

  const regionalSignals = useMemo(() => {
    if (!hasLiveData) {
      return [
        {
          region: "North America",
          signal: 0,
          revenue: 0,
          pipeline: 0,
          note: "No live regional data yet.",
          lat: 37.0902,
          lng: -95.7129,
        },
        {
          region: "Europe",
          signal: 0,
          revenue: 0,
          pipeline: 0,
          note: "No live regional data yet.",
          lat: 50.1109,
          lng: 8.6821,
        },
        {
          region: "Asia",
          signal: 0,
          revenue: 0,
          pipeline: 0,
          note: "No live regional data yet.",
          lat: 1.3521,
          lng: 103.8198,
        },
        {
          region: "LATAM",
          signal: 0,
          revenue: 0,
          pipeline: 0,
          note: "No live regional data yet.",
          lat: -15.7801,
          lng: -47.9292,
        },
      ];
    }

    const pipelineBase = safeNum(kpis.pipelineValue || 0);
    const revenueBase = safeNum(kpis.revenue30 || 0);

    return [
      {
        region: "North America",
        signal: 72,
        revenue: revenueBase * 0.46,
        pipeline: pipelineBase * 0.44,
        note: "Strongest current execution zone",
        lat: 37.0902,
        lng: -95.7129,
      },
      {
        region: "Europe",
        signal: 44,
        revenue: revenueBase * 0.24,
        pipeline: pipelineBase * 0.27,
        note: "Healthy pipeline, moderate close pressure",
        lat: 50.1109,
        lng: 8.6821,
      },
      {
        region: "Asia",
        signal: 38,
        revenue: revenueBase * 0.18,
        pipeline: pipelineBase * 0.19,
        note: "Emerging expansion territory",
        lat: 1.3521,
        lng: 103.8198,
      },
      {
        region: "LATAM",
        signal: 21,
        revenue: revenueBase * 0.12,
        pipeline: pipelineBase * 0.1,
        note: "Early-stage opportunity density",
        lat: -15.7801,
        lng: -47.9292,
      },
    ].sort((a, b) => b.signal - a.signal);
  }, [kpis, hasLiveData]);

  const revenueFlows = useMemo(() => {
    if (!hasLiveData) return [];
    return [
      { from: "North America", to: "Europe" },
      { from: "North America", to: "Asia" },
      { from: "Europe", to: "Asia" },
    ];
  }, [hasLiveData]);

  const revenueFlowGeoJson = useMemo(() => {
    return {
      type: "FeatureCollection",
      features: revenueFlows
        .map((f) => {
          const start = regionalSignals.find((r) => r.region === f.from);
          const end = regionalSignals.find((r) => r.region === f.to);
          if (!start || !end) return null;

          return {
            type: "Feature",
            properties: {},
            geometry: {
              type: "LineString",
              coordinates: [
                [start.lng, start.lat],
                [end.lng, end.lat],
              ],
            },
          };
        })
        .filter(Boolean),
    };
  }, [regionalSignals, revenueFlows]);

  const axisTick = { fill: "#9fb0d0", fontSize: 11 };

  const tooltipStyle = {
    background: "rgba(7,11,24,0.97)",
    border: "1px solid rgba(255,255,255,0.10)",
    borderRadius: "14px",
    color: "#fff",
    boxShadow: "0 14px 40px rgba(0,0,0,0.35)",
  };

  const legendStyle = { color: "#dbe4f0" };

  const S = useMemo(() => {
    const card = {
      background: "rgba(255,255,255,0.03)",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 18,
      padding: 16,
      boxShadow: "0 10px 24px rgba(0,0,0,0.14)",
    };

    return {
      page: {
        minHeight: "100vh",
        padding: "14px 16px 28px",
        maxWidth: 1512,
        margin: "0 auto",
        color: "#fff",
        background:
          "radial-gradient(900px 500px at 15% 0%, rgba(37,99,235,0.16), transparent 55%), radial-gradient(900px 500px at 85% 0%, rgba(124,92,255,0.11), transparent 55%), linear-gradient(180deg, #050814 0%, #070b18 100%)",
      },
      bgGlow: {
        position: "fixed",
        inset: 0,
        zIndex: -1,
        background: "#050814",
      },
      topRow: {
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 16,
        maxWidth: 1480,
        margin: "0 auto 12px",
        flexWrap: "wrap",
        padding: "18px 20px",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 20,
        background:
          "linear-gradient(135deg, rgba(30,64,175,0.16), rgba(37,99,235,0.08), rgba(255,255,255,0.02))",
        boxShadow: "0 12px 30px rgba(0,0,0,0.18)",
      },
      title: { margin: 0, fontSize: 28, fontWeight: 900, lineHeight: 1.05, letterSpacing: -0.7 },
      sub: { marginTop: 8, color: "rgba(203,213,225,0.78)", fontSize: 12, lineHeight: 1.5 },
      org: { color: "rgba(226,232,240,0.90)", fontSize: 12, marginTop: 7 },
      badge: {
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 9px",
        borderRadius: 8,
        border: "1px solid rgba(255,255,255,0.08)",
        background: "rgba(255,255,255,0.035)",
        fontSize: 10,
        textDecoration: "none",
        color: "#dbe4f0",
        cursor: "pointer",
        fontWeight: 800,
        letterSpacing: "0.04em",
      },
      simRow: {
        display: "flex",
        gap: 10,
        flexWrap: "wrap",
        alignItems: "center",
        marginBottom: 12,
      },
      navGrid: {
        display: "grid",
        gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
        gap: 12,
        marginTop: 12,
        marginBottom: 12,
      },
      navCard: {
        borderRadius: 14,
        padding: 14,
        border: "1px solid rgba(255,255,255,0.08)",
        background: "rgba(4,10,24,0.34)",
        cursor: "pointer",
      },
      navTitle: { fontWeight: 900, fontSize: 14, marginBottom: 8 },
      navDesc: { fontSize: 12, opacity: 0.8, lineHeight: 1.45 },
      signalStrip: {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        gap: 10,
        marginTop: 12,
        marginBottom: 12,
      },
      signalPill: {
        borderRadius: 14,
        padding: "12px 14px",
        border: "1px solid rgba(255,255,255,0.07)",
        background: "rgba(4,10,24,0.34)",
        fontSize: 12,
        lineHeight: 1.45,
        opacity: 0.92,
      },
      kpiGrid: {
        display: "grid",
        gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
        gap: 12,
        marginBottom: 12,
      },
      card,
      kLabel: {
        fontSize: 10,
        color: "rgba(148,163,184,0.88)",
        letterSpacing: "0.14em",
        textTransform: "uppercase",
        fontWeight: 800,
      },
      kValue: {
        marginTop: 10,
        fontSize: 26,
        fontWeight: 900,
        lineHeight: 1.08,
      },
      kSub: {
        marginTop: 7,
        fontSize: 12,
        color: "rgba(203,213,225,0.76)",
        lineHeight: 1.45,
      },
      grid: {
        display: "grid",
        gridTemplateColumns: "minmax(0, 2.15fr) minmax(0, 1fr)",
        gap: 12,
        alignItems: "start",
      },
      chartsGrid: { display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 12 },
      chartRow: {
        display: "grid",
        gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1.05fr)",
        gap: 12,
      },
      sectionTitle: { fontSize: 17, fontWeight: 800, letterSpacing: -0.3, marginBottom: 10 },
      chartShell: {
        height: 260,
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 16,
        background: "rgba(4,10,24,0.72)",
        padding: 10,
      },
      miniChartShell: {
        height: 220,
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 16,
        background: "rgba(4,10,24,0.72)",
        padding: 10,
      },
      miniWorldGrid: {
        display: "grid",
        gridTemplateColumns: "1.2fr 0.8fr",
        gap: 12,
      },
      miniMapShell: {
        height: 320,
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 16,
        overflow: "hidden",
        background: "rgba(4,10,24,0.72)",
        position: "relative",
      },
      miniMapHud: {
        position: "absolute",
        top: 12,
        left: 12,
        zIndex: 5,
        width: 220,
        borderRadius: 14,
        border: "1px solid rgba(255,255,255,0.10)",
        background: "linear-gradient(180deg, rgba(8,14,28,0.88), rgba(5,9,18,0.82))",
        boxShadow: "0 12px 28px rgba(0,0,0,0.22)",
        overflow: "hidden",
      },
      miniMapHudHead: {
        padding: "10px 12px",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
      },
      miniMapHudTitle: {
        fontSize: 11,
        textTransform: "uppercase",
        letterSpacing: "0.14em",
        color: "rgba(148,163,184,0.82)",
        fontWeight: 800,
      },
      miniMapHudBody: {
        padding: 12,
        display: "grid",
        gap: 10,
      },
      miniMapHudLabel: {
        fontSize: 10,
        textTransform: "uppercase",
        letterSpacing: "0.14em",
        color: "rgba(148,163,184,0.78)",
        fontWeight: 800,
      },
      miniMapHudValue: {
        fontSize: 22,
        lineHeight: 1.05,
        fontWeight: 900,
        color: "#fff",
      },
      miniMapHudSub: {
        fontSize: 12,
        color: "rgba(203,213,225,0.74)",
        lineHeight: 1.45,
      },
      miniMapStatus: {
        position: "absolute",
        left: 12,
        bottom: 12,
        zIndex: 5,
        padding: "7px 11px",
        borderRadius: 999,
        border: "1px solid rgba(255,255,255,0.08)",
        background: "rgba(7,11,24,0.82)",
        color: "#cbd5e1",
        fontSize: 10,
        fontWeight: 700,
      },
      miniMapSide: {
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 16,
        background: "rgba(4,10,24,0.55)",
        padding: 14,
      },
      miniMapSideTitle: {
        fontSize: 14,
        fontWeight: 900,
        marginBottom: 10,
      },
      miniRankList: {
        display: "grid",
        gap: 10,
      },
      miniRankRow: {
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 12,
        background: "rgba(255,255,255,0.03)",
        padding: 10,
      },
      miniRankTop: {
        display: "flex",
        justifyContent: "space-between",
        gap: 8,
        alignItems: "center",
      },
      miniRankName: {
        fontWeight: 800,
        fontSize: 13,
      },
      miniRankValue: {
        fontWeight: 900,
        fontSize: 13,
      },
      rightStack: { display: "flex", flexDirection: "column", gap: 12 },
      divider: { height: 1, background: "rgba(255,255,255,0.08)", margin: "14px 0" },
      list: { display: "grid", gap: 10 },
      pillCard: {
        borderRadius: 14,
        padding: 12,
        border: "1px solid rgba(255,255,255,0.07)",
        background: "rgba(4,10,24,0.34)",
      },
      pillTitle: { fontWeight: 900, fontSize: 14, marginBottom: 6 },
      pillMeta: { opacity: 0.85, fontSize: 13, lineHeight: 1.35 },
      progressWrap: {
        height: 10,
        borderRadius: 999,
        background: "rgba(255,255,255,0.08)",
        overflow: "hidden",
        border: "1px solid rgba(255,255,255,0.10)",
      },
      progressBar: (pct) => ({
        height: "100%",
        width: `${clamp(pct, 0, 200)}%`,
        background: "#60a5fa",
      }),
      insightWrap: { display: "grid", gap: 10 },
      insightItem: (type) => ({
        borderRadius: 14,
        padding: 14,
        border: "1px solid rgba(255,255,255,0.08)",
        background:
          type === "SUCCESS"
            ? "rgba(34,197,94,0.07)"
            : type === "WARNING"
            ? "rgba(245,158,11,0.07)"
            : "rgba(56,189,248,0.07)",
      }),
      insightTop: {
        display: "flex",
        justifyContent: "space-between",
        gap: 10,
        flexWrap: "wrap",
      },
      tag: (type) => ({
        fontSize: 11,
        fontWeight: 900,
        letterSpacing: 0.7,
        padding: "6px 10px",
        borderRadius: 999,
        border: "1px solid rgba(255,255,255,0.12)",
        background: "rgba(255,255,255,0.04)",
        color: type === "SUCCESS" ? "#22C55E" : type === "WARNING" ? "#F59E0B" : "#38BDF8",
      }),
      confidence: {
        fontSize: 11,
        fontWeight: 900,
        padding: "6px 10px",
        borderRadius: 999,
        background: "rgba(255,255,255,0.05)",
        border: "1px solid rgba(255,255,255,0.10)",
      },
      insightTitle: { fontWeight: 900, fontSize: 15, marginTop: 10 },
      insightBody: { opacity: 0.88, marginTop: 6, fontSize: 13, lineHeight: 1.45 },
      statusGood: { color: "#22C55E", fontWeight: 900 },
      statusWarn: { color: "#F59E0B", fontWeight: 900 },
      statusBad: { color: "#FB7185", fontWeight: 900 },
      error: {
        marginTop: 10,
        borderRadius: 12,
        padding: 12,
        border: "1px solid rgba(255,0,0,0.25)",
        background: "rgba(255,0,0,0.10)",
      },
      actionBtn: {
        borderRadius: 10,
        padding: "10px 14px",
        border: "1px solid rgba(96,165,250,0.38)",
        background: "#2563eb",
        color: "#fff",
        fontWeight: 800,
        fontSize: 12,
        cursor: "pointer",
        opacity: 0.98,
      },
      actionBtnDisabled: { cursor: "not-allowed", opacity: 0.65 },
      helperText: { opacity: 0.75, fontSize: 12, marginTop: 6, lineHeight: 1.45 },
      success: {
        marginTop: 10,
        borderRadius: 12,
        padding: 12,
        border: "1px solid rgba(34,197,94,0.30)",
        background: "rgba(34,197,94,0.12)",
        color: "rgba(234,240,255,0.95)",
      },
      secondaryBtn: {
        borderRadius: 10,
        padding: "10px 14px",
        border: "1px solid rgba(255,255,255,0.10)",
        background: "rgba(255,255,255,0.035)",
        color: "#EAF0FF",
        fontWeight: 800,
        fontSize: 12,
        cursor: "pointer",
      },
      modalOverlay: {
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(2,6,23,0.70)",
        backdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      },
      modalCard: {
        width: "min(900px, 100%)",
        maxHeight: "90vh",
        overflowY: "auto",
        borderRadius: 18,
        border: "1px solid rgba(255,255,255,0.10)",
        background: "#0a1020",
        boxShadow: "0 22px 60px rgba(0,0,0,0.38)",
        padding: 18,
      },
      modalHeaderRow: {
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 12,
        marginBottom: 14,
      },
      modalEyebrow: {
        fontSize: 10,
        textTransform: "uppercase",
        letterSpacing: "0.14em",
        color: "rgba(148,163,184,0.78)",
        fontWeight: 800,
      },
      modalTitle: {
        marginTop: 4,
        fontSize: 22,
        lineHeight: 1.1,
        fontWeight: 900,
        color: "#fff",
      },
      modalCloseBtn: {
        border: "1px solid rgba(255,255,255,0.10)",
        background: "rgba(255,255,255,0.04)",
        color: "#EAF0FF",
        borderRadius: 999,
        width: 36,
        height: 36,
        cursor: "pointer",
        fontSize: 14,
        fontWeight: 900,
      },
      modalForm: {
        display: "grid",
        gap: 14,
      },
      formGrid2: {
        display: "grid",
        gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
        gap: 12,
      },
      fieldWrap: {
        display: "grid",
        gap: 6,
      },
      fieldLabel: {
        fontSize: 11,
        fontWeight: 800,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        color: "rgba(226,232,240,0.72)",
      },
      input: {
        padding: 12,
        borderRadius: 10,
        border: "1px solid rgba(255,255,255,0.12)",
        background: "rgba(255,255,255,0.04)",
        color: "#EAF0FF",
        outline: "none",
        width: "100%",
      },
      textarea: {
        padding: 12,
        borderRadius: 10,
        border: "1px solid rgba(255,255,255,0.12)",
        background: "rgba(255,255,255,0.04)",
        color: "#EAF0FF",
        outline: "none",
        width: "100%",
        resize: "vertical",
      },
      modalActionRow: {
        display: "flex",
        justifyContent: "flex-end",
        gap: 10,
        flexWrap: "wrap",
        marginTop: 4,
      },
    };
  }, []);

  const riskStyle =
    kpis.risk.tone === "good"
      ? S.statusGood
      : kpis.risk.tone === "warn"
      ? S.statusWarn
      : S.statusBad;

  if (loading) {
    return (
      <div style={S.page}>
        <div style={S.bgGlow} />
        <h1 style={S.title}>Atlas Overview</h1>
        <div style={S.sub}>Loading…</div>
      </div>
    );
  }

  return (
    <div style={S.page}>
      <div style={S.bgGlow} />

      <div style={S.topRow}>
        <div>
          <h1 style={S.title}>Atlas Overview</h1>
          <div style={S.sub}>
            <span style={{ opacity: 0.7 }}>Last updated:</span> {lastUpdatedLabel}{" "}
            <span style={{ opacity: 0.7 }}>• Data as of:</span> {dataAsOfLabel}
          </div>
          <div style={S.org}>
            <span style={{ opacity: 0.7 }}>Org:</span> <strong>{orgName}</strong>
          </div>
        </div>

        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <div style={{ minWidth: 260 }}>
            <OrgSwitcher
              onSwitched={async () => {
                await Promise.all([loadDashboardData(), loadClients()]);
              }}
            />
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <button onClick={openClientModal} style={S.actionBtn}>
              Add Client
            </button>

            <button onClick={openDealModal} style={S.actionBtn}>
              Add Deal
            </button>

            {isDev ? (
              <button
                onClick={onLoadDemoData}
                disabled={demoLoading}
                style={{ ...S.actionBtn, ...(demoLoading ? S.actionBtnDisabled : {}) }}
                title="Seeds demo clients + deals into the active workspace"
              >
                {demoLoading ? "Loading Demo…" : "Load Demo Data"}
              </button>
            ) : null}

            <div style={S.badge}>Revenue OS Overview</div>
            <div style={S.badge}>AI Insights Active</div>
            <div style={S.badge}>Secure Session</div>
          </div>
        </div>
      </div>

      {demoMsg ? <div style={S.success}>{demoMsg}</div> : null}
      {error ? <div style={S.error}>{error}</div> : null}

      <SystemStatus />
      <AITicker />
      <CommandBar
        onGenerateBoardReport={handleGenerateBoardReport}
        onRunAiAnalysis={handleRunAiAnalysis}
        onSimulateForecast={handleSimulateForecast}
        onExportRevenueModel={handleExportRevenueModel}
        busy={insightsLoading}
      />

      <div style={{ ...S.card, marginTop: 12, marginBottom: 12 }}>
        <div style={S.sectionTitle}>Invite Your Team</div>

        <div style={S.helperText}>
          Bring analysts, managers, and leadership into Atlas so your whole team can
          operate inside one revenue command center.
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.6fr 0.8fr auto",
            gap: 12,
            marginTop: 14,
          }}
        >
          <input
            type="email"
            placeholder="person@company.com"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            style={{
              padding: 12,
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(255,255,255,0.04)",
              color: "#EAF0FF",
              outline: "none",
            }}
          />

          <select
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value)}
            style={{
              padding: 12,
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(255,255,255,0.04)",
              color: "#EAF0FF",
              outline: "none",
            }}
          >
            <option value="analyst">analyst</option>
            <option value="manager">manager</option>
            <option value="admin">admin</option>
            <option value="viewer">viewer</option>
          </select>

          <button
            onClick={handleQuickInvite}
            disabled={inviteLoading}
            style={{
              ...S.actionBtn,
              ...(inviteLoading ? S.actionBtnDisabled : {}),
              minWidth: 140,
            }}
          >
            {inviteLoading ? "Sending..." : "Send Invite"}
          </button>
        </div>

        {inviteMsg ? <div style={S.success}>{inviteMsg}</div> : null}
        {inviteErr ? <div style={S.error}>{inviteErr}</div> : null}
      </div>

      <div style={S.signalStrip}>
        {overviewSignals.length ? (
          overviewSignals.map((signal, idx) => (
            <div key={`${signal}-${idx}`} style={S.signalPill}>
              {signal}
            </div>
          ))
        ) : (
          <div style={S.signalPill}>
            No live signals yet. Connect integrations, upload a spreadsheet, or add deals to activate Atlas intelligence.
          </div>
        )}
      </div>

      <div style={S.card}>
        <div style={S.sectionTitle}>Atlas Executive Overview</div>
        <div style={{ display: "grid", gap: 8, fontSize: 14, opacity: 0.95, lineHeight: 1.6 }}>
          {!hasLiveData ? (
            <>
              <div>This workspace does not have live revenue intelligence data yet.</div>
              <div>Add deals, connect integrations, or upload a spreadsheet to activate forecasting and reporting.</div>
              <div style={{ marginTop: 4, opacity: 0.8, fontSize: 12 }}>
                Mode: <strong>Live Workspace</strong> — waiting for real data
              </div>
            </>
          ) : (
            <>
              <div>
                <ExecutiveBriefing kpis={kpis} />
                Revenue is{" "}
                {kpis.wow == null ? (
                  <strong>steady</strong>
                ) : (
                  <strong style={kpis.wow >= 0 ? S.statusGood : S.statusBad}>
                    {kpis.wow >= 0 ? "up" : "down"} {Math.abs(kpis.wow).toFixed(1)}% WoW
                  </strong>
                )}
              </div>
              <div>
                Pipeline coverage is <strong>{kpis.coverage.toFixed(1)}x</strong> (
                <span style={riskStyle}>
                  <strong>{kpis.risk.label}</strong>
                </span>
                )
              </div>
              <div>
                90-day forecast suggests <strong>{money(kpis.forecast90)}</strong>
              </div>
              <div style={{ marginTop: 4, opacity: 0.8, fontSize: 12 }}>
                Mode: <strong>{kpis.scenario?.label || "Current"}</strong> —{" "}
                {kpis.scenario?.note || "Actual performance"}
              </div>
            </>
          )}
        </div>
      </div>

      <div style={{ marginTop: 12, marginBottom: 12 }}>
        <LiveRevenueSnapshot
          projectedRevenue={liveRevenueSnapshot.projectedRevenue}
          pipelineValue={liveRevenueSnapshot.pipelineValue}
          dealsAtRisk={liveRevenueSnapshot.dealsAtRisk}
          activeOpportunities={liveRevenueSnapshot.activeOpportunities}
          forecastConfidence={liveRevenueSnapshot.forecastConfidence}
          stripeRevenue={stripeData?.summary?.totalRevenue || 0}
          stripeTransactions={stripeData?.summary?.totalTransactions || 0}
        />
      </div>

      <div style={{ marginBottom: 12 }}>
        {dealRiskItems.length ? (
          <DealRiskDetectionAI deals={dealRiskItems} />
        ) : (
          <div style={S.card}>
            <div style={S.sectionTitle}>Deal Risk Detection AI</div>
            <div style={S.helperText}>
              No deal intelligence yet. Add deals to start monitoring opportunity risk, stalled movement, and close pressure.
            </div>
          </div>
        )}
      </div>

      <div style={S.navGrid}>
        <div style={S.navCard} onClick={() => nav("/command-center")}>
          <div style={S.navTitle}>Command Center</div>
          <div style={S.navDesc}>
            Go to the main revenue war room for forecast, pipeline health, and AI intelligence.
          </div>
        </div>

        <div style={S.navCard} onClick={() => nav("/deal-war-room")}>
          <div style={S.navTitle}>Deal War Room</div>
          <div style={S.navDesc}>
            Analyze opportunity risk, stakeholders, next best actions, and close probability.
          </div>
        </div>

        <div style={S.navCard} onClick={() => nav("/growth-engine")}>
          <div style={S.navTitle}>Growth Engine</div>
          <div style={S.navDesc}>
            Connect marketing to pipeline and understand what channels drive revenue.
          </div>
        </div>

        <div style={S.navCard} onClick={() => nav("/atlas-ai-operator")}>
          <div style={S.navTitle}>Atlas AI Operator</div>
          <div style={S.navDesc}>
            Open the AI copilot for executive insights, strategy prompts, and revenue guidance.
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gap: 10, fontSize: 14, lineHeight: 1.7, marginBottom: 12 }}>
        <div>
          <strong>Revenue Protection:</strong> At current coverage, revenue is protected for approximately{" "}
          <strong>{kpis.coverage.toFixed(1)} months</strong>.
        </div>
        <div>
          <strong>Pipeline Leverage:</strong> A +5% close-rate lift unlocks approximately{" "}
          <strong>{money(kpis.pipelineValue * 0.05)}</strong> in additional revenue — without increasing spend.
        </div>
        <div>
          <strong>Efficiency Gain:</strong> Reducing marketing waste by 10% recovers approximately{" "}
          <strong>{money(kpis.spend30 * 0.1)}</strong> per month in margin.
        </div>
        <div>
          <strong>Strategic Projection:</strong> Under <strong>{kpis.scenario?.label}</strong>, 90-day revenue projects to{" "}
          <strong>{money(kpis.forecast90)}</strong>.
        </div>
      </div>

      <div style={S.card}>
        <div style={S.sectionTitle}>Forecast Confidence</div>
        <PipelineVelocity pipeline={pipeline} />
        <ForecastConfidence
          coverage={kpis.coverage}
          pipeline={kpis.pipelineValue}
          revenue={kpis.revenue30}
          forecast={kpis.forecast90}
        />
      </div>

      <div style={S.simRow}>
        {scenarioList.map((s) => (
          <button
            key={s.key}
            onClick={() => setScenarioKey(s.key)}
            style={{
              ...S.badge,
              background:
                scenarioKey === s.key ? "rgba(124,92,255,0.18)" : "rgba(255,255,255,0.04)",
              border:
                scenarioKey === s.key
                  ? "1px solid rgba(124,92,255,0.45)"
                  : "1px solid rgba(255,255,255,0.10)",
            }}
            title={s.note || ""}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div style={S.kpiGrid}>
        <div style={S.card}>
          <div style={S.kLabel}>REVENUE (30D)</div>
          <div style={S.kValue}>
            <AnimatedCounter value={kpis.revenue30} formatter={moneyCompact} />
          </div>
          <div style={S.kSub}>
            Momentum:{" "}
            {kpis.wow == null ? (
              "—"
            ) : (
              <span style={kpis.wow >= 0 ? S.statusGood : S.statusBad}>
                {kpis.wow >= 0 ? "▲" : "▼"} {Math.abs(kpis.wow).toFixed(1)}% WoW
              </span>
            )}
          </div>
        </div>

        <div style={S.card}>
          <div style={S.kLabel}>PIPELINE</div>
          <div style={S.kValue}>
            <AnimatedCounter value={kpis.pipelineValue} formatter={moneyCompact} />
          </div>
          <div style={S.kSub}>
            Coverage: <strong>{kpis.coverage.toFixed(1)}x</strong>
          </div>
        </div>

        <div style={S.card}>
          <div style={S.kLabel}>CUSTOMER ACQUISITION COST</div>
          <div style={S.kValue}>
            <AnimatedCounter value={kpis.cac} formatter={moneyCompact} />
          </div>
          <div style={S.kSub}>Based on spend/leads (30D)</div>
        </div>

        <div style={S.card}>
          <div style={S.kLabel}>FORECAST (90D)</div>
          <div style={S.kValue}>
            <AnimatedCounter value={kpis.forecast90} formatter={moneyCompact} />
          </div>
          <div style={S.kSub}>Scenario-based projection</div>
        </div>

        <div style={S.card}>
          <div style={S.kLabel}>REVENUE STABILITY INDEX</div>
          <div style={{ marginTop: 8, fontSize: 30, fontWeight: 950, ...S.statusGood }}>
            <AnimatedCounter value={Math.round(rsi.score)} /> / 100
          </div>
          <div style={S.kSub}>
            Tier: <strong>{rsi.tier}</strong>
          </div>
        </div>
      </div>

      <div style={S.grid}>
        <div style={S.chartsGrid}>
          <div style={S.chartRow}>
            <div style={S.card}>
              <div style={S.sectionTitle}>Revenue vs Spend (30 Days)</div>
              <div style={S.chartShell}>
                {metrics.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={metrics} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                      <defs>
                        <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#00c6ff" stopOpacity={0.28} />
                          <stop offset="100%" stopColor="#00c6ff" stopOpacity={0.03} />
                        </linearGradient>
                        <linearGradient id="spendFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#7C5CFF" stopOpacity={0.22} />
                          <stop offset="100%" stopColor="#7C5CFF" stopOpacity={0.03} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.10)" />
                      <XAxis dataKey="x" tick={axisTick} tickMargin={8} stroke="#94a3b8" />
                      <YAxis
                        tick={axisTick}
                        tickMargin={8}
                        stroke="#94a3b8"
                        tickFormatter={moneyCompact}
                      />
                      <Tooltip
                        formatter={(value, name) => [money(value), name]}
                        contentStyle={tooltipStyle}
                        labelStyle={{ color: "#fff" }}
                      />
                      <Legend wrapperStyle={legendStyle} />
                      <Area
                        type="monotone"
                        dataKey="spend"
                        stroke="#7C5CFF"
                        fill="url(#spendFill)"
                        strokeWidth={2}
                        dot={false}
                      />
                      <Area
                        type="monotone"
                        dataKey="revenue"
                        stroke="#00c6ff"
                        fill="url(#revFill)"
                        strokeWidth={3}
                        dot={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ opacity: 0.85 }}>
                    No revenue or spend data yet.
                    <div style={{ opacity: 0.7, marginTop: 6, fontSize: 13 }}>
                      Upload a spreadsheet or connect sources to populate the 30-day trendline.
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div style={S.card}>
              <div style={S.sectionTitle}>Pipeline by Stage</div>
              <div style={S.miniChartShell}>
                {pipelineByStage.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Tooltip
                        formatter={(value) => money(value)}
                        contentStyle={tooltipStyle}
                        labelStyle={{ color: "#fff" }}
                      />
                      <Legend wrapperStyle={legendStyle} />
                      <Pie
                        data={pipelineByStage}
                        dataKey="value"
                        nameKey="name"
                        innerRadius="55%"
                        outerRadius="85%"
                        paddingAngle={3}
                      >
                        {pipelineByStage.map((entry, idx) => (
                          <Cell key={entry.name} fill={donutColors[idx % donutColors.length]} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ opacity: 0.85, paddingTop: 10 }}>
                    No pipeline stage data yet.
                    <div style={{ opacity: 0.7, marginTop: 6, fontSize: 13 }}>
                      Once deals have stages + values, this donut fills automatically.
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div style={S.card}>
            <div style={S.sectionTitle}>Leads (30 Days)</div>
            <div style={S.chartShell}>
              {metrics.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={metrics} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.10)" />
                    <XAxis dataKey="x" tick={axisTick} tickMargin={8} stroke="#94a3b8" />
                    <YAxis tick={axisTick} tickMargin={8} stroke="#94a3b8" />
                    <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "#fff" }} />
                    <Legend wrapperStyle={legendStyle} />
                    <Bar dataKey="leads" fill="#38BDF8" radius={[10, 10, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ opacity: 0.85 }}>
                  No lead data yet.
                  <div style={{ opacity: 0.7, marginTop: 6, fontSize: 13 }}>
                    Connect sources or upload a spreadsheet to populate lead activity.
                  </div>
                </div>
              )}
            </div>
          </div>

          <div style={S.card}>
            <div style={S.sectionTitle}>Channel Revenue Attribution</div>
            <div style={S.chartShell}>
              {channelChart.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={channelChart} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.10)" />
                    <XAxis dataKey="channel" tick={axisTick} tickMargin={8} stroke="#94a3b8" />
                    <YAxis
                      tick={axisTick}
                      tickMargin={8}
                      stroke="#94a3b8"
                      tickFormatter={moneyCompact}
                    />
                    <Tooltip
                      formatter={(value, name) => {
                        if (name === "revenue" || name === "spend") return [money(value), name];
                        if (name === "roiPct") return [`${safeNum(value).toFixed(1)}%`, name];
                        return [value, name];
                      }}
                      contentStyle={tooltipStyle}
                      labelStyle={{ color: "#fff" }}
                    />
                    <Legend wrapperStyle={legendStyle} />
                    <Bar dataKey="revenue" fill="#38BDF8" radius={[8, 8, 0, 0]} />
                    <Bar dataKey="spend" fill="#7C5CFF" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ opacity: 0.85 }}>
                  No attribution data yet.
                  <div style={{ opacity: 0.7, marginTop: 6, fontSize: 13 }}>
                    Connect ad platforms and CRM sources to unlock channel-level attribution.
                  </div>
                </div>
              )}
            </div>
          </div>

          <div style={S.card}>
            <div style={S.sectionTitle}>Global Revenue Intelligence Map</div>

            <div style={S.miniWorldGrid}>
              <div style={S.miniMapShell}>
                <div style={S.miniMapHud}>
                  <div style={S.miniMapHudHead}>
                    <div style={S.miniMapHudTitle}>Atlas Live Region Monitor</div>
                  </div>

                  <div style={S.miniMapHudBody}>
                    <div>
                      <div style={S.miniMapHudLabel}>Top Active Region</div>
                      <div style={S.miniMapHudValue}>{regionalSignals[0]?.region || "—"}</div>
                      <div style={S.miniMapHudSub}>
                        {hasLiveData
                          ? "Highest revenue concentration and strongest leadership priority."
                          : "No live regional data yet."}
                      </div>
                    </div>

                    <div>
                      <div style={S.miniMapHudLabel}>Revenue</div>
                      <div style={S.miniMapHudValue}>
                        {moneyCompact(regionalSignals[0]?.revenue || 0)}
                      </div>
                    </div>

                    <div>
                      <div style={S.miniMapHudLabel}>Pipeline</div>
                      <div style={S.miniMapHudValue}>
                        {moneyCompact(regionalSignals[0]?.pipeline || 0)}
                      </div>
                    </div>
                  </div>
                </div>

                <Map
                  {...miniMapView}
                  onMove={(e) => setMiniMapView(e.viewState)}
                  mapboxAccessToken={DASHBOARD_MAPBOX_TOKEN || undefined}
                  mapStyle={
                    hasDashboardMapToken
                      ? "mapbox://styles/mapbox/dark-v11"
                      : dashboardFallbackMapStyle
                  }
                  projection={hasDashboardMapToken ? "globe" : "mercator"}
                  attributionControl={false}
                  style={{ width: "100%", height: "100%" }}
                  onClick={() => setSelectedMiniRegion(null)}
                  onLoad={(e) => {
                    const map = e.target;

                    if (hasDashboardMapToken) {
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

                  <Source id="revenue-flows" type="geojson" data={revenueFlowGeoJson}>
                    <Layer
                      id="flow-lines"
                      type="line"
                      paint={{
                        "line-color": "#38BDF8",
                        "line-width": 2,
                        "line-opacity": hasLiveData ? 0.55 : 0,
                      }}
                    />
                  </Source>

                  {regionalSignals.map((region) => (
                    <MiniRegionMarker
                      key={region.region}
                      region={region}
                      onClick={setSelectedMiniRegion}
                    />
                  ))}

                  {selectedMiniRegion ? (
                    <Popup
                      longitude={selectedMiniRegion.lng}
                      latitude={selectedMiniRegion.lat}
                      anchor="top"
                      closeButton={false}
                      closeOnClick={false}
                      offset={20}
                      className="atlas-map-popup"
                    >
                      <div
                        style={{
                          minWidth: 220,
                          padding: 12,
                          borderRadius: 14,
                          color: "#fff",
                          background:
                            "linear-gradient(180deg, rgba(8,14,28,0.98), rgba(5,9,18,0.96))",
                          border: "1px solid rgba(255,255,255,0.10)",
                          boxShadow: "0 18px 40px rgba(0,0,0,0.35)",
                        }}
                      >
                        <div style={{ fontWeight: 900, fontSize: 15 }}>
                          {selectedMiniRegion.region}
                        </div>

                        <div
                          style={{
                            marginTop: 10,
                            display: "grid",
                            gap: 6,
                            fontSize: 12,
                            color: "rgba(226,232,240,0.9)",
                          }}
                        >
                          <div>Revenue {moneyCompact(selectedMiniRegion.revenue)}</div>
                          <div>Pipeline {moneyCompact(selectedMiniRegion.pipeline)}</div>
                          <div>Signal {selectedMiniRegion.signal}%</div>
                        </div>

                        <div
                          style={{
                            marginTop: 10,
                            fontSize: 11,
                            lineHeight: 1.5,
                            color: "rgba(203,213,225,0.74)",
                          }}
                        >
                          {selectedMiniRegion.note}
                        </div>
                      </div>
                    </Popup>
                  ) : null}
                </Map>

                {!hasDashboardMapToken ? (
                  <div style={S.miniMapStatus}>
                    Fallback map active — add VITE_MAPBOX_TOKEN for full globe
                  </div>
                ) : null}
              </div>

              <div style={S.miniMapSide}>
                <div style={S.miniMapSideTitle}>Regional Priority Ranking</div>

                <div style={S.miniRankList}>
                  {regionalSignals.map((r, idx) => (
                    <div key={`${r.region}-rank`} style={S.miniRankRow}>
                      <div style={S.miniRankTop}>
                        <div style={S.miniRankName}>
                          #{idx + 1} {r.region}
                        </div>
                        <div style={S.miniRankValue}>{r.signal}%</div>
                      </div>

                      <div style={{ marginTop: 6, fontSize: 12, opacity: 0.78, lineHeight: 1.45 }}>
                        {r.note}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div style={S.card}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <div style={S.sectionTitle}>AI-Powered Insights</div>
              <button
                onClick={handleRunAiAnalysis}
                disabled={insightsLoading || !hasLiveData}
                style={{
                  ...S.actionBtn,
                  ...((insightsLoading || !hasLiveData) ? S.actionBtnDisabled : {}),
                }}
              >
                {insightsLoading ? "Generating..." : "Generate New Insights"}
              </button>
            </div>

            <div style={S.helperText}>
              Generates fresh executive insights based on your latest revenue, spend, pipeline, and lead signals.
            </div>

            <div style={{ marginTop: 12 }}>
              {displayedInsights.length ? (
                <div style={S.insightWrap}>
                  {displayedInsights.map((it, idx) => (
                    <div key={`${it.title}-${idx}`} style={S.insightItem(it.type)}>
                      <div style={S.insightTop}>
                        <div style={S.tag(it.type)}>
                          {it.type} <span style={{ opacity: 0.7 }}>•</span> {it.impact}
                        </div>
                        <div style={S.confidence}>{it.confidence}% CONFIDENCE</div>
                      </div>
                      <div style={S.insightTitle}>{it.title}</div>
                      <div style={S.insightBody}>{it.body}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={S.signalPill}>
                  No AI insights yet. Atlas will generate them after real workspace data is added.
                </div>
              )}
            </div>
          </div>
        </div>

        <div style={S.rightStack}>
          <div style={S.card}>
            <div style={S.sectionTitle}>Atlas AI Signals</div>
            <div style={S.list}>
              {overviewSignals.length ? (
                overviewSignals.map((signal, idx) => (
                  <div key={`${signal}-side-${idx}`} style={S.pillCard}>
                    <div style={S.pillMeta}>{signal}</div>
                  </div>
                ))
              ) : (
                <div style={S.pillCard}>
                  <div style={S.pillMeta}>
                    No live signals yet. This panel activates when Atlas receives real workspace data.
                  </div>
                </div>
              )}
            </div>
          </div>

          <div style={S.card}>
            <div style={S.sectionTitle}>Revenue Health Snapshot</div>

            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 6 }}>Pipeline Coverage</div>
              <div style={S.pillMeta}>
                <strong>{kpis.coverage.toFixed(1)}x</strong> •{" "}
                <span style={riskStyle}>{kpis.risk.label}</span>
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 6 }}>Forecast Stability</div>
              <div style={S.pillMeta}>
                <strong>{rsi.score}/100</strong> • {rsi.tier}
              </div>
            </div>

            <div>
              <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 6 }}>Scenario Mode</div>
              <div style={S.pillMeta}>
                <strong>{kpis.scenario?.label}</strong> — {kpis.scenario?.note}
              </div>
            </div>
          </div>

          <div style={S.card}>
            <div style={S.sectionTitle}>Goal Tracking</div>

            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 6 }}>Monthly Revenue Goal</div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 8,
                  fontSize: 13,
                }}
              >
                <span>{money(targets.currentMonthRevenue)}</span>
                <span>{money(targets.monthlyRevenueGoal)}</span>
              </div>
              <div style={S.progressWrap}>
                <div style={S.progressBar(targets.monthPct)} />
              </div>
            </div>

            <div>
              <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 6 }}>Quarter Forecast Progress</div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 8,
                  fontSize: 13,
                }}
              >
                <span>{money(targets.currentQuarterForecast)}</span>
                <span>{money(targets.quarterlyRevenueGoal)}</span>
              </div>
              <div style={S.progressWrap}>
                <div style={S.progressBar(targets.quarterPct)} />
              </div>
            </div>
          </div>

          <div style={S.card}>
            <div style={S.sectionTitle}>Connected Integrations</div>

            {integrations?.length ? (
              <div style={S.list}>
                {integrations.slice(0, 6).map((i, idx) => {
                  const meta = integrationMeta(i);

                  return (
                    <div
                      key={i?._id || i?.id || `${i?.provider || i?.name || "int"}-${idx}`}
                      style={S.pillCard}
                    >
                      <div style={S.pillTitle}>{prettyProvider(i)}</div>
                      <div style={S.pillMeta}>
                        Status: <strong>{prettyStatus(i)}</strong>
                        {meta ? <div style={{ opacity: 0.75, marginTop: 6 }}>{meta}</div> : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ opacity: 0.85 }}>
                No integrations connected yet.
                <div style={{ opacity: 0.7, marginTop: 6, fontSize: 13 }}>
                  Connect Google Ads, Meta, LinkedIn, or your CRM to unlock full attribution.
                </div>
              </div>
            )}

            <div style={S.divider} />
            <RevenueLeakDetector pipeline={pipeline} />

            <div style={S.divider} />
            <div style={S.sectionTitle}>Recent Deals</div>

            {deals?.length ? (
              <div style={S.list}>
                {deals.slice(0, 5).map((d, idx) => (
                  <div key={d?._id || d?.id || `${d?.name || "deal"}-${idx}`} style={S.pillCard}>
                    <div style={S.pillTitle}>
                      {d?.clientId?.name ? `${d.clientId.name} — ` : ""}
                      {d?.name || d?.title || "Deal"}
                    </div>
                    <div style={S.pillMeta}>
                      Value: <strong>{money(d?.amount ?? d?.value ?? d?.pipelineValue ?? 0)}</strong>{" "}
                      <span style={{ opacity: 0.8 }}>• Stage:</span>{" "}
                      <strong>{normalizeStage(d?.stage || d?.status)}</strong>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ opacity: 0.85 }}>No deals yet.</div>
            )}
          </div>

          <div style={S.card}>
            <div style={S.sectionTitle}>Quick Navigation</div>

            <div style={S.list}>
              <div
                style={{ ...S.pillCard, cursor: "pointer" }}
                onClick={() => nav("/account-intelligence")}
              >
                <div style={S.pillTitle}>Account Intelligence</div>
                <div style={S.pillMeta}>
                  View engagement, revenue potential, and expansion opportunities.
                </div>
              </div>

              <div
                style={{ ...S.pillCard, cursor: "pointer" }}
                onClick={() => nav("/global-revenue-map")}
              >
                <div style={S.pillTitle}>Global Revenue Map</div>
                <div style={S.pillMeta}>
                  Analyze revenue and opportunity distribution by geography.
                </div>
              </div>

              <div
                style={{ ...S.pillCard, cursor: "pointer" }}
                onClick={() => nav("/reports")}
              >
                <div style={S.pillTitle}>Reports & Briefings</div>
                <div style={S.pillMeta}>
                  Generate executive-facing reports and boardroom summaries.
                </div>
              </div>

              <div
                style={{ ...S.pillCard, cursor: "pointer" }}
                onClick={() => nav("/partners")}
              >
                <div style={S.pillTitle}>Partners</div>
                <div style={S.pillMeta}>
                  Manage partner relationships and partner-sourced opportunity flow.
                </div>
              </div>

              <div
                style={{ ...S.pillCard, cursor: "pointer" }}
                onClick={() => nav("/integrations")}
              >
                <div style={S.pillTitle}>Integrations</div>
                <div style={S.pillMeta}>
                  Connect Google Ads, HubSpot, Stripe, and more.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 12,
          marginTop: 12,
        }}
      >
        <div style={S.card}>
          <div style={S.sectionTitle}>Opportunity Radar</div>
          <OpportunityRadar pipeline={pipeline} revenue={kpis.revenue30} />
        </div>

        <div style={S.card}>
          <div style={S.sectionTitle}>Revenue Timeline Projection</div>
          <RevenueTimeline forecast={kpis.forecast90} />
        </div>
      </div>

      {showClientModal ? (
        <div style={S.modalOverlay} onClick={() => setShowClientModal(false)}>
          <div style={S.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={S.modalHeaderRow}>
              <div>
                <div style={S.modalEyebrow}>Manual Entry</div>
                <div style={S.modalTitle}>Add Client</div>
              </div>

              <button
                onClick={() => setShowClientModal(false)}
                style={S.modalCloseBtn}
                type="button"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateClientSubmit} style={S.modalForm}>
              <div style={S.formGrid2}>
                <div style={S.fieldWrap}>
                  <label style={S.fieldLabel}>Client Name</label>
                  <input
                    value={clientForm.name}
                    onChange={(e) =>
                      setClientForm((prev) => ({ ...prev, name: e.target.value }))
                    }
                    placeholder="Global Emerging Market Manager"
                    style={S.input}
                  />
                </div>

                <div style={S.fieldWrap}>
                  <label style={S.fieldLabel}>Website</label>
                  <input
                    value={clientForm.website}
                    onChange={(e) =>
                      setClientForm((prev) => ({ ...prev, website: e.target.value }))
                    }
                    placeholder="www.gemm.me"
                    style={S.input}
                  />
                </div>

                <div style={S.fieldWrap}>
                  <label style={S.fieldLabel}>Industry</label>
                  <input
                    value={clientForm.industry}
                    onChange={(e) =>
                      setClientForm((prev) => ({ ...prev, industry: e.target.value }))
                    }
                    placeholder="Finance"
                    style={S.input}
                  />
                </div>

                <div style={S.fieldWrap}>
                  <label style={S.fieldLabel}>Status</label>
                  <select
                    value={clientForm.status}
                    onChange={(e) =>
                      setClientForm((prev) => ({ ...prev, status: e.target.value }))
                    }
                    style={S.input}
                  >
                    <option value="active">active</option>
                    <option value="paused">paused</option>
                    <option value="prospect">prospect</option>
                    <option value="archived">archived</option>
                  </select>
                </div>

                <div style={S.fieldWrap}>
                  <label style={S.fieldLabel}>Primary Contact Name</label>
                  <input
                    value={clientForm.primaryContactName}
                    onChange={(e) =>
                      setClientForm((prev) => ({
                        ...prev,
                        primaryContactName: e.target.value,
                      }))
                    }
                    placeholder="Charles"
                    style={S.input}
                  />
                </div>

                <div style={S.fieldWrap}>
                  <label style={S.fieldLabel}>Primary Contact Email</label>
                  <input
                    value={clientForm.primaryContactEmail}
                    onChange={(e) =>
                      setClientForm((prev) => ({
                        ...prev,
                        primaryContactEmail: e.target.value,
                      }))
                    }
                    placeholder="cd@drccompany.com"
                    style={S.input}
                  />
                </div>

                <div style={S.fieldWrap}>
                  <label style={S.fieldLabel}>Primary Contact Phone</label>
                  <input
                    value={clientForm.primaryContactPhone}
                    onChange={(e) =>
                      setClientForm((prev) => ({
                        ...prev,
                        primaryContactPhone: e.target.value,
                      }))
                    }
                    placeholder="+1 555 555 5555"
                    style={S.input}
                  />
                </div>
              </div>

              <div style={S.fieldWrap}>
                <label style={S.fieldLabel}>Notes</label>
                <textarea
                  value={clientForm.notes}
                  onChange={(e) =>
                    setClientForm((prev) => ({ ...prev, notes: e.target.value }))
                  }
                  placeholder="Add any relationship or context notes here..."
                  style={S.textarea}
                  rows={4}
                />
              </div>

              {clientModalMsg ? <div style={S.success}>{clientModalMsg}</div> : null}
              {clientModalErr ? <div style={S.error}>{clientModalErr}</div> : null}

              <div style={S.modalActionRow}>
                <button
                  type="button"
                  onClick={() => setShowClientModal(false)}
                  style={S.secondaryBtn}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={clientSubmitting}
                  style={{
                    ...S.actionBtn,
                    ...(clientSubmitting ? S.actionBtnDisabled : {}),
                  }}
                >
                  {clientSubmitting ? "Creating..." : "Create Client"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {showDealModal ? (
        <div style={S.modalOverlay} onClick={() => setShowDealModal(false)}>
          <div style={S.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={S.modalHeaderRow}>
              <div>
                <div style={S.modalEyebrow}>Pipeline Entry</div>
                <div style={S.modalTitle}>Add Deal</div>
              </div>

              <button
                onClick={() => setShowDealModal(false)}
                style={S.modalCloseBtn}
                type="button"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateDealSubmit} style={S.modalForm}>
              <div style={S.formGrid2}>
                <div style={S.fieldWrap}>
                  <label style={S.fieldLabel}>Deal Name</label>
                  <input
                    value={dealForm.name}
                    onChange={(e) =>
                      setDealForm((prev) => ({ ...prev, name: e.target.value }))
                    }
                    placeholder="Enterprise Expansion Program"
                    style={S.input}
                  />
                </div>

                <div style={S.fieldWrap}>
                  <label style={S.fieldLabel}>Client</label>
                  <select
                    value={dealForm.clientId}
                    onChange={(e) =>
                      setDealForm((prev) => ({ ...prev, clientId: e.target.value }))
                    }
                    style={S.input}
                  >
                    <option value="">
                      {clientsLoading ? "Loading clients..." : "Select client"}
                    </option>
                    {clients.map((client) => (
                      <option
                        key={client?._id || client?.id}
                        value={client?._id || client?.id}
                      >
                        {client?.name || "Client"}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={S.fieldWrap}>
                  <label style={S.fieldLabel}>Amount</label>
                  <input
                    type="number"
                    min="0"
                    value={dealForm.amount}
                    onChange={(e) =>
                      setDealForm((prev) => ({ ...prev, amount: e.target.value }))
                    }
                    placeholder="85000"
                    style={S.input}
                  />
                </div>

                <div style={S.fieldWrap}>
                  <label style={S.fieldLabel}>Stage</label>
                  <select
                    value={dealForm.stage}
                    onChange={(e) =>
                      setDealForm((prev) => ({ ...prev, stage: e.target.value }))
                    }
                    style={S.input}
                  >
                    <option value="Discovery">Discovery</option>
                    <option value="Proposal">Proposal</option>
                    <option value="Follow-Up">Follow-Up</option>
                    <option value="Negotiation">Negotiation</option>
                    <option value="Closed Won">Closed Won</option>
                    <option value="Closed Lost">Closed Lost</option>
                  </select>
                </div>

                <div style={S.fieldWrap}>
                  <label style={S.fieldLabel}>Probability</label>
                  <input
                    type="number"
                    min="0"
                    max="1"
                    step="0.01"
                    value={dealForm.probability}
                    onChange={(e) =>
                      setDealForm((prev) => ({ ...prev, probability: e.target.value }))
                    }
                    placeholder="0.50"
                    style={S.input}
                  />
                </div>

                <div style={S.fieldWrap}>
                  <label style={S.fieldLabel}>Close Date</label>
                  <input
                    type="date"
                    value={dealForm.closeDate}
                    onChange={(e) =>
                      setDealForm((prev) => ({ ...prev, closeDate: e.target.value }))
                    }
                    style={S.input}
                  />
                </div>

                <div style={S.fieldWrap}>
                  <label style={S.fieldLabel}>Next Action</label>
                  <input
                    value={dealForm.nextAction}
                    onChange={(e) =>
                      setDealForm((prev) => ({ ...prev, nextAction: e.target.value }))
                    }
                    placeholder="Schedule decision call"
                    style={S.input}
                  />
                </div>

                <div style={S.fieldWrap}>
                  <label style={S.fieldLabel}>Next Action Due</label>
                  <input
                    type="date"
                    value={dealForm.nextActionDueAt}
                    onChange={(e) =>
                      setDealForm((prev) => ({
                        ...prev,
                        nextActionDueAt: e.target.value,
                      }))
                    }
                    style={S.input}
                  />
                </div>

                <div style={S.fieldWrap}>
                  <label style={S.fieldLabel}>Competitor</label>
                  <input
                    value={dealForm.competitor}
                    onChange={(e) =>
                      setDealForm((prev) => ({ ...prev, competitor: e.target.value }))
                    }
                    placeholder="Optional"
                    style={S.input}
                  />
                </div>

                <div style={S.fieldWrap}>
                  <label style={S.fieldLabel}>Closed Reason</label>
                  <input
                    value={dealForm.closedReason}
                    onChange={(e) =>
                      setDealForm((prev) => ({ ...prev, closedReason: e.target.value }))
                    }
                    placeholder="Optional"
                    style={S.input}
                  />
                </div>

                <div style={S.fieldWrap}>
                  <label style={S.fieldLabel}>Reactivation Date</label>
                  <input
                    type="date"
                    value={dealForm.reactivationAt}
                    onChange={(e) =>
                      setDealForm((prev) => ({
                        ...prev,
                        reactivationAt: e.target.value,
                      }))
                    }
                    style={S.input}
                  />
                </div>
              </div>

              {dealModalMsg ? <div style={S.success}>{dealModalMsg}</div> : null}
              {dealModalErr ? <div style={S.error}>{dealModalErr}</div> : null}

              <div style={S.modalActionRow}>
                <button
                  type="button"
                  onClick={() => setShowDealModal(false)}
                  style={S.secondaryBtn}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={dealSubmitting}
                  style={{
                    ...S.actionBtn,
                    ...(dealSubmitting ? S.actionBtnDisabled : {}),
                  }}
                >
                  {dealSubmitting ? "Creating..." : "Create Deal"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <PaywallModal open={showPaywall} onClose={() => setShowPaywall(false)} />
    </div>
  );
}
