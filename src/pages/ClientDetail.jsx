import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import OrgSwitcher from "../components/OrgSwitcher";
import { getClient, updateClient, deleteClient } from "../api";

const safe = (value) => (value == null ? "" : String(value));

const normalizeWebsite = (url) => {
  const value = safe(url).trim();
  if (!value) return "";
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  return `https://${value}`;
};

const domainFromWebsite = (url) => {
  try {
    const normalized = normalizeWebsite(url);
    if (!normalized) return "";
    return new URL(normalized).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
};

export default function ClientDetail() {
  const nav = useNavigate();
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [client, setClient] = useState(null);
  const [name, setName] = useState("");
  const [industry, setIndustry] = useState("");
  const [website, setWebsite] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [notes, setNotes] = useState("");

  const derived = useMemo(() => {
    const hasWebsite = Boolean(safe(website).trim());
    const hasOwner = Boolean(safe(ownerName).trim() || safe(ownerEmail).trim());
    const hasIndustry = Boolean(safe(industry).trim());
    const hasNotes = Boolean(safe(notes).trim());

    let engagementScore = 35;
    if (hasWebsite) engagementScore += 20;
    if (hasOwner) engagementScore += 20;
    if (hasIndustry) engagementScore += 10;
    if (hasNotes) engagementScore += 10;

    return {
      domain: domainFromWebsite(website),
      engagementScore,
      expansionProbability: Math.min(
        84,
        46 + (hasWebsite ? 10 : 0) + (hasOwner ? 10 : 0) + (hasNotes ? 8 : 0)
      ),
      accountReadiness: Math.min(
        100,
        (hasWebsite ? 25 : 0) +
          (hasOwner ? 25 : 0) +
          (hasIndustry ? 20 : 0) +
          (hasNotes ? 20 : 0) +
          10
      ),
    };
  }, [website, ownerName, ownerEmail, industry, notes]);

  async function load() {
    try {
      setLoading(true);
      setError("");
      const response = await getClient(id);
      const nextClient = response?.client || response;
      setClient(nextClient);
      setName(safe(nextClient?.name));
      setIndustry(safe(nextClient?.industry));
      setWebsite(safe(nextClient?.website));
      setOwnerName(safe(nextClient?.ownerName));
      setOwnerEmail(safe(nextClient?.ownerEmail));
      setNotes(safe(nextClient?.notes));
    } catch (loadError) {
      console.error(loadError);
      setError(loadError?.message || "Failed to load client");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function onSave(event) {
    event.preventDefault();
    setError("");
    if (!name.trim()) {
      setError("Client name is required.");
      return;
    }

    try {
      setSaving(true);
      await updateClient(id, {
        name: name.trim(),
        industry: industry.trim(),
        website: website.trim(),
        ownerName: ownerName.trim(),
        ownerEmail: ownerEmail.trim(),
        notes: notes.trim(),
      });
      await load();
    } catch (saveError) {
      console.error(saveError);
      setError(saveError?.message || "Failed to save client");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    setError("");
    if (!window.confirm("Delete this client? This cannot be undone.")) return;
    try {
      await deleteClient(id);
      nav("/clients");
    } catch (deleteError) {
      console.error(deleteError);
      setError(deleteError?.message || "Failed to delete client");
    }
  }

  const executiveSummary = !loading
    ? `Atlas Account Intelligence is currently focused on ${
        name || "this account"
      }. The current engagement score is ${derived.engagementScore}, estimated expansion probability is ${
        derived.expansionProbability
      }%, and account readiness is ${derived.accountReadiness}%. ${
        safe(notes).trim()
          ? "Additional account context has been captured in the notes field."
          : "Adding more account notes can improve strategic context and follow-up quality."
      }`
    : "Loading account intelligence profile…";

  return (
    <main style={styles.page}>
      <div style={styles.wrap}>
        <header style={styles.hero}>
          <div style={styles.heroTopRow}>
            <button type="button" onClick={() => nav("/clients")} style={styles.backButton}>
              <span aria-hidden="true">←</span> Accounts
            </button>
            <div style={styles.switcher}>
              <OrgSwitcher onSwitched={() => load()} />
            </div>
          </div>

          <div style={styles.heroContent}>
            <div>
              <div style={styles.eyebrow}>ACCOUNT INTELLIGENCE / CLIENT PROFILE</div>
              <h1 style={styles.title}>{client?.name || "Account Profile"}</h1>
              <p style={styles.subtitle}>
                A unified executive view of ownership, readiness, and expansion potential.
              </p>
            </div>
            <div style={styles.heroBadges}>
              <StatusBadge label="Profile active" color="#34d399" />
              <StatusBadge
                label={`${derived.accountReadiness}% ready`}
                color={scoreColor(derived.accountReadiness)}
              />
            </div>
          </div>
        </header>

        {error ? (
          <div style={styles.errorBanner} role="alert">
            <div>
              <div style={styles.errorTitle}>Account update needs attention</div>
              <div style={styles.errorText}>{error}</div>
            </div>
            {!loading ? (
              <button type="button" onClick={() => load()} style={styles.retryButton}>
                Retry
              </button>
            ) : null}
          </div>
        ) : null}

        <section style={styles.metricGrid} aria-label="Account intelligence summary">
          <MetricCard
            label="Engagement score"
            value={loading ? "—" : derived.engagementScore}
            detail="Profile signal quality"
            color={scoreColor(derived.engagementScore)}
            progress={derived.engagementScore}
          />
          <MetricCard
            label="Expansion probability"
            value={loading ? "—" : `${derived.expansionProbability}%`}
            detail="Estimated growth potential"
            color="#60a5fa"
            progress={derived.expansionProbability}
          />
          <MetricCard
            label="Account readiness"
            value={loading ? "—" : `${derived.accountReadiness}%`}
            detail="Record intelligence coverage"
            color={scoreColor(derived.accountReadiness)}
            progress={derived.accountReadiness}
          />
          <MetricCard
            label="Resolved domain"
            value={loading ? "—" : derived.domain || "Not set"}
            detail="Primary company identity"
            color="#a78bfa"
            compact
          />
        </section>

        <section style={styles.briefingCard}>
          <div style={styles.briefingAccent} />
          <div>
            <div style={styles.sectionEyebrow}>EXECUTIVE ACCOUNT BRIEFING</div>
            <p style={styles.briefingText}>{executiveSummary}</p>
          </div>
        </section>

        <section style={styles.panel}>
          <div style={styles.panelHeader}>
            <div>
              <div style={styles.sectionEyebrow}>ACCOUNT RECORD</div>
              <h2 style={styles.sectionTitle}>Company and ownership details</h2>
              <p style={styles.sectionDescription}>
                Keep the core record current so Atlas can produce stronger account intelligence.
              </p>
            </div>
            <div style={styles.headerStatus}>
              <span style={styles.statusDot} />
              {loading ? "Loading record" : "Record available"}
            </div>
          </div>

          <div style={styles.panelBody}>
            {loading ? (
              <LoadingState />
            ) : (
              <form onSubmit={onSave}>
                <div style={styles.formGridThree}>
                  <Field label="Client name" required>
                    <input
                      style={styles.input}
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder="Company name"
                    />
                  </Field>
                  <Field label="Industry">
                    <input
                      style={styles.input}
                      value={industry}
                      onChange={(event) => setIndustry(event.target.value)}
                      placeholder="Industry"
                    />
                  </Field>
                  <Field label="Website">
                    <input
                      style={styles.input}
                      value={website}
                      onChange={(event) => setWebsite(event.target.value)}
                      placeholder="https://company.com"
                    />
                  </Field>
                </div>

                <div style={styles.divider} />

                <div style={styles.formGridTwo}>
                  <Field label="Account owner">
                    <input
                      style={styles.input}
                      value={ownerName}
                      onChange={(event) => setOwnerName(event.target.value)}
                      placeholder="Owner name"
                    />
                  </Field>
                  <Field label="Owner email">
                    <input
                      type="email"
                      style={styles.input}
                      value={ownerEmail}
                      onChange={(event) => setOwnerEmail(event.target.value)}
                      placeholder="owner@company.com"
                    />
                  </Field>
                </div>

                <div style={{ marginTop: 16 }}>
                  <Field label="Strategic account notes">
                    <textarea
                      style={styles.textarea}
                      value={notes}
                      onChange={(event) => setNotes(event.target.value)}
                      placeholder="Add relationship context, priorities, risks, or next steps…"
                    />
                  </Field>
                </div>

                <div style={styles.formFooter}>
                  <div style={styles.footerNote}>
                    Changes update this account's shared intelligence profile.
                  </div>
                  <div style={styles.actions}>
                    <button type="button" style={styles.deleteButton} onClick={onDelete}>
                      Delete account
                    </button>
                    <button type="button" style={styles.secondaryButton} onClick={() => nav("/clients")}>
                      Cancel
                    </button>
                    <button type="submit" style={styles.primaryButton} disabled={saving}>
                      {saving ? "Saving…" : "Save changes"}
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function StatusBadge({ label, color }) {
  return (
    <div style={styles.badge}>
      <span style={{ ...styles.badgeDot, background: color, boxShadow: `0 0 12px ${color}` }} />
      {label}
    </div>
  );
}

function MetricCard({ label, value, detail, color, progress, compact = false }) {
  return (
    <article style={styles.metricCard}>
      <div style={styles.metricTopLine}>
        <span style={styles.metricLabel}>{label}</span>
        <span style={{ ...styles.metricIndicator, background: color }} />
      </div>
      <div style={{ ...styles.metricValue, ...(compact ? styles.metricValueCompact : {}) }}>{value}</div>
      <div style={styles.metricDetail}>{detail}</div>
      {typeof progress === "number" ? (
        <div style={styles.progressTrack}>
          <div
            style={{
              ...styles.progressFill,
              width: `${Math.max(0, Math.min(100, progress))}%`,
              background: color,
            }}
          />
        </div>
      ) : null}
    </article>
  );
}

function Field({ label, required = false, children }) {
  return (
    <label style={styles.field}>
      <span style={styles.label}>
        {label} {required ? <span style={styles.required}>*</span> : null}
      </span>
      {children}
    </label>
  );
}

function LoadingState() {
  return (
    <div style={styles.loadingState}>
      <div style={styles.loadingIcon}>A</div>
      <div>
        <div style={styles.loadingTitle}>Loading account intelligence</div>
        <div style={styles.loadingText}>Preparing the latest account record and profile signals.</div>
      </div>
    </div>
  );
}

function scoreColor(score) {
  if (score >= 75) return "#34d399";
  if (score >= 55) return "#fbbf24";
  return "#fb7185";
}

const border = "1px solid rgba(148, 163, 184, 0.14)";
const surface = "rgba(10, 15, 30, 0.78)";

const styles = {
  page: {
    minHeight: "100vh",
    padding: "14px 16px 24px",
    color: "#f8fafc",
    background:
      "radial-gradient(900px 500px at 15% 0%, rgba(37,99,235,0.18), transparent 55%), radial-gradient(900px 500px at 85% 0%, rgba(124,92,255,0.14), transparent 55%), linear-gradient(180deg, #050814 0%, #070b18 100%)",
  },
  wrap: { width: "100%", maxWidth: 1380, margin: "0 auto", display: "grid", gap: 12 },
  hero: {
    border,
    borderRadius: 20,
    padding: "18px 20px",
    background:
      "linear-gradient(120deg, rgba(15, 23, 42, 0.96), rgba(9, 14, 30, 0.92) 55%, rgba(30, 41, 70, 0.78))",
    boxShadow: "0 22px 60px rgba(0, 0, 0, 0.28)",
    overflow: "hidden",
  },
  heroTopRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
    flexWrap: "wrap",
    marginBottom: 18,
  },
  backButton: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    border: "none",
    background: "transparent",
    color: "#94a3b8",
    padding: 0,
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
  },
  switcher: { minWidth: 240, maxWidth: "100%" },
  heroContent: {
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 20,
    flexWrap: "wrap",
  },
  eyebrow: { color: "#60a5fa", fontSize: 10, lineHeight: 1, fontWeight: 900, letterSpacing: "0.18em" },
  title: { margin: "8px 0 0", fontSize: 28, lineHeight: 1.12, fontWeight: 850, letterSpacing: "-0.035em" },
  subtitle: { maxWidth: 650, margin: "8px 0 0", color: "#94a3b8", fontSize: 13, lineHeight: 1.6 },
  heroBadges: { display: "flex", gap: 8, flexWrap: "wrap" },
  badge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    minHeight: 30,
    padding: "0 11px",
    border,
    borderRadius: 999,
    color: "#cbd5e1",
    background: "rgba(15, 23, 42, 0.58)",
    fontSize: 11,
    fontWeight: 750,
  },
  badgeDot: { width: 6, height: 6, borderRadius: "50%" },
  errorBanner: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    flexWrap: "wrap",
    padding: "12px 14px",
    border: "1px solid rgba(251, 113, 133, 0.28)",
    borderRadius: 14,
    background: "rgba(127, 29, 29, 0.17)",
  },
  errorTitle: { color: "#fecdd3", fontWeight: 800, fontSize: 13 },
  errorText: { color: "#fda4af", fontSize: 12, marginTop: 3 },
  retryButton: {
    border: "1px solid rgba(251, 113, 133, 0.35)",
    borderRadius: 8,
    padding: "7px 11px",
    color: "#ffe4e6",
    background: "rgba(127, 29, 29, 0.22)",
    fontWeight: 800,
    cursor: "pointer",
  },
  metricGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 },
  metricCard: {
    minHeight: 134,
    padding: 15,
    border,
    borderRadius: 16,
    background: surface,
    boxShadow: "0 14px 34px rgba(0, 0, 0, 0.18)",
  },
  metricTopLine: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 },
  metricLabel: {
    color: "#94a3b8",
    fontSize: 10,
    fontWeight: 850,
    letterSpacing: "0.11em",
    textTransform: "uppercase",
  },
  metricIndicator: { width: 7, height: 7, borderRadius: "50%" },
  metricValue: { marginTop: 13, color: "#f8fafc", fontSize: 27, fontWeight: 850, lineHeight: 1, letterSpacing: "-0.035em" },
  metricValueCompact: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 19, lineHeight: 1.35 },
  metricDetail: { marginTop: 8, color: "#64748b", fontSize: 11 },
  progressTrack: { height: 3, marginTop: 13, borderRadius: 999, overflow: "hidden", background: "rgba(148, 163, 184, 0.13)" },
  progressFill: { height: "100%", borderRadius: 999 },
  briefingCard: {
    display: "grid",
    gridTemplateColumns: "3px 1fr",
    gap: 15,
    padding: "16px 18px",
    border,
    borderRadius: 16,
    background: "linear-gradient(110deg, rgba(37, 99, 235, 0.11), rgba(10, 15, 30, 0.8) 45%, rgba(124, 92, 255, 0.07))",
  },
  briefingAccent: { width: 3, minHeight: 55, borderRadius: 999, background: "linear-gradient(180deg, #60a5fa, #8b5cf6)" },
  sectionEyebrow: { color: "#60a5fa", fontSize: 9, fontWeight: 900, letterSpacing: "0.16em" },
  briefingText: { maxWidth: 1080, margin: "7px 0 0", color: "#cbd5e1", fontSize: 13, lineHeight: 1.65 },
  panel: { border, borderRadius: 18, overflow: "hidden", background: surface, boxShadow: "0 18px 48px rgba(0, 0, 0, 0.2)" },
  panelHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
    flexWrap: "wrap",
    padding: "12px 14px",
    borderBottom: border,
    background: "rgba(15, 23, 42, 0.48)",
  },
  sectionTitle: { margin: "5px 0 0", fontSize: 16, lineHeight: 1.25, fontWeight: 800, letterSpacing: "-0.015em" },
  sectionDescription: { margin: "5px 0 0", color: "#64748b", fontSize: 11, lineHeight: 1.5 },
  headerStatus: { display: "inline-flex", alignItems: "center", gap: 7, color: "#94a3b8", fontSize: 10, fontWeight: 750 },
  statusDot: { width: 6, height: 6, borderRadius: "50%", background: "#34d399" },
  panelBody: { padding: 14 },
  formGridThree: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14 },
  formGridTwo: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 },
  field: { display: "block", minWidth: 0 },
  label: {
    display: "block",
    marginBottom: 7,
    color: "#94a3b8",
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  required: { color: "#60a5fa" },
  input: {
    boxSizing: "border-box",
    width: "100%",
    height: 42,
    padding: "0 12px",
    border,
    borderRadius: 10,
    outline: "none",
    color: "#e2e8f0",
    background: "rgba(2, 6, 23, 0.58)",
    fontSize: 13,
  },
  textarea: {
    boxSizing: "border-box",
    width: "100%",
    minHeight: 112,
    padding: "11px 12px",
    border,
    borderRadius: 10,
    outline: "none",
    resize: "vertical",
    color: "#e2e8f0",
    background: "rgba(2, 6, 23, 0.58)",
    fontFamily: "inherit",
    fontSize: 13,
    lineHeight: 1.55,
  },
  divider: { height: 1, margin: "16px 0", background: "rgba(148, 163, 184, 0.1)" },
  formFooter: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    flexWrap: "wrap",
    marginTop: 18,
    paddingTop: 14,
    borderTop: border,
  },
  footerNote: { color: "#64748b", fontSize: 11 },
  actions: { display: "flex", gap: 8, flexWrap: "wrap" },
  primaryButton: {
    minHeight: 38,
    padding: "0 15px",
    border: "1px solid #2563eb",
    borderRadius: 9,
    color: "#ffffff",
    background: "#2563eb",
    boxShadow: "0 8px 22px rgba(37, 99, 235, 0.25)",
    fontSize: 12,
    fontWeight: 850,
    cursor: "pointer",
  },
  secondaryButton: {
    minHeight: 38,
    padding: "0 14px",
    border,
    borderRadius: 9,
    color: "#cbd5e1",
    background: "rgba(15, 23, 42, 0.72)",
    fontSize: 12,
    fontWeight: 800,
    cursor: "pointer",
  },
  deleteButton: {
    minHeight: 38,
    padding: "0 14px",
    border: "1px solid rgba(251, 113, 133, 0.25)",
    borderRadius: 9,
    color: "#fda4af",
    background: "rgba(127, 29, 29, 0.1)",
    fontSize: 12,
    fontWeight: 800,
    cursor: "pointer",
  },
  loadingState: { minHeight: 180, display: "flex", alignItems: "center", justifyContent: "center", gap: 13 },
  loadingIcon: {
    width: 34,
    height: 34,
    display: "grid",
    placeItems: "center",
    border: "1px solid rgba(96, 165, 250, 0.25)",
    borderRadius: 10,
    color: "#93c5fd",
    background: "rgba(37, 99, 235, 0.12)",
    fontSize: 12,
    fontWeight: 900,
  },
  loadingTitle: { fontSize: 13, fontWeight: 800 },
  loadingText: { marginTop: 4, color: "#64748b", fontSize: 11 },
};
