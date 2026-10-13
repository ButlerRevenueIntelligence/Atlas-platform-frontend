// frontend/src/pages/GlobalHQ.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  getWorkspaces,
  createWorkspace,
  switchWorkspace,
  deleteWorkspace,
} from "../api";

const cardStyle = {
  border: "1px solid rgba(255,255,255,0.10)",
  borderRadius: 18,
  padding: 18,
  background: "rgba(255,255,255,0.03)",
  boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
};

const muted = {
  color: "rgba(255,255,255,0.72)",
};

const buttonBase = {
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.05)",
  color: "#fff",
  borderRadius: 12,
  padding: "10px 14px",
  fontWeight: 700,
  cursor: "pointer",
};

const inputStyle = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.05)",
  color: "#fff",
  outline: "none",
};

function Badge({ children, active = false, danger = false }) {
  let background = "rgba(255,255,255,0.08)";
  let border = "1px solid rgba(255,255,255,0.12)";

  if (active) {
    background = "rgba(58, 130, 246, 0.18)";
    border = "1px solid rgba(58, 130, 246, 0.5)";
  }

  if (danger) {
    background = "rgba(239, 68, 68, 0.14)";
    border = "1px solid rgba(239, 68, 68, 0.35)";
  }

  return (
    <span className="atlas-responsive-card"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 800,
        letterSpacing: 0.3,
        background,
        border,
      }}
    >
      {children}
    </span>
  );
}

