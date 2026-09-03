// frontend/src/pages/Clients.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  createClient,
  deleteClient,
  getClients,
} from "../api";

const EMPTY_FORM = {
  name: "",
  industry: "",
  website: "",
  primaryContactName: "",
  primaryContactEmail: "",
  primaryContactPhone: "",
  status: "active",
  notes: "",
};

const STATUS_LABELS = {
  active: "Active Customer",
  prospect: "Prospect",
  paused: "Paused",
  archived: "Archived",
};

export default function Clients() {
  const navigate = useNavigate();

  const [accounts, setAccounts] = useState([]);
  const [membership, setMembership] = useState(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [archivingId, setArchivingId] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] =
    useState("all");
  const [industryFilter, setIndustryFilter] =
    useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  async function loadAccounts() {
    try {
      setLoading(true);
      setError("");

      const response = await getClients();

      setAccounts(
        Array.isArray(response?.clients)
          ? response.clients
          : []
      );

      setMembership(response?.membership || null);
    } catch (err) {
      setAccounts([]);
      setError(
        err?.message ||
          "We couldn't load customer accounts."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAccounts();
  }, []);

  const canWrite =
    membership?.canWrite !== false;

  const industries = useMemo(() => {
    return Array.from(
      new Set(
        accounts
          .map((account) =>
            String(account?.industry || "").trim()
          )
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b));
  }, [accounts]);

  const filteredAccounts = useMemo(() => {
    const search = query.trim().toLowerCase();

    return accounts.filter((account) => {
      const status = String(
        account?.status || "active"
      ).toLowerCase();

      const industry = String(
        account?.industry || ""
      );

      const matchesSearch =
        !search ||
        String(account?.name || "")
          .toLowerCase()
          .includes(search) ||
        industry.toLowerCase().includes(search) ||
        String(account?.domain || account?.website || "")
          .toLowerCase()
          .includes(search) ||
        String(account?.primaryContactName || "")
          .toLowerCase()
          .includes(search) ||
        String(account?.primaryContactEmail || "")
          .toLowerCase()
          .includes(search);

      const matchesStatus =
        statusFilter === "all" ||
        status === statusFilter;

      const matchesIndustry =
        industryFilter === "all" ||
        industry === industryFilter;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesIndustry
      );
    });
  }, [
    accounts,
    query,
    statusFilter,
    industryFilter,
  ]);

  const stats = useMemo(() => {
    return accounts.reduce(
      (totals, account) => {
        const status = String(
          account?.status || "active"
        ).toLowerCase();

        totals.total += 1;

        if (status === "active") {
          totals.active += 1;
        }

        if (status === "prospect") {
          totals.prospects += 1;
        }

        if (status === "paused") {
          totals.paused += 1;
        }

        return totals;
      },
      {
        total: 0,
        active: 0,
        prospects: 0,
        paused: 0,
      }
    );
  }, [accounts]);

  function openCreateModal() {
    setForm(EMPTY_FORM);
    setError("");
    setSuccess("");
    setModalOpen(true);
  }

  function closeCreateModal() {
    if (creating) return;

    setModalOpen(false);
    setForm(EMPTY_FORM);
  }

  async function handleCreate(event) {
    event.preventDefault();

    if (!form.name.trim()) {
      setError("Enter the account name.");
      return;
    }

    try {
      setCreating(true);
      setError("");
      setSuccess("");

      const response = await createClient({
        name: form.name.trim(),
        industry: form.industry.trim(),
        website: form.website.trim(),
        primaryContactName:
          form.primaryContactName.trim(),
        primaryContactEmail:
          form.primaryContactEmail
            .trim()
            .toLowerCase(),
        primaryContactPhone:
          form.primaryContactPhone.trim(),
        status: form.status,
        notes: form.notes.trim(),
      });

      setModalOpen(false);
      setForm(EMPTY_FORM);

      setSuccess(
        `${response?.client?.name || "Customer account"} was created.`
      );

      await loadAccounts();
    } catch (err) {
      setError(
        err?.message ||
          "We couldn't create this customer account."
      );
    } finally {
      setCreating(false);
    }
  }

  async function handleArchive(account) {
    const confirmed = window.confirm(
      `Archive ${account.name}? Its linked deals and historical data will remain available.`
    );

    if (!confirmed) return;

    try {
      const accountId = account._id || account.id;

      setArchivingId(accountId);
      setError("");
      setSuccess("");

      await deleteClient(accountId);

      setSuccess(`${account.name} was archived.`);
      await loadAccounts();
    } catch (err) {
      setError(
        err?.message ||
          "We couldn't archive this customer account."
      );
    } finally {
      setArchivingId("");
    }
  }

  return (
    <>
      <style>{`
        @media (max-width: 980px) {
          .account-row {
            grid-template-columns: 1fr !important;
          }
        }

        @media (max-width: 680px) {
          .account-filters {
            width: 100%;
          }

          .account-filters input,
          .account-filters select {
            width: 100%;
            min-width: 0 !important;
          }
        }
      `}</style>

      <div style={styles.page}>
        <div style={styles.container}>
          <header style={styles.header}>
            <div>
              <div style={styles.eyebrow}>
                Customer portfolio
              </div>

              <h1 style={styles.title}>
                Customer Accounts
              </h1>

              <p style={styles.subtitle}>
                Manage the customers and prospects already
                inside this workspace. Use Account
                Intelligence to research external companies.
              </p>
            </div>

            <div style={styles.headerActions}>
              <button
                type="button"
                onClick={loadAccounts}
                disabled={loading}
                style={styles.secondaryButton}
              >
                {loading
                  ? "Refreshing..."
                  : "Refresh"}
              </button>

              {canWrite ? (
                <button
                  type="button"
                  onClick={openCreateModal}
                  style={styles.primaryButton}
                >
                  + Add Account
                </button>
              ) : null}
            </div>
          </header>

          {error && !modalOpen ? (
            <div style={styles.error}>{error}</div>
          ) : null}

          {success ? (
            <div style={styles.success}>{success}</div>
          ) : null}

          <section style={styles.statsGrid}>
            <MetricCard
              label="Total Accounts"
              value={stats.total}
              detail="Current customer portfolio"
            />

            <MetricCard
              label="Active Customers"
              value={stats.active}
              detail="Accounts with active status"
            />

            <MetricCard
              label="Prospects"
              value={stats.prospects}
              detail="Potential customer accounts"
            />

            <MetricCard
              label="Paused"
              value={stats.paused}
              detail="Accounts requiring attention"
            />
          </section>

          <section style={styles.accountsSection}>
            <div style={styles.sectionHeader}>
              <div>
                <div style={styles.sectionEyebrow}>
                  Workspace records
                </div>

                <h2 style={styles.sectionTitle}>
                  Account Directory
                </h2>
              </div>

              <div
                className="account-filters"
                style={styles.filters}
              >
                <input
                  value={query}
                  onChange={(event) =>
                    setQuery(event.target.value)
                  }
                  placeholder="Search accounts..."
                  style={styles.search}
                />

                <select
                  value={statusFilter}
                  onChange={(event) =>
                    setStatusFilter(
                      event.target.value
                    )
                  }
                  style={styles.select}
                >
                  <option value="all">
                    All statuses
                  </option>
                  <option value="active">
                    Active customers
                  </option>
                  <option value="prospect">
                    Prospects
                  </option>
                  <option value="paused">
                    Paused
                  </option>
                </select>

                <select
                  value={industryFilter}
                  onChange={(event) =>
                    setIndustryFilter(
                      event.target.value
                    )
                  }
                  style={styles.select}
                >
                  <option value="all">
                    All industries
                  </option>

                  {industries.map((industry) => (
                    <option
                      key={industry}
                      value={industry}
                    >
                      {industry}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {loading ? (
              <div style={styles.emptyState}>
                Loading customer accounts...
              </div>
            ) : null}

            {!loading &&
            accounts.length === 0 ? (
              <div style={styles.emptyState}>
                <div style={styles.emptyIcon}>◎</div>

                <h3 style={styles.emptyTitle}>
                  No customer accounts yet
                </h3>

                <p style={styles.emptyText}>
                  Add the first account to begin organizing
                  customers, prospects, and primary contacts.
                </p>

                {canWrite ? (
                  <button
                    type="button"
                    onClick={openCreateModal}
                    style={styles.primaryButton}
                  >
                    + Add First Account
                  </button>
                ) : null}
              </div>
            ) : null}

            {!loading &&
            accounts.length > 0 &&
            filteredAccounts.length === 0 ? (
              <div style={styles.emptyState}>
                No customer accounts match your search or
                filters.
              </div>
            ) : null}

            {!loading &&
            filteredAccounts.length > 0 ? (
              <div style={styles.accountList}>
                {filteredAccounts.map((account) => (
                  <AccountRow
                    key={account._id || account.id}
                    account={account}
                    canWrite={canWrite}
                    archiving={
                      archivingId ===
                      (account._id || account.id)
                    }
                    onView={() =>
                      navigate(
                        `/clients/${
                          account._id || account.id
                        }`
                      )
                    }
                    onArchive={() =>
                      handleArchive(account)
                    }
                  />
                ))}
              </div>
            ) : null}
          </section>
        </div>

        {modalOpen ? (
          <AccountModal
            form={form}
            creating={creating}
            error={error}
            onChange={setForm}
            onSubmit={handleCreate}
            onClose={closeCreateModal}
          />
        ) : null}
      </div>
    </>
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

function AccountRow({
  account,
  canWrite,
  archiving,
  onView,
  onArchive,
}) {
  const status = String(
    account?.status || "active"
  ).toLowerCase();

  const domain =
    account?.domain ||
    getDomain(account?.website) ||
    "";

  return (
    <article
      className="account-row"
      style={styles.accountRow}
    >
      <div style={styles.identity}>
        <div style={styles.accountIcon}>
          {getInitials(account?.name)}
        </div>

        <div style={styles.identityText}>
          <div style={styles.nameRow}>
            <h3 style={styles.accountName}>
              {account?.name || "Untitled Account"}
            </h3>

            <StatusBadge status={status} />
          </div>

          <div style={styles.companyMeta}>
            {account?.industry || "Industry not added"}

            {domain ? (
              <>
                <span style={styles.dot}>•</span>

                <a
                  href={normalizeWebsite(
                    account?.website || domain
                  )}
                  target="_blank"
                  rel="noreferrer"
                  style={styles.websiteLink}
                >
                  {domain}
                </a>
              </>
            ) : null}
          </div>
        </div>
      </div>

      <div style={styles.accountDetails}>
        <div>
          <div style={styles.detailLabel}>
            Primary Contact
          </div>

          <div style={styles.detailValue}>
            {account?.primaryContactName ||
              "Not assigned"}
          </div>
        </div>

        <div>
          <div style={styles.detailLabel}>Email</div>

          {account?.primaryContactEmail ? (
            <a
              href={`mailto:${account.primaryContactEmail}`}
              style={styles.emailLink}
            >
              {account.primaryContactEmail}
            </a>
          ) : (
            <div style={styles.detailValue}>
              Not added
            </div>
          )}
        </div>

        <div>
          <div style={styles.detailLabel}>
            Last Updated
          </div>

          <div style={styles.detailValue}>
            {formatDate(
              account?.updatedAt ||
                account?.createdAt
            )}
          </div>
        </div>
      </div>

      <div style={styles.rowActions}>
        <button
          type="button"
          onClick={onView}
          style={styles.viewButton}
        >
          {canWrite ? "View / Edit" : "View"}
        </button>

        {canWrite ? (
          <button
            type="button"
            onClick={onArchive}
            disabled={archiving}
            style={styles.archiveButton}
          >
            {archiving
              ? "Archiving..."
              : "Archive"}
          </button>
        ) : null}
      </div>
    </article>
  );
}

function AccountModal({
  form,
  creating,
  error,
  onChange,
  onSubmit,
  onClose,
}) {
  return (
    <div
      style={styles.modalOverlay}
      onMouseDown={onClose}
    >
      <div
        style={styles.modal}
        onMouseDown={(event) =>
          event.stopPropagation()
        }
      >
        <div style={styles.modalHeader}>
          <div>
            <div style={styles.sectionEyebrow}>
              New workspace record
            </div>

            <h2 style={styles.modalTitle}>
              Add Customer Account
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={creating}
            style={styles.closeButton}
          >
            ×
          </button>
        </div>

        <form onSubmit={onSubmit}>
          <div style={styles.formBody}>
            {error ? (
              <div style={styles.error}>
                {error}
              </div>
            ) : null}

            <div style={styles.formGrid}>
              <FormField label="Account name *">
                <input
                  value={form.name}
                  onChange={(event) =>
                    updateForm(
                      onChange,
                      "name",
                      event.target.value
                    )
                  }
                  placeholder="Company name"
                  required
                  autoFocus
                  style={styles.input}
                />
              </FormField>

              <FormField label="Account status">
                <select
                  value={form.status}
                  onChange={(event) =>
                    updateForm(
                      onChange,
                      "status",
                      event.target.value
                    )
                  }
                  style={styles.input}
                >
                  <option value="active">
                    Active Customer
                  </option>
                  <option value="prospect">
                    Prospect
                  </option>
                  <option value="paused">
                    Paused
                  </option>
                </select>
              </FormField>

              <FormField label="Industry">
                <input
                  value={form.industry}
                  onChange={(event) =>
                    updateForm(
                      onChange,
                      "industry",
                      event.target.value
                    )
                  }
                  placeholder="Example: B2B SaaS"
                  style={styles.input}
                />
              </FormField>

              <FormField label="Company website">
                <input
                  value={form.website}
                  onChange={(event) =>
                    updateForm(
                      onChange,
                      "website",
                      event.target.value
                    )
                  }
                  placeholder="company.com"
                  style={styles.input}
                />
              </FormField>

              <FormField label="Primary contact">
                <input
                  value={form.primaryContactName}
                  onChange={(event) =>
                    updateForm(
                      onChange,
                      "primaryContactName",
                      event.target.value
                    )
                  }
                  placeholder="Full name"
                  style={styles.input}
                />
              </FormField>

              <FormField label="Contact email">
                <input
                  type="email"
                  value={form.primaryContactEmail}
                  onChange={(event) =>
                    updateForm(
                      onChange,
                      "primaryContactEmail",
                      event.target.value
                    )
                  }
                  placeholder="contact@company.com"
                  style={styles.input}
                />
              </FormField>

              <FormField label="Contact phone">
                <input
                  type="tel"
                  value={form.primaryContactPhone}
                  onChange={(event) =>
                    updateForm(
                      onChange,
                      "primaryContactPhone",
                      event.target.value
                    )
                  }
                  placeholder="Phone number"
                  style={styles.input}
                />
              </FormField>
            </div>

            <FormField label="Account notes">
              <textarea
                value={form.notes}
                onChange={(event) =>
                  updateForm(
                    onChange,
                    "notes",
                    event.target.value
                  )
                }
                placeholder="Add relevant account context..."
                rows={4}
                style={{
                  ...styles.input,
                  minHeight: 100,
                  resize: "vertical",
                }}
              />
            </FormField>
          </div>

          <div style={styles.modalFooter}>
            <button
              type="button"
              onClick={onClose}
              disabled={creating}
              style={styles.secondaryButton}
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={creating}
              style={styles.primaryButton}
            >
              {creating
                ? "Creating..."
                : "Add Account"}
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
      <span style={styles.fieldLabel}>
        {label}
      </span>

      {children}
    </label>
  );
}

function StatusBadge({ status }) {
  const colors = {
    active: {
      color: "#86efac",
      background: "rgba(34,197,94,0.12)",
    },
    prospect: {
      color: "#93c5fd",
      background: "rgba(59,130,246,0.12)",
    },
    paused: {
      color: "#fde68a",
      background: "rgba(245,158,11,0.12)",
    },
  };

  return (
    <span
      style={{
        ...styles.statusBadge,
        ...(colors[status] || colors.paused),
      }}
    >
      {STATUS_LABELS[status] || "Paused"}
    </span>
  );
}

function updateForm(setter, field, value) {
  setter((current) => ({
    ...current,
    [field]: value,
  }));
}

function getInitials(name) {
  return String(name || "A")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function normalizeWebsite(value) {
  const website = String(value || "").trim();

  if (!website) return "#";

  return /^https?:\/\//i.test(website)
    ? website
    : `https://${website}`;
}

function getDomain(value) {
  try {
    return new URL(
      normalizeWebsite(value)
    ).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function formatDate(value) {
  if (!value) return "Unavailable";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unavailable";
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
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

  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    flexWrap: "wrap",
    gap: 18,
    padding: 22,
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 20,
    background:
      "linear-gradient(135deg, rgba(30,64,175,0.18), rgba(124,92,255,0.08), rgba(255,255,255,0.02))",
  },

  eyebrow: {
    color: "#7dd3fc",
    fontSize: 10,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.18em",
  },

  title: {
    margin: "7px 0 0",
    color: "#ffffff",
    fontSize: 29,
  },

  subtitle: {
    maxWidth: 720,
    margin: "9px 0 0",
    color: "rgba(226,232,240,0.8)",
    fontSize: 14,
    lineHeight: 1.55,
  },

  headerActions: {
    display: "flex",
    flexWrap: "wrap",
    gap: 9,
  },

  primaryButton: {
    minHeight: 41,
    padding: "10px 15px",
    border: "1px solid rgba(96,165,250,0.48)",
    borderRadius: 11,
    background:
      "linear-gradient(135deg, #2563eb, #4f46e5)",
    color: "#ffffff",
    fontSize: 12,
    fontWeight: 850,
    cursor: "pointer",
  },

  secondaryButton: {
    minHeight: 41,
    padding: "10px 14px",
    border: "1px solid rgba(255,255,255,0.11)",
    borderRadius: 11,
    background: "rgba(255,255,255,0.045)",
    color: "#eaf0ff",
    fontSize: 12,
    fontWeight: 800,
    cursor: "pointer",
  },

  error: {
    padding: "11px 13px",
    border: "1px solid rgba(248,113,113,0.3)",
    borderRadius: 11,
    background: "rgba(127,29,29,0.22)",
    color: "#fecaca",
    fontSize: 13,
  },

  success: {
    padding: "11px 13px",
    border: "1px solid rgba(34,197,94,0.26)",
    borderRadius: 11,
    background: "rgba(20,83,45,0.22)",
    color: "#bbf7d0",
    fontSize: 13,
  },

  statsGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(210px, 1fr))",
    gap: 11,
  },

  metricCard: {
    minHeight: 105,
    padding: 16,
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 16,
    background: "rgba(255,255,255,0.03)",
  },

  metricLabel: {
    color: "rgba(148,163,184,0.85)",
    fontSize: 9,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.13em",
  },

  metricValue: {
    marginTop: 9,
    color: "#ffffff",
    fontSize: 25,
    fontWeight: 900,
  },

  metricDetail: {
    marginTop: 6,
    color: "rgba(203,213,225,0.67)",
    fontSize: 11,
  },

  accountsSection: {
    overflow: "hidden",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 18,
    background: "rgba(255,255,255,0.025)",
  },

  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 14,
    padding: 16,
    borderBottom: "1px solid rgba(255,255,255,0.08)",
  },

  sectionEyebrow: {
    color: "rgba(148,163,184,0.72)",
    fontSize: 9,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.15em",
  },

  sectionTitle: {
    margin: "5px 0 0",
    color: "#ffffff",
    fontSize: 19,
  },

  filters: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
  },

  search: {
    minWidth: 220,
    padding: "10px 12px",
    border: "1px solid rgba(255,255,255,0.11)",
    borderRadius: 10,
    outline: "none",
    background: "rgba(0,0,0,0.23)",
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
    padding: "52px 20px",
    color: "rgba(203,213,225,0.7)",
    textAlign: "center",
  },

  emptyIcon: {
    width: 44,
    height: 44,
    margin: "0 auto 13px",
    display: "grid",
    placeItems: "center",
    border: "1px solid rgba(96,165,250,0.2)",
    borderRadius: 12,
    background: "rgba(37,99,235,0.09)",
    color: "#93c5fd",
    fontSize: 19,
  },

  emptyTitle: {
    margin: 0,
    color: "#ffffff",
    fontSize: 17,
  },

  emptyText: {
    margin: "8px 0 17px",
    fontSize: 12,
  },

  accountList: {
    display: "grid",
    gap: 9,
    padding: 14,
  },

  accountRow: {
    display: "grid",
    gridTemplateColumns:
      "minmax(250px, 1fr) minmax(400px, 1.3fr) auto",
    alignItems: "center",
    gap: 18,
    padding: 14,
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 14,
    background: "rgba(2,6,18,0.34)",
  },

  identity: {
    display: "flex",
    alignItems: "center",
    gap: 11,
    minWidth: 0,
  },

  accountIcon: {
    width: 42,
    height: 42,
    flex: "0 0 42px",
    display: "grid",
    placeItems: "center",
    borderRadius: 12,
    background:
      "linear-gradient(135deg, rgba(37,99,235,0.28), rgba(79,70,229,0.22))",
    color: "#bfdbfe",
    fontSize: 12,
    fontWeight: 900,
  },

  identityText: {
    minWidth: 0,
  },

  nameRow: {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 7,
  },

  accountName: {
    margin: 0,
    color: "#ffffff",
    fontSize: 15,
  },

  statusBadge: {
    display: "inline-flex",
    padding: "5px 8px",
    borderRadius: 999,
    fontSize: 9,
    fontWeight: 850,
  },

  companyMeta: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 6,
    marginTop: 6,
    color: "rgba(203,213,225,0.68)",
    fontSize: 10,
  },

  dot: {
    color: "rgba(148,163,184,0.5)",
  },

  websiteLink: {
    color: "#93c5fd",
    textDecoration: "none",
  },

  accountDetails: {
    display: "grid",
    gridTemplateColumns:
      "repeat(3, minmax(110px, 1fr))",
    gap: 10,
  },

  detailLabel: {
    marginBottom: 6,
    color: "rgba(148,163,184,0.62)",
    fontSize: 8,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.1em",
  },

  detailValue: {
    color: "#dbe4f0",
    fontSize: 10,
    fontWeight: 750,
  },

  emailLink: {
    display: "block",
    overflow: "hidden",
    color: "#93c5fd",
    fontSize: 10,
    fontWeight: 750,
    textDecoration: "none",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },

  rowActions: {
    display: "flex",
    justifyContent: "flex-end",
    flexWrap: "wrap",
    gap: 7,
  },

  viewButton: {
    padding: "9px 11px",
    border: "1px solid rgba(96,165,250,0.2)",
    borderRadius: 9,
    background: "rgba(37,99,235,0.09)",
    color: "#bfdbfe",
    fontSize: 10,
    fontWeight: 850,
    cursor: "pointer",
  },

  archiveButton: {
    padding: "9px 11px",
    border: "1px solid rgba(245,158,11,0.18)",
    borderRadius: 9,
    background: "rgba(120,53,15,0.12)",
    color: "#fde68a",
    fontSize: 10,
    fontWeight: 850,
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
    alignItems: "flex-start",
    gap: 15,
    padding: 18,
    borderBottom: "1px solid rgba(255,255,255,0.08)",
    background: "#0a0f1e",
  },

  modalTitle: {
    margin: "5px 0 0",
    color: "#ffffff",
    fontSize: 21,
  },

  closeButton: {
    width: 35,
    height: 35,
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 10,
    background: "rgba(255,255,255,0.04)",
    color: "#cbd5e1",
    fontSize: 22,
    cursor: "pointer",
  },

  formBody: {
    display: "grid",
    gap: 14,
    padding: 18,
  },

  formGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(230px, 1fr))",
    gap: 13,
  },

  field: {
    display: "grid",
    gap: 7,
  },

  fieldLabel: {
    color: "#cbd5e1",
    fontSize: 11,
    fontWeight: 800,
  },

  input: {
    width: "100%",
    boxSizing: "border-box",
    padding: "11px 12px",
    border: "1px solid rgba(255,255,255,0.11)",
    borderRadius: 10,
    outline: "none",
    background: "#070b16",
    color: "#ffffff",
    fontFamily: "inherit",
  },

  modalFooter: {
    position: "sticky",
    bottom: 0,
    display: "flex",
    justifyContent: "flex-end",
    gap: 8,
    padding: 15,
    borderTop: "1px solid rgba(255,255,255,0.08)",
    background: "#0a0f1e",
  },
};
