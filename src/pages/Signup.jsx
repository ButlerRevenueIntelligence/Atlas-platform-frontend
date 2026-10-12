import AuthLayout, { PasswordField } from "../components/AuthLayout";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { signup, acceptInvite, getInvite } from "../api";

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

export default function Signup() {
  const nav = useNavigate();
  const query = useQuery();

  const inviteToken = query.get("token") || query.get("invite");

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [error, setError] = useState("");
  const [inviteInfo, setInviteInfo] = useState(null);

  const isInvite = Boolean(inviteToken);

  function onChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  useEffect(() => {
    if (!inviteToken) return;

    (async () => {
      setInviteLoading(true);
      setError("");

      try {
        const data = await getInvite(inviteToken);

        if (!data?.ok || !data?.invite) {
          setInviteInfo(null);
          setError(data?.message || "Invite link is invalid or expired.");
          return;
        }

        setInviteInfo(data.invite);

        setForm((prev) => ({
          ...prev,
          email: data.invite.email || prev.email,
        }));
      } catch {
        setError("Could not load invite.");
      } finally {
        setInviteLoading(false);
      }
    })();
  }, [inviteToken]);

  async function handlePublicSignup(e) {
    e.preventDefault();
    setError("");

    if (!form.name.trim()) {
      setError("Please enter your full name.");
      return;
    }

    if (!form.email.trim()) {
      setError("Please enter your email.");
      return;
    }

    if (form.password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);

    try {
      await signup({
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
      });

      localStorage.setItem("atlas_onboarded", "false");
      nav("/welcome", { replace: true });
    } catch (err) {
      setError(err?.message || "Signup failed.");
    } finally {
      setLoading(false);
    }
  }

  async function handleInviteSignup(e) {
    e.preventDefault();
    setError("");

    if (!inviteInfo) {
      setError("Invite invalid.");
      return;
    }

    if (!form.name.trim()) {
      setError("Enter your name.");
      return;
    }

    if (form.password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);

    try {
      await acceptInvite(inviteToken, {
        name: form.name.trim(),
        password: form.password,
      });

      nav(`/login?email=${encodeURIComponent(form.email)}`, { replace: true });
    } catch (err) {
      setError(err?.message || "Invite failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout signup>
      <div className="atlas-auth-card-kicker">{isInvite ? "WORKSPACE INVITATION" : "SEVEN-DAY FREE TRIAL"}</div>
      <h2 id="auth-form-title">{isInvite ? "Join your team." : "Get started with Atlas."}</h2>
      <p className="atlas-auth-subtitle">{isInvite ? (inviteLoading ? "Loading your invitation…" : "Create your account to access your team’s workspace.") : "Create your workspace, connect your data, and explore a clearer view of revenue."}</p>
      {isInvite && inviteInfo && <div className="atlas-auth-invite">You’ve been invited to join {inviteInfo.orgName || inviteInfo.workspaceName || "an Atlas workspace"}. Your invitation email is shown below.</div>}
      <form onSubmit={isInvite ? handleInviteSignup : handlePublicSignup} className="atlas-auth-form" aria-busy={loading || inviteLoading}>
        <div className="atlas-auth-field">
          <label htmlFor="signup-name">Full name</label>
          <input id="signup-name" name="name" placeholder="Your full name" value={form.name} onChange={onChange} autoComplete="name" required disabled={loading || inviteLoading} />
        </div>
        <div className="atlas-auth-field">
          <label htmlFor="signup-email">Email address</label>
          <input id="signup-email" name="email" type="email" placeholder="you@company.com" value={form.email} onChange={onChange} readOnly={isInvite} autoComplete="email" autoCapitalize="none" spellCheck={false} required disabled={loading || inviteLoading} />
        </div>
        <div className="atlas-auth-field">
          <label htmlFor="signup-password">Create a password</label>
          <PasswordField id="signup-password" value={form.password} onChange={onChange} visible={showPassword} onToggle={() => setShowPassword(!showPassword)} autoComplete="new-password" minLength={8} disabled={loading || inviteLoading} />
          <p className="atlas-auth-hint">Use at least 8 characters.</p>
        </div>
        {error && <div className="atlas-auth-error" role="alert">{error}</div>}
        <button type="submit" className="atlas-auth-submit" disabled={loading || inviteLoading || (isInvite && !inviteInfo)}><span>{loading ? (isInvite ? "Creating your account…" : "Creating your workspace…") : (isInvite ? "Join workspace" : "Start free trial")}</span><span aria-hidden="true">→</span></button>
        {!isInvite && <p className="atlas-auth-hint">Your seven-day trial begins when you create your account.</p>}
      </form>
      <div className="atlas-auth-card-bottom">Already have an account? <Link to={isInvite ? `/login?email=${encodeURIComponent(form.email)}&invite=${encodeURIComponent(inviteToken)}` : "/login"}>Sign in</Link></div>
    </AuthLayout>
  );
}