export default function GlobalHQ() {
  const [workspaces, setWorkspaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [form, setForm] = useState({
    name: "",
    slug: "",
    type: "client",
    plan: "ENTERPRISE",
    companyWebsite: "",
    industry: "",
  });

  const activeOrgId = localStorage.getItem("active_org_id");
  const activeOrgName = localStorage.getItem("active_org_name");

  async function loadWorkspaces() {
    try {
      setLoading(true);
      setError("");
      const data = await getWorkspaces();
      setWorkspaces(Array.isArray(data.workspaces) ? data.workspaces : []);
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to load workspaces");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadWorkspaces();
  }, []);

  const activeWorkspace = useMemo(() => {
    return workspaces.find((ws) => String(ws._id) === String(activeOrgId)) || null;
  }, [workspaces, activeOrgId]);

  function updateForm(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleCreateWorkspace(e) {
    e.preventDefault();

    if (!form.name.trim()) {
      setError("Workspace name is required");
      return;
    }

    try {
      setCreating(true);
      setError("");
      setSuccess("");

      const created = await createWorkspace({
        name: form.name.trim(),
        slug: form.slug.trim() || undefined,
        type: form.type,
        plan: form.plan,
        companyWebsite: form.companyWebsite.trim(),
        industry: form.industry.trim(),
      });

      if (created?.workspace?._id) {
        await switchWorkspace(created.workspace._id);
        localStorage.setItem("active_org_id", created.workspace._id);
        localStorage.setItem("active_org_name", created.workspace.name);
      }

      setForm({
        name: "",
        slug: "",
        type: "client",
        plan: "ENTERPRISE",
        companyWebsite: "",
        industry: "",
      });

      setSuccess("Workspace created successfully");
      await loadWorkspaces();
      window.location.reload();
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to create workspace");
    } finally {
      setCreating(false);
    }
  }

  async function handleSwitchWorkspace(workspace) {
    try {
      setBusyId(workspace._id);
      setError("");
      setSuccess("");

      const result = await switchWorkspace(workspace._id);

      const target = result?.activeWorkspace || workspace;

      localStorage.setItem("active_org_id", target._id);
      localStorage.setItem("active_org_name", target.name);

      setSuccess(`Switched to ${target.name}`);
      await loadWorkspaces();
      window.location.reload();
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to switch workspace");
    } finally {
      setBusyId("");
    }
  }

  async function handleDeleteWorkspace(workspace) {
    const confirmed = window.confirm(
      `Delete workspace "${workspace.name}"?\n\nThis cannot be undone.`
    );

    if (!confirmed) return;

    try {
      setBusyId(workspace._id);
      setError("");
      setSuccess("");

      await deleteWorkspace(workspace._id);

      setSuccess(`Deleted ${workspace.name}`);
      await loadWorkspaces();
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to delete workspace");
    } finally {
      setBusyId("");
    }
  }

  return (
    <div style={{ padding: 20 }}>
      <div style={{ ...cardStyle, marginBottom: 18 }}>
        <div className="atlas-responsive-row"
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <div>
            <div
              style={{
                fontSize: 12,
                letterSpacing: 1.2,
                textTransform: "uppercase",
                fontWeight: 900,
                color: "rgba(255,255,255,0.62)",
                marginBottom: 8,
              }}
            >
              Organization Command Center
            </div>
            <div style={{ fontSize: 40, fontWeight: 900, lineHeight: 1 }}>
              Global HQ
            </div>
            <div style={{ ...muted, marginTop: 10, maxWidth: 850 }}>
              Manage organization context, switch workspaces, create new workspace
              environments, and control the active operating scope across Atlas.
            </div>
          </div>

          <div style={{ minWidth: 260 }}>
            <div style={{ ...cardStyle, padding: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 900, marginBottom: 6, ...muted }}>
                CURRENT ACTIVE WORKSPACE
              </div>
              <div style={{ fontSize: 18, fontWeight: 900 }}>
                {activeWorkspace?.name || activeOrgName || "No active workspace"}
              </div>
              <div style={{ ...muted, marginTop: 6 }}>
                {activeWorkspace?.slug || "Select a workspace below"}
              </div>
            </div>
          </div>
        </div>
      </div>

      {(error || success) && (
        <div
          style={{
            ...cardStyle,
            marginBottom: 18,
            border: error
              ? "1px solid rgba(239,68,68,0.35)"
              : "1px solid rgba(34,197,94,0.35)",
            background: error
              ? "rgba(239,68,68,0.08)"
              : "rgba(34,197,94,0.08)",
          }}
        >
          <strong>{error ? "Error:" : "Success:"}</strong>{" "}
          {error ? error : success}
        </div>
      )}

      <div className="atlas-responsive-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "1.15fr 1fr",
          gap: 18,
          alignItems: "start",
        }}
      >
        <div style={cardStyle}>
          <div
            style={{
              fontSize: 12,
              letterSpacing: 1.2,
              textTransform: "uppercase",
              fontWeight: 900,
              color: "rgba(255,255,255,0.62)",
              marginBottom: 10,
            }}
          >
            Create Workspace
          </div>

          <div style={{ fontSize: 28, fontWeight: 900, marginBottom: 14 }}>
            New Workspace
          </div>

          <form onSubmit={handleCreateWorkspace}>
            <div style={{ display: "grid", gap: 12 }}>
              <div>
                <div style={{ ...muted, marginBottom: 6 }}>Workspace Name</div>
                <input
                  style={inputStyle}
                  value={form.name}
                  onChange={(e) => updateForm("name", e.target.value)}
                  placeholder="Global Emerging Market Manager (GEMM)"
                />
              </div>

              <div>
                <div style={{ ...muted, marginBottom: 6 }}>Custom Slug (optional)</div>
                <input
                  style={inputStyle}
                  value={form.slug}
                  onChange={(e) => updateForm("slug", e.target.value)}
                  placeholder="gemm"
                />
              </div>

              <div className="atlas-responsive-grid"
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 12,
                }}
              >
                <div>
                  <div style={{ ...muted, marginBottom: 6 }}>Workspace Type</div>
                  <select
                    style={inputStyle}
                    value={form.type}
                    onChange={(e) => updateForm("type", e.target.value)}
                  >
                    <option value="client">client</option>
                    <option value="agency">agency</option>
                  </select>
                </div>

                <div>
                  <div style={{ ...muted, marginBottom: 6 }}>Plan</div>
                  <select
                    style={inputStyle}
                    value={form.plan}
                    onChange={(e) => updateForm("plan", e.target.value)}
                  >
                    <option value="SCALE">SCALE</option>
                    <option value="GROWTH">GROWTH</option>
                    <option value="ENTERPRISE">ENTERPRISE</option>
                  </select>
                </div>
              </div>

              <div>
                <div style={{ ...muted, marginBottom: 6 }}>Company Website</div>
                <input
                  style={inputStyle}
                  value={form.companyWebsite}
                  onChange={(e) => updateForm("companyWebsite", e.target.value)}
                  placeholder="https://example.com"
                />
              </div>

              <div>
                <div style={{ ...muted, marginBottom: 6 }}>Industry</div>
                <input
                  style={inputStyle}
                  value={form.industry}
                  onChange={(e) => updateForm("industry", e.target.value)}
                  placeholder="Finance"
                />
              </div>

              <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
                <button type="submit" disabled={creating} style={buttonBase}>
                  {creating ? "Creating..." : "Create Workspace"}
                </button>

                <button
                  type="button"
                  style={buttonBase}
                  onClick={() =>
                    setForm({
                      name: "",
                      slug: "",
                      type: "client",
                      plan: "ENTERPRISE",
                      companyWebsite: "",
                      industry: "",
                    })
                  }
                >
                  Clear
                </button>
              </div>
            </div>
          </form>
        </div>

        <div style={cardStyle}>
          <div
            style={{
              fontSize: 12,
              letterSpacing: 1.2,
              textTransform: "uppercase",
              fontWeight: 900,
              color: "rgba(255,255,255,0.62)",
              marginBottom: 10,
            }}
          >
            Workspace Stats
          </div>

          <div style={{ display: "grid", gap: 12 }}>
            <div style={cardStyle}>
              <div style={{ ...muted, fontWeight: 800 }}>Total Workspaces</div>
              <div style={{ fontSize: 36, fontWeight: 900 }}>{workspaces.length}</div>
            </div>

            <div style={cardStyle}>
              <div style={{ ...muted, fontWeight: 800 }}>Owner Access</div>
              <div style={{ fontSize: 36, fontWeight: 900 }}>
                {workspaces.filter((ws) => ws.role === "owner").length}
              </div>
            </div>

            <div style={cardStyle}>
              <div style={{ ...muted, fontWeight: 800 }}>Active Workspace</div>
              <div style={{ fontSize: 20, fontWeight: 900 }}>
                {activeWorkspace?.name || activeOrgName || "None selected"}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ ...cardStyle, marginTop: 18 }}>
        <div
          style={{
            fontSize: 12,
            letterSpacing: 1.2,
            textTransform: "uppercase",
            fontWeight: 900,
            color: "rgba(255,255,255,0.62)",
            marginBottom: 10,
          }}
        >
          Workspace Directory
        </div>

        <div style={{ fontSize: 28, fontWeight: 900, marginBottom: 14 }}>
          All Workspaces
        </div>

        {loading ? (
          <div style={muted}>Loading workspaces...</div>
        ) : workspaces.length === 0 ? (
          <div style={muted}>No workspaces found.</div>
        ) : (
          <div style={{ display: "grid", gap: 14 }}>
            {workspaces.map((workspace) => {
              const isActive = String(workspace._id) === String(activeOrgId);
              const isBusy = busyId === workspace._id;

              return (
                <div key={workspace._id} style={cardStyle}>
                  <div className="atlas-responsive-row"
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 14,
                      flexWrap: "wrap",
                      alignItems: "flex-start",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 24, fontWeight: 900 }}>
                        {workspace.name}
                      </div>

                      <div style={{ ...muted, marginTop: 8 }}>
                        Slug: {workspace.slug}
                      </div>

                      <div style={{ ...muted, marginTop: 4 }}>
                        Plan: {workspace.plan} • Type: {workspace.type} • Role:{" "}
                        {workspace.role || "member"}
                      </div>
                    </div>

                    <div className="atlas-responsive-row" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {isActive ? (
                        <Badge active>Active Workspace</Badge>
                      ) : (
                        <Badge>Available Workspace</Badge>
                      )}

                      {workspace.role === "owner" && <Badge>Owner</Badge>}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
                    {!isActive ? (
                      <button
                        style={buttonBase}
                        disabled={isBusy}
                        onClick={() => handleSwitchWorkspace(workspace)}
                      >
                        {isBusy ? "Switching..." : "Switch Workspace"}
                      </button>
                    ) : (
                      <button style={{ ...buttonBase, opacity: 0.6 }} disabled>
                        Active
                      </button>
                    )}

                    {!isActive && workspace.role === "owner" ? (
                      <button
                        style={{
                          ...buttonBase,
                          border: "1px solid rgba(239,68,68,0.35)",
                          background: "rgba(239,68,68,0.10)",
                        }}
                        disabled={isBusy}
                        onClick={() => handleDeleteWorkspace(workspace)}
                      >
                        {isBusy ? "Deleting..." : "Delete"}
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}