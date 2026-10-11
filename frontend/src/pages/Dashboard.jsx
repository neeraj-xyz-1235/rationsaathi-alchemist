import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Activity, ArrowDownRight, ArrowRight, Bell, BookOpenText, CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, CircleHelp, ClipboardList, FileText, Home, LogOut, Menu, MoreHorizontal, Search, Settings2, ShieldCheck, ShoppingBag, TrendingUp, Users, WalletCards, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { useLang } from '../i18n/index.jsx'
import BrandMark from '../components/layout/BrandMark.jsx'

const nav = [
  { label: 'Overview', icon: Home, group: 'WORKSPACE' },
  { label: 'Check entitlement', icon: ClipboardList, route: '/check' },
  { label: 'Monthly tracker', icon: CalendarDays, route: '/tracker' },
  { label: 'Ration reports', icon: FileText, route: '/report' },
  { label: 'Complaints & help', icon: CircleHelp, route: '/complaints', group: 'SUPPORT' },
]

function ChartBars() {
  const heights = [43, 57, 49, 68, 53, 79, 61, 88, 70, 59, 76, 94, 71, 84, 66, 78, 91, 73, 86, 65, 77, 96, 80, 89]
  return <div className="chart-bars" role="img" aria-label="Illustrative monthly recorded ration trend"><div className="chart-grid-lines"><span>100%</span><span>75%</span><span>50%</span><span>25%</span></div><div className="chart-columns">{heights.map((h, i) => <div className={`chart-bar ${i === 21 ? 'highlight' : ''}`} key={i} style={{ height: `${h}%` }} />)}</div></div>
}

