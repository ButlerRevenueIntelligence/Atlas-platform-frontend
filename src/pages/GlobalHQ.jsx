import React, { useEffect, useMemo, useState } from 'react';
import { getWorkspaces, createWorkspace, switchWorkspace, deleteWorkspace } from '../api';
import AdminNav from '../components/admin/AdminNav';
import { admin } from '../components/admin/adminStyles';

function planLabel(value) {
  const key = String(value || '').toUpperCase();
  return ({ SCALE: 'Atlas Core', CORE: 'Atlas Core', GROWTH: 'Atlas Growth', ENTERPRISE: 'Atlas Enterprise' })[key] || 'Not available';
}

export default function GlobalHQ() {
  const [query, setQuery] = useState("");
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

  const filtered = workspaces.filter(ws => `${ws.name || ''} ${ws.slug || ''}`.toLowerCase().includes(query.trim().toLowerCase()));
  return <main className="atlas-admin atlas-responsive-page" style={admin.page}>
    <div style={admin.container}>
      <header className="admin-header" style={admin.header}>
        <div><div style={admin.eyebrow}>Organization management</div><h1 style={admin.title}>Global HQ</h1>
          <p style={admin.subtitle}>One place to manage your workspaces and move between teams.</p></div>
        <button style={admin.secondaryButton} onClick={loadWorkspaces} disabled={loading}>{loading ? 'Refreshing…' : 'Refresh'}</button>
      </header>
      <AdminNav />
      {error && <div role="alert" style={{padding:16, border:'1px solid #805266', borderRadius:8, color:'#ffc4cd', background:'#362331'}}>{error}</div>}
      {success && <div role="status" style={{color:'#89dcc6'}}>{success}</div>}
      <div className="admin-context"><span className="admin-status">Current workspace</span><strong>{activeWorkspace?.name || activeOrgName || 'None selected'}</strong></div>
      <section aria-label="Workspace summary" className="admin-metrics admin-workspace-metrics" style={{...admin.statsGrid, gridTemplateColumns:'repeat(3,minmax(0,1fr))'}}>
        {[
          ['Workspaces', workspaces.length, 'Across your organization'],
          ['Owner access', workspaces.filter(ws => ws.role === 'owner').length, 'Workspaces you own'],
          ['Client workspaces', workspaces.filter(ws => ws.type === 'client').length, 'Client environments'],
        ].map(([label,value,detail]) => <div key={label} style={admin.metricCard}><div style={admin.metricLabel}>{label}</div><div style={admin.metricValue}>{loading ? '—' : value}</div><div style={admin.metricDetail}>{detail}</div></div>)}
      </section>
      <section className="admin-directory">
        <div className="admin-directory-head"><div><h2>Workspace directory</h2><p>Choose the workspace you want to work in.</p></div>
          <input style={admin.search} aria-label="Search workspaces" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search workspaces…" /></div>
        {loading ? <div style={admin.emptyState} role="status">Loading workspaces…</div> : error ? <div style={admin.emptyState}>Workspaces could not be loaded. Use Refresh to try again.</div> : filtered.length === 0 ? <div style={admin.emptyState}>{query ? 'No workspaces match your search.' : 'No workspaces yet. Create your first workspace below.'}</div> : filtered.map(workspace => {
          const isActive = String(workspace._id) === String(activeOrgId);
          const isBusy = busyId === workspace._id;
          return <article key={workspace._id} className={`admin-workspace-row ${isActive ? 'current' : ''}`}>
            <div><h3>{workspace.name}</h3><p>{workspace.slug || 'No workspace slug'}</p></div>
            <div><div className="admin-row-label">Plan / type</div><div className="admin-row-value">{planLabel(workspace.plan)}</div><p style={{marginTop:6}}>{workspace.type || 'Client'}</p></div>
            <div><div className="admin-row-label">Your access</div><div className="admin-row-value">{workspace.role || 'Member'}</div></div>
            <div className="admin-row-actions">{isActive ? <span className="admin-status">Active workspace</span> : <button style={admin.secondaryButton} disabled={Boolean(busyId)} onClick={() => handleSwitchWorkspace(workspace)}>{isBusy ? 'Working…' : 'Open workspace'}</button>}
              {!isActive && workspace.role === 'owner' && <button style={admin.archiveButton} disabled={Boolean(busyId)} onClick={() => handleDeleteWorkspace(workspace)}>Delete</button>}</div>
          </article>;
        })}
      </section>
      <details className="admin-create"><summary>Create a workspace <small>Add a separate environment for a client or agency.</small></summary>
        <form onSubmit={handleCreateWorkspace}>
          <div className="admin-form-grid">
            <label>Workspace name<input style={admin.input} required value={form.name} onChange={e => updateForm('name',e.target.value)} placeholder="Company or team name" /></label>
            <label>Custom slug (optional)<input style={admin.input} value={form.slug} onChange={e => updateForm('slug',e.target.value)} placeholder="company-name" /></label>
            <label>Workspace type<select style={admin.input} value={form.type} onChange={e => updateForm('type',e.target.value)}><option value="client">Client</option><option value="agency">Agency</option></select></label>
            <label>Plan<select style={admin.input} value={form.plan} onChange={e => updateForm('plan',e.target.value)}><option value="SCALE">Atlas Core</option><option value="GROWTH">Atlas Growth</option><option value="ENTERPRISE">Atlas Enterprise</option></select></label>
            <label>Company website<input style={admin.input} value={form.companyWebsite} onChange={e => updateForm('companyWebsite',e.target.value)} placeholder="https://example.com" /></label>
            <label>Industry<input style={admin.input} value={form.industry} onChange={e => updateForm('industry',e.target.value)} placeholder="Industry" /></label>
          </div>
          <div className="admin-form-footer"><button type="submit" style={admin.primaryButton} disabled={creating}>{creating ? 'Creating…' : 'Create workspace'}</button><button type="button" style={admin.secondaryButton} disabled={creating} onClick={() => setForm({name: '', slug: '', type: 'client', plan: 'ENTERPRISE', companyWebsite: '', industry: ''})}>Clear</button><p>Creating a workspace switches your active workspace.</p></div>
        </form>
      </details>
    </div>
  </main>;
}
