import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Activity, Bell, CalendarDays, Check, CheckCheck, ChevronLeft, ChevronRight, Circle, CircleHelp, ClipboardList, FileText, Home, LogOut, Menu, MessageSquare, PackageCheck, ShoppingBag, ShieldCheck, X } from 'lucide-react'
import { useAuth } from '../../context/AuthContext.jsx'
import BrandMark from './BrandMark.jsx'
import LanguagePill from './LanguagePill.jsx'
import { apiGet } from '../../api/client.js'
import { useLang } from '../../i18n/index.jsx'

const navKey = { '/dashboard': 'nav_overview', '/check': 'nav_check', '/tracker': 'nav_tracker', '/withdrawals': 'nav_withdrawals', '/report': 'nav_reports', '/complaints': 'nav_complaints', '/shops': 'nav_shops', '/help': 'nav_help' }
const READ_KEY = 'rationsaathi.read-notices'
const links = [
  { label: 'Overview', to: '/dashboard', icon: Home },
  { label: 'Check entitlement', to: '/check', icon: ClipboardList },
  { label: 'Monthly tracker', to: '/tracker', icon: CalendarDays },
  { label: 'Withdrawals & receipts', to: '/withdrawals', icon: PackageCheck },
  { label: 'Ration reports', to: '/report', icon: FileText },
  { label: 'Complaints & help', to: '/complaints', icon: MessageSquare },
  { label: 'Nearby ration shops', to: '/shops', icon: ShoppingBag },
  { label: 'Help centre', to: '/help', icon: CircleHelp },
]
function Calendar({ month, setMonth, selected, setSelected, eventDays }) {
  const { t, language } = useLang()
  const locale = { en: 'en-IN', hi: 'hi-IN', mr: 'mr-IN' }[language] || 'en-IN'
  const first = new Date(month.getFullYear(), month.getMonth(), 1)
  const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  const offset = (first.getDay() + 6) % 7
  const dateKey = d => `${month.getFullYear()}-${String(month.getMonth()+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
  const cells = [...Array(offset).fill(null), ...Array.from({length:count}, (_,i)=>i+1)]
  return <div className="calendar-widget"><div className="calendar-widget-head"><button type="button" aria-label={t('tr_prev')} onClick={()=>setMonth(new Date(month.getFullYear(),month.getMonth()-1,1))}><ChevronLeft size={17}/></button><strong>{month.toLocaleDateString(locale,{month:'long',year:'numeric'})}</strong><button type="button" aria-label={t('tr_next')} onClick={()=>setMonth(new Date(month.getFullYear(),month.getMonth()+1,1))}><ChevronRight size={17}/></button></div><div className="calendar-grid calendar-weekdays">{['M','T','W','T','F','S','S'].map((d,i)=><span key={`${d}${i}`}>{d}</span>)}</div><div className="calendar-grid">{cells.map((d,i)=>d?<button type="button" key={i} className={`calendar-day ${selected===dateKey(d)?'selected':''} ${eventDays.includes(dateKey(d))?'has-event':''}`} onClick={()=>setSelected(dateKey(d))}>{d}{eventDays.includes(dateKey(d))&&<i/>}</button>:<span key={i}/>)}</div><div className="calendar-selected"><CalendarDays size={15}/><span><strong>{selected}</strong></span></div></div>
}
export default function AccountLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [drawer, setDrawer] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [popover, setPopover] = useState('')
  const [month, setMonth] = useState(new Date())
  const [selected, setSelected] = useState(new Date().toISOString().slice(0,10))
  const [loggingOut, setLoggingOut] = useState(false)
  const { t, tItem } = useLang()
  const [notices, setNotices] = useState([])
  const [readIds, setReadIds] = useState(() => { try { return new Set(JSON.parse(window.localStorage.getItem(READ_KEY) || '[]')) } catch { return new Set() } })
  const markRead = (ids) => setReadIds((current) => {
    const next = new Set([...current, ...ids])
    try { window.localStorage.setItem(READ_KEY, JSON.stringify([...next].slice(-200))) } catch { /* storage can be blocked */ }
    return next
  })
  const refreshNotices = useCallback(async () => {
    try { const data = await apiGet('/api/notifications'); setNotices(data?.notifications || []) } catch { /* keep the last list */ }
  }, [])
  useEffect(() => {
    refreshNotices()
    const timer = window.setInterval(refreshNotices, 30000)
    window.addEventListener('focus', refreshNotices)
    window.addEventListener('rationsaathi:changed', refreshNotices)
    return () => { window.clearInterval(timer); window.removeEventListener('focus', refreshNotices); window.removeEventListener('rationsaathi:changed', refreshNotices) }
  }, [refreshNotices, location.pathname])
  const name = user?.display_name || user?.displayName || user?.name || t('lay_your_account')
  const email = user?.email || ''
  const unread = notices.filter(n=>!readIds.has(n.id)).length
  const eventDays = useMemo(()=>[], [])
  useEffect(()=>{ setDrawer(false); setPopover('') },[location.pathname])
  useEffect(()=>{
    const onUnauthorized = (event) => {
      setPopover('')
      navigate(`/login?next=${encodeURIComponent(location.pathname + location.search)}`, { replace:true, state:{ reason:'session-expired', path:event.detail?.path } })
    }
    window.addEventListener('rationsaathi:unauthorized', onUnauthorized)
    return ()=>window.removeEventListener('rationsaathi:unauthorized', onUnauthorized)
  },[navigate, location.pathname, location.search])
  const doLogout = async()=>{ if(loggingOut)return; setLoggingOut(true); try { await logout() } finally { navigate('/',{replace:true}); setLoggingOut(false) } }
  return <div className={`dashboard-shell account-shell ${collapsed?'sidebar-collapsed':''} ${drawer?'sidebar-mobile-open':''}`}>
    {drawer&&<button className="sidebar-scrim" type="button" aria-label={t('lay_close_nav')} onClick={()=>setDrawer(false)}/>}
    <aside className="dashboard-sidebar"><div className="sidebar-brand-row"><Link to="/" className="sidebar-brand"><BrandMark compact/><span className="sidebar-brand-text"><strong>RationSaathi</strong><small>{t('lay_tagline')}</small></span></Link><button className="sidebar-close-mobile" type="button" onClick={()=>setDrawer(false)} aria-label={t('lay_close_nav')}><X size={19}/></button></div><div className="sidebar-workspace"><div className="workspace-avatar">{String(name).slice(0,1).toUpperCase()}</div><div className="workspace-copy"><strong>{name}</strong><span>{t('lay_personal')}</span></div></div><nav className="sidebar-nav" aria-label={t('lay_workspace')}><p className="sidebar-group-label">{t('lay_group')}</p>{links.map((item,i)=><NavLink end key={item.to} to={item.to} className={({isActive})=>`sidebar-item ${isActive?'active':''}`} onClick={()=>setDrawer(false)}><item.icon size={18}/><span>{t(navKey[item.to])}</span></NavLink>)}</nav><div className="sidebar-bottom"><div className="sidebar-help-card"><div className="help-card-icon"><ShieldCheck size={18}/></div><strong>{t('lay_private_title')}</strong><p>{t('lay_private_text')}</p><Link to="/privacy" onClick={()=>setDrawer(false)}>{t('lay_privacy_link')} <ChevronRight size={14}/></Link></div><button type="button" className="sidebar-collapse" onClick={()=>setCollapsed(v=>!v)}><ChevronLeft className={collapsed?'rotate-arrow':''} size={17}/><span>{collapsed?t('lay_expand'):t('lay_collapse')}</span></button></div></aside>
    <div className="dashboard-main"><header className="dashboard-topbar"><div className="topbar-left"><button type="button" className="topbar-menu" onClick={()=>setDrawer(true)} aria-label={t('lay_open_nav')}><Menu size={22}/></button><div className="breadcrumb"><span>{t('lay_workspace')}</span><ChevronRight size={15}/><strong>{t(navKey[location.pathname] || 'nav_help')}</strong></div></div><div className="topbar-right"><LanguagePill/><button type="button" className="topbar-icon-button notification-button" aria-label={`${t('lay_notifications')}, ${t('lay_unread', { n: unread })}`} aria-expanded={popover==='notifications'} onClick={()=>setPopover(p=>p==='notifications'?'':'notifications')}><Bell size={19}/>{unread>0&&<i/>}</button>{popover==='notifications'&&<section className="notification-popover"><div className="popover-heading"><div><strong>{t('lay_notifications')}</strong><small>{t('lay_unread', { n: unread })}</small></div><button type="button" onClick={()=>markRead(notices.map(n=>n.id))}><CheckCheck size={15}/> {t('lay_mark_all')}</button></div>{notices.length===0&&<p className="popover-footnote">{t('lay_notif_empty')}</p>}{notices.map(n=>{const isRead=readIds.has(n.id);return <button type="button" key={n.id} className={`notification-item ${isRead?'read':''}`} onClick={()=>markRead([n.id])}><span className="notification-dot">{isRead?<Check size={13}/>:<Circle size={9} fill="currentColor"/>}</span><span><strong>{t(`nt_${n.code}`, {...n.params, item: tItem(n.params?.item)})}</strong><small>{t(`nx_${n.code}`, {...n.params, item: tItem(n.params?.item)})}</small></span></button>})}<p className="popover-footnote">{t('lay_notif_live')}</p></section>}<button type="button" className="topbar-icon-button" aria-label={t('lay_open_calendar')} aria-expanded={popover==='calendar'} onClick={()=>setPopover(p=>p==='calendar'?'':'calendar')}><CalendarDays size={19}/></button>{popover==='calendar'&&<section className="calendar-popover"><Calendar month={month} setMonth={setMonth} selected={selected} setSelected={setSelected} eventDays={eventDays}/></section>}<span className="topbar-separator"/><div className="profile-wrap"><span className="profile-avatar">{String(name).slice(0,1).toUpperCase()}</span><span className="profile-text"><strong>{name}</strong><small>{email}</small></span><button type="button" className="account-logout" disabled={loggingOut} onClick={doLogout}><LogOut size={15}/>{loggingOut?t('lay_logging_out'):t('lay_logout')}</button></div></div></header><main className="dashboard-content account-content"><Outlet/></main><footer className="dashboard-footer"><span>© {new Date().getFullYear()} RationSaathi</span><span><ShieldCheck size={14}/> {t('lay_footer_tool')}</span><Link to="/privacy">{t('lay_privacy')}</Link></footer></div>
  </div>
}
