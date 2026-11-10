// Shared administration surfaces follow the executive Reports workspace palette.
const border = '1px solid rgba(148,163,184,.17)';
const surface = '#0c1626';
const muted = '#9eb1cb';
const button = { minHeight: 40, padding: '10px 14px', border, borderRadius: 8, background: '#152136', color: '#dfebfc', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' };
const primary = { ...button, background: '#bcd5ff', color: '#12203b', borderColor: '#bcd5ff' };
const input = { width: '100%', boxSizing: 'border-box', minHeight: 40, padding: '10px 12px', border, borderRadius: 7, background: '#0b1525', color: '#e8effa', fontSize: 13, fontFamily: 'inherit' };
const panel = { border, borderRadius: 12, background: surface, boxShadow: 'none', overflow: 'hidden' };
const header = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 20, padding: '0 0 24px', border: 0, borderRadius: 0, background: 'transparent', boxShadow: 'none' };
const metric = { minHeight: 108, minWidth: 0, padding: '20px 22px', border: 0, borderRight: border, borderRadius: 0, background: 'transparent', boxShadow: 'none' };
const row = { display: 'grid', alignItems: 'center', gap: 20, padding: '20px 22px', border: 0, borderBottom: border, borderRadius: 0, background: 'transparent' };
const label = { color: muted, fontSize: 11, fontWeight: 500, textTransform: 'none', letterSpacing: 0 };
const badge = { display: 'inline-flex', alignItems: 'center', padding: '5px 8px', borderRadius: 5, fontSize: 11, fontWeight: 500 };
const danger = { ...button, color: '#efabb5', background: 'transparent', borderColor: 'rgba(224,132,149,.23)' };
const overrides = {
  page: { minHeight: '100%', padding: '28px 24px 60px', color: '#e8effa', background: 'transparent', fontSize: 14 },
  container: { width: '100%', maxWidth: 1440, margin: '0 auto', display: 'grid', gap: 22 },
  header, hero: header,
  eyebrow: { color: '#98b1d4', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.15em' },
  title: { margin: '9px 0 10px', fontSize: 32, fontWeight: 600, lineHeight: 1.2, letterSpacing: '-1px', color: '#edf4ff' },
  subtitle: { maxWidth: 680, margin: 0, color: '#a5b5cb', fontSize: 14, lineHeight: 1.7 },
  primaryButton: primary, secondaryButton: button, editButton: button,
  secondarySmallButton: { ...button, minHeight: 34, padding: '7px 10px', fontSize: 11 },
  dangerSmallButton: { ...danger, minHeight: 34, padding: '7px 10px', fontSize: 11 },
  removeButton: danger, archiveButton: { ...danger, minHeight: 34, padding: '7px 10px' },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 0, border, borderRadius: 12, background: surface, overflow: 'hidden' },
  metricCard: metric, metricLabel: label, metricValue: { marginTop: 12, color: '#edf4ff', fontSize: 28, fontWeight: 600, letterSpacing: '-.6px', overflowWrap: 'anywhere' },
  metricDetail: { marginTop: 7, color: '#859bb9', fontSize: 11, lineHeight: 1.6 },
  membersSection: panel, invitesSection: panel, partnerSection: panel,
  sectionHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 18, padding: '22px', borderBottom: border },
  sectionEyebrow: { display: 'none' }, sectionTitle: { margin: 0, color: '#e0ebfa', fontSize: 16, fontWeight: 600 },
  filters: { display: 'flex', flexWrap: 'wrap', gap: 8 }, search: { ...input, width: 240, minWidth: 0 }, select: { ...input, width: 'auto' }, input,
  memberList: { display: 'grid', gap: 0, padding: 0 }, inviteList: { display: 'grid', gap: 0, padding: 0 }, partnerList: { display: 'grid', gap: 0, padding: 0 },
  memberRow: { ...row, gridTemplateColumns: 'minmax(180px,1fr) minmax(340px,1.3fr) auto' },
  inviteRow: { ...row, gridTemplateColumns: 'minmax(200px,1fr) minmax(260px,1fr) auto' },
  partnerCard: { ...row, gridTemplateColumns: 'minmax(220px,1.3fr) minmax(260px,1fr) auto' },
  avatar: { width: 38, height: 38, flex: '0 0 38px', display: 'grid', placeItems: 'center', border, borderRadius: 9, background: '#1b2b44', color: '#bcd5ff', fontSize: 12, fontWeight: 600 },
  companyIcon: { width: 38, height: 38, flex: '0 0 38px', display: 'grid', placeItems: 'center', border, borderRadius: 9, background: '#1b2b44', color: '#bcd5ff', fontSize: 12, fontWeight: 600 },
  mailIcon: { width: 38, height: 38, flex: '0 0 38px', display: 'grid', placeItems: 'center', border, borderRadius: 9, background: '#1b2b44', color: '#bcd5ff', fontSize: 16 },
  accessLabel: label, detailLabel: label, smallMetricLabel: label,
  dateValue: { color: '#c5d4e9', fontSize: 12, fontWeight: 400 },
  smallMetric: { padding: '0 8px', border: 0, borderRadius: 0, background: 'transparent' },
  smallMetricValue: { marginTop: 8, color: '#dfebfc', fontSize: 14, fontWeight: 600 },
  badge, statusBadge: badge, typeBadge: { ...badge, color: '#a6bad6', background: '#18253a', border: 0 },
  memberName: { margin: 0, color: '#e2ecfa', fontSize: 14, fontWeight: 600 }, companyName: { margin: 0, color: '#e2ecfa', fontSize: 14, fontWeight: 600 },
  emptyState: { padding: '56px 24px', color: muted, textAlign: 'center', fontSize: 13, lineHeight: 1.8 },
  modal: { width: '100%', maxWidth: 600, maxHeight: 'calc(100dvh - 32px)', overflowY: 'auto', border, borderRadius: 14, background: surface, boxShadow: '0 24px 90px #0008' },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, padding: 24, borderBottom: border, background: surface },
  modalTitle: { margin: 0, color: '#e8effa', fontSize: 21, fontWeight: 600 },
  modalFooter: { display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, padding: 20, borderTop: border, background: surface },
  formBody: { display: 'grid', gap: 18, padding: 24 }, fieldLabel: { color: '#c5d4e9', fontSize: 12, fontWeight: 500 },
  closeButton: { ...button, width: 34, minHeight: 34, padding: 0, fontSize: 22 },
  summaryCard: { ...metric, marginTop: 0 }, summaryLabel: label, summaryValue: { color: '#e8effa', marginTop: 12, fontSize: 18, fontWeight: 600 },
  plansSection: { padding: 0, border: 0, borderRadius: 0, background: 'transparent' },
  planCard: { ...panel, display: 'flex', flexDirection: 'column', padding: 24, position: 'relative' },
  featuredPlanCard: { borderColor: '#4c688f', background: '#111e31', boxShadow: 'none' },
  currentPlanCard: { borderColor: '#6084b4', boxShadow: 'none' },
  featureList: { display: 'grid', gap: 12, marginTop: 18, marginBottom: 24, flex: 1 },
  planName: { color: '#e8effa', fontSize: 16, fontWeight: 600 }, price: { color: '#edf4ff', fontSize: 34, fontWeight: 600, letterSpacing: '-1px' },
  featuredBadge: { ...badge, color: '#bad3f9', background: '#233956', border: 0 }, planBadge: { ...badge, color: muted, background: '#18253a', border: 0 },
  planButton: { ...button, width: '100%', marginTop: 'auto' }, featuredPlanButton: primary, currentPlanButton: { ...button, background: '#192a40' },
  sectionSubtitle: { color: muted, fontSize: 13, lineHeight: 1.7, margin: '8px 0 0' },
};
export function adminStyles(original) {
  const result = Object.fromEntries(Object.entries(original).map(([key, value]) => [key, { ...value,
    ...(value.fontWeight > 600 ? { fontWeight: 600 } : {}),
    ...(value.borderRadius >= 14 ? { borderRadius: 10 } : {}),
  }]));
  for (const [key, value] of Object.entries(overrides)) {
    if (key in original) result[key] = { ...original[key], ...value };
  }
  return result;
}
export const admin = overrides;
