import { Link } from 'react-router-dom'
import { ArrowRight, CalendarDays, ClipboardList, FileText, PackageCheck, ShieldCheck, ShoppingBag, Users } from 'lucide-react'
import { useLang } from '../i18n/index.jsx'

export default function Dashboard() {
  const { t } = useLang()
  const cards = [
    { to: '/check', icon: ClipboardList, tone: 'green', title: t('nav_check'), text: t('dash_check_text'), open: t('dash_open_check') },
    { to: '/withdrawals', icon: PackageCheck, tone: 'blue', title: t('dash_withdraw'), text: t('dash_withdraw_text'), open: t('dash_open_withdraw') },
    { to: '/tracker', icon: CalendarDays, tone: 'blue', title: t('nav_tracker'), text: t('dash_tracker_text'), open: t('dash_open_tracker') },
    { to: '/report', icon: FileText, tone: 'amber', title: t('nav_reports'), text: t('dash_reports_text'), open: t('dash_open_reports') },
    { to: '/complaints', icon: Users, tone: 'violet', title: t('nav_complaints'), text: t('dash_support_text'), open: t('dash_open_support') },
    { to: '/shops', icon: ShoppingBag, tone: 'green', title: t('nav_shops'), text: t('dash_shops_text'), open: t('dash_open_shops') },
  ]
  return <div className="account-dashboard-page">
    <div className="dashboard-heading-row"><div><p className="dashboard-eyebrow"><span/> {t('dash_eyebrow')}</p><h1>{t('dash_title')} <span className="wave">✦</span></h1><p className="dashboard-subtitle">{t('dash_subtitle')}</p></div><Link to="/check" className="button button-primary dashboard-new-check"><ClipboardList size={17}/> {t('dash_new_check')} <ArrowRight size={16}/></Link></div>
    <section className="welcome-strip"><div className="welcome-strip-icon"><ShieldCheck size={21}/></div><div><strong>{t('dash_control_title')}</strong><p>{t('dash_control_text')}</p></div></section>
    <div className="dashboard-section-title"><div><h2>{t('dash_start')}</h2><p>{t('dash_choose')}</p></div></div>
    <section className="account-shortcuts">{cards.map((card) => <Link key={card.to} to={card.to} className="account-shortcut"><span className={`quick-action-icon ${card.tone}`}><card.icon size={21}/></span><h3>{card.title}</h3><p>{card.text}</p><span>{card.open} <ArrowRight size={15}/></span></Link>)}</section>
    <p className="demo-caption">{t('dash_caption')}</p>
  </div>
}
