import React, { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  logout,
  getActiveOrgId,
  getActiveOrgName,
  getWorkspaces,
  getActiveWorkspace,
  switchWorkspace,
  getMyOrgs,
  apiGet,
} from "../api";
import {
  getPermissions,
  getPlan,
  hasPerm,
  hasPlan,
} from "../utils/perms";
import TrialBanner from "./TrialBanner";
import PaywallModal from "./PaywallModal";

const baseLink = {
  textDecoration: "none",
  fontWeight: 800,
  fontSize: 12,
  letterSpacing: 0.12,
  color: "#EAF0FF",
  padding: "8px 12px",
  borderRadius: 12,
  transition: "all 160ms ease",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 34,
  lineHeight: 1,
};

const navLinkStyle = ({ isActive }) => ({
  ...baseLink,
  border: isActive
    ? "1px solid rgba(96,165,250,0.42)"
    : "1px solid rgba(255,255,255,0.07)",
  background: isActive
    ? "linear-gradient(180deg, rgba(37,99,235,0.24), rgba(29,78,216,0.18))"
    : "rgba(255,255,255,0.028)",
  boxShadow: isActive
    ? "0 0 0 1px rgba(59,130,246,0.08), 0 6px 18px rgba(37,99,235,0.16)"
    : "none",
});

const pill = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "6px 10px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.07)",
  background: "rgba(255,255,255,0.035)",
  color: "#EAF0FF",
  fontSize: 11,
  lineHeight: 1,
  whiteSpace: "nowrap",
};

const label = {
  fontSize: 10,
  fontWeight: 900,
  letterSpacing: 0.8,
  color: "rgba(226,232,240,0.48)",
  minWidth: 88,
  paddingTop: 8,
};

function NavRow({ title, children }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "88px 1fr",
        gap: 10,
        alignItems: "start",
      }}
    >
      <div style={label}>{title}</div>
      <div
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        {children}
      </div>
    </div>
  );
}

function workspaceIdFromItem(item) {
  return (
    item?.workspace?._id ||
    item?.workspace?.id ||
    item?._id ||
    item?.id ||
    item?.orgId ||
    item?.workspaceId ||
    ""
  );
}

function workspaceNameFromItem(item) {
  return (
    item?.workspace?.name ||
    item?.name ||
    item?.orgName ||
    item?.workspaceName ||
    "Workspace"
  );
}

function normalizeBillingState(me) {
  const billingStatus =
    me?.billing?.status ||
    me?.activeWorkspace?.billing?.status ||
    "";

  const paymentStatus =
    me?.paymentStatus ||
    me?.activeWorkspace?.paymentStatus ||
    "";

  const accessStatus =
    me?.accessStatus ||
    me?.activeWorkspace?.status ||
    "";

  const trialStatus =
    me?.trial?.status ||
    me?.activeWorkspace?.trial?.status ||
    "";

  const workspaceActive = Boolean(me?.workspaceActive);
  const trialExpired = Boolean(me?.trialExpired) || trialStatus === "expired";

  const blocked =
    !workspaceActive ||
    trialExpired ||
    ["past_due", "canceled", "inactive"].includes(String(billingStatus).toLowerCase()) ||
    ["past_due", "canceled", "pending"].includes(String(paymentStatus).toLowerCase()) ||
    ["suspended"].includes(String(accessStatus).toLowerCase());

  return {
    billingStatus: String(billingStatus || "").toLowerCase(),
    paymentStatus: String(paymentStatus || "").toLowerCase(),
    accessStatus: String(accessStatus || "").toLowerCase(),
    trialStatus: String(trialStatus || "").toLowerCase(),
    workspaceActive,
    trialExpired,
    blocked,
  };
}

function getPaywallCopy(state) {
  if (state.trialExpired) {
    return {
      title: "Your trial has expired",
      message:
        "Your Atlas trial has ended. Upgrade your workspace to restore access to command center, forecasting, reporting, and revenue intelligence.",
    };
  }

  if (state.paymentStatus === "past_due" || state.billingStatus === "past_due") {
    return {
      title: "Billing issue detected",
      message:
        "Your workspace billing is past due. Update your billing to restore full access to Atlas.",
    };
  }

  if (state.accessStatus === "suspended") {
    return {
      title: "Workspace suspended",
      message:
        "This workspace is currently suspended. Visit billing to restore access.",
    };
  }

  return {
    title: "Workspace access required",
    message:
      "This workspace no longer has active access. Visit billing to continue using Atlas.",
  };
}

