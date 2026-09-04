// frontend/src/App.jsx
import React from "react";
import { Routes, Route, Navigate, useLocation, Link } from "react-router-dom";

import Signup from "./pages/Signup.jsx";
import Login from "./pages/Login.jsx";
import ForgotPassword from "./pages/ForgotPassword.jsx";
import ResetPassword from "./pages/ResetPassword.jsx";
import PaymentSuccess from "./pages/PaymentSuccess.jsx";
import CreateWorkspace from "./pages/CreateWorkspace.jsx";
import Members from "./pages/Members.jsx";
import Welcome from "./pages/Welcome.jsx";
import Billing from "./pages/Billing.jsx";

import Dashboard from "./pages/Dashboard.jsx";
import RevenueIntel from "./pages/RevenueIntel.jsx";
import Pipeline from "./pages/Pipeline.jsx";
import Metrics from "./pages/Metrics.jsx";
import Clients from "./pages/Clients.jsx";
import ClientDetail from "./pages/ClientDetail.jsx";
import Partners from "./pages/Partners.jsx";
import Workspaces from "./pages/Workspaces.jsx";
import Invites from "./pages/Invites.jsx";
import AcceptInvite from "./pages/AcceptInvite.jsx";
import Integrations from "./pages/Integrations.jsx";

// Atlas Revenue OS pages
import DealWarRoom from "./pages/DealWarRoom.jsx";
import GrowthEngine from "./pages/GrowthEngine.jsx";
import AccountIntelligence from "./pages/AccountIntelligence.jsx";
import GlobalRevenueMap from "./pages/GlobalRevenueMap.jsx";
import Reports from "./pages/Reports.jsx";
import AtlasAIOperator from "./pages/AtlasAIOperator.jsx";
import BoardMode from "./pages/BoardMode.jsx";

import AppLayout from "./components/AppLayout.jsx";
import RequirePerm from "./components/RequirePerm.jsx";
import RequirePlan from "./components/RequirePlan.jsx";
import BillingSuccess from "./pages/BillingSuccess.jsx";

function isAuthenticated() {
  return !!localStorage.getItem("butler_token");
}

function getToken() {
  return localStorage.getItem("butler_token");
}

function getOrgId() {
  return (
    localStorage.getItem("x-org-id") ||
    localStorage.getItem("orgId") ||
    localStorage.getItem("butler_org_id") ||
    ""
  );
}

async function fetchMe() {
  const token = getToken();
  const orgId = getOrgId();

  const API_BASE = "https://atlas-revenue-backend.onrender.com";

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  if (orgId) headers["x-org-id"] = orgId;

  const res = await fetch(`${API_BASE}/api/me`, {
    method: "GET",
    headers,
    credentials: "include",
  });

  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    const text = await res.text();
    throw new Error(`Expected JSON from /api/me but got: ${text.slice(0, 120)}`);
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.message || data?.error || `Failed to load me: ${res.status}`);
  }

  return res.json();
}

function extractBillingStatus(payload) {
  return (
    payload?.billing?.status ||
    payload?.organization?.billing?.status ||
    payload?.activeWorkspace?.billing?.status ||
    payload?.org?.billing?.status ||
    payload?.user?.organization?.billing?.status ||
    payload?.user?.org?.billing?.status ||
    payload?.user?.billing?.status ||
    null
  );
}

function extractPlan(payload) {
  return (
    payload?.plan ||
    payload?.organization?.plan ||
    payload?.activeWorkspace?.plan ||
    payload?.org?.plan ||
    payload?.user?.plan ||
    payload?.user?.organization?.plan ||
    payload?.user?.org?.plan ||
    null
  );
}

function extractActiveWorkspace(payload) {
  return (
    payload?.activeWorkspace ||
    payload?.user?.activeWorkspace ||
    payload?.workspace ||
    payload?.user?.workspace ||
    null
  );
}

function extractAccessStatus(payload) {
  return String(
    payload?.accessStatus ||
      payload?.organization?.accessStatus ||
      payload?.activeWorkspace?.status ||
      payload?.org?.accessStatus ||
      payload?.status ||
      payload?.organization?.status ||
      payload?.org?.status ||
      ""
  ).toLowerCase();
}

function extractTrialStatus(payload) {
  return String(
    payload?.trial?.status ||
      payload?.organization?.trial?.status ||
      payload?.activeWorkspace?.trial?.status ||
      payload?.org?.trial?.status ||
      ""
  ).toLowerCase();
}

function hasActiveAccess(payload) {
  const workspaceActive = payload?.workspaceActive;
  if (typeof workspaceActive === "boolean") {
    return workspaceActive;
  }

  const billingStatus = String(extractBillingStatus(payload) || "").toLowerCase();
  const plan = String(extractPlan(payload) || "").toUpperCase();
  const trialStatus = extractTrialStatus(payload);
  const accessStatus = extractAccessStatus(payload);

  const paidActive =
    (plan === "SCALE" || plan === "GROWTH" || plan === "ENTERPRISE") &&
    billingStatus === "active";

  const trialActive = trialStatus === "trialing";
  const billingActive = billingStatus === "active" || billingStatus === "trialing";
  const accessAllowed = accessStatus === "active" || accessStatus === "";

  return accessAllowed && (paidActive || trialActive || billingActive);
}