export default function Dashboard() {
  const { t } = useLang()
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const displayName = user?.display_name || user?.displayName || user?.name || 'Guest user'
  const email = user?.email || 'Your account'
  const logOut = async () => { await logout(); navigate('/', { replace: true }) }

  return <div className={`dashboard-shell ${collapsed ? 'sidebar-collapsed' : ''} ${sidebarOpen ? 'sidebar-mobile-open' : ''}`}>
    {sidebarOpen && <button className="sidebar-scrim" aria-label="Close navigation" onClick={() => setSidebarOpen(false)} />}
    <aside className="dashboard-sidebar">
      <div className="sidebar-brand-row"><Link to="/" className="sidebar-brand"><BrandMark compact /><span className="sidebar-brand-text"><strong>RationSaathi</strong><small>Entitlement companion</small></span></Link><button className="sidebar-close-mobile" onClick={() => setSidebarOpen(false)} aria-label="Close navigation"><X size={19} /></button></div>
      <div className="sidebar-workspace"><div className="workspace-avatar">RS</div><div className="workspace-copy"><strong>Personal workspace</strong><span>Household records</span></div><ChevronDown size={15} /></div>
      <nav className="sidebar-nav" aria-label="Dashboard navigation">
        <p className="sidebar-group-label">WORKSPACE</p>
        <button className="sidebar-item active" onClick={() => { setSidebarOpen(false); navigate('/dashboard') }}><Home size={18} /><span>Overview</span><span className="active-indicator" /></button>
        {nav.slice(1,4).map((item) => <Link key={item.label} className="sidebar-item" to={item.route} onClick={() => setSidebarOpen(false)}><item.icon size={18} /><span>{item.label}</span></Link>)}
        <p className="sidebar-group-label support-label">SUPPORT</p>
        <Link className="sidebar-item" to="/complaints" onClick={() => setSidebarOpen(false)}><CircleHelp size={18} /><span>Complaints & help</span></Link>
        <Link className="sidebar-item" to="/shops" onClick={() => setSidebarOpen(false)}><ShoppingBag size={18} /><span>Nearby ration shops</span><span className="coming-dot" /></Link>
      </nav>
      <div className="sidebar-bottom">
        <div className="sidebar-help-card"><div className="help-card-icon"><BookOpenText size={18} /></div><strong>Need a hand?</strong><p>Learn how to keep your ration records clear.</p><Link to="/help" onClick={() => setSidebarOpen(false)}>Visit help centre <ArrowRight size={14} /></Link></div>
        <button className="sidebar-collapse" onClick={() => setCollapsed((v) => !v)}><ChevronLeft className={collapsed ? 'rotate-arrow' : ''} size={17} /><span>{collapsed ? 'Expand sidebar' : 'Collapse sidebar'}</span></button>
      </div>
    </aside>

    <div className="dashboard-main">
      <header className="dashboard-topbar">
        <div className="topbar-left"><button className="topbar-menu" onClick={() => setSidebarOpen(true)} aria-label="Open navigation"><Menu size={22} /></button><div className="breadcrumb"><span>Workspace</span><ChevronRight size={15} /><strong>Overview</strong></div></div>
        <div className="topbar-right"><label className="dashboard-search"><Search size={17} /><input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search your records..." aria-label="Search your records" /><kbd>⌘ K</kbd></label><button className="topbar-icon-button notification-button" aria-label="Notifications"><Bell size={19} /><i /></button><span className="topbar-separator" /><div className="profile-wrap"><button className="profile-button" onClick={() => setProfileOpen((v) => !v)} aria-expanded={profileOpen}><span className="profile-avatar">{String(displayName).slice(0,1).toUpperCase()}</span><span className="profile-text"><strong>{displayName}</strong><small>{email}</small></span><ChevronDown size={16} /></button>{profileOpen && <div className="profile-menu"><div className="profile-menu-user"><strong>{displayName}</strong><span>{email}</span></div><button onClick={() => navigate('/help')}><CircleHelp size={16} /> Help centre</button><button onClick={logOut}><LogOut size={16} /> Log out</button></div>}</div></div>
      </header>

      <main className="dashboard-content">
        <div className="dashboard-heading-row"><div><p className="dashboard-eyebrow"><span /> YOUR HOUSEHOLD OVERVIEW</p><h1>Good morning, {String(displayName).split(' ')[0]} <span className="wave">✦</span></h1><p className="dashboard-subtitle">Keep your ration records organised and easy to understand.</p></div><Link to="/check" className="button button-primary dashboard-new-check"><ClipboardList size={17} /> New ration check <ArrowRight size={16} /></Link></div>

        <section className="welcome-strip"><div className="welcome-strip-icon"><ShieldCheck size={21} /></div><div><strong>Your information, your control</strong><p>Compare your own entitlement rules with the records you enter. A difference alone does not establish its cause.</p></div><button aria-label="Dismiss information notice" onClick={(e) => e.currentTarget.closest('.welcome-strip')?.remove()}><X size={17} /></button></section>

        <div className="dashboard-section-title"><div><h2>At a glance</h2><p>A quick look at your ration records.</p></div><button className="period-select"><CalendarDays size={16} /> September 2026 <ChevronDown size={15} /></button></div>
        <section className="dashboard-stats" aria-label="Ration summary">
          <article className="stat-card stat-card-green"><div className="stat-card-top"><span className="stat-icon"><WalletCards size={20} /></span><span className="stat-trend"><TrendingUp size={13} /> Demo</span></div><p>Expected entitlement</p><div className="stat-number">30 <small>kg</small></div><div className="stat-bottom"><span>Rice + wheat rules</span><span className="stat-foot-icon"><Users size={14} /> 4 members</span></div></article>
          <article className="stat-card stat-card-blue"><div className="stat-card-top"><span className="stat-icon"><ShoppingBag size={20} /></span><span className="stat-neutral">Recorded</span></div><p>Ration recorded</p><div className="stat-number">24 <small>kg</small></div><div className="stat-bottom"><span>Across 3 entries</span><span className="stat-foot-icon"><Check size={14} /> Confirmed</span></div></article>
          <article className="stat-card stat-card-amber"><div className="stat-card-top"><span className="stat-icon"><Activity size={20} /></span><span className="stat-neutral">Review</span></div><p>Recorded difference</p><div className="stat-number">6 <small>kg</small></div><div className="stat-bottom"><span>Based on demo data</span><Link to="/report">View details <ArrowRight size={13} /></Link></div></article>
        </section>
        <p className="demo-caption">Illustrative dashboard figures — they are not connected to your saved records yet.</p>

        <section className="dashboard-grid-main">
          <article className="panel chart-panel"><div className="panel-heading"><div><h3>Ration record activity</h3><p>Illustrative overview · September 2026</p></div><button className="panel-more" aria-label="More chart options"><MoreHorizontal size={20} /></button></div><div className="chart-summary"><div><strong>24 kg</strong><span>Recorded in this demo</span></div><span className="chart-change"><ArrowDownRight size={15} /> Example only</span></div><ChartBars /><div className="chart-axis"><span>01 Sep</span><span>08 Sep</span><span>15 Sep</span><span>22 Sep</span><span>30 Sep</span></div><div className="chart-legend"><span><i /> Recorded distribution</span><span><i /> Example highlight</span></div></article>

          <article className="panel quick-actions-panel"><div className="panel-heading"><div><h3>Quick actions</h3><p>What would you like to do?</p></div></div><div className="quick-action-list"><Link to="/check" className="quick-action"><span className="quick-action-icon green"><ClipboardList size={19} /></span><span><strong>Check entitlement</strong><small>Enter family details and rules</small></span><ArrowRight size={17} /></Link><Link to="/check" className="quick-action"><span className="quick-action-icon blue"><ShoppingBag size={19} /></span><span><strong>Add received ration</strong><small>Record delivery and evidence</small></span><ArrowRight size={17} /></Link><Link to="/report" className="quick-action"><span className="quick-action-icon amber"><FileText size={19} /></span><span><strong>View ration report</strong><small>Review the recorded comparison</small></span><ArrowRight size={17} /></Link><Link to="/tracker" className="quick-action"><span className="quick-action-icon violet"><CalendarDays size={19} /></span><span><strong>Monthly tracker</strong><small>Follow checks across periods</small></span><ArrowRight size={17} /></Link></div></article>
        </section>

        <section className="dashboard-grid-bottom"><article className="panel recent-panel"><div className="panel-heading"><div><h3>Recent records</h3><p>Example entries for the interface preview</p></div><Link to="/report" className="panel-link">See report <ArrowRight size={14} /></Link></div><div className="record-table-wrap"><table className="record-table"><thead><tr><th>ITEM</th><th>DATE</th><th>QUANTITY</th><th>SOURCE</th><th>STATUS</th></tr></thead><tbody><tr><td><span className="item-avatar rice">R</span><span className="item-name"><strong>Rice</strong><small>Receipt #101</small></span></td><td>03 Sep 2026</td><td><strong>8 kg</strong></td><td>Receipt</td><td><span className="status-chip status-confirmed"><Check size={12} /> Confirmed</span></td></tr><tr><td><span className="item-avatar wheat">W</span><span className="item-name"><strong>Wheat</strong><small>Manual record</small></span></td><td>05 Sep 2026</td><td><strong>10 kg</strong></td><td>Note</td><td><span className="status-chip status-confirmed"><Check size={12} /> Confirmed</span></td></tr><tr><td><span className="item-avatar rice">R</span><span className="item-name"><strong>Rice</strong><small>Receipt #145</small></span></td><td>20 Sep 2026</td><td><strong>6 kg</strong></td><td>Receipt</td><td><span className="status-chip status-confirmed"><Check size={12} /> Confirmed</span></td></tr></tbody></table></div><div className="demo-data-note"><ShieldCheck size={15} /> Demo data is for layout preview only and is not saved to your account.</div></article>
          <article className="panel period-panel"><div className="panel-heading"><div><h3>Current period</h3><p>September 2026</p></div><span className="period-ended">Ended</span></div><div className="period-progress-label"><span>Recorded against expected</span><strong>80%</strong></div><div className="period-progress"><span style={{ width: '80%' }} /></div><div className="period-values"><div><span>Recorded</span><strong>24 kg</strong></div><div><span>Expected</span><strong>30 kg</strong></div></div><div className="period-divider" /><p className="period-note">The amounts above are illustrative. Your actual totals will come from the calculation service after records are entered and confirmed.</p><Link to="/check" className="button button-quiet period-button">Review entitlement <ArrowRight size={15} /></Link></article></section>
        <footer className="dashboard-footer"><span>© 2026 RationSaathi</span><span><ShieldCheck size={14} /> Independent information tool · Not a government service</span><Link to="/help">Help & guidance</Link></footer>
      </main>
    </div>
  </div>
}
