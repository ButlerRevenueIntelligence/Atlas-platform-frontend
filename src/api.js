// frontend/src/api.js
import { setPlan } from "./utils/perms";

// Build a safe API base that ALWAYS ends with /api
function buildApiBase(raw) {
  const cleaned = String(raw || "").trim().replace(/\/+$/, "");
  if (!cleaned) return "https://atlas-revenue-backend.onrender.com/api";
  return cleaned.endsWith("/api") ? cleaned : `${cleaned}/api`;
}

// Decide default base based on where the frontend is running
function getDefaultBase() {
  if (typeof window === "undefined") {
    return "https://atlas-revenue-backend.onrender.com";
  }

  const host = window.location.hostname;

  if (host === "localhost" || host === "127.0.0.1") {
    return "http://localhost:5001";
  }

  if (host.includes("onrender.com")) {
    return "https://atlas-revenue-backend.onrender.com";
  }

  return "https://atlas-revenue-backend.onrender.com";
}

export const API_BASE = buildApiBase(
  import.meta.env.VITE_API_BASE || getDefaultBase()
);


// -------------------- Shared helpers --------------------
const oid = (v) => {
  if (!v) return "";
  if (typeof v === "string") return v;
  if (typeof v === "object") {
    if (v.$oid) return v.$oid;
    if (v.id) return String(v.id);
    if (v._id) return typeof v._id === "string" ? v._id : v._id?.$oid || "";
    try {
      return String(v);
    } catch {
      return "";
    }
  }
  return "";
};

// -------------------- Token helpers --------------------
export function getToken() {
  return (
    localStorage.getItem("butler_token") ||
    localStorage.getItem("token") ||
    localStorage.getItem("atlas_token") ||
    ""
  );
}

export function setToken(token) {
  if (!token) {
    localStorage.removeItem("butler_token");
    localStorage.removeItem("token");
    localStorage.removeItem("atlas_token");
    return;
  }

  const value = String(token);
  localStorage.setItem("butler_token", value);
  localStorage.setItem("token", value);
  localStorage.setItem("atlas_token", value);
}

export function clearToken() {
  localStorage.removeItem("butler_token");
  localStorage.removeItem("token");
  localStorage.removeItem("atlas_token");
}

// -------------------- Org / Workspace helpers --------------------
export function getActiveOrgId() {
  return (
    localStorage.getItem("x-org-id") ||
    localStorage.getItem("orgId") ||
    localStorage.getItem("butler_org_id") ||
    localStorage.getItem("active_org_id") ||
    localStorage.getItem("butler_active_org_id") ||
    ""
  );
}

export function setActiveOrgId(orgId) {
  const value = orgId ? String(orgId) : "";

  if (!value) {
    localStorage.removeItem("x-org-id");
    localStorage.removeItem("orgId");
    localStorage.removeItem("butler_org_id");
    localStorage.removeItem("active_org_id");
    localStorage.removeItem("butler_active_org_id");
    return;
  }

  localStorage.setItem("x-org-id", value);
  localStorage.setItem("orgId", value);
  localStorage.setItem("butler_org_id", value);
  localStorage.setItem("active_org_id", value);
  localStorage.setItem("butler_active_org_id", value);
}

export function getActiveOrgName() {
  return (
    localStorage.getItem("activeOrgName") ||
    localStorage.getItem("butler_active_org_name") ||
    localStorage.getItem("active_org_name") ||
    ""
  );
}

export function setActiveOrgName(name) {
  const value = name ? String(name) : "";

  if (!value) {
    localStorage.removeItem("activeOrgName");
    localStorage.removeItem("butler_active_org_name");
    localStorage.removeItem("active_org_name");
    return;
  }

  localStorage.setItem("activeOrgName", value);
  localStorage.setItem("butler_active_org_name", value);
  localStorage.setItem("active_org_name", value);
}

