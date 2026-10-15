import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { apiGet, getActiveOrgId } from '../api';
import '../pages/WorkspaceSetup.css';
export default function WorkspaceSetupPrompt({
  workspaceId,
  enabled
}) {
  const location = useLocation(),
    [status, setStatus] = useState(null);
  const hidden = ['/setup', '/welcome', '/billing', '/billing-required'].includes(location.pathname.replace(/\/+$/, '') || '/');
  useEffect(() => {
    if (!enabled || hidden || !workspaceId) {
      setStatus(null);
      return;
    }
    let active = true;
    async function read() {
      try {
        const next = await apiGet('/workspace-setup/status');
        if (active && next.orgId === workspaceId && getActiveOrgId() === workspaceId) setStatus(next);
      } catch {
        if (active) setStatus(null);
      }
    }
    setStatus(null);
    read();
    window.addEventListener('atlas:setup-changed', read);
    return () => {
      active = false;
      window.removeEventListener('atlas:setup-changed', read);
    };
  }, [workspaceId, enabled, hidden, location.pathname]);
  if (!enabled || !status || hidden || status.orgId !== workspaceId) return null;
  if (status.status === 'completed' || status.status === 'deferred' || !status.canManage) return <div className="ws-prompt is-small"><Link to="/setup">{status.status === 'completed' ? 'Review workspace setup' : 'Workspace setup'} →</Link></div>;
  return <aside className="ws-prompt" aria-label="Workspace setup"><div><strong>{status.status === 'not_started' ? 'Set up your leadership workspace' : 'Your workspace setup is saved'}</strong><span>Choose priorities, check your data, and build your first briefing.</span></div><Link to="/setup">{status.status === 'not_started' ? 'Start setup' : 'Continue setup'} →</Link></aside>;
}
