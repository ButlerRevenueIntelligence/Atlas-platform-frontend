// frontend/src/pages/Invites.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  createInvite,
  getActiveOrgName,
  listInvites,
  resendInvite,
  revokeInvite,
} from "../api";

const ROLE_LABELS = {
  admin: "Admin",
  manager: "Manager",
  analyst: "Analyst",
  member: "Member",
  viewer: "Viewer",
};

const ROLE_DESCRIPTIONS = {
  admin:
    "Full workspace administration, excluding ownership controls.",
  manager:
    "Manages operational workflows and team activity.",
  analyst:
    "Reviews reporting, performance, and revenue intelligence.",
  member:
    "Standard access to assigned workspace capabilities.",
  viewer:
    "Read-only access to permitted workspace information.",
};

const STATUS_LABELS = {
  pending: "Pending",
  accepted: "Accepted",
  expired: "Expired",
  revoked: "Revoked",
};

export default function Invites() {
  const navigate = useNavigate();

  const [invites, setInvites] = useState([]);
  const [viewerMembership, setViewerMembership] =
    useState(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [workingId, setWorkingId] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] =
    useState("all");
  const [modalOpen, setModalOpen] = useState(false);

  const [form, setForm] = useState({
    email: "",
    role: "analyst",
  });

  const workspaceName =
    getActiveOrgName() || "Current Workspace";

  async function loadInvites() {
    try {
      setLoading(true);
      setError("");

      const response = await listInvites();

      setInvites(
        Array.isArray(response?.invites)
          ? response.invites
          : []
      );

      setViewerMembership(
        response?.membership || null
      );
    } catch (err) {
      setInvites([]);

      if (err?.status === 403) {
        setError(
          "Only workspace owners and administrators can view invitations."
        );
      } else {
        setError(
          err?.message ||
            "We couldn't load workspace invitations."
        );
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadInvites();
  }, []);

  const viewerRole = String(
    viewerMembership?.role || ""
  ).toLowerCase();

  const availableRoles =
    viewerRole === "owner"
      ? [
          "admin",
          "manager",
          "analyst",
          "member",
          "viewer",
        ]
      : ["manager", "analyst", "member", "viewer"];

  const stats = useMemo(() => {
    return invites.reduce(
      (totals, invite) => {
        const status = String(
          invite?.status || "pending"
        ).toLowerCase();

        totals.total += 1;

        if (status === "pending") {
          totals.pending += 1;
        }

        if (status === "accepted") {
          totals.accepted += 1;
        }

        if (status === "expired") {
          totals.expired += 1;
        }

        if (status === "revoked") {
          totals.revoked += 1;
        }

        return totals;
      },
      {
        total: 0,
        pending: 0,
        accepted: 0,
        expired: 0,
        revoked: 0,
      }
    );
  }, [invites]);

  const filteredInvites = useMemo(() => {
    const search = query.trim().toLowerCase();

    return invites.filter((invite) => {
      const email = String(
        invite?.email || ""
      ).toLowerCase();

      const role = String(
        invite?.role || ""
      ).toLowerCase();

      const status = String(
        invite?.status || ""
      ).toLowerCase();

      const matchesSearch =
        !search ||
        email.includes(search) ||
        role.includes(search);

      const matchesStatus =
        statusFilter === "all" ||
        status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [invites, query, statusFilter]);

  function openModal() {
    setForm({
      email: "",
      role: "analyst",
    });

    setError("");
    setSuccess("");
    setModalOpen(true);
  }

  function closeModal() {
    if (creating) return;

    setModalOpen(false);
    setForm({
      email: "",
      role: "analyst",
    });
  }

  async function handleCreate(event) {
    event.preventDefault();

    const email = form.email.trim();

    if (!email) {
      setError("Enter the member's email address.");
      return;
    }

    try {
      setCreating(true);
      setError("");
      setSuccess("");

      const response = await createInvite(
        email,
        form.role
      );

      setSuccess(
        response?.message ||
          `Invitation sent to ${email}.`
      );

      setModalOpen(false);

      setForm({
        email: "",
        role: "analyst",
      });

      await loadInvites();
    } catch (err) {
      setError(
        err?.message ||
          "We couldn't create this invitation."
      );

      if (err?.data?.invite) {
        await loadInvites();
      }
    } finally {
      setCreating(false);
    }
  }

  function buildInviteLink(invite) {
    if (!invite?.token) return "";

    return `${
      window.location.origin
    }/accept-invite?token=${encodeURIComponent(
      invite.token
    )}`;
  }

  async function handleCopyLink(invite) {
    const link = buildInviteLink(invite);

    if (!link) {
      setError(
        "This invitation does not have an active link."
      );
      return;
    }

    try {
      await navigator.clipboard.writeText(link);

      setError("");
      setSuccess(
        `Invitation link copied for ${invite.email}.`
      );
    } catch {
      setError(
        "The link could not be copied automatically."
      );
    }
  }

  async function handleResend(invite) {
    const confirmed = window.confirm(
      `Resend the invitation to ${invite.email}? The previous link will stop working and a new seven-day link will be created.`
    );

    if (!confirmed) return;

    try {
      setWorkingId(invite._id || invite.id);
      setError("");
      setSuccess("");

      const response = await resendInvite(
        invite._id || invite.id
      );

      setSuccess(
        response?.message ||
          `Invitation resent to ${invite.email}.`
      );

      await loadInvites();
    } catch (err) {
      setError(
        err?.message ||
          "We couldn't resend this invitation."
      );

      if (err?.data?.invite) {
        await loadInvites();
      }
    } finally {
      setWorkingId("");
    }
  }

  async function handleRevoke(invite) {
    const confirmed = window.confirm(
      `Revoke the invitation for ${invite.email}? Their current invitation link will immediately stop working.`
    );

    if (!confirmed) return;

    try {
      setWorkingId(invite._id || invite.id);
      setError("");
      setSuccess("");

      const response = await revokeInvite(
        invite._id || invite.id
      );

      setSuccess(
        response?.message || "Invitation revoked."
      );

      await loadInvites();
    } catch (err) {
      setError(
        err?.message ||
          "We couldn't revoke this invitation."
      );
    } finally {
      setWorkingId("");
    }
  }

  return (
    <>
      <style>{`
        @media (max-width: 900px) {
          .invite-row {
            grid-template-columns: 1fr !important;
          }
        }

        @media (max-width: 680px) {
          .invite-filters {
            width: 100%;
          }

          .invite-filters input,
          .invite-filters select {
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
                Workspace administration
              </div>

              <h1 style={styles.title}>
                Invitations
              </h1>

              <p style={styles.subtitle}>
                Invite people to{" "}
                <strong>{workspaceName}</strong> and
                track their onboarding status.
              </p>
            </div>

            <div style={styles.headerActions}>
              <button
                type="button"
                onClick={loadInvites}
                disabled={loading}
                style={styles.secondaryButton}
              >
                {loading
                  ? "Refreshing..."
                  : "Refresh"}
              </button>

              <button
                type="button"
                onClick={openModal}
                style={styles.primaryButton}
              >
                + Invite Member
              </button>
            </div>
          </header>

          {error && !modalOpen ? (
            <div style={styles.error}>
              {error}
            </div>
          ) : null}

          {success ? (
            <div style={styles.success}>
              {success}
            </div>
          ) : null}

          <section style={styles.statsGrid}>
            <MetricCard
              label="Total Invites"
              value={stats.total}
              detail="All invitation records"
            />

            <MetricCard
              label="Pending"
              value={stats.pending}
              detail="Awaiting acceptance"
            />

            <MetricCard
              label="Accepted"
              value={stats.accepted}
              detail="Converted into workspace access"
            />

            <MetricCard
              label="Needs Attention"
              value={stats.expired + stats.revoked}
              detail={`${stats.expired} expired · ${stats.revoked} revoked`}
            />
          </section>

          <section style={styles.invitesSection}>
            <div style={styles.sectionHeader}>
              <div>
                <div style={styles.sectionEyebrow}>
                  Access onboarding
                </div>

                <h2 style={styles.sectionTitle}>
                  Invitation History
                </h2>
              </div>

              <div
                className="invite-filters"
                style={styles.filters}
              >
                <input
                  value={query}
                  onChange={(event) =>
                    setQuery(event.target.value)
                  }
                  placeholder="Search email or role..."
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
                  <option value="pending">
                    Pending
                  </option>
                  <option value="accepted">
                    Accepted
                  </option>
                  <option value="expired">
                    Expired
                  </option>
                  <option value="revoked">
                    Revoked
                  </option>
                </select>
              </div>
            </div>

            {loading ? (
              <div style={styles.emptyState}>
                Loading invitations...
              </div>
            ) : null}

            {!loading &&
            !error &&
            invites.length === 0 ? (
              <div style={styles.emptyState}>
                <div style={styles.emptyIcon}>✉</div>

                <h3 style={styles.emptyTitle}>
                  No invitations yet
                </h3>

                <p style={styles.emptyText}>
                  Invite the first team member to
                  begin building this workspace.
                </p>

                <button
                  type="button"
                  onClick={openModal}
                  style={styles.primaryButton}
                >
                  + Invite First Member
                </button>
              </div>
            ) : null}

            {!loading &&
            invites.length > 0 &&
            filteredInvites.length === 0 ? (
              <div style={styles.emptyState}>
                No invitations match your search or
                filter.
              </div>
            ) : null}

            {!loading &&
            filteredInvites.length > 0 ? (
              <div style={styles.inviteList}>
                {filteredInvites.map((invite) => (
                  <InviteRow
                    key={
                      invite._id ||
                      invite.id ||
                      `${invite.email}-${invite.createdAt}`
                    }
                    invite={invite}
                    working={
                      workingId ===
                      (invite._id || invite.id)
                    }
                    onCopy={() =>
                      handleCopyLink(invite)
                    }
                    onResend={() =>
                      handleResend(invite)
                    }
                    onRevoke={() =>
                      handleRevoke(invite)
                    }
                    onViewMember={() =>
                      navigate("/members")
                    }
                  />
                ))}
              </div>
            ) : null}
          </section>
        </div>

        {modalOpen ? (
          <InviteModal
            form={form}
            roles={availableRoles}
            creating={creating}
            error={error}
            onChange={setForm}
            onSubmit={handleCreate}
            onClose={closeModal}
          />
        ) : null}
      </div>
    </>
  );
}

function MetricCard({ label, value, detail }) {
  return (
    <div style={styles.metricCard}>
      <div style={styles.metricLabel}>
        {label}
      </div>

      <div style={styles.metricValue}>
        {value}
      </div>

      <div style={styles.metricDetail}>
        {detail}
      </div>
    </div>
  );
}

function InviteRow({
  invite,
  working,
  onCopy,
  onResend,
  onRevoke,
  onViewMember,
}) {
  const status = String(
    invite?.status || "pending"
  ).toLowerCase();

  const role = String(
    invite?.role || "analyst"
  ).toLowerCase();

  const pending = status === "pending";
  const expired = status === "expired";
  const accepted = status === "accepted";

  return (
    <article
      className="invite-row"
      style={styles.inviteRow}
    >
      <div style={styles.identity}>
        <div style={styles.mailIcon}>✉</div>

        <div style={styles.identityText}>
          <h3 style={styles.email}>
            {invite?.email || "No email"}
          </h3>

          <div style={styles.createdDate}>
            Created {formatDate(invite?.createdAt)}
          </div>
        </div>
      </div>

      <div style={styles.inviteDetails}>
        <div>
          <div style={styles.detailLabel}>
            Role
          </div>

          <RoleBadge role={role} />
        </div>

        <div>
          <div style={styles.detailLabel}>
            Status
          </div>

          <StatusBadge status={status} />
        </div>

        <div>
          <div style={styles.detailLabel}>
            {accepted
              ? "Accepted"
              : "Expiration"}
          </div>

          <div style={styles.dateValue}>
            {formatDate(
              accepted
                ? invite?.acceptedAt
                : invite?.expiresAt
            )}
          </div>
        </div>
      </div>

      <div style={styles.rowActions}>
        {pending ? (
          <>
            <button
              type="button"
              onClick={onCopy}
              disabled={working}
              style={styles.secondarySmallButton}
            >
              Copy Link
            </button>

            <button
              type="button"
              onClick={onResend}
              disabled={working}
              style={styles.secondarySmallButton}
            >
              {working ? "Working..." : "Resend"}
            </button>

            <button
              type="button"
              onClick={onRevoke}
              disabled={working}
              style={styles.dangerSmallButton}
            >
              Revoke
            </button>
          </>
        ) : null}

        {expired ? (
          <>
            <button
              type="button"
              onClick={onResend}
              disabled={working}
              style={styles.secondarySmallButton}
            >
              {working
                ? "Working..."
                : "Renew & Resend"}
            </button>

            <button
              type="button"
              onClick={onRevoke}
              disabled={working}
              style={styles.dangerSmallButton}
            >
              Revoke
            </button>
          </>
        ) : null}

        {accepted ? (
          <button
            type="button"
            onClick={onViewMember}
            style={styles.secondarySmallButton}
          >
            View Member
          </button>
        ) : null}

        {status === "revoked" ? (
          <span style={styles.noAction}>
            No active link
          </span>
        ) : null}
      </div>
    </article>
  );
}

function InviteModal({
  form,
  roles,
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
              New workspace access
            </div>

            <h2 style={styles.modalTitle}>
              Invite Member
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

            <label style={styles.field}>
              <span style={styles.fieldLabel}>
                Email address
              </span>

              <input
                type="email"
                value={form.email}
                onChange={(event) =>
                  onChange((current) => ({
                    ...current,
                    email: event.target.value,
                  }))
                }
                placeholder="person@company.com"
                required
                autoFocus
                style={styles.input}
              />
            </label>

            <label style={styles.field}>
              <span style={styles.fieldLabel}>
                Workspace role
              </span>

              <select
                value={form.role}
                onChange={(event) =>
                  onChange((current) => ({
                    ...current,
                    role: event.target.value,
                  }))
                }
                style={styles.input}
              >
                {roles.map((role) => (
                  <option
                    key={role}
                    value={role}
                  >
                    {ROLE_LABELS[role]}
                  </option>
                ))}
              </select>
            </label>

            <div style={styles.roleDescription}>
              {ROLE_DESCRIPTIONS[form.role]}
            </div>

            <div style={styles.securityNote}>
              The invitation expires after seven
              days. Workspace ownership cannot be
              assigned through an invitation.
            </div>
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
              disabled={
                creating || !form.email.trim()
              }
              style={styles.primaryButton}
            >
              {creating
                ? "Sending..."
                : "Send Invitation"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function RoleBadge({ role }) {
  const colors = {
    admin: {
      color: "#7dd3fc",
      background: "rgba(56,189,248,0.12)",
    },
    manager: {
      color: "#fde68a",
      background: "rgba(245,158,11,0.12)",
    },
    analyst: {
      color: "#c4b5fd",
      background: "rgba(167,139,250,0.12)",
    },
    member: {
      color: "#bfdbfe",
      background: "rgba(59,130,246,0.12)",
    },
    viewer: {
      color: "#cbd5e1",
      background: "rgba(148,163,184,0.12)",
    },
  };

  return (
    <span
      style={{
        ...styles.badge,
        ...(colors[role] || colors.viewer),
      }}
    >
      {ROLE_LABELS[role] || "Analyst"}
    </span>
  );
}

function StatusBadge({ status }) {
  const colors = {
    pending: {
      color: "#fde68a",
      background: "rgba(245,158,11,0.12)",
    },
    accepted: {
      color: "#86efac",
      background: "rgba(34,197,94,0.12)",
    },
    expired: {
      color: "#fda4af",
      background: "rgba(244,63,94,0.12)",
    },
    revoked: {
      color: "#cbd5e1",
      background: "rgba(148,163,184,0.12)",
    },
  };

  return (
    <span
      style={{
        ...styles.badge,
        ...(colors[status] || colors.revoked),
      }}
    >
      {STATUS_LABELS[status] || "Unknown"}
    </span>
  );
}

function formatDate(value) {
  if (!value) return "Unavailable";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unavailable";
  }

  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
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
    maxWidth: 650,
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
    lineHeight: 1.5,
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

  invitesSection: {
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
    fontSize: 18,
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

  inviteList: {
    display: "grid",
    gap: 9,
    padding: 14,
  },

  inviteRow: {
    display: "grid",
    gridTemplateColumns:
      "minmax(240px, 1fr) minmax(370px, 1.25fr) auto",
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

  mailIcon: {
    width: 42,
    height: 42,
    flex: "0 0 42px",
    display: "grid",
    placeItems: "center",
    borderRadius: 12,
    background:
      "linear-gradient(135deg, rgba(37,99,235,0.28), rgba(79,70,229,0.22))",
    color: "#bfdbfe",
    fontSize: 15,
  },

  identityText: {
    minWidth: 0,
  },

  email: {
    margin: 0,
    overflow: "hidden",
    color: "#ffffff",
    fontSize: 14,
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },

  createdDate: {
    marginTop: 6,
    color: "rgba(148,163,184,0.67)",
    fontSize: 10,
  },

  inviteDetails: {
    display: "grid",
    gridTemplateColumns:
      "repeat(3, minmax(90px, 1fr))",
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

  badge: {
    display: "inline-flex",
    padding: "5px 8px",
    borderRadius: 999,
    fontSize: 10,
    fontWeight: 850,
  },

  dateValue: {
    color: "#dbe4f0",
    fontSize: 10,
    fontWeight: 750,
  },

  rowActions: {
    display: "flex",
    justifyContent: "flex-end",
    flexWrap: "wrap",
    gap: 7,
  },

  secondarySmallButton: {
    padding: "8px 10px",
    border: "1px solid rgba(96,165,250,0.2)",
    borderRadius: 9,
    background: "rgba(37,99,235,0.08)",
    color: "#bfdbfe",
    fontSize: 10,
    fontWeight: 850,
    cursor: "pointer",
  },

  dangerSmallButton: {
    padding: "8px 10px",
    border: "1px solid rgba(248,113,113,0.18)",
    borderRadius: 9,
    background: "rgba(127,29,29,0.12)",
    color: "#fca5a5",
    fontSize: 10,
    fontWeight: 850,
    cursor: "pointer",
  },

  noAction: {
    color: "rgba(148,163,184,0.55)",
    fontSize: 10,
    fontWeight: 750,
  },

  modalOverlay: {
    position: "fixed",
    inset: 0,
    zIndex: 1000,
    display: "grid",
    placeItems: "center",
    padding: 18,
    background: "rgba(1,4,12,0.78)",
    backdropFilter: "blur(8px)",
  },

  modal: {
    width: "100%",
    maxWidth: 540,
    overflow: "hidden",
    border: "1px solid rgba(255,255,255,0.11)",
    borderRadius: 18,
    background: "#0a0f1e",
    boxShadow: "0 28px 90px rgba(0,0,0,0.55)",
  },

  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 15,
    padding: 18,
    borderBottom: "1px solid rgba(255,255,255,0.08)",
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
  },

  roleDescription: {
    marginTop: -5,
    color: "rgba(148,163,184,0.7)",
    fontSize: 11,
    lineHeight: 1.45,
  },

  securityNote: {
    padding: 11,
    border: "1px solid rgba(59,130,246,0.15)",
    borderRadius: 11,
    background: "rgba(37,99,235,0.065)",
    color: "rgba(191,219,254,0.8)",
    fontSize: 10,
    lineHeight: 1.5,
  },

  modalFooter: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 8,
    padding: 15,
    borderTop: "1px solid rgba(255,255,255,0.08)",
  },
};
