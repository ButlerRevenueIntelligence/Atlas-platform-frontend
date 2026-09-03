// frontend/src/pages/Partners.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  archivePartner,
  createPartner,
  getPartners,
  updatePartner,
} from "../api";

const EMPTY_FORM = {
  companyName: "",
  contactName: "",
  email: "",
  partnershipType: "referral",
  status: "active",
  referredOpportunities: 0,
  influencedPipeline: 0,
  revenueGenerated: 0,
  notes: "",
};

const TYPE_LABELS = {
  referral: "Referral",
  reseller: "Reseller",
  technology: "Technology",
  strategic: "Strategic",
  affiliate: "Affiliate",
  agency: "Agency",
  other: "Other",
};

const STATUS_LABELS = {
  active: "Active",
  prospective: "Prospective",
  inactive: "Inactive",
};

export default function Partners() {
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPartner, setEditingPartner] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  async function loadPartners() {
    try {
      setLoading(true);
      setError("");

      const response = await getPartners();

      const rows = Array.isArray(response?.partners)
        ? response.partners
        : Array.isArray(response)
        ? response
        : [];

      setPartners(rows);
    } catch (err) {
      setError(err?.message || "We couldn't load the partner records.");
      setPartners([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPartners();
  }, []);

  const filteredPartners = useMemo(() => {
    const search = query.trim().toLowerCase();

    return partners.filter((partner) => {
      const matchesStatus =
        statusFilter === "all" || partner.status === statusFilter;

      const matchesSearch =
        !search ||
        String(partner.companyName || "")
          .toLowerCase()
          .includes(search) ||
        String(partner.contactName || "")
          .toLowerCase()
          .includes(search) ||
        String(partner.email || "")
          .toLowerCase()
          .includes(search) ||
        String(TYPE_LABELS[partner.partnershipType] || "")
          .toLowerCase()
          .includes(search);

      return matchesStatus && matchesSearch;
    });
  }, [partners, query, statusFilter]);

  const stats = useMemo(() => {
    return partners.reduce(
      (totals, partner) => {
        totals.total += 1;

        if (partner.status === "active") {
          totals.active += 1;
        }

        totals.opportunities += Number(
          partner.referredOpportunities || 0
        );

        totals.pipeline += Number(partner.influencedPipeline || 0);
        totals.revenue += Number(partner.revenueGenerated || 0);

        return totals;
      },
      {
        total: 0,
        active: 0,
        opportunities: 0,
        pipeline: 0,
        revenue: 0,
      }
    );
  }, [partners]);

  function openCreateModal() {
    setEditingPartner(null);
    setForm(EMPTY_FORM);
    setError("");
    setModalOpen(true);
  }

  function openEditModal(partner) {
    setEditingPartner(partner);

    setForm({
      companyName: partner.companyName || "",
      contactName: partner.contactName || "",
      email: partner.email || "",
      partnershipType: partner.partnershipType || "referral",
      status: partner.status || "active",
      referredOpportunities: partner.referredOpportunities || 0,
      influencedPipeline: partner.influencedPipeline || 0,
      revenueGenerated: partner.revenueGenerated || 0,
      notes: partner.notes || "",
    });

    setError("");
    setModalOpen(true);
  }

  function closeModal() {
    if (saving) return;

    setModalOpen(false);
    setEditingPartner(null);
    setForm(EMPTY_FORM);
  }

  function updateField(event) {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!form.companyName.trim()) {
      setError("Enter the partner company name.");
      return;
    }

    const payload = {
      companyName: form.companyName.trim(),
      contactName: form.contactName.trim(),
      email: form.email.trim(),
      partnershipType: form.partnershipType,
      status: form.status,
      referredOpportunities: Number(form.referredOpportunities) || 0,
      influencedPipeline: Number(form.influencedPipeline) || 0,
      revenueGenerated: Number(form.revenueGenerated) || 0,
      notes: form.notes.trim(),
    };

    try {
      setSaving(true);
      setError("");

      if (editingPartner) {
        const response = await updatePartner(
          editingPartner._id,
          payload
        );

        setPartners((current) =>
          current.map((partner) =>
            partner._id === editingPartner._id
              ? response.partner
              : partner
          )
        );
      } else {
        const response = await createPartner(payload);

        setPartners((current) => [
          response.partner,
          ...current,
        ]);
      }

      closeModal();
    } catch (err) {
      if (err?.status === 403) {
        setError(
          "Only a workspace owner or admin can manage partners."
        );
      } else {
        setError(err?.message || "We couldn't save this partner.");
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleArchive(partner) {
    const confirmed = window.confirm(
      `Archive ${partner.companyName}? The partner will be removed from this workspace view.`
    );

    if (!confirmed) return;

    try {
      setError("");
      await archivePartner(partner._id);

      setPartners((current) =>
        current.filter((item) => item._id !== partner._id)
      );
    } catch (err) {
      if (err?.status === 403) {
        setError(
          "Only a workspace owner or admin can archive partners."
        );
      } else {
        setError(err?.message || "We couldn't archive this partner.");
      }
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <section style={styles.hero}>
          <div>
            <div style={styles.eyebrow}>Partner ecosystem</div>

            <h1 style={styles.title}>Partner Intelligence</h1>

            <p style={styles.subtitle}>
              Track the companies helping influence pipeline and
              generate revenue across this workspace.
            </p>
          </div>

          <div style={styles.heroActions}>
            <button
              type="button"
              onClick={loadPartners}
              disabled={loading}
              style={styles.secondaryButton}
            >
              {loading ? "Refreshing..." : "Refresh"}
            </button>

            <button
              type="button"
              onClick={openCreateModal}
              style={styles.primaryButton}
            >
              + Add Partner
            </button>
          </div>
        </section>

        {error && !modalOpen ? (
          <div style={styles.error}>{error}</div>
        ) : null}

        <section style={styles.statsGrid}>
          <MetricCard
            label="Total Partners"
            value={stats.total}
            detail={`${stats.active} currently active`}
          />

          <MetricCard
            label="Referred Opportunities"
            value={stats.opportunities}
            detail="Opportunities referred by partners"
          />

          <MetricCard
            label="Influenced Pipeline"
            value={formatCurrency(stats.pipeline)}
            detail="Open pipeline influenced by partners"
          />

          <MetricCard
            label="Revenue Generated"
            value={formatCurrency(stats.revenue)}
            detail="Closed revenue attributed to partners"
          />
        </section>

        <section style={styles.partnerSection}>
          <div style={styles.sectionHeader}>
            <div>
              <div style={styles.sectionEyebrow}>Workspace records</div>
              <h2 style={styles.sectionTitle}>Partners</h2>
            </div>

            <div style={styles.filters}>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search partners..."
                style={styles.search}
              />

              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value)
                }
                style={styles.select}
              >
                <option value="all">All statuses</option>
                <option value="active">Active</option>
                <option value="prospective">Prospective</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div style={styles.emptyState}>
              Loading partner records...
            </div>
          ) : null}

          {!loading && partners.length === 0 ? (
            <div style={styles.emptyState}>
              <div style={styles.emptyIcon}>↗</div>
              <h3 style={styles.emptyTitle}>No partners added yet</h3>
              <p style={styles.emptyText}>
                Add the first partner to begin tracking referrals,
                influenced pipeline, and partner-generated revenue.
              </p>

              <button
                type="button"
                onClick={openCreateModal}
                style={styles.primaryButton}
              >
                + Add First Partner
              </button>
            </div>
          ) : null}

          {!loading &&
          partners.length > 0 &&
          filteredPartners.length === 0 ? (
            <div style={styles.emptyState}>
              No partners match your search or filter.
            </div>
          ) : null}

          {!loading && filteredPartners.length > 0 ? (
            <div style={styles.partnerList}>
              {filteredPartners.map((partner) => (
                <PartnerCard
                  key={partner._id}
                  partner={partner}
                  onEdit={() => openEditModal(partner)}
                  onArchive={() => handleArchive(partner)}
                />
              ))}
            </div>
          ) : null}
        </section>
      </div>

      {modalOpen ? (
        <PartnerModal
          form={form}
          editing={Boolean(editingPartner)}
          saving={saving}
          error={error}
          onChange={updateField}
          onClose={closeModal}
          onSubmit={handleSubmit}
        />
      ) : null}
    </div>
  );
}

