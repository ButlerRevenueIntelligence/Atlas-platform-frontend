// frontend/src/pages/Accounts.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import AccountForm from "../components/AccountForm.jsx";
import { getClients, createClient } from "../api";

export default function Accounts() {
  const nav = useNavigate();
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [q, setQ] = useState("");

  async function load() {
    try {
      setLoading(true);
      const res = await getClients();
      const items = Array.isArray(res?.clients) ? res.clients : Array.isArray(res) ? res : [];
      setAccounts(items);
    } catch (e) {
      console.error("Accounts load error:", e);
      alert(e?.message || "Failed to load accounts");
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return accounts;

    return accounts.filter((a) => {
      const name = (a?.name || "").toLowerCase();
      const industry = (a?.industry || "").toLowerCase();
      const website = (a?.website || "").toLowerCase();
      return name.includes(s) || industry.includes(s) || website.includes(s);
    });
  }, [accounts, q]);

  async function createAccount(payload) {
    try {
      setCreating(true);

      // AccountForm likely returns: { name, website, industry, ... }
      // Our backend expects the same for Client create.
      const res = await createClient(payload);

      // createClient returns the created client or { ok: true, client: ... } depending on backend
      // so just reload to be safe.
      await load();
      return res;
    } catch (e) {
      console.error("Create account error:", e);
      alert(e?.message || "Failed to create account");
    } finally {
      setCreating(false);
    }
  }

  return (
    <>
      <style>{`
        .accounts-create-panel form {
          border: 0 !important;
          border-radius: 0 !important;
          padding: 0 !important;
          background: transparent !important;
        }

        .accounts-create-panel input,
        .accounts-create-panel textarea {
          border: 1px solid rgba(255,255,255,0.10) !important;
          background: rgba(4,10,24,0.72) !important;
          color: #ffffff !important;
        }

        .accounts-create-panel button {
          border: 1px solid rgba(96,165,250,0.34) !important;
          background: #2563eb !important;
          color: #ffffff !important;
          font-weight: 800 !important;
        }

        @media (max-width: 720px) {
          .accounts-hero-top {
            display: block !important;
          }

          .accounts-hero-actions {
            margin-top: 14px;
            justify-content: flex-start !important;
          }

          .accounts-search {
            min-width: 0 !important;
            width: 100% !important;
          }
        }
      `}</style>

      <div style={styles.page}>
        <div style={styles.wrap}>
          <header style={styles.hero}>
            <div className="accounts-hero-top" style={styles.heroTop}>
              <div>
                <div style={styles.eyebrow}>Account Intelligence Foundation</div>
                <h1 style={styles.h1}>Accounts</h1>
                <div style={styles.heroText}>
                  Organize the companies in your revenue ecosystem and open a
                  complete intelligence view for every account.
                </div>
              </div>

              <div className="accounts-hero-actions" style={styles.heroActions}>
                <div style={styles.badge}>{accounts.length} tracked</div>
                <input
                  className="accounts-search"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search accounts..."
                  style={styles.search}
                />
              </div>
            </div>
          </header>

          <section style={styles.section}>
            <div style={styles.sectionHead}>
              <div>
                <div style={styles.sectionSub}>Workspace Record</div>
                <div style={styles.sectionTitle}>Create Account</div>
              </div>
            </div>
            <div className="accounts-create-panel" style={styles.sectionBody}>
              <AccountForm onSubmit={createAccount} submitting={creating} />
            </div>
          </section>

          <section style={styles.section}>
            <div style={styles.sectionHead}>
              <div>
                <div style={styles.sectionSub}>Account Directory</div>
                <div style={styles.sectionTitle}>Tracked Companies</div>
              </div>
              <div style={styles.sectionTag}>{filtered.length} shown</div>
            </div>

            <div style={styles.sectionBody}>
              {loading ? (
                <div style={styles.emptyState}>Loading account records...</div>
              ) : filtered.length === 0 ? (
                <div style={styles.emptyState}>
                  {q.trim()
                    ? "No accounts match your search."
                    : "No accounts yet. Create your first one above."}
                </div>
              ) : (
                <div style={styles.grid}>
                  {filtered.map((account) => {
                    const accountName = account.name || "Untitled Account";
                    const initials = accountName
                      .split(" ")
                      .filter(Boolean)
                      .slice(0, 2)
                      .map((word) => word[0])
                      .join("")
                      .toUpperCase();

                    return (
                      <button
                        key={account._id || account.id}
                        onClick={() => nav(`/accounts/${account._id || account.id}`)}
                        style={styles.accountCard}
                      >
                        <div style={styles.cardTop}>
                          <div style={styles.companyIcon}>{initials || "A"}</div>
                          <div style={styles.openLabel}>Open account →</div>
                        </div>
                        <div style={styles.accountName}>{accountName}</div>
                        <div style={styles.accountIndustry}>
                          {account.industry || "Industry not specified"}
                        </div>
                        <div style={styles.accountWebsite}>
                          {account.website || "No website added"}
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
    </>
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
  heroActions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 8,
    flexWrap: "wrap",
    alignItems: "center",
  },
  badge: {
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.05)",
    fontSize: 11,
    fontWeight: 700,
    color: "#e2e8f0",
  },
  search: {
    minWidth: 260,
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(4,10,24,0.72)",
    color: "#ffffff",
    outline: "none",
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
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: "0.16em",
    color: "rgba(148,163,184,0.75)",
    fontWeight: 700,
    marginBottom: 4,
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
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: 12,
  },
  accountCard: {
    minHeight: 150,
    textAlign: "left",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 16,
    padding: 14,
    background: "rgba(4,10,24,0.46)",
    color: "inherit",
    cursor: "pointer",
  },
  cardTop: {
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
  accountName: {
    fontWeight: 800,
    fontSize: 16,
    color: "#ffffff",
  },
  accountIndustry: {
    color: "rgba(203,213,225,0.78)",
    fontSize: 12,
    marginTop: 6,
  },
  accountWebsite: {
    color: "rgba(148,163,184,0.72)",
    fontSize: 12,
    marginTop: 4,
    overflowWrap: "anywhere",
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
};
