// frontend/src/pages/Workspaces.jsx
import { useEffect, useMemo, useState } from "react";
import {
  createWorkspace,
  getActiveOrgId,
  getActiveOrgName,
  getActiveWorkspace,
  getMyOrgs,
  setActiveOrgId,
  setActiveOrgName,
  setActiveWorkspace,
  switchWorkspace,
} from "../api";

const EMPTY_FORM = {
  name: "",
  type: "client",
  companyWebsite: "",
  industry: "",
};

const ROLE_RANK = {
  owner: 6,
  admin: 5,
  manager: 4,
  analyst: 3,
  member: 2,
  viewer: 1,
  sales: 1,
};

function clean(value) {
  return String(value || "").trim();
}

function normalizeRole(value) {
  return clean(value).toLowerCase() || "member";
}

function roleRank(value) {
  return ROLE_RANK[normalizeRole(value)] || 0;
}

function titleCase(value) {
  return clean(value)
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function normalizeWorkspace(row) {
  if (!row) return null;

  const workspace =
    row.workspace ||
    row.organization ||
    row.org ||
    row;

  const orgId =
    workspace?._id ||
    workspace?.id ||
    row.orgId ||
    row.workspaceId ||
    "";

  if (!orgId) return null;

  const accessStatus = clean(
    workspace?.accessStatus ||
      workspace?.status ||
      row.accessStatus ||
      row.status ||
      "active"
  ).toLowerCase();

  const billingStatus = clean(
    workspace?.billing?.status ||
      workspace?.paymentStatus ||
      row.billingStatus ||
      row.paymentStatus ||
      "inactive"
  ).toLowerCase();

  return {
    orgId: String(orgId),
    orgName:
      workspace?.name ||
      row.orgName ||
      row.workspaceName ||
      "Workspace",
    orgSlug: workspace?.slug || row.orgSlug || "",
    type: workspace?.type || row.type || "client",
    plan: workspace?.plan || row.plan || "SCALE",
    role: normalizeRole(
      row.role ||
        workspace?.role ||
        row.orgRole ||
        row.workspaceRole
    ),
    accessStatus,
    billingStatus,
    trial: workspace?.trial || row.trial || null,
    companyWebsite:
      workspace?.companyWebsite ||
      row.companyWebsite ||
      "",
    industry: workspace?.industry || row.industry || "",
    createdAt: workspace?.createdAt || row.createdAt || null,
    updatedAt: workspace?.updatedAt || row.updatedAt || null,
  };
}

function dedupeWorkspaces(rows) {
  const workspaceMap = new Map();

  for (const row of rows) {
    const workspace = normalizeWorkspace(row);
    if (!workspace) continue;

    const existing = workspaceMap.get(workspace.orgId);

    if (
      !existing ||
      roleRank(workspace.role) > roleRank(existing.role)
    ) {
      workspaceMap.set(workspace.orgId, workspace);
    }
  }

  return Array.from(workspaceMap.values());
}

function isAccessAvailable(workspace) {
  return ["active", "approved", "live"].includes(
    clean(workspace?.accessStatus).toLowerCase()
  );
}

function isBillingReady(workspace) {
  return ["paid", "active", "converted"].includes(
    clean(workspace?.billingStatus).toLowerCase()
  );
}

function isTrial(workspace) {
  return (
    clean(workspace?.billingStatus).toLowerCase() === "trialing" ||
    clean(workspace?.trial?.status).toLowerCase() === "trialing"
  );
}

function needsReview(workspace) {
  const billingStatus = clean(
    workspace?.billingStatus
  ).toLowerCase();

  const accessUnavailable = !isAccessAvailable(workspace);
  const billingProblem = [
    "past_due",
    "unpaid",
    "canceled",
    "cancelled",
    "failed",
  ].includes(billingStatus);

  return accessUnavailable || billingProblem;
}

function getWorkspaceState(workspace) {
  if (needsReview(workspace)) {
    return {
      key: "review",
      label: "Needs Review",
      style: styles.dangerPill,
    };
  }

  if (isTrial(workspace)) {
    return {
      key: "trial",
      label: "Trial",
      style: styles.warningPill,
    };
  }

  return {
    key: "ready",
    label: "Ready",
    style: styles.successPill,
  };
}

function trialDaysRemaining(workspace) {
  const endValue =
    workspace?.trial?.endsAt ||
    workspace?.trial?.endDate ||
    workspace?.trial?.expiresAt;

  if (!endValue) return null;

  const endDate = new Date(endValue);

  if (Number.isNaN(endDate.getTime())) return null;

  const milliseconds = endDate.getTime() - Date.now();

  return Math.max(
    0,
    Math.ceil(milliseconds / (1000 * 60 * 60 * 24))
  );
}

function roleStyle(role) {
  const normalizedRole = normalizeRole(role);

  if (normalizedRole === "owner") {
    return styles.ownerPill;
  }

  if (normalizedRole === "admin") {
    return styles.adminPill;
  }

  if (normalizedRole === "manager") {
    return styles.managerPill;
  }

  return styles.neutralPill;
}

function formatDate(value) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function StatCard({ label, value, description, accent }) {
  return (
    <div
      style={{
        ...styles.statCard,
        borderColor: accent,
      }}
    >
      <div style={styles.statLabel}>{label}</div>
      <div style={styles.statValue}>{value}</div>
      <div style={styles.statDescription}>{description}</div>
    </div>
  );
}

function Pill({ children, style }) {
  return <span style={style}>{children}</span>;
}

function WorkspaceCard({
  workspace,
  active,
  switching,
  actionsDisabled,
  onSwitch,
}) {
  const state = getWorkspaceState(workspace);
  const daysRemaining = trialDaysRemaining(workspace);

  return (
    <div
      style={{
        ...styles.workspaceCard,
        ...(active ? styles.activeWorkspaceCard : {}),
      }}
    >
      <div style={styles.workspaceTop}>
        <div style={styles.workspaceIdentity}>
          <div style={styles.workspaceName}>
            {workspace.orgName}
          </div>

          <div style={styles.workspaceMetadata}>
            {titleCase(workspace.type)} workspace
            {workspace.industry
              ? ` · ${workspace.industry}`
              : ""}
            {workspace.createdAt
              ? ` · Created ${formatDate(workspace.createdAt)}`
              : ""}
          </div>
        </div>

        <div style={styles.pillRow}>
          <Pill style={roleStyle(workspace.role)}>
            {titleCase(workspace.role)}
          </Pill>

          <Pill style={state.style}>{state.label}</Pill>

          {active ? (
            <Pill style={styles.activePill}>Current</Pill>
          ) : null}
        </div>
      </div>

      <div style={styles.workspaceDetails}>
        <div style={styles.detail}>
          <span style={styles.detailLabel}>Plan</span>
          <span style={styles.detailValue}>
            {titleCase(workspace.plan)}
          </span>
        </div>

        <div style={styles.detail}>
          <span style={styles.detailLabel}>Access</span>
          <span style={styles.detailValue}>
            {isAccessAvailable(workspace)
              ? "Available"
              : titleCase(workspace.accessStatus)}
          </span>
        </div>

        <div style={styles.detail}>
          <span style={styles.detailLabel}>Billing</span>
          <span style={styles.detailValue}>
            {isTrial(workspace)
              ? daysRemaining === null
                ? "Trial"
                : `${daysRemaining} day${
                    daysRemaining === 1 ? "" : "s"
                  } remaining`
              : isBillingReady(workspace)
              ? "Active"
              : titleCase(workspace.billingStatus || "Not set")}
          </span>
        </div>
      </div>

      {workspace.companyWebsite ? (
        <div style={styles.website}>
          {workspace.companyWebsite}
        </div>
      ) : null}

      <div style={styles.workspaceActions}>
        {active ? (
          <button
            type="button"
            disabled
            style={styles.currentButton}
          >
            Active Workspace
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onSwitch(workspace)}
            disabled={actionsDisabled}
            style={{
              ...styles.primaryButton,
              opacity: actionsDisabled ? 0.65 : 1,
              cursor: actionsDisabled
                ? "not-allowed"
                : "pointer",
            }}
          >
            {switching
              ? "Switching..."
              : "Switch Workspace"}
          </button>
        )}
      </div>
    </div>
  );
}