function MetricCard({ label, value, detail }) {
  return (
    <div style={styles.metricCard}>
      <div style={styles.metricLabel}>{label}</div>
      <div style={styles.metricValue}>{value}</div>
      <div style={styles.metricDetail}>{detail}</div>
    </div>
  );
}

function PartnerCard({ partner, onEdit, onArchive }) {
  return (
    <article style={styles.partnerCard}>
      <div style={styles.partnerMain}>
        <div style={styles.companyIcon}>
          {getInitials(partner.companyName)}
        </div>

        <div style={styles.partnerIdentity}>
          <div style={styles.partnerTitleRow}>
            <h3 style={styles.companyName}>
              {partner.companyName}
            </h3>

            <StatusBadge status={partner.status} />

            <span style={styles.typeBadge}>
              {TYPE_LABELS[partner.partnershipType] || "Other"}
            </span>
          </div>

          <div style={styles.contactLine}>
            {partner.contactName || "No primary contact"}

            {partner.email ? (
              <>
                <span style={styles.dot}>•</span>
                <a
                  href={`mailto:${partner.email}`}
                  style={styles.emailLink}
                >
                  {partner.email}
                </a>
              </>
            ) : null}
          </div>

          {partner.notes ? (
            <div style={styles.notes}>{partner.notes}</div>
          ) : null}
        </div>
      </div>

      <div style={styles.partnerMetrics}>
        <SmallMetric
          label="Opportunities"
          value={Number(partner.referredOpportunities || 0)}
        />

        <SmallMetric
          label="Pipeline"
          value={formatCurrency(partner.influencedPipeline)}
        />

        <SmallMetric
          label="Revenue"
          value={formatCurrency(partner.revenueGenerated)}
        />
      </div>

      <div style={styles.cardActions}>
        <button
          type="button"
          onClick={onEdit}
          style={styles.editButton}
        >
          Edit
        </button>

        <button
          type="button"
          onClick={onArchive}
          style={styles.archiveButton}
        >
          Archive
        </button>
      </div>
    </article>
  );
}

