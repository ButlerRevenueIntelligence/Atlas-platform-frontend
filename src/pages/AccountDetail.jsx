import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiGet } from "../api";

export default function AccountDetail() {
  const { id } = useParams(); // matches /accounts/:id
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [account, setAccount] = useState(null);
  const [clients, setClients] = useState([]);
  const [error, setError] = useState("");

  async function load() {
    try {
      setLoading(true);
      setError("");

      // Load account (client used as account container)
      const res = await apiGet(`/clients/${id}`);
      const acc =
        res?.client || res?.data || res;

      if (!acc) {
        throw new Error("Account not found");
      }

      setAccount(acc);

      // Load clients under same org
      const listRes = await apiGet(`/clients?orgId=${id}`);
      const rows =
        listRes?.clients ||
        listRes?.data ||
        listRes ||
        [];

      setClients(Array.isArray(rows) ? rows : []);
    } catch (e) {
      console.error(e);
      setError(e.message || "Failed to load account.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!id) return;
    load();
  }, [id]);

  if (loading) {
    return (
      <div style={styles.page}>
        <div style={styles.wrap}>
          <div style={styles.stateCard}>Loading account intelligence…</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.page}>
        <div style={styles.wrap}>
          <div style={styles.errorCard}>
            <div style={styles.stateTitle}>Account could not be loaded</div>
            <div style={styles.errorText}>{error}</div>
            <div style={styles.actionRow}>
              <button type="button" onClick={() => navigate(-1)} style={styles.secondaryButton}>
                ← Back
              </button>
              <button type="button" onClick={load} style={styles.primaryButton}>
                Try Again
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!account) {
    return (
      <div style={styles.page}>
        <div style={styles.wrap}>
          <div style={styles.stateCard}>Account not found.</div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.wrap}>
        <header style={styles.hero}>
          <div style={styles.heroTop}>
            <div>
              <button type="button" onClick={() => navigate(-1)} style={styles.backButton}>
                ← Accounts
              </button>
              <div style={styles.eyebrow}>Account Intelligence Workspace</div>
              <h1 style={styles.h1}>{account.name || "Untitled Account"}</h1>
              <div style={styles.heroText}>
                Review the account profile and open the client records connected
                to this company.
              </div>
            </div>

            <div style={styles.badgeWrap}>
              <div style={styles.badge}>Account Active</div>
              <div style={styles.badge}>{clients.length} clients linked</div>
            </div>
          </div>
        </header>

        <section style={styles.statsGrid}>
          <StatCard
            label="Linked Clients"
            value={clients.length}
            note="Client records currently associated with this account."
          />
          <StatCard
            label="Industry"
            value={account.industry || "Not specified"}
            note="Primary market classification for this account."
            compact
          />
          <StatCard
            label="Website"
            value={account.website || "Not added"}
            note="Primary company website stored in Atlas."
            compact
          />
        </section>

        <section style={styles.section}>
          <div style={styles.sectionHead}>
            <div>
              <div style={styles.sectionSub}>Relationship Directory</div>
              <div style={styles.sectionTitle}>Clients</div>
            </div>
            <div style={styles.sectionTag}>{clients.length} total</div>
          </div>

          <div style={styles.sectionBody}>
            {clients.length === 0 ? (
              <div style={styles.emptyState}>
                No clients are connected to this account yet.
              </div>
            ) : (
              <div style={styles.clientGrid}>
                {clients.map((client) => {
                  const clientName = client.name || "Untitled Client";
                  const initials = clientName
                    .split(" ")
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((word) => word[0])
                    .join("")
                    .toUpperCase();

                  return (
                    <button
                      type="button"
                      key={client._id}
                      style={styles.clientCard}
                      onClick={() => navigate(`/clients/${client._id}`)}
                    >
                      <div style={styles.clientTop}>
                        <div style={styles.companyIcon}>{initials || "C"}</div>
                        <div style={styles.openLabel}>Open client →</div>
                      </div>
                      <div style={styles.clientName}>{clientName}</div>
                      <div style={styles.clientIndustry}>
                        {client.industry || "Industry not specified"}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function StatCard({ label, value, note, compact = false }) {
  return (
    <div style={styles.statCard}>
      <div style={styles.statLabel}>{label}</div>
      <div
        style={{
          ...styles.statValue,
          ...(compact ? styles.statValueCompact : {}),
        }}
      >
        {value}
      </div>
      <div style={styles.statNote}>{note}</div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    padding: "14px 16px 24px",
    color: "#EAF0FF",
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
  backButton: {
    marginBottom: 14,
    padding: "8px 11px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.04)",
    color: "#dbeafe",
    fontSize: 12,
    fontWeight: 800,
    cursor: "pointer",
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
    maxWidth: 720,
    fontSize: 14,
    lineHeight: 1.55,
    color: "rgba(226,232,240,0.90)",
  },
  badgeWrap: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },
  badge: {
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.05)",
    color: "#e2e8f0",
    fontSize: 11,
    fontWeight: 700,
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 10,
  },
  statCard: {
    minHeight: 126,
    borderRadius: 16,
    padding: "14px 14px 13px",
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(10,16,35,0.40)",
    boxShadow: "0 10px 24px rgba(0,0,0,0.14)",
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
    color: "#ffffff",
    lineHeight: 1.05,
    overflowWrap: "anywhere",
  },
  statValueCompact: {
    fontSize: 18,
    lineHeight: 1.25,
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
    color: "#ffffff",
  },
  sectionSub: {
    marginBottom: 4,
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: "0.16em",
    color: "rgba(148,163,184,0.75)",
    fontWeight: 700,
  },
  sectionTag: {
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.05)",
    color: "#e2e8f0",
    fontSize: 11,
    fontWeight: 800,
  },
  sectionBody: {
    padding: 14,
  },
  clientGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: 12,
  },
  clientCard: {
    minHeight: 140,
    padding: 14,
    textAlign: "left",
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(4,10,24,0.46)",
    color: "inherit",
    cursor: "pointer",
  },
  clientTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  companyIcon: {
    width: 38,
    height: 38,
    display: "grid",
    placeItems: "center",
    borderRadius: 11,
    background: "rgba(37,99,235,0.18)",
    color: "#bfdbfe",
    fontSize: 12,
    fontWeight: 900,
  },
  openLabel: {
    color: "#93c5fd",
    fontSize: 11,
    fontWeight: 800,
  },
  clientName: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: 800,
  },
  clientIndustry: {
    marginTop: 6,
    color: "rgba(203,213,225,0.76)",
    fontSize: 12,
  },
  emptyState: {
    minHeight: 130,
    border: "1px dashed rgba(255,255,255,0.12)",
    borderRadius: 14,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
    color: "rgba(226,232,240,0.76)",
    fontSize: 13,
    textAlign: "center",
    background: "rgba(4,10,24,0.34)",
  },
  stateCard: {
    marginTop: 40,
    padding: 24,
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.03)",
    color: "#ffffff",
    fontSize: 18,
    fontWeight: 800,
    textAlign: "center",
  },
  errorCard: {
    marginTop: 40,
    padding: 20,
    borderRadius: 18,
    border: "1px solid rgba(248,113,113,0.28)",
    background: "rgba(127,29,29,0.16)",
  },
  stateTitle: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: 900,
  },
  errorText: {
    marginTop: 8,
    color: "#fecaca",
    fontSize: 13,
  },
  actionRow: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    marginTop: 14,
  },
  primaryButton: {
    padding: "10px 14px",
    borderRadius: 10,
    border: "1px solid rgba(96,165,250,0.34)",
    background: "#2563eb",
    color: "#ffffff",
    fontWeight: 800,
    cursor: "pointer",
  },
  secondaryButton: {
    padding: "10px 14px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.05)",
    color: "#ffffff",
    fontWeight: 800,
    cursor: "pointer",
  },
};
