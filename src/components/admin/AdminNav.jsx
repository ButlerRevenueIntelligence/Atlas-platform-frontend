import React from 'react';
import { NavLink } from 'react-router-dom';
import './admin.css';
const pages = [['/global-hq', 'Global HQ'], ['/billing', 'Billing'], ['/members', 'Members'], ['/invites', 'Invitations'], ['/partners', 'Partners']];
export default function AdminNav() {
  return <nav className="admin-nav" aria-label="Workspace management">
    {pages.map(([to, label]) => <NavLink key={to} to={to} className={({ isActive }) => isActive ? 'selected' : undefined}>{label}</NavLink>)}
  </nav>;
}
