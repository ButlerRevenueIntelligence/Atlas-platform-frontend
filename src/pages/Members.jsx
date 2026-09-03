import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  deleteMember,
  getActiveOrgName,
  getMembers,
  updateMember,
} from "../api";

const ROLE_LABELS = {
  owner: "Owner",
  admin: "Admin",
  manager: "Manager",
  analyst: "Analyst",
  member: "Member",
  viewer: "Viewer",
};

const STATUS_LABELS = {
  active: "Active",
  invited: "Invited",
  suspended: "Suspended",
  disabled: "Disabled",
};

const ROLE_DESCRIPTIONS = {
  admin: "Full workspace administration, excluding ownership controls.",
  manager: "Manages operational workflows and team activity.",
  analyst: "Reviews data, reporting, and revenue intelligence.",
  member: "Standard access to assigned workspace capabilities.",
  viewer: "Read-only access to permitted workspace information.",
};

export default function Members() {
  const navigate = useNavigate();

  const [members, setMembers] = useState([]);
  const [viewerMembership, setViewerMembership] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [editingMember, setEditingMember] = useState(null);
  const [editForm, setEditForm] = useState({
    role: "member",
    membershipStatus: "active",
  });

  const workspaceName =
    getActiveOrgName() || "Current Workspace";

  async function loadMembers() {
    try {
      setLoading(true);
      setError("");

      const response = await getMembers();

      setMembers(
        Array.isArray(response?.members)
          ? response.members
          : []
      );

      setViewerMembership(response?.membership || null);
    } catch (err) {
      setMembers([]);

      if (err?.status === 403) {
        setError(
          "Only workspace owners and administrators can view member access."
        );
      } else {
        setError(
          err?.message || "We couldn't load workspace members."
        );
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMembers();
  }, []);

  const viewerRole = String(
    viewerMembership?.role || ""
  ).toLowerCase();

  const stats = useMemo(() => {
    return members.reduce(
      (totals, member) => {
        const role = String(
          member?.role || ""
        ).toLowerCase();

        const status = String(
          member?.membershipStatus || ""
        ).toLowerCase();

        totals.total += 1;

        if (status === "active") {
          totals.active += 1;
        }

        if (role === "owner" || role === "admin") {
          totals.elevated += 1;
        }

        if (
          status === "suspended" ||
          status === "disabled"
        ) {
          totals.restricted += 1;
        }

        return totals;
      },
      {
        total: 0,
        active: 0,
        elevated: 0,
        restricted: 0,
      }
    );
  }, [members]);

  const filteredMembers = useMemo(() => {
    const search = query.trim().toLowerCase();

    return members.filter((member) => {
      const role = String(
        member?.role || ""
      ).toLowerCase();

      const status = String(
        member?.membershipStatus || ""
      ).toLowerCase();

      const matchesSearch =
        !search ||
        String(member?.name || "")
          .toLowerCase()
          .includes(search) ||
        String(member?.email || "")
          .toLowerCase()
          .includes(search);

      const matchesRole =
        roleFilter === "all" || role === roleFilter;

      const matchesStatus =
        statusFilter === "all" ||
        status === statusFilter;

      return (
        matchesSearch &&
        matchesRole &&
        matchesStatus
      );
    });
  }, [members, query, roleFilter, statusFilter]);

  function canManageMember(member) {
    const role = String(
      member?.role || ""
    ).toLowerCase();

    if (member?.isCurrentUser) return false;
    if (member?.isProtected || role === "owner") return false;

    if (viewerRole === "owner") return true;

    if (viewerRole === "admin" && role !== "admin") {
      return true;
    }

    return false;
  }

  function openEdit(member) {
    setEditingMember(member);
    setEditForm({
      role: member?.role || "member",
      membershipStatus:
        member?.membershipStatus || "active",
    });
    setError("");
    setSuccess("");
  }

  function closeEdit() {
    if (saving) return;

    setEditingMember(null);
    setEditForm({
      role: "member",
      membershipStatus: "active",
    });
  }

  async function saveAccess(event) {
    event.preventDefault();

    if (!editingMember) return;

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      await updateMember(
        editingMember.membershipId,
        editForm
      );

      setSuccess(
        `${editingMember.name}'s workspace access was updated.`
      );

      setEditingMember(null);
      await loadMembers();
    } catch (err) {
      setError(
        err?.message ||
          "We couldn't update this member's access."
      );
    } finally {
      setSaving(false);
    }
  }

  async function removeAccess(member) {
    const confirmed = window.confirm(
      `Remove ${member.name} from ${workspaceName}? This removes access to this workspace but does not delete their Atlas account.`
    );

    if (!confirmed) return;

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      await deleteMember(member.membershipId);

      setSuccess(
        `${member.name} was removed from this workspace.`
      );

      setEditingMember(null);
      await loadMembers();
    } catch (err) {
      setError(
        err?.message ||
          "We couldn't remove this member's access."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <style>{`
        @media (max-width: 900px) {
          .member-row {
            grid-template-columns: 1fr !important;
          }
        }

        @media (max-width: 680px) {
          .member-filters {
            width: 100%;
          }

          .member-filters input,
          .member-filters select {
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

              <h1 style={styles.title}>Members & Access</h1>

              <p style={styles.subtitle}>
                Manage who can access{" "}
                <strong>{workspaceName}</strong> and what
                they’re allowed to do.
              </p>
            </div>

            <div style={styles.headerActions}>
              <button
                type="button"
                onClick={loadMembers}
                disabled={loading}
                style={styles.secondaryButton}
              >
                {loading ? "Refreshing..." : "Refresh"}
              </button>

              <button
                type="button"
                onClick={() => navigate("/invites")}
                style={styles.primaryButton}
              >
                + Invite Member
              </button>
            </div>
          </header>

          {error ? (
            <div style={styles.error}>{error}</div>
          ) : null}

          {success ? (
            <div style={styles.success}>{success}</div>
          ) : null}

          <section style={styles.statsGrid}>
            <MetricCard
              label="Total Members"
              value={stats.total}
              detail="All workspace memberships"
            />

            <MetricCard
              label="Active Access"
              value={stats.active}
              detail="Members currently able to sign in"
            />

            <MetricCard
              label="Elevated Access"
              value={stats.elevated}
              detail="Owners and administrators"
            />

            <MetricCard
              label="Restricted"
              value={stats.restricted}
              detail="Suspended or disabled memberships"
            />
          </section>

          <section style={styles.membersSection}>
            <div style={styles.sectionHeader}>
              <div>
                <div style={styles.sectionEyebrow}>
                  Access directory
                </div>

                <h2 style={styles.sectionTitle}>
                  Workspace Members
                </h2>
              </div>

              <div
                className="member-filters"
                style={styles.filters}
              >
                <input
                  value={query}
                  onChange={(event) =>
                    setQuery(event.target.value)
                  }
                  placeholder="Search name or email..."
                  style={styles.search}
                />

                <select
                  value={roleFilter}
                  onChange={(event) =>
                    setRoleFilter(event.target.value)
                  }
                  style={styles.select}
                >
                  <option value="all">All roles</option>
                  <option value="owner">Owner</option>
                  <option value="admin">Admin</option>
                  <option value="manager">Manager</option>
                  <option value="analyst">Analyst</option>
                  <option value="member">Member</option>
                  <option value="viewer">Viewer</option>
                </select>

                <select
                  value={statusFilter}
                  onChange={(event) =>
                    setStatusFilter(event.target.value)
                  }
                  style={styles.select}
                >
                  <option value="all">All statuses</option>
                  <option value="active">Active</option>
                  <option value="invited">Invited</option>
                  <option value="suspended">Suspended</option>
                  <option value="disabled">Disabled</option>
                </select>
              </div>
            </div>

            {loading ? (
              <div style={styles.emptyState}>
                Loading workspace members...
              </div>
            ) : null}

            {!loading &&
            !error &&
            members.length === 0 ? (
              <div style={styles.emptyState}>
                No workspace members found.
              </div>
            ) : null}

            {!loading &&
            members.length > 0 &&
            filteredMembers.length === 0 ? (
              <div style={styles.emptyState}>
                No members match your search or filters.
              </div>
            ) : null}

            {!loading && filteredMembers.length > 0 ? (
              <div style={styles.memberList}>
                {filteredMembers.map((member) => (
                  <MemberRow
                    key={member.membershipId}
                    member={member}
                    manageable={canManageMember(member)}
                    onEdit={() => openEdit(member)}
                  />
                ))}
              </div>
            ) : null}
          </section>
        </div>

        {editingMember ? (
          <AccessModal
            member={editingMember}
            form={editForm}
            viewerRole={viewerRole}
            saving={saving}
            onChange={setEditForm}
            onSave={saveAccess}
            onRemove={() =>
              removeAccess(editingMember)
            }
            onClose={closeEdit}
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

function MemberRow({
  member,
  manageable,
  onEdit,
}) {
  const role = String(
    member?.role || "member"
  ).toLowerCase();

  const status = String(
    member?.membershipStatus || "active"
  ).toLowerCase();

  return (
    <article className="member-row" style={styles.memberRow}>
      <div style={styles.identity}>
        <div style={styles.avatar}>
          {getInitials(member?.name)}
        </div>

        <div style={styles.identityText}>
          <div style={styles.nameRow}>
            <h3 style={styles.memberName}>
              {member?.name || "User"}
            </h3>

            {member?.isCurrentUser ? (
              <span style={styles.youBadge}>You</span>
            ) : null}
          </div>

          <div style={styles.email}>
            {member?.email || "No email available"}
          </div>
        </div>
      </div>

      <div style={styles.accessSummary}>
        <div>
          <div style={styles.accessLabel}>Role</div>
          <RoleBadge role={role} />
        </div>

        <div>
          <div style={styles.accessLabel}>Status</div>
          <StatusBadge status={status} />
        </div>

        <div>
          <div style={styles.accessLabel}>Last login</div>
          <div style={styles.dateValue}>
            {formatDate(member?.lastLoginAt)}
          </div>
        </div>

        <div>
          <div style={styles.accessLabel}>Joined</div>
          <div style={styles.dateValue}>
            {formatDate(
              member?.joinedAt || member?.createdAt
            )}
          </div>
        </div>
      </div>

      <div style={styles.rowAction}>
        {manageable ? (
          <button
            type="button"
            onClick={onEdit}
            style={styles.editButton}
          >
            Manage Access
          </button>
        ) : (
          <div style={styles.protectedText}>
            {role === "owner"
              ? "Protected owner"
              : member?.isCurrentUser
              ? "Current account"
              : "Protected access"}
          </div>
        )}
      </div>
    </article>
  );
}

function AccessModal({
  member,
  form,
  viewerRole,
  saving,
  onChange,
  onSave,
  onRemove,
  onClose,
}) {
  const availableRoles =
    viewerRole === "owner"
      ? ["admin", "manager", "analyst", "member", "viewer"]
      : ["manager", "analyst", "member", "viewer"];

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
              Workspace permissions
            </div>

            <h2 style={styles.modalTitle}>
              Manage Access
            </h2>

            <div style={styles.modalMember}>
              {member.name} · {member.email}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            style={styles.closeButton}
          >
            ×
          </button>
        </div>

        <form onSubmit={onSave}>
          <div style={styles.formBody}>
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
                {availableRoles.map((role) => (
                  <option key={role} value={role}>
                    {ROLE_LABELS[role]}
                  </option>
                ))}
              </select>
            </label>

            <div style={styles.roleDescription}>
              {ROLE_DESCRIPTIONS[form.role]}
            </div>

            <label style={styles.field}>
              <span style={styles.fieldLabel}>
                Access status
              </span>

              <select
                value={form.membershipStatus}
                onChange={(event) =>
                  onChange((current) => ({
                    ...current,
                    membershipStatus:
                      event.target.value,
                  }))
                }
                style={styles.input}
              >
                <option value="active">Active</option>
                <option value="suspended">
                  Suspended
                </option>
                <option value="disabled">
                  Disabled
                </option>
              </select>
            </label>

            <div style={styles.securityNote}>
              These changes apply only to this workspace.
              They do not change the member’s password or
              access to other Atlas workspaces.
            </div>
          </div>

          <div style={styles.modalFooter}>
            <button
              type="button"
              onClick={onRemove}
              disabled={saving}
              style={styles.removeButton}
            >
              Remove Access
            </button>

            <div style={styles.footerActions}>
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
                style={styles.primaryButton}
              >
                {saving
                  ? "Saving..."
                  : "Save Changes"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

function RoleBadge({ role }) {
  const colors = {
    owner: {
      color: "#86efac",
      background: "rgba(34,197,94,0.12)",
    },
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
      {ROLE_LABELS[role] || "Member"}
    </span>
  );
}

function StatusBadge({ status }) {
  const colors = {
    active: {
      color: "#86efac",
      background: "rgba(34,197,94,0.12)",
    },
    invited: {
      color: "#93c5fd",
      background: "rgba(59,130,246,0.12)",
    },
    suspended: {
      color: "#fda4af",
      background: "rgba(244,63,94,0.12)",
    },
    disabled: {
      color: "#cbd5e1",
      background: "rgba(148,163,184,0.12)",
    },
  };

  return (
    <span
      style={{
        ...styles.badge,
        ...(colors[status] || colors.disabled),
      }}
    >
      {STATUS_LABELS[status] || "Disabled"}
    </span>
  );
}

function getInitials(name) {
  return String(name || "U")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function formatDate(value) {
  if (!value) return "Never";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Never";
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
    borderRadius: 20,
    border: "1px solid rgba(255,255,255,0.08)",
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
    lineHeight: 1.1,
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

  membersSection: {
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

  memberList: {
    display: "grid",
    gap: 9,
    padding: 14,
  },

  memberRow: {
    display: "grid",
    gridTemplateColumns:
      "minmax(230px, 1fr) minmax(410px, 1.35fr) auto",
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

  avatar: {
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

  memberName: {
    margin: 0,
    color: "#ffffff",
    fontSize: 15,
  },

  youBadge: {
    padding: "3px 7px",
    borderRadius: 999,
    background: "rgba(59,130,246,0.12)",
    color: "#93c5fd",
    fontSize: 9,
    fontWeight: 900,
  },

  email: {
    marginTop: 5,
    overflow: "hidden",
    color: "rgba(203,213,225,0.7)",
    fontSize: 11,
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },

  accessSummary: {
    display: "grid",
    gridTemplateColumns:
      "repeat(4, minmax(85px, 1fr))",
    gap: 9,
  },

  accessLabel: {
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

  rowAction: {
    display: "flex",
    justifyContent: "flex-end",
  },

  editButton: {
    padding: "9px 12px",
    border: "1px solid rgba(96,165,250,0.22)",
    borderRadius: 9,
    background: "rgba(37,99,235,0.1)",
    color: "#bfdbfe",
    fontSize: 11,
    fontWeight: 850,
    cursor: "pointer",
  },

  protectedText: {
    color: "rgba(148,163,184,0.6)",
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
    maxWidth: 560,
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

  modalMember: {
    marginTop: 7,
    color: "rgba(203,213,225,0.7)",
    fontSize: 11,
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
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 10,
    padding: 15,
    borderTop: "1px solid rgba(255,255,255,0.08)",
  },

  footerActions: {
    display: "flex",
    gap: 8,
  },

  removeButton: {
    minHeight: 41,
    padding: "10px 13px",
    border: "1px solid rgba(248,113,113,0.2)",
    borderRadius: 10,
    background: "rgba(127,29,29,0.14)",
    color: "#fca5a5",
    fontSize: 11,
    fontWeight: 850,
    cursor: "pointer",
  },
};
