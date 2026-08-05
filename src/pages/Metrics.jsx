// frontend/src/pages/Metrics.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  getMetricsDaily,
  getMetricsSummary,
  searchGraphIQOrganizations,
} from "../api";
import OpportunityRadar from "../components/atlas/OpportunityRadar";
import RevenueTimeline from "../components/atlas/RevenueTimeline";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

const safeNum = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const money = (value) =>
  safeNum(value).toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

const moneyCompact = (value) => {
  const number = safeNum(value);
  if (number >= 1_000_000) return `$${(number / 1_000_000).toFixed(1)}M`;
  if (number >= 1_000) return `$${Math.round(number / 1_000)}K`;
  return `$${Math.round(number)}`;
};

const pct = (value) => `${Math.round(safeNum(value) * 100)}%`;
const clamp = (value, minimum, maximum) =>
  Math.max(minimum, Math.min(maximum, value));

function Section({ title, subtitle, children, action }) {
  return (
    <div style={S.section}>
      <div style={S.sectionHead}>
        <div>
          {subtitle ? <div style={S.sectionSub}>{subtitle}</div> : null}
          <div style={S.sectionTitle}>{title}</div>
        </div>
        {action ? <div>{action}</div> : null}
      </div>
      <div style={S.sectionBody}>{children}</div>
    </div>
  );
}

function StatCard({ label, value, note, valueStyle }) {
  return (
    <div style={S.statCard}>
      <div style={S.statLabel}>{label}</div>
      <div style={{ ...S.statValue, ...(valueStyle || {}) }}>{value}</div>
      <div style={S.statNote}>{note}</div>
    </div>
  );
}

function SignalItem({ title, body, tone = "neutral" }) {
  const toneStyle =
    tone === "good"
      ? { borderLeft: "3px solid #22C55E" }
      : tone === "warn"
      ? { borderLeft: "3px solid #F59E0B" }
      : tone === "bad"
      ? { borderLeft: "3px solid #FB7185" }
      : { borderLeft: "3px solid #38BDF8" };

  return (
    <div style={{ ...S.signalItem, ...toneStyle }}>
      <div style={S.signalItemTitle}>{title}</div>
      <div style={S.signalItemBody}>{body}</div>
    </div>
  );
}

function normalizeOrganization(org, index) {
  const industries = Array.isArray(org?.industries)
    ? org.industries
    : org?.industry
    ? [org.industry]
    : [];

  const capabilities = Array.isArray(org?.capabilities)
    ? org.capabilities
    : [];

  const locations = Array.isArray(org?.locations)
    ? org.locations
    : org?.location
    ? [org.location]
    : [];

  return {
    id:
      org?.id ||
      org?._id ||
      org?.organizationId ||
      org?.uri ||
      `market-org-${index}`,
    name:
      org?.name ||
      org?.organizationName ||
      org?.legalName ||
      org?.title ||
      "Unknown organization",
    website:
      org?.website ||
      org?.websiteUrl ||
      org?.domain ||
      org?.url ||
      "",
    description:
      org?.description ||
      org?.summary ||
      org?.overview ||
      "",
    industries,
    capabilities,
    locations,
  };
}

function readableValue(value, fallback = "") {
  if (typeof value === "string") return value;
  return value?.name || value?.label || value?.title || fallback;
}

