import React, { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  ScatterChart,
  Scatter,
  CartesianGrid,
  XAxis,
  YAxis,
  ZAxis,
  Tooltip,
} from "recharts";

import AtlasAccountExpansionSignals from "../components/atlas/AtlasAccountExpansionSignals";
import {
  getDashboard,
  searchGraphIQOrganizations,
} from "../api";

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

const money = (n) =>
  safeNum(n).toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

const moneyCompact = (num) => {
  const n = safeNum(num);
  if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `$${(n / 1000).toFixed(0)}K`;
  return `$${n}`;
};

function toneStyle(tone) {
  const map = {
    High: {
      border: "1px solid rgba(16,185,129,0.22)",
      background: "rgba(16,185,129,0.12)",
      color: "#bbf7d0",
    },
    Strong: {
      border: "1px solid rgba(56,189,248,0.22)",
      background: "rgba(56,189,248,0.12)",
      color: "#bae6fd",
    },
    Watch: {
      border: "1px solid rgba(245,158,11,0.22)",
      background: "rgba(245,158,11,0.12)",
      color: "#fde68a",
    },
  };

  return {
    display: "inline-flex",
    alignItems: "center",
    padding: "7px 11px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 800,
    whiteSpace: "nowrap",
    ...(map[tone] || map.Strong),
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

function EmptyState({ text = "No live account intelligence data available yet." }) {
  return <div style={styles.emptyState}>{text}</div>;
}

function normalizeDeal(d) {
  if (!d) return null;
  return {
    id: d?._id || d?.id || "",
    name: d?.name || d?.title || d?.accountName || "Opportunity",
    company:
      d?.accountName ||
      d?.company ||
      d?.clientName ||
      d?.name ||
      "Account",
    stage: String(d?.stage || "Unknown"),
    amount:
      safeNum(d?.amount, 0) ||
      safeNum(d?.value, 0) ||
      safeNum(d?.pipelineValue, 0),
  };
}

function normalizeGraphIQOrganization(org, index) {
  if (!org || typeof org !== "object") {
    return {
      id: `graphiq-${index}`,
      name: "Unknown organization",
      website: "",
      description: "",
      industries: [],
      capabilities: [],
      locations: [],
      raw: org,
    };
  }

  const industries = Array.isArray(org.industries)
    ? org.industries
    : org.industry
    ? [org.industry]
    : [];

  const capabilities = Array.isArray(org.capabilities)
    ? org.capabilities
    : [];

  const locations = Array.isArray(org.locations)
    ? org.locations
    : org.location
    ? [org.location]
    : [];

  return {
    id:
      org.id ||
      org._id ||
      org.organizationId ||
      org.uri ||
      `graphiq-${index}`,
    name:
      org.name ||
      org.organizationName ||
      org.legalName ||
      org.title ||
      "Unknown organization",
    website:
      org.website ||
      org.websiteUrl ||
      org.domain ||
      org.url ||
      "",
    description:
      org.description ||
      org.summary ||
      org.overview ||
      "",
    industries,
    capabilities,
    locations,
    raw: org,
  };
}
export default function AccountIntelligence() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dashboard, setDashboard] = useState(null);
  const [graphiqQuery, setGraphiqQuery] = useState("");
  const [graphiqLoading, setGraphiqLoading] = useState(false);
  const [graphiqError, setGraphiqError] = useState("");
  const [graphiqResults, setGraphiqResults] = useState([]);

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
        console.error(err);
        if (!mounted) return;
        setError(err?.message || "Failed to load Account Intelligence");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();

    return () => {
      mounted = false;
    };
  }, []);