function CreateWorkspaceModal({
  form,
  creating,
  onChange,
  onClose,
  onSubmit,
}) {
  return (
    <div
      style={styles.modalBackdrop}
      onMouseDown={onClose}
      role="presentation"
    >
      <div
        style={styles.modal}
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-workspace-title"
      >
        <div style={styles.modalHeader}>
          <div>
            <div style={styles.eyebrow}>New Environment</div>
            <h2
              id="create-workspace-title"
              style={styles.modalTitle}
            >
              Create Workspace
            </h2>
            <div style={styles.modalSubtitle}>
              Create a separate environment for a company,
              client, or business unit.
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={creating}
            style={styles.closeButton}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <form onSubmit={onSubmit} style={styles.form}>
          <div style={styles.formGroup}>
            <label style={styles.label} htmlFor="workspace-name">
              Workspace name
            </label>

            <input
              id="workspace-name"
              value={form.name}
              onChange={(event) =>
                onChange("name", event.target.value)
              }
              placeholder="Company or business unit name"
              maxLength={120}
              autoFocus
              required
              style={styles.input}
            />
          </div>

          <div style={styles.formGrid}>
            <div style={styles.formGroup}>
              <label
                style={styles.label}
                htmlFor="workspace-type"
              >
                Workspace type
              </label>

              <select
                id="workspace-type"
                value={form.type}
                onChange={(event) =>
                  onChange("type", event.target.value)
                }
                style={styles.input}
              >
                <option value="client">Company</option>
                <option value="agency">Agency</option>
              </select>
            </div>

            <div style={styles.formGroup}>
              <label
                style={styles.label}
                htmlFor="workspace-industry"
              >
                Industry
              </label>

              <input
                id="workspace-industry"
                value={form.industry}
                onChange={(event) =>
                  onChange("industry", event.target.value)
                }
                placeholder="Example: Technology"
                maxLength={120}
                style={styles.input}
              />
            </div>
          </div>

          <div style={styles.formGroup}>
            <label
              style={styles.label}
              htmlFor="workspace-website"
            >
              Company website
            </label>

            <input
              id="workspace-website"
              value={form.companyWebsite}
              onChange={(event) =>
                onChange(
                  "companyWebsite",
                  event.target.value
                )
              }
              placeholder="https://company.com"
              maxLength={300}
              style={styles.input}
            />
          </div>

          <div style={styles.formNotice}>
            The new workspace will begin on the standard
            7-day trial and will become your active workspace
            after creation.
          </div>

          <div style={styles.modalActions}>
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
              disabled={creating || !form.name.trim()}
              style={{
                ...styles.primaryButton,
                opacity:
                  creating || !form.name.trim() ? 0.65 : 1,
                cursor:
                  creating || !form.name.trim()
                    ? "not-allowed"
                    : "pointer",
              }}
            >
              {creating
                ? "Creating..."
                : "Create Workspace"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Workspaces() {
  const [workspaces, setWorkspaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [switchingId, setSwitchingId] = useState("");
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState("");
  const [stateFilter, setStateFilter] = useState("all");
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState("");

  const activeOrgId = String(getActiveOrgId() || "");
  const activeOrgName = getActiveOrgName();
  const storedActiveWorkspace = getActiveWorkspace();

  async function load({ quiet = false } = {}) {
    try {
      if (quiet) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      const response = await getMyOrgs();

      const rows = Array.isArray(response?.orgs)
        ? response.orgs
        : Array.isArray(response?.workspaces)
        ? response.workspaces
        : Array.isArray(response)
        ? response
        : [];

      setWorkspaces(dedupeWorkspaces(rows));
    } catch (err) {
      console.error("Workspace load error:", err);
      setError(
        err?.message || "Unable to load your workspaces."
      );
      setWorkspaces([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const activeWorkspace = useMemo(() => {
    const match = workspaces.find(
      (workspace) =>
        String(workspace.orgId) === activeOrgId
    );

    if (match) return match;

    const fallback = normalizeWorkspace(
      storedActiveWorkspace
        ? {
            ...storedActiveWorkspace,
            name:
              storedActiveWorkspace.name ||
              activeOrgName ||
              "Current Workspace",
          }
        : null
    );

    return fallback;
  }, [
    workspaces,
    activeOrgId,
    activeOrgName,
    storedActiveWorkspace,
  ]);

  const stats = useMemo(() => {
    return {
      total: workspaces.length,
      accessible: workspaces.filter(isAccessAvailable).length,
      ownerAccess: workspaces.filter(
        (workspace) => workspace.role === "owner"
      ).length,
      needsReview: workspaces.filter(needsReview).length,
    };
  }, [workspaces]);

  const filteredWorkspaces = useMemo(() => {
    const query = search.trim().toLowerCase();

    return [...workspaces]
      .filter((workspace) => {
        if (!query) return true;

        return [
          workspace.orgName,
          workspace.orgSlug,
          workspace.type,
          workspace.plan,
          workspace.industry,
          workspace.companyWebsite,
        ].some((value) =>
          clean(value).toLowerCase().includes(query)
        );
      })
      .filter((workspace) => {
        if (stateFilter === "all") return true;
        return getWorkspaceState(workspace).key === stateFilter;
      })
      .sort((a, b) => {
        const aActive =
          String(a.orgId) === activeOrgId ? 1 : 0;
        const bActive =
          String(b.orgId) === activeOrgId ? 1 : 0;

        if (aActive !== bActive) {
          return bActive - aActive;
        }

        const roleDifference =
          roleRank(b.role) - roleRank(a.role);

        if (roleDifference !== 0) {
          return roleDifference;
        }

        return a.orgName.localeCompare(b.orgName);
      });
  }, [workspaces, search, stateFilter, activeOrgId]);

  function updateForm(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function closeCreateModal() {
    if (creating) return;

    setShowCreate(false);
    setForm(EMPTY_FORM);
  }

  async function handleCreate(event) {
    event.preventDefault();

    if (!form.name.trim()) {
      setError("Workspace name is required.");
      return;
    }

    try {
      setCreating(true);
      setError("");

      const response = await createWorkspace({
        name: form.name.trim(),
        type: form.type,
        companyWebsite: form.companyWebsite.trim(),
        industry: form.industry.trim(),
      });

      const workspace = response?.workspace;

      if (!workspace?._id && !workspace?.id) {
        throw new Error(
          "The workspace was created, but no workspace ID was returned."
        );
      }

      const workspaceId = workspace._id || workspace.id;

      setActiveOrgId(workspaceId);
      setActiveOrgName(workspace.name || form.name.trim());
      setActiveWorkspace(workspace);

      setShowCreate(false);
      setForm(EMPTY_FORM);

      window.location.reload();
    } catch (err) {
      console.error("Create workspace error:", err);
      setError(
        err?.message || "Unable to create the workspace."
      );
    } finally {
      setCreating(false);
    }
  }

  async function handleSwitch(workspace) {
    if (
      !workspace?.orgId ||
      String(workspace.orgId) === activeOrgId
    ) {
      return;
    }

    try {
      setSwitchingId(workspace.orgId);
      setError("");

      const response = await switchWorkspace(
        workspace.orgId
      );

      const active = response?.activeWorkspace;

      if (!active?._id && !active?.id) {
        throw new Error(
          "The workspace could not be activated."
        );
      }

      const workspaceId = active._id || active.id;

      setActiveOrgId(workspaceId);
      setActiveOrgName(
        active.name || workspace.orgName
      );
      setActiveWorkspace(active);

      window.location.reload();
    } catch (err) {
      console.error("Switch workspace error:", err);
      setError(
        err?.message || "Unable to switch workspaces."
      );
      setSwitchingId("");
    }
  }

  return (
    <div style={styles.page}>
      <style>{`
        .global-hq-stats {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
        }

        .global-hq-details {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
        }

        .global-hq-form-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }

        @media (max-width: 900px) {
          .global-hq-stats {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .global-hq-details {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 620px) {
          .global-hq-stats,
          .global-hq-form-grid {
            grid-template-columns: 1fr;
          }
        }

        .global-hq-input::placeholder {
          color: rgba(203, 213, 225, 0.5);
        }

        .global-hq-input:focus {
          border-color: rgba(56, 189, 248, 0.65) !important;
          box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.1);
        }
      `}</style>

      <div style={styles.container}>
        <section style={styles.hero}>
          <div style={styles.heroContent}>
            <div>
              <div style={styles.eyebrow}>
                Organization Management
              </div>

              <h1 style={styles.title}>Global HQ</h1>

              <p style={styles.subtitle}>
                Manage the workspaces you can access and move
                between companies without mixing their data.
              </p>
            </div>

            <div style={styles.heroActions}>
              <button
                type="button"
                onClick={() => load({ quiet: true })}
                disabled={
                  refreshing ||
                  loading ||
                  creating ||
                  Boolean(switchingId)
                }
                style={styles.secondaryButton}
              >
                {refreshing ? "Refreshing..." : "Refresh"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setError("");
                  setShowCreate(true);
                }}
                style={styles.primaryButton}
              >
                + New Workspace
              </button>
            </div>
          </div>
        </section>

        {error ? (
          <div style={styles.errorBanner}>{error}</div>
        ) : null}

        <div className="global-hq-stats">
          <StatCard
            label="Workspaces"
            value={stats.total}
            description="Companies and operating environments available to you."
            accent="rgba(56,189,248,0.28)"
          />

          <StatCard
            label="Access Available"
            value={stats.accessible}
            description="Workspaces you can currently enter."
            accent="rgba(34,197,94,0.28)"
          />

          <StatCard
            label="Owner Access"
            value={stats.ownerAccess}
            description="Workspaces where you have owner-level control."
            accent="rgba(167,139,250,0.28)"
          />

          <StatCard
            label="Needs Review"
            value={stats.needsReview}
            description="Workspaces with an access or billing issue."
            accent={
              stats.needsReview
                ? "rgba(239,68,68,0.38)"
                : "rgba(255,255,255,0.08)"
            }
          />
        </div>

        {activeWorkspace ? (
          <section style={styles.currentSection}>
            <div style={styles.currentHeader}>
              <div>
                <div style={styles.eyebrow}>
                  Current Workspace
                </div>

                <div style={styles.currentName}>
                  {activeWorkspace.orgName ||
                    activeOrgName ||
                    "Workspace"}
                </div>

                <div style={styles.currentDescription}>
                  Atlas is currently showing data and insights
                  for this workspace.
                </div>
              </div>

              <div style={styles.pillRow}>
                <Pill style={styles.activePill}>Active</Pill>

                <Pill
                  style={roleStyle(activeWorkspace.role)}
                >
                  {titleCase(activeWorkspace.role)}
                </Pill>

                <Pill
                  style={
                    getWorkspaceState(activeWorkspace).style
                  }
                >
                  {
                    getWorkspaceState(activeWorkspace)
                      .label
                  }
                </Pill>
              </div>
            </div>

            <div className="global-hq-details">
              <div style={styles.currentDetail}>
                <div style={styles.detailLabel}>
                  Workspace Type
                </div>
                <div style={styles.currentDetailValue}>
                  {titleCase(activeWorkspace.type)}
                </div>
              </div>

              <div style={styles.currentDetail}>
                <div style={styles.detailLabel}>
                  Current Plan
                </div>
                <div style={styles.currentDetailValue}>
                  {titleCase(activeWorkspace.plan)}
                </div>
              </div>

              <div style={styles.currentDetail}>
                <div style={styles.detailLabel}>
                  Your Access
                </div>
                <div style={styles.currentDetailValue}>
                  {titleCase(activeWorkspace.role)}
                </div>
              </div>
            </div>
          </section>
        ) : null}

        <section style={styles.directory}>
          <div style={styles.directoryHeader}>
            <div>
              <div style={styles.eyebrow}>
                Workspace Directory
              </div>
              <h2 style={styles.sectionTitle}>
                Your Workspaces
              </h2>
              <div style={styles.sectionSubtitle}>
                Select a workspace to change the company Atlas
                is currently analyzing.
              </div>
            </div>

            <div style={styles.filters}>
              <input
                className="global-hq-input"
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Search workspaces..."
                style={styles.searchInput}
              />

              <select
                className="global-hq-input"
                value={stateFilter}
                onChange={(event) =>
                  setStateFilter(event.target.value)
                }
                style={styles.filterSelect}
              >
                <option value="all">All workspaces</option>
                <option value="ready">Ready</option>
                <option value="trial">Trial</option>
                <option value="review">Needs review</option>
              </select>
            </div>
          </div>

          <div style={styles.directoryBody}>
            {loading ? (
              <div style={styles.emptyState}>
                Loading workspaces...
              </div>
            ) : filteredWorkspaces.length === 0 ? (
              <div style={styles.emptyState}>
                {workspaces.length === 0
                  ? "You do not have any workspaces yet."
                  : "No workspaces match your search or filter."}
              </div>
            ) : (
              <div style={styles.workspaceList}>
                {filteredWorkspaces.map((workspace) => (
                  <WorkspaceCard
                    key={workspace.orgId}
                    workspace={workspace}
                    active={
                      String(workspace.orgId) ===
                      activeOrgId
                    }
                    switching={
                      switchingId === workspace.orgId
                    }
                    actionsDisabled={Boolean(switchingId)}
                    onSwitch={handleSwitch}
                  />
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      {showCreate ? (
        <CreateWorkspaceModal
          form={form}
          creating={creating}
          onChange={updateForm}
          onClose={closeCreateModal}
          onSubmit={handleCreate}
        />
      ) : null}
    </div>
  );
}

const basePill = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "6px 10px",
  borderRadius: 999,
  fontSize: 11,
  lineHeight: 1,
  fontWeight: 900,
  whiteSpace: "nowrap",
};

const styles = {
  page: {
    minHeight: "100vh",
    padding: "28px 16px 42px",
    color: "#EAF0FF",
    background:
      "radial-gradient(900px 480px at 8% 0%, rgba(37,99,235,0.16), transparent 58%), radial-gradient(900px 520px at 92% 5%, rgba(124,92,255,0.12), transparent 58%), #050814",
  },

  container: {
    width: "100%",
    maxWidth: 1380,
    margin: "0 auto",
    display: "grid",
    gap: 14,
  },

  hero: {
    padding: "24px 26px",
    borderRadius: 22,
    border: "1px solid rgba(125,160,255,0.14)",
    background:
      "linear-gradient(135deg, rgba(24,71,190,0.22), rgba(68,55,160,0.14), rgba(10,16,35,0.82))",
    boxShadow: "0 18px 45px rgba(0,0,0,0.2)",
  },

  heroContent: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 20,
    flexWrap: "wrap",
  },

  eyebrow: {
    color: "#7DD3FC",
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: "0.17em",
    textTransform: "uppercase",
  },

  title: {
    margin: "7px 0 0",
    color: "#FFFFFF",
    fontSize: "clamp(28px, 4vw, 38px)",
    lineHeight: 1.05,
    letterSpacing: "-0.04em",
  },

  subtitle: {
    maxWidth: 720,
    margin: "10px 0 0",
    color: "rgba(226,232,240,0.82)",
    fontSize: 14,
    lineHeight: 1.65,
  },

  heroActions: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },

  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 12,
  },

  statCard: {
    minHeight: 124,
    padding: 17,
    borderRadius: 17,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(10,16,35,0.72)",
    boxShadow: "0 12px 30px rgba(0,0,0,0.15)",
  },

  statLabel: {
    color: "rgba(148,163,184,0.9)",
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
  },

  statValue: {
    marginTop: 10,
    color: "#FFFFFF",
    fontSize: 28,
    lineHeight: 1,
    fontWeight: 900,
  },

  statDescription: {
    marginTop: 9,
    color: "rgba(203,213,225,0.7)",
    fontSize: 12,
    lineHeight: 1.5,
  },

  currentSection: {
    padding: 20,
    borderRadius: 19,
    border: "1px solid rgba(56,189,248,0.24)",
    background:
      "linear-gradient(135deg, rgba(14,116,144,0.12), rgba(37,99,235,0.1), rgba(10,16,35,0.74))",
    boxShadow: "0 14px 34px rgba(0,0,0,0.16)",
  },

  currentHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
    flexWrap: "wrap",
  },

  currentName: {
    marginTop: 7,
    color: "#FFFFFF",
    fontSize: 23,
    fontWeight: 900,
    letterSpacing: "-0.025em",
  },

  currentDescription: {
    marginTop: 7,
    color: "rgba(203,213,225,0.76)",
    fontSize: 13,
    lineHeight: 1.5,
  },

  currentDetail: {
    marginTop: 17,
    padding: "12px 13px",
    borderRadius: 13,
    border: "1px solid rgba(255,255,255,0.07)",
    background: "rgba(3,8,22,0.34)",
  },

  currentDetailValue: {
    marginTop: 5,
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: 800,
  },

  directory: {
    overflow: "hidden",
    borderRadius: 20,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(8,13,29,0.76)",
    boxShadow: "0 16px 38px rgba(0,0,0,0.18)",
  },

  directoryHeader: {
    padding: "18px 20px",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: 16,
    flexWrap: "wrap",
  },

  sectionTitle: {
    margin: "5px 0 0",
    color: "#FFFFFF",
    fontSize: 21,
    letterSpacing: "-0.025em",
  },

  sectionSubtitle: {
    marginTop: 5,
    color: "rgba(203,213,225,0.7)",
    fontSize: 12,
    lineHeight: 1.5,
  },

  directoryBody: {
    padding: 14,
  },

  filters: {
    display: "flex",
    alignItems: "center",
    gap: 9,
    flexWrap: "wrap",
  },

  searchInput: {
    minWidth: 235,
    padding: "11px 13px",
    borderRadius: 11,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.045)",
    color: "#FFFFFF",
    outline: "none",
  },

  filterSelect: {
    padding: "11px 13px",
    borderRadius: 11,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "#0D1426",
    color: "#FFFFFF",
    outline: "none",
  },

  workspaceList: {
    display: "grid",
    gap: 10,
  },

  workspaceCard: {
    padding: 16,
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.025)",
  },

  activeWorkspaceCard: {
    border: "1px solid rgba(56,189,248,0.34)",
    background:
      "linear-gradient(135deg, rgba(37,99,235,0.13), rgba(56,189,248,0.06))",
    boxShadow: "0 10px 28px rgba(37,99,235,0.12)",
  },

  workspaceTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 14,
    flexWrap: "wrap",
  },

  workspaceIdentity: {
    minWidth: 0,
  },

  workspaceName: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: 900,
    lineHeight: 1.25,
  },

  workspaceMetadata: {
    marginTop: 5,
    color: "rgba(203,213,225,0.68)",
    fontSize: 12,
    lineHeight: 1.5,
  },

  workspaceDetails: {
    marginTop: 14,
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },

  detail: {
    minWidth: 145,
    padding: "9px 11px",
    borderRadius: 11,
    border: "1px solid rgba(255,255,255,0.065)",
    background: "rgba(3,8,22,0.3)",
    display: "grid",
    gap: 4,
  },

  detailLabel: {
    color: "rgba(148,163,184,0.72)",
    fontSize: 9,
    fontWeight: 900,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
  },

  detailValue: {
    color: "#E2E8F0",
    fontSize: 12,
    fontWeight: 800,
  },

  website: {
    marginTop: 11,
    color: "#7DD3FC",
    fontSize: 12,
    wordBreak: "break-word",
  },

  workspaceActions: {
    marginTop: 15,
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },

  pillRow: {
    display: "flex",
    alignItems: "center",
    gap: 7,
    flexWrap: "wrap",
  },

  ownerPill: {
    ...basePill,
    color: "#86EFAC",
    border: "1px solid rgba(34,197,94,0.25)",
    background: "rgba(34,197,94,0.1)",
  },

  adminPill: {
    ...basePill,
    color: "#7DD3FC",
    border: "1px solid rgba(56,189,248,0.25)",
    background: "rgba(56,189,248,0.1)",
  },

  managerPill: {
    ...basePill,
    color: "#FDE68A",
    border: "1px solid rgba(245,158,11,0.25)",
    background: "rgba(245,158,11,0.1)",
  },

  neutralPill: {
    ...basePill,
    color: "#C4B5FD",
    border: "1px solid rgba(167,139,250,0.25)",
    background: "rgba(167,139,250,0.1)",
  },

  activePill: {
    ...basePill,
    color: "#BAE6FD",
    border: "1px solid rgba(56,189,248,0.3)",
    background: "rgba(14,165,233,0.12)",
  },

  successPill: {
    ...basePill,
    color: "#86EFAC",
    border: "1px solid rgba(34,197,94,0.25)",
    background: "rgba(34,197,94,0.1)",
  },

  warningPill: {
    ...basePill,
    color: "#FDE68A",
    border: "1px solid rgba(245,158,11,0.25)",
    background: "rgba(245,158,11,0.1)",
  },

  dangerPill: {
    ...basePill,
    color: "#FCA5A5",
    border: "1px solid rgba(239,68,68,0.26)",
    background: "rgba(239,68,68,0.1)",
  },

  primaryButton: {
    padding: "11px 15px",
    border: 0,
    borderRadius: 11,
    background:
      "linear-gradient(90deg, #2563EB, #0EA5E9)",
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: 900,
    cursor: "pointer",
    boxShadow: "0 8px 20px rgba(37,99,235,0.2)",
  },

  secondaryButton: {
    padding: "11px 15px",
    borderRadius: 11,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.055)",
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: 800,
    cursor: "pointer",
  },

  currentButton: {
    padding: "11px 15px",
    borderRadius: 11,
    border: "1px solid rgba(34,197,94,0.24)",
    background: "rgba(34,197,94,0.1)",
    color: "#86EFAC",
    fontSize: 12,
    fontWeight: 900,
  },

  emptyState: {
    padding: "34px 18px",
    borderRadius: 14,
    border: "1px dashed rgba(255,255,255,0.12)",
    color: "rgba(203,213,225,0.72)",
    textAlign: "center",
    fontSize: 13,
  },

  errorBanner: {
    padding: "12px 14px",
    borderRadius: 13,
    border: "1px solid rgba(239,68,68,0.3)",
    background: "rgba(239,68,68,0.1)",
    color: "#FECACA",
    fontSize: 13,
    lineHeight: 1.5,
  },

  modalBackdrop: {
    position: "fixed",
    inset: 0,
    zIndex: 1000,
    padding: 18,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(1,4,13,0.8)",
    backdropFilter: "blur(8px)",
  },

  modal: {
    width: "100%",
    maxWidth: 620,
    maxHeight: "calc(100vh - 36px)",
    overflowY: "auto",
    borderRadius: 20,
    border: "1px solid rgba(125,160,255,0.2)",
    background: "#0A1020",
    boxShadow: "0 30px 90px rgba(0,0,0,0.5)",
  },

  modalHeader: {
    padding: "20px 21px",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
  },

  modalTitle: {
    margin: "6px 0 0",
    color: "#FFFFFF",
    fontSize: 23,
    letterSpacing: "-0.025em",
  },

  modalSubtitle: {
    marginTop: 7,
    color: "rgba(203,213,225,0.72)",
    fontSize: 13,
    lineHeight: 1.5,
  },

  closeButton: {
    width: 36,
    height: 36,
    flex: "0 0 auto",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.1)",
    background: "rgba(255,255,255,0.05)",
    color: "#FFFFFF",
    fontSize: 22,
    cursor: "pointer",
  },

  form: {
    padding: 21,
    display: "grid",
    gap: 14,
  },

  formGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
  },

  formGroup: {
    display: "grid",
    gap: 7,
  },

  label: {
    color: "#CBD5E1",
    fontSize: 12,
    fontWeight: 800,
  },

  input: {
    width: "100%",
    boxSizing: "border-box",
    padding: "12px 13px",
    borderRadius: 11,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "#0D1426",
    color: "#FFFFFF",
    outline: "none",
  },

  formNotice: {
    padding: "11px 12px",
    borderRadius: 11,
    border: "1px solid rgba(56,189,248,0.15)",
    background: "rgba(56,189,248,0.06)",
    color: "rgba(186,230,253,0.82)",
    fontSize: 12,
    lineHeight: 1.55,
  },

  modalActions: {
    marginTop: 3,
    paddingTop: 14,
    borderTop: "1px solid rgba(255,255,255,0.07)",
    display: "flex",
    justifyContent: "flex-end",
    gap: 10,
    flexWrap: "wrap",
  },
};