export default function Metrics() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [days, setDays] = useState(30);
  const [summary, setSummary] = useState(null);
  const [series, setSeries] = useState([]);

  const [marketQuery, setMarketQuery] = useState("");
  const [marketLoading, setMarketLoading] = useState(false);
  const [marketError, setMarketError] = useState("");
  const [marketResults, setMarketResults] = useState([]);
  const [marketTotal, setMarketTotal] = useState(0);

  async function load() {
    try {
      setLoading(true);
      setError("");

      const [summaryResponse, dailyResponse] = await Promise.all([
        getMetricsSummary(days),
        getMetricsDaily(days),
      ]);

      setSummary(summaryResponse?.summary || null);
      setSeries(
        Array.isArray(dailyResponse?.days) ? dailyResponse.days : []
      );
    } catch (loadError) {
      setError(loadError?.message || "Failed to load market signals");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days]);

  async function handleMarketSearch(event) {
    event?.preventDefault?.();

    const query = marketQuery.trim();

    if (!query) {
      setMarketError("Enter a product, service, capability, or market.");
      setMarketResults([]);
      setMarketTotal(0);
      return;
    }

    try {
      setMarketLoading(true);
      setMarketError("");
      setMarketResults([]);
      setMarketTotal(0);

      const response = await searchGraphIQOrganizations({
        capabilities: [query],
      });

      const rawData = response?.data ?? response;

      const results = Array.isArray(rawData)
        ? rawData
        : rawData?.entities ||
          rawData?.organizations ||
          rawData?.results ||
          rawData?.items ||
          rawData?.data ||
          [];

      setMarketResults(Array.isArray(results) ? results.slice(0, 10) : []);
      setMarketTotal(
        safeNum(rawData?.total_count) ||
          safeNum(rawData?.totalCount) ||
          (Array.isArray(results) ? results.length : 0)
      );
    } catch (searchError) {
      setMarketError(
        searchError?.data?.details?.message ||
          searchError?.data?.message ||
          searchError?.message ||
          "Company intelligence search failed."
      );
    } finally {
      setMarketLoading(false);
    }
  }

  const organizations = useMemo(
    () =>
      marketResults.map((organization, index) =>
        normalizeOrganization(organization, index)
      ),
    [marketResults]
  );

  const totals = useMemo(() => {
    const weightedCreatedTotal = series.reduce(
      (sum, row) => sum + safeNum(row?.weightedCreated),
      0
    );
    const wonRevenueTotal = series.reduce(
      (sum, row) => sum + safeNum(row?.wonRevenue),
      0
    );

    return {
      weightedCreatedTotal,
      wonRevenueTotal,
      avgDailyWon: series.length ? wonRevenueTotal / series.length : 0,
    };
  }, [series]);

  const signalStrength = useMemo(() => {
    const current = summary || {};
    const winComponent = clamp(safeNum(current.winRate) * 100, 0, 100);
    const stalePenalty = clamp(safeNum(current.staleCount) * 8, 0, 40);
    return clamp(Math.round(winComponent - stalePenalty + 20), 0, 100);
  }, [summary]);

  const signalTone =
    signalStrength >= 75
      ? "#22C55E"
      : signalStrength >= 50
      ? "#F59E0B"
      : "#FB7185";

  const chartSeries = useMemo(
    () =>
      series.map((row, index) => ({
        ...row,
        label: row?.date || row?.day || row?.createdAt || `D${index + 1}`,
      })),
    [series]
  );

  const marketInsights = useMemo(() => {
    const current = summary || {};
    const insights = [];

    if (safeNum(current.winRate) < 0.3) {
      insights.push({
        title: "Demand is not converting efficiently",
        body: `Current win rate is ${pct(
          current.winRate
        )}. Atlas is detecting opportunity activity, but too little of it is reaching closed revenue.`,
        tone: "bad",
      });
    } else {
      insights.push({
        title: "Demand conversion is holding",
        body: `Current win rate is ${pct(
          current.winRate
        )}, which suggests market demand is translating into revenue at a stable rate.`,
        tone: "good",
      });
    }

    if (safeNum(current.staleCount) >= 5) {
      insights.push({
        title: "Opportunity drag is building",
        body: `${current.staleCount} opportunities are stale. Leadership should tighten follow-up before market interest loses momentum.`,
        tone: "warn",
      });
    } else {
      insights.push({
        title: "Opportunity drag remains controlled",
        body: `Only ${
          current.staleCount ?? 0
        } opportunities are currently stale, keeping execution friction manageable.`,
        tone: "good",
      });
    }

    if (totals.weightedCreatedTotal > totals.wonRevenueTotal) {
      insights.push({
        title: "New demand is outpacing revenue capture",
        body: "Atlas is seeing more weighted opportunity creation than won revenue in the selected period.",
        tone: "neutral",
      });
    } else {
      insights.push({
        title: "Revenue capture is keeping pace",
        body: "Won revenue is tracking closely against weighted opportunity creation in the selected period.",
        tone: "good",
      });
    }

    return insights.slice(0, 3);
  }, [summary, totals]);

  const recommendations = useMemo(() => {
    const current = summary || {};
    const items = [];

    if (safeNum(current.staleCount) >= 5) {
      items.push({
        title: "Protect active market demand",
        body: "Re-engage stale opportunities before interest declines or competitors enter the conversation.",
      });
    }

    if (safeNum(current.winRate) < 0.3) {
      items.push({
        title: "Improve qualification",
        body: "Focus the team on the segments and accounts most likely to convert instead of increasing volume alone.",
      });
    }

    items.push({
      title: "Use external discovery with internal signals",
      body: "Search for companies in attractive markets, then compare those results against pipeline, account fit, and revenue priorities inside Atlas.",
    });

    return items.slice(0, 3);
  }, [summary]);

  const industryCounts = useMemo(() => {
    const counts = new Map();

    organizations.forEach((organization) => {
      organization.industries.forEach((industry) => {
        const label = readableValue(industry, "Other");
        if (!label) return;
        counts.set(label, (counts.get(label) || 0) + 1);
      });
    });

    return Array.from(counts.entries())
      .map(([industry, count]) => ({ industry, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [organizations]);

  const executiveBriefing = useMemo(() => {
    const current = summary || {};

    if (organizations.length) {
      return `Atlas found ${marketTotal || organizations.length} organizations connected to "${marketQuery}". The first ${organizations.length} results are shown below so leadership can quickly identify companies and markets worth deeper account research.`;
    }

    return `Atlas Market Signals combines external company discovery with internal demand, pipeline, and conversion intelligence. Search a product, service, or capability to find relevant companies, then use Atlas to decide where the strongest revenue opportunities may exist. Current close performance is ${pct(
      current.winRate ?? 0
    )} across the selected ${days}-day window.`;
  }, [summary, days, organizations, marketTotal, marketQuery]);

  const axisTick = { fill: "#9fb0d0", fontSize: 11 };

  const tooltipStyle = {
    background: "rgba(7,11,24,0.97)",
    border: "1px solid rgba(255,255,255,0.10)",
    borderRadius: "14px",
    color: "#fff",
    boxShadow: "0 14px 40px rgba(0,0,0,0.35)",
  };

  if (loading && !summary && !series.length) {
    return (
      <div style={S.page}>
        <div style={S.wrap}>
          <div style={S.hero}>
            <div style={S.eyebrow}>External Market Intelligence</div>
            <h1 style={S.h1}>Market Signals</h1>
            <div style={S.heroText}>Loading market intelligence…</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={S.page}>
      <div style={S.wrap}>
        <div style={S.hero}>
          <div style={S.heroTop}>
            <div>
              <div style={S.eyebrow}>External Market Intelligence</div>
              <h1 style={S.h1}>Market Signals</h1>
              <div style={S.heroText}>
                Discover where opportunity is building, identify relevant
                companies, and connect external market intelligence to the
                revenue data already inside Atlas.
              </div>
            </div>

            <div style={S.controlsWrap}>
              <div style={S.badge}>Powered by GraphIQ</div>
              <div style={S.badge}>Signals Active</div>
              <div style={S.badge}>
                {signalStrength >= 60
                  ? "Signal Strength Elevated"
                  : "Signal Flow Stable"}
              </div>

              <div style={{ width: "100%" }} />

              <div style={S.pill}>Window</div>

              <select
                style={S.select}
                value={days}
                onChange={(event) => setDays(Number(event.target.value))}
              >
                <option value={14}>14 days</option>
                <option value={30}>30 days</option>
                <option value={60}>60 days</option>
                <option value={90}>90 days</option>
              </select>

              <button style={S.btn} onClick={load} disabled={loading}>
                {loading ? "Loading..." : "Refresh"}
              </button>
            </div>
          </div>
        </div>

        {error ? <div style={S.error}>{error}</div> : null}

        <div style={S.briefingCard}>
          <div style={S.briefingEyebrow}>Atlas AI Market Outlook</div>
          <div style={S.briefingBody}>{executiveBriefing}</div>
        </div>

        <Section
          title="External Opportunity Discovery"
          subtitle="Powered by GraphIQ"
          action={
            marketTotal > 0 ? (
              <div style={S.sectionTag}>
                {marketTotal.toLocaleString()} matches
              </div>
            ) : null
          }
        >
          <form onSubmit={handleMarketSearch} style={S.searchForm}>
            <input
              value={marketQuery}
              onChange={(event) => setMarketQuery(event.target.value)}
              placeholder="Search by product, capability, technology, or service"
              style={S.searchInput}
              disabled={marketLoading}
            />
            <button
              type="submit"
              style={{
                ...S.searchButton,
                opacity: marketLoading ? 0.65 : 1,
                cursor: marketLoading ? "wait" : "pointer",
              }}
              disabled={marketLoading}
            >
              {marketLoading ? "Searching Companies..." : "Search Companies"}
            </button>
          </form>

          <div style={S.searchHelp}>
            Find organizations based on what they make, sell, or provide, then
            use Atlas to decide which markets and accounts deserve attention.
          </div>

          {marketError ? <div style={S.searchError}>{marketError}</div> : null}

          {!marketLoading &&
          marketQuery.trim() &&
          !marketError &&
          organizations.length === 0 ? (
            <div style={S.emptyStateBox}>
              No organizations were returned for this search.
            </div>
          ) : null}

          {organizations.length > 0 ? (
            <div style={S.companyGrid}>
              {organizations.map((organization) => (
                <div key={organization.id} style={S.companyCard}>
                  <div style={S.companyTop}>
                    <div>
                      <div style={S.companyName}>{organization.name}</div>
                      {organization.website ? (
                        <div style={S.companyWebsite}>
                          {organization.website}
                        </div>
                      ) : null}
                    </div>
                    <div style={S.opportunityPill}>
                      Potential Opportunity
                    </div>
                  </div>

                  {organization.description ? (
                    <div style={S.companyDescription}>
                      {organization.description}
                    </div>
                  ) : null}

                  {organization.industries.length > 0 ? (
                    <div style={S.tagSection}>
                      <div style={S.tagLabel}>Industries</div>
                      <div style={S.tags}>
                        {organization.industries
                          .slice(0, 5)
                          .map((industry, index) => (
                            <div
                              key={`${organization.id}-industry-${index}`}
                              style={S.tag}
                            >
                              {readableValue(industry, "Industry")}
                            </div>
                          ))}
                      </div>
                    </div>
                  ) : null}

                  {organization.capabilities.length > 0 ? (
                    <div style={S.tagSection}>
                      <div style={S.tagLabel}>Capabilities</div>
                      <div style={S.tags}>
                        {organization.capabilities
                          .slice(0, 7)
                          .map((capability, index) => (
                            <div
                              key={`${organization.id}-capability-${index}`}
                              style={S.tag}
                            >
                              {readableValue(capability, "Capability")}
                            </div>
                          ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
        </Section>

        <div style={S.statsGrid}>
          <StatCard
            label="Companies Discovered"
            value={marketTotal || organizations.length}
            note="Organizations returned by the most recent external market search."
          />
          <StatCard
            label="Weighted Opportunity"
            value={money(summary?.weighted ?? 0)}
            note="Probability-adjusted internal opportunity value in the selected window."
          />
          <StatCard
            label="Revenue Captured"
            value={money(summary?.wonRevenue ?? 0)}
            note="Won revenue realized from current opportunity activity."
          />
          <StatCard
            label="Signal Strength"
            value={signalStrength}
            valueStyle={{ color: signalTone }}
            note="Derived from conversion efficiency and stale opportunity drag."
          />
        </div>

        <div style={S.twoCol}>
          <Section title="Market Activity Over Time" subtitle="Demand Flow">
            <div style={S.chartShellLg}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartSeries}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgba(255,255,255,0.10)"
                  />
                  <XAxis
                    dataKey="label"
                    tick={axisTick}
                    stroke="#94a3b8"
                    minTickGap={24}
                  />
                  <YAxis
                    tick={axisTick}
                    stroke="#94a3b8"
                    tickFormatter={(value) => moneyCompact(value)}
                  />
                  <Tooltip
                    formatter={(value, name) => [money(value), name]}
                    labelFormatter={(label) => `Date: ${label}`}
                    contentStyle={tooltipStyle}
                    labelStyle={{ color: "#fff" }}
                  />
                  <Line
                    type="monotone"
                    dataKey="weightedCreated"
                    name="Weighted Opportunity"
                    stroke="#67e8f9"
                    strokeWidth={3}
                    dot={false}
                    animationDuration={1400}
                  />
                  <Line
                    type="monotone"
                    dataKey="wonRevenue"
                    name="Won Revenue"
                    stroke="#93c5fd"
                    strokeWidth={3}
                    dot={false}
                    animationDuration={1600}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Section>

          <Section title="Atlas Recommendations" subtitle="Where to Focus">
            <div style={S.signalList}>
              {recommendations.map((item, index) => (
                <SignalItem
                  key={`${item.title}-${index}`}
                  title={item.title}
                  body={item.body}
                  tone={index === 0 ? "good" : "neutral"}
                />
              ))}
            </div>
          </Section>
        </div>

        <div style={S.twoCol}>
          <Section title="Revenue Opportunity Radar" subtitle="Growth Levers">
            <OpportunityRadar
              pipeline={{ pipelineValue: summary?.raw ?? 0 }}
              revenue={summary?.wonRevenue ?? totals.wonRevenueTotal}
            />
          </Section>

          <Section title="Industry Mix From Search" subtitle="External Results">
            {industryCounts.length ? (
              <div style={S.chartShell}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={industryCounts}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="rgba(255,255,255,0.10)"
                    />
                    <XAxis
                      dataKey="industry"
                      tick={axisTick}
                      stroke="#94a3b8"
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={axisTick}
                      stroke="#94a3b8"
                    />
                    <Tooltip
                      formatter={(value) => [value, "Companies"]}
                      contentStyle={tooltipStyle}
                      labelStyle={{ color: "#fff" }}
                    />
                    <Bar
                      dataKey="count"
                      fill="#93c5fd"
                      radius={[10, 10, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div style={S.emptyStateBox}>
                Run a company search to see the industry mix across the returned
                organizations.
              </div>
            )}
          </Section>
        </div>

        <div style={S.twoCol}>
          <Section title="Revenue Timeline Projection" subtitle="Forward View">
            <RevenueTimeline
              forecast={Math.max(
                summary?.weighted ?? 0,
                summary?.wonRevenue ?? 0
              )}
            />
          </Section>

          <Section title="Current Market Signals" subtitle="AI Narrative">
            <div style={S.signalList}>
              {marketInsights.map((item, index) => (
                <SignalItem
                  key={`${item.title}-${index}`}
                  title={item.title}
                  body={item.body}
                  tone={item.tone}
                />
              ))}
            </div>
          </Section>
        </div>

        <div style={S.footerStats}>
          <StatCard
            label="Average Daily Won Revenue"
            value={money(totals.avgDailyWon)}
            note="Average daily realized revenue in the selected window."
          />
          <StatCard
            label="Current Win Rate"
            value={pct(summary?.winRate ?? 0)}
            note="The share of tracked opportunities converting into won revenue."
          />
        </div>
      </div>
    </div>
  );
}

const S = {
  page: {
    minHeight: "100vh",
    color: "#EAF0FF",
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
  heroTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
    alignItems: "flex-start",
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
    letterSpacing: -0.6,
    fontWeight: 900,
    color: "#ffffff",
  },
  heroText: {
    marginTop: 8,
    maxWidth: 760,
    fontSize: 14,
    lineHeight: 1.55,
    color: "rgba(226,232,240,0.90)",
  },
  controlsWrap: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 8,
    flexWrap: "wrap",
    alignItems: "center",
    alignContent: "flex-start",
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
  pill: {
    display: "inline-flex",
    alignItems: "center",
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.04)",
    fontSize: 11,
    color: "#EAF0FF",
    fontWeight: 700,
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
  },
  select: {
    borderRadius: 999,
    padding: "10px 12px",
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(0,0,0,0.22)",
    color: "#EAF0FF",
    fontWeight: 900,
    fontSize: 12,
    outline: "none",
  },
  briefingCard: {
    borderRadius: 18,
    padding: 16,
    border: "1px solid rgba(255,255,255,0.08)",
    background:
      "linear-gradient(135deg, rgba(124,92,255,0.14), rgba(56,189,248,0.09), rgba(255,255,255,0.02))",
  },
  briefingEyebrow: {
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: "0.16em",
    color: "rgba(148,163,184,0.78)",
    fontWeight: 800,
    marginBottom: 8,
  },
  briefingBody: {
    fontSize: 14,
    color: "rgba(226,232,240,0.90)",
    lineHeight: 1.65,
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 10,
  },
  statCard: {
    borderRadius: 16,
    padding: "14px 14px 13px",
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(10,16,35,0.40)",
    boxShadow: "0 10px 24px rgba(0,0,0,0.14)",
    minHeight: 126,
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
    color: "rgba(203,213,225,0.76)",
    lineHeight: 1.45,
  },
  section: {
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.03)",
    overflow: "hidden",
    boxShadow: "0 10px 24px rgba(0,0,0,0.14)",
  },
  sectionHead: {
    padding: "12px 14px",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
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
  sectionTag: {
    fontSize: 11,
    fontWeight: 800,
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.05)",
    color: "#e2e8f0",
  },
  twoCol: {
    display: "grid",
    gridTemplateColumns: "1.1fr 0.9fr",
    gap: 12,
  },
  chartShell: {
    height: 280,
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 16,
    background: "rgba(4,10,24,0.72)",
    padding: 10,
  },
  chartShellLg: {
    height: 300,
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 16,
    background: "rgba(4,10,24,0.72)",
    padding: 10,
  },
  signalList: {
    display: "grid",
    gap: 10,
  },
  signalItem: {
    borderRadius: 14,
    padding: "12px 13px",
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.08)",
  },
  signalItemTitle: {
    fontSize: 13,
    fontWeight: 900,
    color: "#fff",
    marginBottom: 6,
  },
  signalItemBody: {
    fontSize: 13,
    color: "rgba(219,228,240,0.84)",
    lineHeight: 1.55,
  },
  footerStats: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
  },
  error: {
    borderRadius: 12,
    padding: 12,
    border: "1px solid rgba(255,0,0,0.25)",
    background: "rgba(255,0,0,0.10)",
    color: "#FFD7D7",
  },
  searchForm: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) auto",
    gap: 10,
  },
  searchInput: {
    width: "100%",
    minWidth: 0,
    boxSizing: "border-box",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 14,
    padding: "13px 14px",
    background: "rgba(4,10,24,0.72)",
    color: "#fff",
    fontSize: 14,
    outline: "none",
  },
  searchButton: {
    border: "1px solid rgba(125,211,252,0.3)",
    borderRadius: 14,
    padding: "13px 18px",
    background:
      "linear-gradient(135deg, rgba(37,99,235,0.95), rgba(14,165,233,0.88))",
    color: "#fff",
    fontSize: 13,
    fontWeight: 800,
    whiteSpace: "nowrap",
  },
  searchHelp: {
    marginTop: 10,
    fontSize: 12,
    lineHeight: 1.5,
    color: "rgba(203,213,225,0.72)",
  },
  searchError: {
    marginTop: 12,
    border: "1px solid rgba(248,113,113,0.3)",
    borderRadius: 14,
    padding: "12px 14px",
    background: "rgba(127,29,29,0.2)",
    color: "#fecaca",
    fontSize: 13,
  },
  emptyStateBox: {
    marginTop: 12,
    minHeight: 120,
    border: "1px dashed rgba(255,255,255,0.12)",
    borderRadius: 14,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
    color: "rgba(226,232,240,0.76)",
    fontSize: 13,
    lineHeight: 1.6,
    textAlign: "center",
    background: "rgba(4,10,24,0.34)",
  },
  companyGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
    gap: 12,
    marginTop: 14,
  },
  companyCard: {
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 16,
    padding: 14,
    background: "rgba(4,10,24,0.46)",
  },
  companyTop: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  companyName: {
    fontSize: 17,
    fontWeight: 800,
    color: "#fff",
  },
  companyWebsite: {
    marginTop: 5,
    color: "#7dd3fc",
    fontSize: 12,
    overflowWrap: "anywhere",
  },
  opportunityPill: {
    border: "1px solid rgba(34,197,94,0.24)",
    borderRadius: 999,
    padding: "6px 9px",
    background: "rgba(34,197,94,0.1)",
    color: "#bbf7d0",
    fontSize: 10,
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: "0.09em",
    whiteSpace: "nowrap",
  },
  companyDescription: {
    marginTop: 12,
    fontSize: 13,
    lineHeight: 1.6,
    color: "rgba(226,232,240,0.82)",
  },
  tagSection: {
    marginTop: 13,
  },
  tagLabel: {
    marginBottom: 7,
    color: "rgba(148,163,184,0.88)",
    fontSize: 10,
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: "0.14em",
  },
  tags: {
    display: "flex",
    flexWrap: "wrap",
    gap: 6,
  },
  tag: {
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 999,
    padding: "6px 9px",
    background: "rgba(255,255,255,0.04)",
    color: "#dbeafe",
    fontSize: 11,
  },
};
