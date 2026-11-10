import { admin, adminStyles } from '../admin/adminStyles';
import './workspace.css';
const border = '1px solid rgba(148,163,184,.17)';
const panel = {border, borderRadius:12, background:'#0c1626', boxShadow:'none', overflow:'hidden'};
const sectionHead = {padding:'20px 22px',borderBottom:border,display:'flex',justifyContent:'space-between',alignItems:'center',gap:16,flexWrap:'wrap'};
const row = {padding:'16px 0',border:0,borderBottom:border,borderRadius:0,background:'transparent',boxShadow:'none'};
const label = {fontSize:11,fontWeight:500,color:'#9eb1cb',textTransform:'none',letterSpacing:0};
const body = {fontSize:13,lineHeight:1.75,color:'#a5b5cb'};
const badge = {padding:'5px 8px',borderRadius:5,fontSize:11,fontWeight:500,background:'#17263b',border:'1px solid #30435e',color:'#afc5e5'};
const overrides = {
  page: admin.page, wrap: admin.container, container:admin.container,
  hero: {...admin.header,display:'block'}, header:admin.header,
  heroTop:{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:24,flexWrap:'wrap'},
  eyebrow:admin.eyebrow, h1:admin.title, title:admin.title,
  heroText:admin.subtitle, subtitle:admin.subtitle,
  statGrid:admin.statsGrid, statsGrid:admin.statsGrid,
  statCard:admin.metricCard, statLabel:admin.metricLabel, statValue:admin.metricValue, statNote:admin.metricDetail,
  metricCard:admin.metricCard, metricLabel:admin.metricLabel,metricValue:admin.metricValue,metricDetail:admin.metricDetail,
  section:panel, accountsSection:panel, sectionHead, sectionHeader:sectionHead,
  sectionBody:{padding:22}, sectionTitle:{fontSize:16,fontWeight:600,lineHeight:1.4,color:'#e0ebfa',margin:0},
  sectionSub:{fontSize:10,fontWeight:500,color:'#869dbd',letterSpacing:'.08em',textTransform:'uppercase',marginBottom:6},
  sectionEyebrow:{fontSize:10,fontWeight:500,color:'#869dbd',letterSpacing:'.08em',textTransform:'uppercase'},
  sectionHeading:{paddingBottom:18,marginBottom:18,borderBottom:border},
  twoCol:{display:'grid',gridTemplateColumns:'minmax(0,1fr) minmax(0,1fr)',gap:22,alignItems:'start'},
  twoColumn:{display:'grid',gridTemplateColumns:'minmax(0,1fr) minmax(0,1fr)',gap:22,alignItems:'start'},
  badge, pill:badge, sectionTag:badge,
  badgeWrap:{display:'flex',gap:8,flexWrap:'wrap',justifyContent:'flex-start',maxWidth:420},
  controlsWrap:{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center',maxWidth:430},
  primaryButton:admin.primaryButton, secondaryButton:admin.secondaryButton,
  btn:admin.secondaryButton, searchButton:admin.primaryButton,
  askButton:admin.primaryButton, askButtonSecondary:admin.secondaryButton,
  viewButton:admin.secondaryButton,
  search:admin.search, searchInput:admin.input, input:admin.input, select:admin.select,
  searchForm:{display:'grid',gridTemplateColumns:'minmax(0,1fr) auto',gap:12},
  searchHelp:{...body,fontSize:12,marginTop:12},
  askTextarea:{...admin.input,minHeight:132,resize:'vertical',lineHeight:1.8,padding:18},
  askPanel:{display:'grid',gap:18},
  askResponse:{marginTop:12,padding:22,border,borderRadius:10,background:'#101d30'},
  askResponseTitle:{fontSize:12,fontWeight:600,color:'#cbdcf7',marginBottom:14,letterSpacing:'.04em'},
  askResponseBody:{fontSize:14,lineHeight:1.9,color:'#d6e3f5',whiteSpace:'pre-wrap',overflowWrap:'anywhere'},
  askPromptButton:{...admin.secondaryButton,textAlign:'left',lineHeight:1.6,padding:'12px 14px'},
  summaryItem:{...row,padding:'12px 0',color:'#c5d4e9',fontSize:13,lineHeight:1.8},
  noteCard:{...row,...body}, feedCard:{...row,padding:16,border,borderRadius:8,background:'#101c2e'},
  queueCard:{...row,padding:16,border,borderRadius:8,background:'#101c2e'},
  stageCard:{padding:16,border,borderRadius:8,background:'#101c2e',boxShadow:'none'},
  funnelCard:{padding:16,border,borderRadius:8,background:'#101c2e',boxShadow:'none'},
  companyCard:{padding:20,border,borderRadius:10,background:'#101c2e',boxShadow:'none'},
  signalItem:{padding:'16px 18px',border:0,borderRadius:6,background:'#101c2e'},
  briefingCard:{padding:22,border,borderRadius:12,background:'#101e32',boxShadow:'none'},
  briefingEyebrow:{...label,color:'#a9c3e9',marginBottom:12}, briefingBody:{...body,color:'#d4e3f8',fontSize:14},
  chartShell:{width:'100%',height:260,minWidth:0,padding:0,border:0,borderRadius:0,background:'transparent'},
  chartShellSmall:{width:'100%',height:220,minWidth:0,padding:0,border:0,borderRadius:0,background:'transparent'},
  chartShellLg:{width:'100%',height:290,minWidth:0,padding:0,border:0,borderRadius:0,background:'transparent'},
  th:{padding:'12px 14px',textAlign:'left',fontSize:11,fontWeight:500,color:'#91a8c7',background:'#142136',borderBottom:border,whiteSpace:'nowrap'},
  td:{padding:'16px 14px',fontSize:12,lineHeight:1.7,color:'#c9d8ee',borderBottom:border,verticalAlign:'top'},
  table:{width:'100%',borderCollapse:'collapse',textAlign:'left'},tableWrap:{width:'100%',overflowX:'auto',minWidth:0},
  accountList:{display:'grid',gap:0,padding:0},
  accountRow:{display:'grid',gridTemplateColumns:'minmax(200px,1fr) minmax(320px,1.25fr) auto',alignItems:'center',gap:20,padding:22,border:0,borderBottom:border,borderRadius:0,background:'transparent'},
  accountIcon:admin.avatar, accountName:{color:'#e2ecfa',fontSize:14,fontWeight:600,margin:0},detailLabel:label,
  presentationPage:{position:'fixed',inset:0,zIndex:9999,overflowY:'auto',background:'#080f1b',padding:32},
};
export function workspaceStyles(original) {
  const themed=adminStyles(original);
  // Flatten legacy decorative surfaces without changing their sizing or layout.
  for(const [key,value] of Object.entries(themed)) {
    const next={...value};
    if(typeof next.background==='string' && /gradient/.test(next.background)) next.background='#101c2e';
    if(next.boxShadow) next.boxShadow='none';
    if(next.fontWeight>600) next.fontWeight=600;
    themed[key]=next;
  }
  for(const [key,value] of Object.entries(overrides)) if(key in original) themed[key]={...original[key],...value};
  return themed;
}
export const workspace = {...overrides,border,panel,body,badge};