async function handleGraphIQSearch(event) {
  event?.preventDefault?.();

  const query = graphiqQuery.trim();

  if (!query) {
    setGraphiqError("Enter a company name, website, industry, or capability.");
    setGraphiqResults([]);
    return;
  }

  try {
    setGraphiqLoading(true);
    setGraphiqError("");
    setGraphiqResults([]);

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

    setGraphiqResults(
  Array.isArray(results) ? results.slice(0, 10) : []
);
  } catch (err) {
    console.error("GraphIQ search error:", err);

    setGraphiqError(
      err?.data?.details?.message ||
        err?.data?.message ||
        err?.message ||
        "GraphIQ search failed."
    );
  } finally {
    setGraphiqLoading(false);
  }
}
  const workspaceMode = String(dashboard?.workspaceMode || "demo").toLowerCase();
  const isDemo = workspaceMode === "demo";
  const orgName = dashboard?.activeWorkspace?.name || "Workspace";
  const normalizedGraphIQResults = useMemo(
  () =>
    graphiqResults.map((organization, index) =>
      normalizeGraphIQOrganization(organization, index)
    ),
  [graphiqResults]
);

  const deals = useMemo(() => {
    return (Array.isArray(dashboard?.deals) ? dashboard.deals : [])
      .map(normalizeDeal)
      .filter(Boolean);
  }, [dashboard]);

  const pipelineValue = safeNum(dashboard?.summary?.pipelineValue, 0);
  const revenue = safeNum(dashboard?.summary?.revenue, 0);

  const groupedAccounts = useMemo(() => {
    const map = new Map();

    deals.forEach((deal) => {
      const key = String(deal.company || "Account").trim();
      if (!map.has(key)) {
        map.set(key, {
          name: key,
          engagement: 0,
          expansion: 0,
          industry: "Connected Account",
          revenuePotential: 0,
          revenueLabel: "$0",
          buyingSignal: "Live deal activity detected",
          priority: "Watchlist",
          tone: "Watch",
          dealCount: 0,
          openCount: 0,
        });
      }

      const row = map.get(key);
      row.revenuePotential += safeNum(deal.amount, 0);
      row.dealCount += 1;

      if (!["Closed Won", "Closed Lost"].includes(deal.stage)) {
        row.openCount += 1;
      }
    });

    const arr = Array.from(map.values()).map((row, idx) => {
      const engagementBase = 45 + Math.min(40, row.dealCount * 9 + row.openCount * 6);
      const expansionBase =
        row.revenuePotential > 0
          ? Math.min(85, 40 + Math.round(row.revenuePotential / 10000))
          : 0;

      const priority =
        row.revenuePotential >= 150000
          ? "High Priority"
          : row.revenuePotential >= 50000
          ? "Expansion Watch"
          : "Watchlist";

      const tone =
        row.revenuePotential >= 150000
          ? "High"
          : row.revenuePotential >= 50000
          ? "Strong"
          : "Watch";

      return {
        ...row,
        engagement: engagementBase,
        expansion: expansionBase,
        revenueLabel: moneyCompact(row.revenuePotential),
        buyingSignal:
          row.openCount > 0
            ? `${row.openCount} active opportunity${row.openCount === 1 ? "" : "ies"}`
            : "No active opportunities",
        priority,
        tone,
      };
    });

    arr.sort((a, b) => b.revenuePotential - a.revenuePotential);
    return arr.slice(0, 6);
  }, [deals]);

  const accounts = groupedAccounts;

  const hasLiveAccountData = accounts.length > 0;

  const topStats = useMemo(() => {
    const topEngagement = accounts.length
      ? Math.max(...accounts.map((a) => safeNum(a.engagement, 0)))
      : 0;

    const topExpansion = accounts.length
      ? Math.max(...accounts.map((a) => safeNum(a.expansion, 0)))
      : 0;

    const topPotential = accounts.reduce(
      (sum, a) => sum + safeNum(a.revenuePotential, 0),
      0
    );

    return [
      {
        label: "Top Opportunity Accounts",
        value: String(accounts.length),
        note: hasLiveAccountData
          ? "Highest-priority live targets"
          : "No live targets yet",
      },
      {
        label: "Highest Engagement",
        value: String(topEngagement),
        note: hasLiveAccountData
          ? "Current live peak score"
          : "Waiting for account activity",
      },
      {
        label: "Best Expansion Signal",
        value: `${topExpansion}%`,
        note: hasLiveAccountData
          ? "Strongest account fit"
          : "No expansion signal yet",
      },
      {
        label: "Revenue Potential",
        value: moneyCompact(topPotential),
        note: hasLiveAccountData
          ? "Near-term live upside"
          : "No live upside yet",
      },
    ];
  }, [accounts, hasLiveAccountData]);

  const summaryPoints = useMemo(() => {
    if (!hasLiveAccountData) {
      return [
        "No live account intelligence data is available for this workspace yet.",
        "Account Intelligence will populate when deals, companies, and connected account activity begin flowing in.",
        "This live workspace is no longer showing hardcoded demo account scores.",
        "Once opportunities are active, Atlas will identify which accounts deserve the most attention.",
      ];
    }

    const top = accounts[0];

    return [
      `${top.name} is currently the strongest near-term account based on live opportunity value.`,
      `${accounts.length} account group${accounts.length === 1 ? "" : "s"} are currently being evaluated by Atlas.`,
      `Total tracked revenue potential across surfaced accounts is ${moneyCompact(
        accounts.reduce((sum, a) => sum + safeNum(a.revenuePotential, 0), 0)
      )}.`,
      "Atlas is prioritizing accounts using live deal concentration, opportunity count, and expansion potential.",
    ];
  }, [accounts, hasLiveAccountData]);

  const opportunityRadar = useMemo(() => {
    if (!hasLiveAccountData) {
      return [
        "Connect CRM and opportunity data to activate live account scoring.",
        "Once account-level pipeline exists, Atlas will rank the best expansion targets here.",
        "Stakeholder, engagement, and buying-signal logic can only activate after live account records exist.",
        "This workspace is currently in live mode without account-fed opportunity intelligence.",
      ];
    }

    return accounts.slice(0, 4).map((acct) => {
      if (acct.priority === "High Priority") {
        return `${acct.name} should move into an executive expansion motion immediately.`;
      }
      if (acct.priority === "Expansion Watch") {
        return `${acct.name} has meaningful upside and should stay in active account review.`;
      }
      return `${acct.name} remains on the watchlist but needs stronger account momentum to rise.`;
    });
  }, [accounts, hasLiveAccountData]);

  const nextMoves = useMemo(() => {
    if (!hasLiveAccountData) {
      return [
        "Connect CRM account and deal sources so Atlas can calculate real account intelligence.",
        "Add deal stages and company names consistently to improve account grouping quality.",
        "Once opportunities are flowing, Atlas will generate next-best account moves automatically.",
        "Use the connected workspace data model to map real account expansion signals.",
      ];
    }

    return accounts.slice(0, 4).map((acct, index) => {
      if (index === 0) {
        return `Prioritize executive outreach on ${acct.name} first.`;
      }
      if (index === 1) {
        return `Map buying roles and next-step motion for ${acct.name}.`;
      }
      if (index === 2) {
        return `Keep ${acct.name} in active follow-up while monitoring deal movement.`;
      }
      return `Build an account-specific action plan for ${acct.name}.`;
    });
  }, [accounts, hasLiveAccountData]);

  if (loading) {
    return (
      <div style={styles.page}>
        <div style={styles.wrap}>
          <div style={styles.hero}>
            <h1 style={styles.h1}>Loading Account Intelligence...</h1>
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

  return (
    <div style={styles.page}>
      <div style={styles.wrap}>
        <div style={styles.hero}>
          <div style={styles.eyebrow}>Prioritize the Right Accounts</div>
          <h1 style={styles.h1}>Account Intelligence</h1>
          <div style={styles.heroText}>
            Atlas identifies which accounts have the best combination of engagement,
            expansion probability, and revenue upside so leadership can focus on the
            right growth opportunities inside <b>{orgName}</b>.
          </div>

          <div style={styles.badgeWrap}>
            {[
              isDemo ? "Demo Account Mode" : "Live Account Mode",
              hasLiveAccountData ? "Opportunity Radar Active" : "Opportunity Radar Waiting",
              hasLiveAccountData ? "Expansion Signals Synced" : "Signals Pending",
              "Atlas AI Monitoring",
            ].map((item) => (
              <div key={item} style={styles.badge}>
                {item}
              </div>
            ))}
          </div>
        </div>

        <AtlasAccountExpansionSignals clients={accounts} />
        <Section
  title="Company Intelligence Search"
  subtitle="Powered by GraphIQ"
>
  <form onSubmit={handleGraphIQSearch} style={styles.graphiqForm}>
    <input
      type="text"
      value={graphiqQuery}
      onChange={(event) => setGraphiqQuery(event.target.value)}
      placeholder="Search by capability, product, or service"
      style={styles.graphiqInput}
      disabled={graphiqLoading}
    />

    <button
      type="submit"
      style={{
        ...styles.graphiqButton,
        opacity: graphiqLoading ? 0.65 : 1,
        cursor: graphiqLoading ? "wait" : "pointer",
      }}
      disabled={graphiqLoading}
    >
      {graphiqLoading ? "Searching Companies..." : "Search Companies"}
    </button>
  </form>

  <div style={styles.graphiqHelp}>
    Search GraphIQ for companies based on what they make, sell, or provide.
  </div>

  {graphiqError ? (
    <div style={styles.graphiqError}>{graphiqError}</div>
  ) : null}

  {!graphiqLoading &&
  graphiqQuery.trim() &&
  !graphiqError &&
  normalizedGraphIQResults.length === 0 ? (
    <div style={styles.graphiqEmpty}>
      No GraphIQ organizations were returned for this search.
    </div>
  ) : null}

  {normalizedGraphIQResults.length > 0 ? (
    <div style={styles.graphiqResults}>
      {normalizedGraphIQResults.map((organization) => (
        <div key={organization.id} style={styles.graphiqCard}>
          <div style={styles.graphiqCardTop}>
            <div>
              <div style={styles.graphiqName}>{organization.name}</div>

              {organization.website ? (
                <div style={styles.graphiqWebsite}>
                  {organization.website}
                </div>
              ) : null}
            </div>

            <div style={styles.graphiqSource}>GraphIQ</div>
          </div>

          {organization.description ? (
            <div style={styles.graphiqDescription}>
              {organization.description}
            </div>
          ) : null}

          {organization.industries.length > 0 ? (
            <div style={styles.graphiqTagSection}>
              <div style={styles.graphiqTagLabel}>Industries</div>

              <div style={styles.graphiqTags}>
                {organization.industries.slice(0, 6).map((industry, index) => (
                  <div
                    key={`${organization.id}-industry-${index}`}
                    style={styles.graphiqTag}
                  >
                    {typeof industry === "string"
                      ? industry
                      : industry?.name || industry?.label || "Industry"}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {organization.capabilities.length > 0 ? (
            <div style={styles.graphiqTagSection}>
              <div style={styles.graphiqTagLabel}>Capabilities</div>

              <div style={styles.graphiqTags}>
                {organization.capabilities
                  .slice(0, 8)
                  .map((capability, index) => (
                    <div
                      key={`${organization.id}-capability-${index}`}
                      style={styles.graphiqTag}
                    >
                      {typeof capability === "string"
                        ? capability
                        : capability?.name ||
                          capability?.label ||
                          capability?.title ||
                          "Capability"}
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

        <div style={styles.statsGrid}>
          {topStats.map((item) => (
            <SmallStat
              key={item.label}
              label={item.label}
              value={item.value}
              note={item.note}
            />
          ))}
        </div>

        <div style={styles.twoCol}>
          <Section title="Executive Summary" subtitle="Overview">
            <div style={styles.summaryList}>
              {summaryPoints.map((point) => (
                <div key={point} style={styles.summaryItem}>
                  {point}
                </div>
              ))}
            </div>
          </Section>

          <Section title="Opportunity Radar" subtitle="Signals">
            <div style={styles.summaryList}>
              {opportunityRadar.map((point) => (
                <div key={point} style={styles.summaryItem}>
                  {point}
                </div>
              ))}
            </div>
          </Section>
        </div>

        <div style={styles.twoCol}>
          <Section title="Revenue Potential by Account" subtitle="Upside">
            <div style={styles.chartShell}>
              {!hasLiveAccountData ? (
                <EmptyState text="No live account revenue potential yet. Add company-linked opportunities to populate this chart." />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={accounts} barCategoryGap={28}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                    <XAxis dataKey="name" tick={axisTick} stroke="#94a3b8" />
                    <YAxis
                      tick={axisTick}
                      stroke="#94a3b8"
                      tickFormatter={(v) => moneyCompact(v)}
                    />
                    <Tooltip
                      formatter={(value) => [moneyCompact(value), "Revenue Potential"]}
                      contentStyle={tooltipStyle}
                      labelStyle={{ color: "#fff" }}
                    />
                    <Bar
                      dataKey="revenuePotential"
                      fill="#bffcff"
                      radius={[12, 12, 0, 0]}
                      animationDuration={1500}
                      animationEasing="ease-out"
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </Section>

          <Section title="Engagement vs Expansion" subtitle="Positioning">
            <div style={styles.chartShell}>
              {!hasLiveAccountData ? (
                <EmptyState text="No live engagement or expansion data yet. Connect opportunities and account activity to activate this view." />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 12, right: 12, bottom: 6, left: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                    <XAxis
                      type="number"
                      dataKey="engagement"
                      name="Engagement"
                      stroke="#94a3b8"
                      tick={axisTick}
                      domain={[0, 100]}
                    />
                    <YAxis
                      type="number"
                      dataKey="expansion"
                      name="Expansion"
                      stroke="#94a3b8"
                      tick={axisTick}
                      unit="%"
                      domain={[0, 100]}
                    />
                    <ZAxis type="number" dataKey="revenuePotential" range={[140, 420]} />
                    <Tooltip
                      cursor={{ strokeDasharray: "3 3" }}
                      formatter={(value, name) => {
                        if (name === "revenuePotential") {
                          return [moneyCompact(value), "Revenue Potential"];
                        }
                        if (name === "expansion") {
                          return [`${value}%`, "Expansion"];
                        }
                        return [value, name];
                      }}
                      labelFormatter={() => ""}
                      contentStyle={tooltipStyle}
                    />
                    <Scatter
                      name="Accounts"
                      data={accounts}
                      fill="#bffcff"
                      animationDuration={1500}
                    />
                  </ScatterChart>
                </ResponsiveContainer>
              )}
            </div>
          </Section>
        </div>

        <div style={styles.twoCol}>
          <Section title="Top Opportunity Accounts" subtitle="Accounts">
            {!hasLiveAccountData ? (
              <EmptyState text="No live accounts are being surfaced yet." />
            ) : (
              <div style={styles.accountList}>
                {accounts.map((acct) => (
                  <div key={acct.name} style={styles.accountCard}>
                    <div style={styles.accountTop}>
                      <div>
                        <div style={styles.accountName}>{acct.name}</div>
                        <div style={styles.accountMeta}>
                          {acct.industry} • {acct.buyingSignal}
                        </div>
                      </div>
                      <div style={toneStyle(acct.tone)}>{acct.priority}</div>
                    </div>

                    <div style={styles.accountGrid}>
                      <div style={styles.mini}>
                        <div style={styles.miniLabel}>Engagement</div>
                        <div style={styles.miniValue}>{acct.engagement}</div>
                      </div>
                      <div style={styles.mini}>
                        <div style={styles.miniLabel}>Expansion</div>
                        <div style={styles.miniValue}>{acct.expansion}%</div>
                      </div>
                      <div style={styles.mini}>
                        <div style={styles.miniLabel}>Revenue Potential</div>
                        <div style={styles.miniValue}>{acct.revenueLabel}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>

          <Section title="Account Table" subtitle="Detail">
            {!hasLiveAccountData ? (
              <EmptyState text="No live account table data yet." />
            ) : (
              <div style={styles.tableWrap}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Account</th>
                      <th style={styles.th}>Industry</th>
                      <th style={styles.th}>Engagement</th>
                      <th style={styles.th}>Expansion</th>
                      <th style={styles.th}>Potential</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accounts.map((acct, idx) => (
                      <tr key={acct.name}>
                        <td style={styles.td}>
                          <div style={{ fontWeight: 800, color: "#fff" }}>{acct.name}</div>
                          <div style={{ marginTop: 6, color: "rgba(203,213,225,0.72)" }}>
                            {acct.buyingSignal}
                          </div>
                        </td>
                        <td style={styles.td}>{acct.industry}</td>
                        <td style={styles.td}>{acct.engagement}</td>
                        <td style={styles.td}>{acct.expansion}%</td>
                        <td
                          style={{
                            ...styles.td,
                            borderBottom:
                              idx === accounts.length - 1
                                ? "none"
                                : "1px solid rgba(255,255,255,0.06)",
                          }}
                        >
                          {acct.revenueLabel}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>
        </div>

        <Section title="Next Best Account Moves" subtitle="Priorities">
          <div style={styles.summaryList}>
            {nextMoves.map((move) => (
              <div key={move} style={styles.summaryItem}>
                {move}
              </div>
            ))}
          </div>
        </Section>
      </div>
    </div>
  );
}
const styles = {
  page: {
    minHeight: "100vh",
    color: "#fff",
  },
  wrap: {
    maxWidth: 1380,
    margin: "0 auto",
    display: "grid",
    gap: 14,
  },
  hero: {
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 20,
    padding: 18,
    background:
      "linear-gradient(135deg, rgba(30,64,175,0.18), rgba(37,99,235,0.11), rgba(255,255,255,0.02))",
    boxShadow: "0 12px 30px rgba(0,0,0,0.18)",
  },
  eyebrow: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: "0.22em",
    color: "rgba(125,211,252,0.9)",
    fontWeight: 700,
  },
  h1: {
    margin: "8px 0 0",
    fontSize: 34,
    lineHeight: 1.04,
    letterSpacing: -0.7,
    fontWeight: 900,
    color: "#ffffff",
  },
  heroText: {
    marginTop: 12,
    maxWidth: 760,
    fontSize: 15,
    lineHeight: 1.7,
    color: "rgba(226,232,240,0.9)",
  },
  badgeWrap: {
    marginTop: 14,
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },
  badge: {
    padding: "8px 12px",
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
    gap: 12,
  },
  statCard: {
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 18,
    padding: 15,
    background: "rgba(255,255,255,0.032)",
    boxShadow: "0 8px 20px rgba(0,0,0,0.12)",
    minHeight: 108,
  },
  statLabel: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: "0.18em",
    color: "rgba(148,163,184,0.88)",
    fontWeight: 700,
  },
  statValue: {
    marginTop: 10,
    fontSize: 28,
    fontWeight: 800,
    color: "#fff",
    lineHeight: 1.05,
  },
  statNote: {
    marginTop: 7,
    fontSize: 13,
    lineHeight: 1.45,
    color: "rgba(203,213,225,0.76)",
  },
  twoCol: {
    display: "grid",
    gridTemplateColumns: "1.08fr 0.92fr",
    gap: 14,
  },
  section: {
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 20,
    background: "rgba(255,255,255,0.03)",
    overflow: "hidden",
    boxShadow: "0 10px 24px rgba(0,0,0,0.14)",
  },
  sectionHead: {
    padding: "14px 16px",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 800,
    letterSpacing: -0.35,
    color: "#fff",
  },
  sectionSub: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: "0.18em",
    color: "rgba(148,163,184,0.75)",
    fontWeight: 700,
    marginBottom: 4,
  },
  sectionBody: {
    padding: 16,
  },
  summaryList: {
    display: "grid",
    gap: 10,
  },
  summaryItem: {
    border: "1px solid rgba(255,255,255,0.07)",
    background: "rgba(4,10,24,0.34)",
    borderRadius: 14,
    padding: "13px 14px",
    fontSize: 14,
    lineHeight: 1.6,
    color: "#dbe4f0",
  },
  chartShell: {
    height: 280,
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 16,
    background: "rgba(4,10,24,0.72)",
    padding: 12,
  },
  accountList: {
    display: "grid",
    gap: 12,
  },
  accountCard: {
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 16,
    padding: 14,
    background: "rgba(4,10,24,0.34)",
  },
  accountTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
    alignItems: "flex-start",
  },
  accountName: {
    fontSize: 17,
    fontWeight: 800,
    color: "#fff",
  },
  accountMeta: {
    marginTop: 4,
    fontSize: 13,
    color: "rgba(203,213,225,0.78)",
  },
  accountGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 10,
    marginTop: 12,
  },
  mini: {
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 14,
    padding: 12,
    background: "rgba(255,255,255,0.03)",
  },
  miniLabel: {
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: "0.16em",
    color: "rgba(148,163,184,0.86)",
    fontWeight: 700,
  },
  miniValue: {
    marginTop: 8,
    fontSize: 22,
    fontWeight: 800,
    color: "#fff",
  },
  tableWrap: {
    overflowX: "auto",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 16,
    background: "rgba(4,10,24,0.34)",
  },
  table: {
    width: "100%",
    minWidth: 760,
    borderCollapse: "collapse",
  },
  th: {
    textAlign: "left",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: "0.14em",
    color: "rgba(148,163,184,0.82)",
    padding: "13px 15px",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
  },
  td: {
    padding: "14px 15px",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
    fontSize: 14,
    color: "#dbe4f0",
    verticalAlign: "top",
  },
  emptyState: {
    minHeight: 180,
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
      graphiqForm: {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) auto",
  gap: 10,
},

graphiqInput: {
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

graphiqButton: {
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

graphiqHelp: {
  marginTop: 10,
  fontSize: 12,
  lineHeight: 1.5,
  color: "rgba(203,213,225,0.72)",
},

graphiqError: {
  marginTop: 12,
  border: "1px solid rgba(248,113,113,0.3)",
  borderRadius: 14,
  padding: "12px 14px",
  background: "rgba(127,29,29,0.2)",
  color: "#fecaca",
  fontSize: 13,
},

graphiqEmpty: {
  marginTop: 12,
  border: "1px dashed rgba(255,255,255,0.12)",
  borderRadius: 14,
  padding: 16,
  color: "rgba(226,232,240,0.76)",
  fontSize: 13,
  textAlign: "center",
},

graphiqResults: {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
  gap: 12,
  marginTop: 14,
},

graphiqCard: {
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 16,
  padding: 14,
  background: "rgba(4,10,24,0.46)",
},

graphiqCardTop: {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 12,
},

graphiqName: {
  fontSize: 17,
  fontWeight: 800,
  color: "#fff",
},

graphiqWebsite: {
  marginTop: 5,
  color: "#7dd3fc",
  fontSize: 12,
  overflowWrap: "anywhere",
},

graphiqSource: {
  border: "1px solid rgba(56,189,248,0.24)",
  borderRadius: 999,
  padding: "6px 9px",
  background: "rgba(56,189,248,0.1)",
  color: "#bae6fd",
  fontSize: 10,
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: "0.12em",
},

graphiqDescription: {
  marginTop: 12,
  fontSize: 13,
  lineHeight: 1.6,
  color: "rgba(226,232,240,0.82)",
},

graphiqTagSection: {
  marginTop: 13,
},

graphiqTagLabel: {
  marginBottom: 7,
  color: "rgba(148,163,184,0.88)",
  fontSize: 10,
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: "0.14em",
},

graphiqTags: {
  display: "flex",
  flexWrap: "wrap",
  gap: 6,
},

  graphiqTag: {
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 999,
    padding: "6px 9px",
    background: "rgba(255,255,255,0.04)",
    color: "#dbeafe",
    fontSize: 11,
  },
};