export default function AppLayout() {
  const nav = useNavigate();
  const location = useLocation();
  const isBillingPage = location.pathname === "/billing";

  const [permissions, setPermissions] = useState(() => getPermissions());
  const [activePlan, setActivePlan] = useState(() => getPlan());

  const [paywallData, setPaywallData] = useState(null);
  const [workspaceBlocked, setWorkspaceBlocked] = useState(false);

  const can = (perm) => hasPerm(permissions, perm);
  const canUsePlan = (requiredPlan) => hasPlan(requiredPlan, activePlan);

  const initialOrgId = getActiveOrgId();
  const initialWorkspace = getActiveWorkspace();

  const [workspaceLabel, setWorkspaceLabel] = useState(
    () => getActiveOrgName() || initialWorkspace?.name || initialOrgId || "—"
  );

  const [workspaceOptions, setWorkspaceOptions] = useState(() => {
    const stored = getWorkspaces();
    return Array.isArray(stored) ? stored : [];
  });

  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState(
    () => initialOrgId || initialWorkspace?._id || initialWorkspace?.id || ""
  );

  const [switchingWorkspace, setSwitchingWorkspace] = useState(false);

  useEffect(() => {
    const sync = () => {
      const activeOrgIdValue = getActiveOrgId();
      const activeOrgName = getActiveOrgName();
      const activeWorkspace = getActiveWorkspace();
      const storedWorkspaces = getWorkspaces();

      setPermissions(getPermissions());
      setActivePlan(getPlan());
      setWorkspaceLabel(
        activeOrgName || activeWorkspace?.name || activeOrgIdValue || "—"
      );
      setSelectedWorkspaceId(
        activeOrgIdValue || activeWorkspace?._id || activeWorkspace?.id || ""
      );
      setWorkspaceOptions(Array.isArray(storedWorkspaces) ? storedWorkspaces : []);
    };

    async function bootstrapWorkspacePlan() {
      try {
        await getMyOrgs();
      } catch (err) {
        console.error("Workspace bootstrap sync failed:", err);
      } finally {
        sync();
      }
    }

    sync();
    bootstrapWorkspacePlan();

    const onStorage = (e) => {
      if (
        e.key === "butler_user" ||
        e.key === "user" ||
        e.key === "x-org-id" ||
        e.key === "orgId" ||
        e.key === "butler_org_id" ||
        e.key === "active_org_id" ||
        e.key === "butler_active_org_id" ||
        e.key === "activeOrgName" ||
        e.key === "butler_active_org_name" ||
        e.key === "activeWorkspace" ||
        e.key === "workspaces" ||
        e.key === "membership" ||
        e.key === "active_org_plan" ||
        e.key === "org_plan" ||
        e.key === "plan"
      ) {
        sync();
      }
    };

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    function handleLimit(e) {
      setPaywallData(
        e.detail || { message: "Usage limit reached. Upgrade to continue." }
      );
    }

    window.addEventListener("atlas:usage-limit", handleLimit);
    return () => window.removeEventListener("atlas:usage-limit", handleLimit);
  }, []);

  useEffect(() => {
    let mounted = true;

    async function checkWorkspaceState() {
      try {
        const me = await apiGet("/me");
        if (!mounted) return;

        const state = normalizeBillingState(me);
        setWorkspaceBlocked(state.blocked);

        if (state.blocked) {
          setPaywallData(getPaywallCopy(state));
        } else {
          setPaywallData(null);
        }
      } catch (err) {
        console.error("Workspace access state check failed:", err);
      }
    }

    checkWorkspaceState();
    return () => {
      mounted = false;
    };
  }, [selectedWorkspaceId]);

  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const localTime = useMemo(() => {
    try {
      return now.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "";
    }
  }, [now]);

  const hqTime = useMemo(() => {
    try {
      return now.toLocaleTimeString([], {
        timeZone: "America/New_York",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "";
    }
  }, [now]);

  const localTz = useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    } catch {
      return "";
    }
  }, []);

  async function handleWorkspaceChange(e) {
    const nextId = e.target.value;
    setSelectedWorkspaceId(nextId);

    if (!nextId || nextId === getActiveOrgId()) {
      return;
    }

    try {
      setSwitchingWorkspace(true);
      const res = await switchWorkspace(nextId);

      const nextName =
        res?.activeWorkspace?.name ||
        workspaceOptions.find((w) => workspaceIdFromItem(w) === nextId)?.workspace?.name ||
        workspaceOptions.find((w) => workspaceIdFromItem(w) === nextId)?.name ||
        "Workspace";

      const membershipPerms = res?.membership?.permissions || [];
      setPermissions(membershipPerms);
      setActivePlan(getPlan());
      setWorkspaceLabel(nextName);

      nav("/command-center", { replace: true });
    } catch (err) {
      console.error("Workspace switch failed:", err);
      alert(err?.message || "Failed to switch workspace.");
      setSelectedWorkspaceId(getActiveOrgId() || "");
    } finally {
      setSwitchingWorkspace(false);
    }
  }

  const visibleWorkspaceOptions = Array.isArray(workspaceOptions)
    ? workspaceOptions.filter(Boolean)
    : [];

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(900px 460px at 10% 0%, rgba(37,99,235,0.16), transparent 55%), radial-gradient(700px 420px at 85% 0%, rgba(99,102,241,0.10), transparent 55%), linear-gradient(180deg, #060915 0%, #070b18 100%)",
      }}
    >
      <TrialBanner />

      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          backdropFilter: "blur(14px)",
          background: "rgba(6,10,20,0.80)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div
          style={{
            maxWidth: 1440,
            margin: "0 auto",
            padding: "10px 18px 10px",
            display: "grid",
            gap: 10,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 14,
              flexWrap: "wrap",
            }}
          >
            <div
              style={{
                display: "grid",
                gap: 3,
                minWidth: 190,
              }}
            >
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 1000,
                  lineHeight: 1,
                  letterSpacing: -0.35,
                  color: "#F8FAFC",
                }}
              >
                Atlas Revenue AI
              </div>

              <div
                style={{
                  fontSize: 11,
                  color: "rgba(226,232,240,0.66)",
                }}
              >
                Revenue Operating System
              </div>
            </div>

            <div
              style={{
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
                justifyContent: "flex-end",
                alignItems: "center",
              }}
            >
              <div style={pill}>
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: 999,
                    background: workspaceBlocked ? "#fb7185" : "#22c55e",
                    boxShadow: workspaceBlocked
                      ? "0 0 8px rgba(251,113,133,0.5)"
                      : "0 0 8px rgba(34,197,94,0.5)",
                  }}
                />
                <strong>{workspaceBlocked ? "Access Limited" : "Systems Online"}</strong>
              </div>

              {visibleWorkspaceOptions.length > 0 ? (
                <div
                  style={{
                    ...pill,
                    gap: 8,
                    paddingRight: 8,
                  }}
                >
                  <span>Workspace:</span>
                  <select
                    value={selectedWorkspaceId}
                    onChange={handleWorkspaceChange}
                    disabled={switchingWorkspace}
                    style={{
                      background: "transparent",
                      color: "#EAF0FF",
                      border: "none",
                      outline: "none",
                      fontWeight: 800,
                      fontSize: 11,
                      cursor: switchingWorkspace ? "wait" : "pointer",
                    }}
                  >
                    {visibleWorkspaceOptions.map((item, idx) => {
                      const value = workspaceIdFromItem(item);
                      const name = workspaceNameFromItem(item);

                      return (
                        <option
                          key={value || `${name}-${idx}`}
                          value={value}
                          style={{ color: "#0f172a" }}
                        >
                          {name}
                        </option>
                      );
                    })}
                  </select>
                </div>
              ) : (
                <div style={pill}>
                  Workspace: <strong>{workspaceLabel}</strong>
                </div>
              )}

              <div style={pill}>
                HQ (EST): <strong>{hqTime || "—"}</strong>
              </div>

              <div style={pill}>
                Local: <strong>{localTime || "—"}</strong>
                {localTz ? <span style={{ opacity: 0.68 }}>• {localTz}</span> : null}
              </div>

              <button
                onClick={() => {
                  logout();
                  nav("/login");
                }}
                style={{
                  borderRadius: 999,
                  padding: "8px 13px",
                  border: "1px solid rgba(255,255,255,0.10)",
                  background: "rgba(255,255,255,0.05)",
                  color: "#EAF0FF",
                  fontWeight: 800,
                  fontSize: 11,
                  cursor: "pointer",
                  lineHeight: 1,
                }}
              >
                Logout
              </button>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gap: 8,
              padding: 10,
              borderRadius: 18,
              border: "1px solid rgba(255,255,255,0.05)",
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.022), rgba(255,255,255,0.012))",
              boxShadow: "0 8px 22px rgba(0,0,0,0.14)",
              opacity: workspaceBlocked && !isBillingPage ? 0.55 : 1,
              pointerEvents: workspaceBlocked && !isBillingPage ? "none" : "auto",
            }}
          >
            <NavRow title="CORE">
              {can("dashboard.view") && (
                <NavLink to="/overview" style={navLinkStyle}>
                  Overview
                </NavLink>
              )}
              {can("command_center.view") && (
                <NavLink to="/command-center" style={navLinkStyle}>
                  Command Center
                </NavLink>
              )}
              {can("deal_room.view") && (
                <NavLink to="/deal-war-room" style={navLinkStyle}>
                  Deal War Room
                </NavLink>
              )}
              {can("deal_room.view") && (
                <NavLink to="/deal-room" style={navLinkStyle}>
                  Deal Room
                </NavLink>
              )}
              {can("dashboard.view") && (
                <NavLink to="/data-connectors" style={navLinkStyle}>
                  Data Connectors
                </NavLink>
              )}
              {can("clients.view") && (
                <NavLink to="/accounts" style={navLinkStyle}>
                  Accounts
                </NavLink>
              )}
              {can("partners.manage") && (
                <NavLink to="/partners" style={navLinkStyle}>
                  Partners
                </NavLink>
              )}
            </NavRow>

            {canUsePlan("GROWTH") ? (
              <NavRow title="GROWTH">
                {can("market_signals.view") && (
                  <NavLink to="/growth-engine" style={navLinkStyle}>
                    Growth Engine
                  </NavLink>
                )}
                {can("clients.view") && (
                  <NavLink to="/account-intelligence" style={navLinkStyle}>
                    Account Intelligence
                  </NavLink>
                )}
                {can("market_signals.view") && (
                  <NavLink to="/market-signals" style={navLinkStyle}>
                    Market Signals
                  </NavLink>
                )}
                {can("admin.audit") && (
                  <NavLink to="/global-revenue-map" style={navLinkStyle}>
                    Global Revenue Map
                  </NavLink>
                )}
                {can("dashboard.view") && (
                  <NavLink to="/atlas-ai-operator" style={navLinkStyle}>
                    Atlas AI Operator
                  </NavLink>
                )}
                {can("dashboard.view") && (
                  <NavLink to="/reports" style={navLinkStyle}>
                    Reports
                  </NavLink>
                )}
              </NavRow>
            ) : null}

            {canUsePlan("ENTERPRISE") && can("dashboard.view") ? (
              <NavRow title="EXECUTIVE">
                <NavLink to="/board-mode" style={navLinkStyle}>
                  Board Mode
                </NavLink>
              </NavRow>
            ) : null}

            <NavRow title="ADMIN">
              {canUsePlan("GROWTH") && can("admin.audit") && (
                <NavLink to="/global-hq" style={navLinkStyle}>
                  Global HQ
                </NavLink>
              )}
              {can("admin.audit") && (
                <NavLink to="/billing" style={navLinkStyle}>
                  Billing
                </NavLink>
              )}
              {can("admin.audit") && (
                <NavLink to="/members" style={navLinkStyle}>
                  Members
                </NavLink>
              )}
              {can("admin.audit") && (
                <NavLink to="/invites" style={navLinkStyle}>
                  Invites
                </NavLink>
              )}
            </NavRow>
          </div>
        </div>
      </div>

      <div
        style={{
          maxWidth: 1440,
          margin: "0 auto",
          padding: "14px 18px 32px",
          opacity: workspaceBlocked && !isBillingPage ? 0.55 : 1,
          pointerEvents: workspaceBlocked && !isBillingPage ? "none" : "auto",
          filter: workspaceBlocked && !isBillingPage ? "blur(1px)" : "none",
        }}
      >
        <Outlet />
      </div>

      {paywallData && !isBillingPage ? (
        <PaywallModal
          open={!!paywallData}
          title={paywallData?.title}
          message={paywallData?.message}
          onClose={() => {}}
          primaryActionLabel="Go to Billing"
          onPrimaryAction={() => nav("/billing")}
          force={workspaceBlocked}
        />
      ) : null}
    </div>
  );
}