function isTrialExpired(payload) {
  if (typeof payload?.trialExpired === "boolean") {
    return payload.trialExpired;
  }

  const trialStatus = extractTrialStatus(payload);
  return trialStatus === "expired";
}

function BillingRequired() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(1200px 700px at 15% 15%, rgba(124,92,255,0.22), transparent 60%), radial-gradient(1000px 650px at 85% 30%, rgba(56,189,248,0.18), transparent 60%), linear-gradient(180deg, rgba(5,8,18,1) 0%, rgba(7,12,28,1) 55%, rgba(5,8,18,1) 100%)",
        color: "#EAF0FF",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 640,
          borderRadius: 20,
          padding: 28,
          border: "1px solid rgba(255,255,255,0.10)",
          background: "rgba(255,255,255,0.04)",
          boxShadow: "0 24px 60px rgba(0,0,0,0.35)",
          backdropFilter: "blur(12px)",
        }}
      >
        <div style={{ fontSize: 30, fontWeight: 900, marginBottom: 10 }}>
          Billing activation required
        </div>

        <div style={{ fontSize: 15, opacity: 0.9, lineHeight: 1.7 }}>
          Your workspace is authenticated, but Atlas billing is not active yet.
          Complete your subscription to continue using the platform.
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 24 }}>
          <Link
            to="/billing"
            style={{
              textDecoration: "none",
              borderRadius: 999,
              padding: "12px 18px",
              fontWeight: 900,
              color: "#fff",
              background: "linear-gradient(90deg, #2563eb, #38bdf8)",
              border: "1px solid rgba(255,255,255,0.10)",
            }}
          >
            Go to billing
          </Link>

          <Link
            to="/login"
            style={{
              textDecoration: "none",
              borderRadius: 999,
              padding: "12px 18px",
              fontWeight: 900,
              color: "#EAF0FF",
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.10)",
            }}
          >
            Back to login
          </Link>
        </div>
      </div>
    </div>
  );
}

function RequireAuth({ children }) {
  const location = useLocation();
  const [checked, setChecked] = React.useState(false);

  React.useEffect(() => {
    setChecked(true);
  }, []);

  if (!checked) return null;

  if (!isAuthenticated()) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return children;
}