function SmallMetric({ label, value }) {
  return (
    <div style={styles.smallMetric}>
      <div style={styles.smallMetricLabel}>{label}</div>
      <div style={styles.smallMetricValue}>{value}</div>
    </div>
  );
}

function StatusBadge({ status }) {
  const colors = {
    active: {
      color: "#86efac",
      background: "rgba(34,197,94,0.12)",
      border: "1px solid rgba(34,197,94,0.25)",
    },
    prospective: {
      color: "#93c5fd",
      background: "rgba(59,130,246,0.12)",
      border: "1px solid rgba(59,130,246,0.25)",
    },
    inactive: {
      color: "#cbd5e1",
      background: "rgba(148,163,184,0.10)",
      border: "1px solid rgba(148,163,184,0.20)",
    },
  };

  return (
    <span
      style={{
        ...styles.statusBadge,
        ...(colors[status] || colors.inactive),
      }}
    >
      {STATUS_LABELS[status] || "Inactive"}
    </span>
  );
}

function PartnerModal({
  form,
  editing,
  saving,
  error,
  onChange,
  onClose,
  onSubmit,
}) {
  return (
    <div style={styles.modalOverlay} onMouseDown={onClose}>
      <div
        style={styles.modal}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div style={styles.modalHeader}>
          <div>
            <div style={styles.sectionEyebrow}>
              {editing ? "Update record" : "New relationship"}
            </div>

            <h2 style={styles.modalTitle}>
              {editing ? "Edit Partner" : "Add Partner"}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            style={styles.closeButton}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <form onSubmit={onSubmit}>
          <div style={styles.formBody}>
            {error ? <div style={styles.error}>{error}</div> : null}

            <div style={styles.twoColumnForm}>
              <FormField label="Partner company *">
                <input
                  name="companyName"
                  value={form.companyName}
                  onChange={onChange}
                  placeholder="Example: GraphIQ"
                  maxLength={150}
                  required
                  style={styles.input}
                />
              </FormField>

              <FormField label="Primary contact">
                <input
                  name="contactName"
                  value={form.contactName}
                  onChange={onChange}
                  placeholder="Contact name"
                  maxLength={120}
                  style={styles.input}
                />
              </FormField>

              <FormField label="Email">
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={onChange}
                  placeholder="contact@company.com"
                  maxLength={200}
                  style={styles.input}
                />
              </FormField>

              <FormField label="Partnership type">
                <select
                  name="partnershipType"
                  value={form.partnershipType}
                  onChange={onChange}
                  style={styles.input}
                >
                  <option value="referral">Referral</option>
                  <option value="reseller">Reseller</option>
                  <option value="technology">Technology</option>
                  <option value="strategic">Strategic</option>
                  <option value="affiliate">Affiliate</option>
                  <option value="agency">Agency</option>
                  <option value="other">Other</option>
                </select>
              </FormField>

              <FormField label="Status">
                <select
                  name="status"
                  value={form.status}
                  onChange={onChange}
                  style={styles.input}
                >
                  <option value="active">Active</option>
                  <option value="prospective">Prospective</option>
                  <option value="inactive">Inactive</option>
                </select>
              </FormField>

              <FormField label="Referred opportunities">
                <input
                  type="number"
                  name="referredOpportunities"
                  value={form.referredOpportunities}
                  onChange={onChange}
                  min="0"
                  step="1"
                  style={styles.input}
                />
              </FormField>

              <FormField label="Influenced pipeline">
                <input
                  type="number"
                  name="influencedPipeline"
                  value={form.influencedPipeline}
                  onChange={onChange}
                  min="0"
                  step="0.01"
                  placeholder="0"
                  style={styles.input}
                />
              </FormField>

              <FormField label="Revenue generated">
                <input
                  type="number"
                  name="revenueGenerated"
                  value={form.revenueGenerated}
                  onChange={onChange}
                  min="0"
                  step="0.01"
                  placeholder="0"
                  style={styles.input}
                />
              </FormField>
            </div>

            <FormField label="Notes">
              <textarea
                name="notes"
                value={form.notes}
                onChange={onChange}
                placeholder="Add context about this partnership..."
                maxLength={3000}
                rows={4}
                style={{
                  ...styles.input,
                  resize: "vertical",
                  minHeight: 100,
                }}
              />
            </FormField>
          </div>

          <div style={styles.modalFooter}>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              style={styles.secondaryButton}
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving}
              style={{
                ...styles.primaryButton,
                opacity: saving ? 0.65 : 1,
              }}
            >
              {saving
                ? "Saving..."
                : editing
                ? "Save Changes"
                : "Add Partner"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function FormField({ label, children }) {
  return (
    <label style={styles.field}>
      <span style={styles.fieldLabel}>{label}</span>
      {children}
    </label>
  );
}

function formatCurrency(value) {
  const number = Number(value) || 0;

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(number);
}

function getInitials(companyName) {
  return String(companyName || "P")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

const styles = {
  page: {
    minHeight: "100vh",
    padding: "18px 16px 36px",
    color: "#eaf0ff",
    background:
      "radial-gradient(900px 500px at 15% 0%, rgba(37,99,235,0.16), transparent 55%), linear-gradient(180deg, #050814 0%, #070b18 100%)",
  },

  container: {
    width: "100%",
    maxWidth: 1380,
    margin: "0 auto",
    display: "grid",
    gap: 14,
  },

  hero: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    flexWrap: "wrap",
    gap: 18,
    padding: "22px",
    borderRadius: 20,
    border: "1px solid rgba(255,255,255,0.08)",
    background:
      "linear-gradient(135deg, rgba(30,64,175,0.18), rgba(124,92,255,0.08), rgba(255,255,255,0.02))",
  },

  eyebrow: {
    fontSize: 10,
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: "0.18em",
    color: "#7dd3fc",
  },

  title: {
    margin: "7px 0 0",
    fontSize: 30,
    lineHeight: 1.1,
    color: "#ffffff",
  },

  subtitle: {
    maxWidth: 680,
    margin: "9px 0 0",
    color: "rgba(226,232,240,0.78)",
    fontSize: 14,
    lineHeight: 1.55,
  },

  heroActions: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },

  primaryButton: {
    minHeight: 41,
    padding: "10px 16px",
    border: "1px solid rgba(96,165,250,0.55)",
    borderRadius: 11,
    background:
      "linear-gradient(135deg, #2563eb, #4f46e5)",
    color: "#ffffff",
    fontSize: 13,
    fontWeight: 800,
    cursor: "pointer",
  },

  secondaryButton: {
    minHeight: 41,
    padding: "10px 15px",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 11,
    background: "rgba(255,255,255,0.045)",
    color: "#eaf0ff",
    fontSize: 13,
    fontWeight: 750,
    cursor: "pointer",
  },

  error: {
    padding: "11px 13px",
    borderRadius: 11,
    border: "1px solid rgba(248,113,113,0.30)",
    background: "rgba(127,29,29,0.22)",
    color: "#fecaca",
    fontSize: 13,
    lineHeight: 1.5,
  },

  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
    gap: 11,
  },

  metricCard: {
    minHeight: 112,
    padding: 16,
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.032)",
  },

  metricLabel: {
    color: "rgba(148,163,184,0.88)",
    fontSize: 10,
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: "0.13em",
  },

  metricValue: {
    marginTop: 10,
    color: "#ffffff",
    fontSize: 25,
    fontWeight: 900,
  },

  metricDetail: {
    marginTop: 7,
    color: "rgba(203,213,225,0.68)",
    fontSize: 12,
    lineHeight: 1.4,
  },

  partnerSection: {
    overflow: "hidden",
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.025)",
  },

  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 14,
    padding: "16px",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
  },

  sectionEyebrow: {
    marginBottom: 4,
    color: "rgba(148,163,184,0.75)",
    fontSize: 9,
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: "0.16em",
  },

  sectionTitle: {
    margin: 0,
    color: "#ffffff",
    fontSize: 20,
  },

  filters: {
    display: "flex",
    gap: 9,
    flexWrap: "wrap",
  },

  search: {
    minWidth: 230,
    padding: "10px 12px",
    border: "1px solid rgba(255,255,255,0.11)",
    borderRadius: 10,
    outline: "none",
    background: "rgba(0,0,0,0.24)",
    color: "#ffffff",
  },

  select: {
    padding: "10px 12px",
    border: "1px solid rgba(255,255,255,0.11)",
    borderRadius: 10,
    outline: "none",
    background: "#0b1020",
    color: "#ffffff",
  },

  emptyState: {
    padding: "55px 20px",
    textAlign: "center",
    color: "rgba(203,213,225,0.76)",
  },

  emptyIcon: {
    width: 45,
    height: 45,
    margin: "0 auto 14px",
    display: "grid",
    placeItems: "center",
    borderRadius: 13,
    border: "1px solid rgba(96,165,250,0.24)",
    background: "rgba(37,99,235,0.10)",
    color: "#93c5fd",
    fontSize: 23,
  },

  emptyTitle: {
    margin: 0,
    color: "#ffffff",
    fontSize: 18,
  },

  emptyText: {
    maxWidth: 490,
    margin: "9px auto 18px",
    fontSize: 13,
    lineHeight: 1.6,
  },

  partnerList: {
    display: "grid",
    gap: 10,
    padding: 14,
  },

  partnerCard: {
    display: "grid",
    gridTemplateColumns: "minmax(250px, 1.5fr) minmax(300px, 1fr) auto",
    alignItems: "center",
    gap: 18,
    padding: 15,
    border: "1px solid rgba(255,255,255,0.075)",
    borderRadius: 15,
    background: "rgba(3,8,20,0.38)",
  },

  partnerMain: {
    display: "flex",
    alignItems: "flex-start",
    gap: 12,
    minWidth: 0,
  },

  companyIcon: {
    width: 42,
    height: 42,
    flex: "0 0 42px",
    display: "grid",
    placeItems: "center",
    borderRadius: 12,
    background:
      "linear-gradient(135deg, rgba(37,99,235,0.28), rgba(79,70,229,0.22))",
    color: "#bfdbfe",
    fontSize: 13,
    fontWeight: 900,
  },

  partnerIdentity: {
    minWidth: 0,
  },

  partnerTitleRow: {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 7,
  },

  companyName: {
    margin: 0,
    color: "#ffffff",
    fontSize: 16,
  },

  statusBadge: {
    padding: "4px 8px",
    borderRadius: 999,
    fontSize: 10,
    fontWeight: 800,
  },

  typeBadge: {
    padding: "4px 8px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.09)",
    background: "rgba(255,255,255,0.045)",
    color: "#cbd5e1",
    fontSize: 10,
    fontWeight: 750,
  },

  contactLine: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 6,
    marginTop: 7,
    color: "rgba(203,213,225,0.72)",
    fontSize: 12,
  },

  dot: {
    color: "rgba(148,163,184,0.55)",
  },

  emailLink: {
    color: "#93c5fd",
    textDecoration: "none",
  },

  notes: {
    maxWidth: 500,
    marginTop: 8,
    color: "rgba(148,163,184,0.72)",
    fontSize: 11,
    lineHeight: 1.45,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },

  partnerMetrics: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(85px, 1fr))",
    gap: 8,
  },

  smallMetric: {
    padding: "9px 10px",
    borderRadius: 11,
    border: "1px solid rgba(255,255,255,0.065)",
    background: "rgba(255,255,255,0.025)",
  },

  smallMetricLabel: {
    color: "rgba(148,163,184,0.7)",
    fontSize: 8,
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: "0.1em",
  },

  smallMetricValue: {
    marginTop: 5,
    color: "#ffffff",
    fontSize: 13,
    fontWeight: 850,
  },

  cardActions: {
    display: "flex",
    gap: 7,
  },

  editButton: {
    padding: "8px 11px",
    border: "1px solid rgba(96,165,250,0.22)",
    borderRadius: 9,
    background: "rgba(37,99,235,0.10)",
    color: "#bfdbfe",
    fontSize: 11,
    fontWeight: 800,
    cursor: "pointer",
  },

  archiveButton: {
    padding: "8px 11px",
    border: "1px solid rgba(248,113,113,0.18)",
    borderRadius: 9,
    background: "rgba(127,29,29,0.12)",
    color: "#fca5a5",
    fontSize: 11,
    fontWeight: 800,
    cursor: "pointer",
  },

  modalOverlay: {
    position: "fixed",
    inset: 0,
    zIndex: 1000,
    display: "grid",
    placeItems: "center",
    padding: 18,
    overflowY: "auto",
    background: "rgba(1,4,12,0.78)",
    backdropFilter: "blur(8px)",
  },

  modal: {
    width: "100%",
    maxWidth: 720,
    maxHeight: "calc(100vh - 36px)",
    overflowY: "auto",
    border: "1px solid rgba(255,255,255,0.11)",
    borderRadius: 18,
    background: "#0a0f1e",
    boxShadow: "0 28px 90px rgba(0,0,0,0.55)",
  },

  modalHeader: {
    position: "sticky",
    top: 0,
    zIndex: 2,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "17px 19px",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
    background: "#0a0f1e",
  },

  modalTitle: {
    margin: 0,
    color: "#ffffff",
    fontSize: 21,
  },

  closeButton: {
    width: 35,
    height: 35,
    border: "1px solid rgba(255,255,255,0.10)",
    borderRadius: 10,
    background: "rgba(255,255,255,0.04)",
    color: "#cbd5e1",
    fontSize: 23,
    cursor: "pointer",
  },

  formBody: {
    display: "grid",
    gap: 15,
    padding: 19,
  },

  twoColumnForm: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(235px, 1fr))",
    gap: 14,
  },

  field: {
    display: "grid",
    gap: 7,
  },

  fieldLabel: {
    color: "#cbd5e1",
    fontSize: 11,
    fontWeight: 750,
  },

  input: {
    width: "100%",
    boxSizing: "border-box",
    padding: "11px 12px",
    border: "1px solid rgba(255,255,255,0.11)",
    borderRadius: 10,
    outline: "none",
    background: "rgba(2,6,18,0.6)",
    color: "#ffffff",
    fontFamily: "inherit",
    fontSize: 13,
  },

  modalFooter: {
    position: "sticky",
    bottom: 0,
    display: "flex",
    justifyContent: "flex-end",
    gap: 9,
    padding: "15px 19px",
    borderTop: "1px solid rgba(255,255,255,0.08)",
    background: "#0a0f1e",
  },
};
