// frontend/src/utils/perms.js

const PLAN_RANK = {
  CORE: 1,
  GROWTH: 2,
  ENTERPRISE: 3,
};

export function normalizePlan(plan) {
  const value = String(plan || "")
    .trim()
    .toUpperCase();

  if (value === "SCALE") return "CORE";
  if (value === "CORE") return "CORE";
  if (value === "GROWTH") return "GROWTH";
  if (value === "ENTERPRISE") return "ENTERPRISE";

  return "CORE";
}

function readStoredObject(key) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

export function getMembership() {
  return readStoredObject("membership") || {};
}

export function getStoredUser() {
  return (
    readStoredObject("butler_user") ||
    readStoredObject("user") ||
    {}
  );
}

export function getPermissions() {
  const membership = getMembership();
  const user = getStoredUser();

  const permissions =
    membership?.permissions ||
    user?.permissions ||
    user?.perms ||
    [];

  return Array.isArray(permissions)
    ? permissions
    : [];
}

export function getActiveRole() {
  const membership = getMembership();
  const user = getStoredUser();

  return String(
    membership?.role ||
      user?.role ||
      "member"
  )
    .trim()
    .toLowerCase();
}

export function hasPerm(
  permissions = getPermissions(),
  permission
) {
  if (!permission) return true;

  const role = getActiveRole();

  // Workspace owners have full permission access,
  // but they remain restricted by their subscription plan.
  if (role === "owner") return true;

  if (!Array.isArray(permissions)) return false;
  if (permissions.includes("*")) return true;

  return permissions.includes(permission);
}

export function hasAllPerms(
  permissions = getPermissions(),
  required = []
) {
  if (!Array.isArray(required)) return false;

  return required.every((permission) =>
    hasPerm(permissions, permission)
  );
}

export function getPlan() {
  const raw =
    localStorage.getItem("active_org_plan") ||
    localStorage.getItem("org_plan") ||
    localStorage.getItem("plan") ||
    "CORE";

  return normalizePlan(raw);
}

export function setPlan(plan) {
  if (!plan) {
    localStorage.removeItem("active_org_plan");
    localStorage.removeItem("org_plan");
    localStorage.removeItem("plan");
    return;
  }

  const value = normalizePlan(plan);

  localStorage.setItem(
    "active_org_plan",
    value
  );
  localStorage.setItem("org_plan", value);
  localStorage.setItem("plan", value);
}

export function getPlanRank(plan = getPlan()) {
  return PLAN_RANK[normalizePlan(plan)] || 1;
}

export function hasPlan(
  requiredPlan,
  currentPlan = getPlan()
) {
  return (
    getPlanRank(currentPlan) >=
    getPlanRank(requiredPlan)
  );
}

export function getPlanLabel(
  plan = getPlan()
) {
  const normalized = normalizePlan(plan);

  if (normalized === "CORE") {
    return "Atlas Core";
  }

  if (normalized === "GROWTH") {
    return "Atlas Growth";
  }

  if (normalized === "ENTERPRISE") {
    return "Atlas Enterprise";
  }

  return "Atlas Core";
}

export const PAGE_PLAN_REQUIREMENTS = {
  "/overview": "CORE",
  "/command-center": "CORE",
  "/deal-war-room": "CORE",
  "/deal-room": "CORE",
  "/data-connectors": "CORE",
  "/integrations": "CORE",
  "/accounts": "CORE",
  "/partners": "CORE",
  "/members": "CORE",
  "/invites": "CORE",

  "/growth-engine": "GROWTH",
  "/account-intelligence": "GROWTH",
  "/market-signals": "GROWTH",
  "/global-revenue-map": "GROWTH",
  "/atlas-ai-operator": "GROWTH",
  "/reports": "GROWTH",
  "/global-hq": "GROWTH",

  "/board-mode": "ENTERPRISE",
};

export function getRequiredPlanForPath(
  pathname = ""
) {
  const normalizedPath =
    String(pathname || "").split("?")[0];

  return (
    PAGE_PLAN_REQUIREMENTS[normalizedPath] ||
    "CORE"
  );
}