function RequireBilling({ children }) {
  const [loading, setLoading] = React.useState(true);
  const [billingActive, setBillingActive] = React.useState(false);
  const [hasWorkspace, setHasWorkspace] = React.useState(true);
  const [trialExpired, setTrialExpired] = React.useState(false);

  React.useEffect(() => {
    let mounted = true;

    async function run() {
      try {
        const me = await fetchMe();
        const active = hasActiveAccess(me);
        const activeWorkspace = extractActiveWorkspace(me);
        const expired = isTrialExpired(me);

        if (mounted) {
          setBillingActive(active);
          setHasWorkspace(!!activeWorkspace);
          setTrialExpired(expired);
        }
      } catch (err) {
        console.error("Billing/workspace check failed:", err);
        if (mounted) {
          setBillingActive(false);
          setHasWorkspace(false);
          setTrialExpired(false);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    run();

    return () => {
      mounted = false;
    };
  }, []);

  if (loading) return null;

  if (!hasWorkspace) {
    return <Navigate to="/create-workspace" replace />;
  }

  if (trialExpired) {
    return <Navigate to="/billing" replace />;
  }

  if (!billingActive) {
    return <Navigate to="/billing-required" replace />;
  }

  return children;
}

function RedirectIfAuth({ children }) {
  const [checked, setChecked] = React.useState(false);
  const [redirectTo, setRedirectTo] = React.useState(null);

  React.useEffect(() => {
    let mounted = true;

    async function run() {
      if (!isAuthenticated()) {
        if (mounted) setChecked(true);
        return;
      }

      try {
        const me = await fetchMe();
        const active = hasActiveAccess(me);
        const activeWorkspace = extractActiveWorkspace(me);
        const expired = isTrialExpired(me);

        if (mounted) {
          if (!activeWorkspace) {
            setRedirectTo("/create-workspace");
          } else if (expired) {
            setRedirectTo("/billing");
          } else {
            setRedirectTo(active ? "/command-center" : "/billing-required");
          }
        }
      } catch (err) {
        console.error("Redirect billing/workspace check failed:", err);
        if (mounted) setRedirectTo("/billing-required");
      } finally {
        if (mounted) setChecked(true);
      }
    }

    run();

    return () => {
      mounted = false;
    };
  }, []);

  if (!checked) return null;

  if (redirectTo) {
    return <Navigate to={redirectTo} replace />;
  }

  return children;
}

export default function App() {
  const authed = isAuthenticated();

  return (
    <Routes>
      <Route
        path="/"
        element={<Navigate to={authed ? "/command-center" : "/login"} replace />}
      />

      <Route
        path="/signup"
        element={
          <RedirectIfAuth>
            <Signup />
          </RedirectIfAuth>
        }
      />

      <Route
        path="/login"
        element={
          <RedirectIfAuth>
            <Login />
          </RedirectIfAuth>
        }
      />

      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      <Route path="/accept-invite" element={<AcceptInvite />} />
      <Route path="/billing-required" element={<BillingRequired />} />
      <Route path="/payment-success" element={<PaymentSuccess />} />

      <Route
        path="/create-workspace"
        element={
          <RequireAuth>
            <CreateWorkspace />
          </RequireAuth>
        }
      />

      <Route
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        <Route path="/billing" element={<Billing />} />
      </Route>

      <Route
        path="/billing/success"
        element={
          <RequireAuth>
            <BillingSuccess />
          </RequireAuth>
        }
      />

      <Route
        element={
          <RequireAuth>
            <RequireBilling>
              <RequirePlan>
                <AppLayout />
              </RequirePlan>
            </RequireBilling>
          </RequireAuth>
        }
      >
        <Route
          path="/overview"
          element={
            <RequirePerm perm="dashboard.view">
              <Dashboard />
            </RequirePerm>
          }
        />

        <Route
          path="/command-center"
          element={
            <RequirePerm perm="command_center.view">
              <RevenueIntel />
            </RequirePerm>
          }
        />

        <Route
          path="/deal-room"
          element={
            <RequirePerm perm="deal_room.view">
              <Pipeline />
            </RequirePerm>
          }
        />

        <Route
          path="/market-signals"
          element={
            <RequirePerm perm="market_signals.view">
              <Metrics />
            </RequirePerm>
          }
        />

        <Route
          path="/accounts"
          element={
            <RequirePerm perm="clients.view">
              <Clients />
            </RequirePerm>
          }
        />

        <Route
          path="/partners"
          element={
            <RequirePerm perm="partners.manage">
              <Partners />
            </RequirePerm>
          }
        />

        <Route
          path="/global-hq"
          element={
            <RequirePerm perm="admin.audit">
              <Workspaces />
            </RequirePerm>
          }
        />

        <Route
          path="/integrations"
          element={
            <RequirePerm perm="dashboard.view">
              <Integrations />
            </RequirePerm>
          }
        />

        <Route
          path="/data-connectors"
          element={
            <RequirePerm perm="dashboard.view">
              <Integrations />
            </RequirePerm>
          }
        />

        <Route
          path="/invites"
          element={
            <RequirePerm perm="admin.audit">
              <Invites />
            </RequirePerm>
          }
        />

        <Route
          path="/members"
          element={
            <RequirePerm perm="admin.audit">
              <Members />
            </RequirePerm>
          }
        />

        <Route path="/clients/:id" element={<ClientDetail />} />

        <Route
          path="/deal-war-room"
          element={
            <RequirePerm perm="deal_room.view">
              <DealWarRoom />
            </RequirePerm>
          }
        />

        <Route
          path="/growth-engine"
          element={
            <RequirePerm perm="market_signals.view">
              <GrowthEngine />
            </RequirePerm>
          }
        />

        <Route
          path="/account-intelligence"
          element={
            <RequirePerm perm="clients.view">
              <AccountIntelligence />
            </RequirePerm>
          }
        />

        <Route
          path="/global-revenue-map"
          element={
            <RequirePerm perm="admin.audit">
              <GlobalRevenueMap />
            </RequirePerm>
          }
        />

        <Route
          path="/atlas-ai-operator"
          element={
            <RequirePerm perm="dashboard.view">
              <AtlasAIOperator />
            </RequirePerm>
          }
        />

        <Route
          path="/reports"
          element={
            <RequirePerm perm="dashboard.view">
              <Reports />
            </RequirePerm>
          }
        />

        <Route
          path="/board-mode"
          element={
            <RequirePerm perm="dashboard.view">
              <BoardMode />
            </RequirePerm>
          }
        />

        <Route path="/dashboard" element={<Navigate to="/overview" replace />} />
        <Route path="/revenue-intel" element={<Navigate to="/command-center" replace />} />
        <Route path="/pipeline" element={<Navigate to="/deal-war-room" replace />} />
        <Route path="/metrics" element={<Navigate to="/market-signals" replace />} />
        <Route path="/clients" element={<Navigate to="/accounts" replace />} />
        <Route path="/welcome" element={<Welcome />} />
        <Route path="/growth" element={<Navigate to="/growth-engine" replace />} />
        <Route path="/ai-operator" element={<Navigate to="/atlas-ai-operator" replace />} />
      </Route>

      <Route
        path="*"
        element={<Navigate to={authed ? "/command-center" : "/login"} replace />}
      />
    </Routes>
  );
}
