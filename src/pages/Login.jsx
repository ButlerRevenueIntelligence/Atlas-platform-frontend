import AuthLayout, { PasswordField } from "../components/AuthLayout";
import { useEffect, useMemo, useState } from "react";
import {
  useNavigate,
  useLocation,
  useSearchParams,
  Link,
} from "react-router-dom";
import {
  login,
  setToken,
  setUser,
  setActiveOrgId,
  setActiveOrgName,
  getInvite,
} from "../api";

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

const oid = (v) => {
  if (!v) return "";
  if (typeof v === "string") return v;
  if (typeof v === "object") {
    if (v.$oid) return v.$oid;
    if (v.id) return v.id;
    if (v._id) return typeof v._id === "string" ? v._id : v._id?.$oid || "";
    try {
      return String(v);
    } catch {
      return "";
    }
  }
  return "";
};

const decodeJwt = (token) => {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const base64 = part.replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
};

export default function Login() {
  const nav = useNavigate();
  const query = useQuery();
  const [params] = useSearchParams();

  const emailFromQuery = query.get("email");
  const inviteToken = query.get("invite");

  const [email, setEmail] = useState(emailFromQuery || "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [prefillLoading, setPrefillLoading] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    const e = params.get("email");
    if (e) setEmail(e);
  }, [params]);

  useEffect(() => {
    if (emailFromQuery) setEmail(emailFromQuery);
  }, [emailFromQuery]);

  useEffect(() => {
    if (!inviteToken) return;

    (async () => {
      setPrefillLoading(true);
      setErr("");

      try {
        const data = await getInvite(inviteToken);
        const ok = data?.ok ?? true;
        const invite = data?.invite ?? data;

        if (!ok || !invite) {
          setErr(data?.message || "Invite link is invalid or expired.");
          return;
        }

        if (invite?.email) setEmail(invite.email);
      } catch (e) {
        setErr(e?.message || "Could not load invite email.");
      } finally {
        setPrefillLoading(false);
      }
    })();
  }, [inviteToken]);

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");
    setLoading(true);

    try {
      const res = await login({ email, password });

      const token =
        res?.token ||
        res?.accessToken ||
        res?.data?.token ||
        res?.data?.accessToken ||
        "";

      if (!token) {
        throw new Error("Login succeeded but no token was returned.");
      }

      try {
        setToken(token);
      } catch (_) {}

      localStorage.setItem("butler_token", token);
      localStorage.setItem("token", token);

      const claims = decodeJwt(token) || {};

      let user = res?.user || res?.data?.user || null;
      const activeWorkspace =
        res?.activeWorkspace || res?.data?.activeWorkspace || null;
      const workspaces = res?.workspaces || res?.data?.workspaces || [];
      const membership = res?.membership || res?.data?.membership || null;

      if (!user) {
        user = {
          id: claims.id || claims.userId || claims.sub || "",
          email,
          role: claims.role || "user",
          plan: claims.plan || claims.tier || claims.subscription || "STANDARD",
          orgId:
            claims.orgId ||
            claims.activeWorkspace ||
            claims.activeOrgId ||
            claims.workspaceId ||
            "",
          orgName:
            claims.orgName ||
            claims.workspaceName ||
            claims.company ||
            "",
          permissions: claims.permissions || claims.perms || [],
        };
      }

      const resolvedWorkspaceId = oid(
        activeWorkspace?._id ||
          activeWorkspace?.id ||
          user?.orgId ||
          res?.orgId ||
          res?.activeOrgId ||
          res?.workspaceId ||
          res?.data?.orgId ||
          res?.data?.activeOrgId ||
          res?.data?.workspaceId ||
          claims?.activeWorkspace ||
          claims?.orgId ||
          claims?.workspaceId ||
          ""
      );

      const resolvedWorkspaceName =
        activeWorkspace?.name ||
        user?.orgName ||
        user?.organizationName ||
        user?.company ||
        res?.orgName ||
        res?.workspaceName ||
        res?.data?.orgName ||
        res?.data?.workspaceName ||
        "";

      const normalizedUser = {
        ...user,
        orgId: resolvedWorkspaceId,
        activeWorkspace: resolvedWorkspaceId,
        orgName: resolvedWorkspaceName,
        workspaceName: resolvedWorkspaceName,
        permissions:
          user?.permissions ||
          user?.perms ||
          membership?.permissions ||
          [],
      };

      try {
        setUser(normalizedUser);
      } catch (_) {}

      localStorage.setItem("butler_user", JSON.stringify(normalizedUser));
      localStorage.setItem("user", JSON.stringify(normalizedUser));

      if (resolvedWorkspaceId) {
        try {
          setActiveOrgId(resolvedWorkspaceId);
        } catch (_) {}

        localStorage.setItem("x-org-id", resolvedWorkspaceId);
        localStorage.setItem("orgId", resolvedWorkspaceId);
        localStorage.setItem("butler_org_id", resolvedWorkspaceId);
        localStorage.setItem("butler_active_org_id", resolvedWorkspaceId);
        localStorage.setItem("activeOrgId", resolvedWorkspaceId);
      }

      if (resolvedWorkspaceName) {
        try {
          setActiveOrgName(resolvedWorkspaceName);
        } catch (_) {}

        localStorage.setItem("butler_active_org_name", resolvedWorkspaceName);
        localStorage.setItem("activeOrgName", resolvedWorkspaceName);
      }

      if (activeWorkspace) {
        localStorage.setItem("activeWorkspace", JSON.stringify(activeWorkspace));
      }

      if (Array.isArray(workspaces)) {
        localStorage.setItem("workspaces", JSON.stringify(workspaces));
      }

      if (membership) {
        localStorage.setItem("membership", JSON.stringify(membership));
      }

      if (!resolvedWorkspaceId) {
        nav("/create-workspace", { replace: true });
        return;
      }

      nav("/command-center", { replace: true });
    } catch (e2) {
      setErr(e2?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout>
      <div className="atlas-auth-card-kicker">YOUR REVENUE WORKSPACE</div>
      <h2 id="auth-form-title">Welcome back.</h2>
      <p className="atlas-auth-subtitle">{prefillLoading ? "Loading your workspace invitation…" : "Sign in to see your priorities and keep your team moving."}</p>
      {inviteToken && !prefillLoading && <div className="atlas-auth-invite">Sign in with the email address on your invitation.</div>}
      <form onSubmit={onSubmit} className="atlas-auth-form" aria-busy={loading || prefillLoading}>
        <div className="atlas-auth-field">
          <label htmlFor="login-email">Email address</label>
          <input id="login-email" name="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" type="email" required autoComplete="email" autoCapitalize="none" spellCheck={false} disabled={loading || prefillLoading} />
        </div>
        <div className="atlas-auth-field">
          <div className="atlas-auth-label-row"><label htmlFor="login-password">Password</label><Link to="/forgot-password">Forgot password?</Link></div>
          <PasswordField id="login-password" value={password} onChange={(e) => setPassword(e.target.value)} visible={showPassword} onToggle={() => setShowPassword(!showPassword)} autoComplete="current-password" disabled={loading || prefillLoading} />
        </div>
        {err && <div className="atlas-auth-error" role="alert"><strong>Couldn’t sign in.</strong><br />{err}</div>}
        <button type="submit" disabled={loading || prefillLoading} className="atlas-auth-submit"><span>{loading ? "Signing in…" : "Sign in to Atlas"}</span><span aria-hidden="true">→</span></button>
      </form>
      <div className="atlas-auth-card-bottom">New to Atlas? <Link to="/signup">Start your seven-day trial</Link></div>
    </AuthLayout>
  );
}