// -------------------- User helpers --------------------
export function getUser() {
  try {
    const raw =
      localStorage.getItem("butler_user") ||
      localStorage.getItem("user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setUser(user) {
  if (!user) {
    localStorage.removeItem("butler_user");
    localStorage.removeItem("user");
    return;
  }

  const value = JSON.stringify(user);
  localStorage.setItem("butler_user", value);
  localStorage.setItem("user", value);
}

export function clearUser() {
  localStorage.removeItem("butler_user");
  localStorage.removeItem("user");
}

export function getActiveWorkspace() {
  try {
    const raw = localStorage.getItem("activeWorkspace");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setActiveWorkspace(workspace) {
  if (!workspace) {
    localStorage.removeItem("activeWorkspace");
    return;
  }

  localStorage.setItem("activeWorkspace", JSON.stringify(workspace));

  const id = oid(workspace?._id || workspace?.id);
  const name = workspace?.name || "";
  const plan = workspace?.plan || "";

  if (id) setActiveOrgId(id);
  if (name) setActiveOrgName(name);
  if (plan) setPlan(plan);
}

export function getStoredWorkspaces() {
  try {
    const raw = localStorage.getItem("workspaces");
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function setStoredWorkspaces(workspaces) {
  if (!Array.isArray(workspaces)) {
    localStorage.removeItem("workspaces");
    return;
  }

  localStorage.setItem("workspaces", JSON.stringify(workspaces));
}

export function getMembership() {
  try {
    const raw = localStorage.getItem("membership");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setMembership(membership) {
  if (!membership) {
    localStorage.removeItem("membership");
    return;
  }

  localStorage.setItem("membership", JSON.stringify(membership));
}

export function logout() {
  clearToken();
  clearUser();
  setActiveOrgId("");
  setActiveOrgName("");
  setPlan("");
  localStorage.removeItem("activeWorkspace");
  localStorage.removeItem("workspaces");
  localStorage.removeItem("membership");
  clearOnboardingState();
}

// -------------------- Org context auto-fix --------------------
function ensureOrgContext() {
  let orgId = getActiveOrgId();
  if (orgId) return orgId;

  const activeWorkspace = getActiveWorkspace();
  const workspaceId = oid(activeWorkspace?._id || activeWorkspace?.id);
  if (workspaceId) {
    setActiveOrgId(workspaceId);
    return workspaceId;
  }

  const user = getUser();
  const fallback =
    user?.orgId ||
    user?.activeWorkspace ||
    user?.scope?.orgId ||
    "";

  if (fallback) {
    setActiveOrgId(fallback);
    orgId = String(fallback);
  }

  return orgId;
}

// -------------------- Response session sync --------------------
function syncSessionFromAuthResponse(res) {
  if (!res || typeof res !== "object") return res;

  const token =
    res?.token ||
    res?.accessToken ||
    res?.data?.token ||
    res?.data?.accessToken ||
    "";

  if (token) {
    setToken(token);
  }

  const user = res?.user || res?.data?.user || null;
  if (user) {
    setUser(user);
  }

  const activeWorkspace =
    res?.activeWorkspace ||
    res?.data?.activeWorkspace ||
    res?.workspace ||
    res?.data?.workspace ||
    null;

  if (activeWorkspace) {
    setActiveWorkspace(activeWorkspace);
  }

  const workspaces =
    res?.workspaces ||
    res?.data?.workspaces ||
    null;

  if (Array.isArray(workspaces)) {
    setStoredWorkspaces(workspaces);
  }

  const membership =
    res?.membership ||
    res?.data?.membership ||
    null;

  if (membership) {
    setMembership(membership);
  }

  const orgId = oid(
    activeWorkspace?._id ||
      activeWorkspace?.id ||
      user?.orgId ||
      res?.orgId ||
      res?.workspaceId ||
      res?.activeOrgId ||
      res?.data?.orgId ||
      res?.data?.workspaceId ||
      res?.data?.activeOrgId ||
      ""
  );

  if (orgId) {
    setActiveOrgId(orgId);
  }

  const orgName =
    activeWorkspace?.name ||
    user?.orgName ||
    user?.workspaceName ||
    res?.orgName ||
    res?.workspaceName ||
    res?.data?.orgName ||
    res?.data?.workspaceName ||
    "";

  if (orgName) {
    setActiveOrgName(orgName);
  }

  const plan =
    activeWorkspace?.plan ||
    user?.plan ||
    res?.plan ||
    res?.org?.plan ||
    res?.workspace?.plan ||
    res?.data?.plan ||
    res?.data?.org?.plan ||
    res?.data?.workspace?.plan ||
    "";

  if (plan) {
    setPlan(plan);
  }

  return res;
}

// -------------------- Core request helpers --------------------
async function request(path, options = {}) {
  const token = getToken();
  const orgId = ensureOrgContext();

  const headers = { ...(options.headers || {}) };
  const isFormData = options.body instanceof FormData;

  if (!isFormData && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  if (orgId) {
    headers["x-org-id"] = String(orgId);
  }

  const isFullUrl = typeof path === "string" && /^https?:\/\//i.test(path);
  const cleanPath = path?.startsWith("/") ? path : `/${path}`;
  const url = isFullUrl ? path : `${API_BASE}${cleanPath}`;

  const res = await fetch(url, {
    ...options,
    headers,
    credentials: "include",
  });

  const text = await res.text();
  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text || null;
  }

  if (!res.ok) {
    const msg =
      (data && (data.message || data.error)) ||
      `Request failed (${res.status})`;

    if (data?.code === "USAGE_LIMIT") {
      window.dispatchEvent(
        new CustomEvent("atlas:usage-limit", {
          detail: data,
        })
      );
    }

    const err = new Error(msg);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}

export const apiGet = (path) => request(path, { method: "GET" });

export const apiPost = (path, payload) =>
  request(path, {
    method: "POST",
    body: JSON.stringify(payload || {}),
  });

export const apiPut = (path, payload) =>
  request(path, {
    method: "PUT",
    body: JSON.stringify(payload || {}),
  });

export const apiPatch = (path, payload) =>
  request(path, {
    method: "PATCH",
    body: JSON.stringify(payload || {}),
  });

export const apiDelete = (path) =>
  request(path, {
    method: "DELETE",
  });

// -------------------- Auth --------------------
export const signup = async (payload) => {
  const res = await apiPost("/auth/signup", payload);
  return syncSessionFromAuthResponse(res);
};

export const login = async (payload) => {
  const res = await apiPost("/auth/login", payload);
  return syncSessionFromAuthResponse(res);
};

export function markOnboardingComplete(goal = "Grow Revenue") {
  localStorage.setItem("atlas_onboarded", "true");
  localStorage.setItem("atlas_primary_goal", goal);
}

export function clearOnboardingState() {
  localStorage.removeItem("atlas_onboarded");
  localStorage.removeItem("atlas_primary_goal");
}

export const forgotPassword = (email) =>
  apiPost("/auth/forgot-password", { email });

export const resetPassword = (token, password) =>
  apiPost("/auth/reset-password", { token, password });

export const serverLogout = () => request("/auth/logout", { method: "POST" });

export const createCheckoutSession = (payload) =>
  apiPost("/stripe/create-checkout-session", payload);

export const createPortalSession = (payload) =>
  apiPost("/stripe/create-portal-session", payload);

export const startFreeTrial = (payload = {}) =>
  apiPost("/trial/start", payload);

export const uploadSpreadsheetData = (payload) =>
  apiPost("/imports/spreadsheet", payload);

// -------------------- Dashboard --------------------
export const getDashboard = () => apiGet("/dashboard");
export const getIntegrations = () => apiGet("/integrations");
export const connectIntegration = (id) =>
  apiPost("/integrations/connect", { id });
export const disconnectIntegration = (id) =>
  apiPost("/integrations/disconnect", { id });
export const getAttributionSummary = () => apiGet("/attribution/summary");
export const getRevenueStability = () => apiGet("/revenue-stability");
export const getForecastScenarios = () => apiGet("/forecast/scenarios");
export const getOperatorSignals = () => apiGet("/operator/signals");

// -------------------- GraphIQ --------------------
export const searchGraphIQOrganizations = (organization) =>
  apiPost("/graphiq/organizations/search", {
    organization,
  });
// -------------------- Integrations (Extended) --------------------
export const syncHubSpot = () =>
  apiPost("/integrations/hubspot/sync", {});

export const getHubSpotStatus = () =>
  apiGet("/integrations/hubspot/status");

export const getIntegrationAuthUrl = (provider) =>
  apiGet(`/integrations/${encodeURIComponent(provider)}/auth-url`);

export const selectGA4Property = (propertyId) =>
  apiPost("/integrations/ga4/select-property", { propertyId });

export const getStripeRevenueDaily = () =>
  apiGet("/integrations/stripe/revenue-daily");

export const getZohoStatus = () =>
  apiGet("/integrations/zoho_crm/status");

export const getPipedriveStatus = () =>
  apiGet("/integrations/pipedrive/status");

export const getBitrix24Status = () =>
  apiGet("/integrations/bitrix24/status");

export const syncZohoCRM = () =>
  apiPost("/integrations/zoho_crm/sync", {});

export const syncPipedrive = () =>
  apiPost("/integrations/pipedrive/sync", {});

export const syncBitrix24 = () =>
  apiPost("/integrations/bitrix24/sync", {});

export const connectBitrix24Webhook = (webhookUrl) =>
  apiPost("/integrations/bitrix24/connect-webhook", { webhookUrl });
// -------------------- Atlas AI --------------------
export const askAtlas = (question, metrics = {}) =>
  apiPost("/atlas/ask", { question, metrics });

export const analyzeWithAtlas = (payload = {}) =>
  apiPost("/ai/analyze", payload);
// -------------------- Metrics --------------------
export const getMetricsDaily = (params = {}) => {
  const qs = new URLSearchParams();

  if (params.start) qs.set("start", params.start);
  if (params.end) qs.set("end", params.end);

  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return apiGet(`/metrics/daily${suffix}`);
};

export const getMetricsSummary = (days = 30) =>
  apiGet(`/metrics/summary?days=${encodeURIComponent(days)}`);

// -------------------- Insights --------------------
export const generateInsights = (payload) =>
  apiPost("/insights/generate", payload);

// -------------------- Orgs / Legacy --------------------
export const getMyOrgs = async () => {
  const res = await apiGet("/organizations/mine");

  const list = Array.isArray(res?.orgs)
    ? res.orgs
    : Array.isArray(res)
    ? res
    : [];

  if (!getActiveOrgId()) {
    const first = list?.[0];
    const firstId = oid(
      first?._id || first?.id || first?.orgId || first?.workspaceId
    );
    const firstName =
      first?.name ||
      first?.orgName ||
      first?.workspaceName ||
      "";
    const firstPlan = first?.plan || "";

    if (firstId) setActiveOrgId(firstId);
    if (firstName) setActiveOrgName(firstName);
    if (firstPlan) setPlan(firstPlan);
  } else {
    const activeId = getActiveOrgId();

    const active = list.find(
      (o) =>
        oid(o?._id || o?.id || o?.orgId || o?.workspaceId) === activeId
    );

    if (active?.plan) {
      setPlan(active.plan);
    }
  }

  return res;
};

// Legacy alias
export const switchOrg = async (orgId) => switchWorkspace(orgId);

// -------------------- Workspaces --------------------
export const getWorkspaces = async () => {
  const res = await apiGet("/auth/workspaces");

  const workspaces = Array.isArray(res?.workspaces)
    ? res.workspaces
    : Array.isArray(res)
    ? res
    : [];

  if (Array.isArray(workspaces)) {
    setStoredWorkspaces(workspaces);
  }

  return {
    ...res,
    workspaces,
  };
};

export const createWorkspace = async (payload) => {
  const res = await apiPost("/workspaces", payload);

  const workspace = res?.workspace || null;
  const workspaceId = oid(workspace?._id || workspace?.id);
  const workspaceName = workspace?.name || "";
  const workspacePlan = workspace?.plan || res?.plan || "";

  if (workspace) {
    setActiveWorkspace(workspace);
  }

  if (workspaceId) {
    setActiveOrgId(workspaceId);
  }

  if (workspaceName) {
    setActiveOrgName(workspaceName);
  }

  if (workspacePlan) {
    setPlan(workspacePlan);
  }

  return res;
};

export const switchWorkspace = async (workspaceId) => {
  const res = await apiPost("/auth/switch-workspace", { workspaceId });

  const activeWorkspace = res?.activeWorkspace || null;

  if (activeWorkspace) {
    setActiveWorkspace(activeWorkspace);
  }

  if (res?.membership) {
    setMembership(res.membership);
  }

  return syncSessionFromAuthResponse(res);
};

export const deleteWorkspace = async (workspaceId) => {
  const res = await apiDelete(`/workspaces/${workspaceId}`);

  const currentActiveId = getActiveOrgId();
  if (String(currentActiveId) === String(workspaceId)) {
    setActiveOrgId("");
    setActiveOrgName("");
    localStorage.removeItem("activeWorkspace");
  }

  return res;
};

// -------------------- Invites --------------------
export const createInvite = (email, role = "analyst") =>
  apiPost("/invites", { email, role });

export const listInvites = () => apiGet("/invites");
export const getInvite = (token) =>
  apiGet(`/invites/${encodeURIComponent(token)}`);

export const acceptInvite = (token, payload = {}) =>
  apiPost(`/invites/${encodeURIComponent(token)}/accept`, payload);

// -------------------- Members --------------------
export const getMembers = () => apiGet("/members");

export const createMember = (payload) =>
  apiPost("/members", payload);

export const updateMember = (membershipId, payload) =>
  apiPatch(`/members/${membershipId}`, payload);

export const resetMemberPassword = (membershipId, newPassword) =>
  apiPost(`/members/${membershipId}/reset-password`, { newPassword });

export const deleteMember = (membershipId) =>
  apiDelete(`/members/${membershipId}`);

// -------------------- Clients (CRUD) --------------------
export const getClients = () => apiGet("/clients");
export const getClient = (id) => apiGet(`/clients/${id}`);
export const createClient = (payload) => apiPost("/clients", payload);
export const updateClient = (id, payload) => apiPut(`/clients/${id}`, payload);
export const deleteClient = (id) => apiDelete(`/clients/${id}`);

// -------------------- Deals (Pipeline) --------------------
export const getDeals = (params = {}) => {
  const qs = new URLSearchParams();

  if (params.q) qs.set("q", params.q);
  if (params.stage) qs.set("stage", params.stage);

  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return apiGet(`/deals${suffix}`);
};

export const getDeal = (id) => apiGet(`/deals/${id}`);
export const createDeal = (payload) => apiPost("/deals", payload);
export const updateDeal = (id, payload) => apiPut(`/deals/${id}`, payload);
export const deleteDeal = (id) => apiDelete(`/deals/${id}`);
export const moveDealStage = (id, stage) =>
  apiPatch(`/deals/${id}/stage`, { stage });

export const getDealActivity = (id) => apiGet(`/deals/${id}/activity`);
export const logDealActivity = (id, payload) =>
  apiPost(`/deals/${id}/activity`, payload);

// -------------------- Deal Intel --------------------
export const getPriorities = (limit = 10) =>
  apiGet(`/deal-intel/priorities?limit=${encodeURIComponent(limit)}`);

export const runAutopilot = (
  payload = { maxUpdates: 200, dryRun: true, force: false }
) => apiPost("/deal-intel/autopilot/run", payload);

// -------------------- Revenue Intel Board --------------------
export const getRevenueIntelBoard = (params = {}) => {
  const qs = new URLSearchParams();

  if (params.reactivateAfterDays != null) {
    qs.set("reactivateAfterDays", String(params.reactivateAfterDays));
  }

  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return apiGet(`/revenue-intel/board${suffix}`);
};

// -------------------- Demo Seed --------------------
export const seedDemoData = async (payload = {}) =>
  apiPost("/seed/refresh", payload);

// -------------------- Optional: pipeline helper --------------------
export const getPipeline = async () => {
  const res = await getDeals();
  const deals = Array.isArray(res?.deals)
    ? res.deals
    : Array.isArray(res)
    ? res
    : [];

  const pipelineValue = deals.reduce((sum, d) => {
    const amt = Number(d?.amount ?? d?.value ?? 0) || 0;
    const prob = Number(d?.probability ?? 1) || 0;
    return sum + amt * prob;
  }, 0);

  return {
    deals,
    pipelineValue: Math.round(pipelineValue),
  };
};
