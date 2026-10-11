import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight, CalendarDays, CheckCircle2, ClipboardList, FileText, HelpCircle, MessageSquare, ShieldCheck, X } from 'lucide-react'
import { useLang } from '../i18n/index.jsx'

// The complaints draft and the help centre. (Check, tracker, reports and shops have their own pages.)
export default function WorkspacePage({ type }) {
  const { t } = useLang()
  const isComplaints = type === 'complaints'
  const Icon = isComplaints ? MessageSquare : HelpCircle
  const [saved, setSaved] = useState(false)
  const [complaint, setComplaint] = useState({ topic: 'cp_t1', details: '' })
  const title = isComplaints ? t('wp_complaints_title') : t('wp_help_title')
  const subtitle = isComplaints ? t('wp_complaints_sub') : t('wp_help_sub')

  return <main className="workspace-page"><div className="workspace-breadcrumb"><Link to="/dashboard"><ArrowLeft size={15}/> {t('wp_back')}</Link><span>/</span><span>{title}</span></div><div className="workspace-page-heading"><span className="workspace-page-icon"><Icon size={24}/></span><div><p className="section-eyebrow">{t('wp_eyebrow')}</p><h1>{title}</h1><p>{subtitle}</p></div></div>
    {saved && <div className="workspace-success" role="status"><CheckCircle2 size={18}/><span>{t('wp_preview_note')}</span><button type="button" onClick={()=>setSaved(false)} aria-label={t('wd_dismiss')}><X size={16}/></button></div>}
    {isComplaints && <div className="workspace-columns"><form className="workspace-panel workspace-form" onSubmit={(event)=>{event.preventDefault();setSaved(true)}}><h2>{t('cp_title')}</h2><p className="workspace-muted">{t('cp_note')}</p><label>{t('cp_topic')}<select value={complaint.topic} onChange={e=>setComplaint(v=>({...v,topic:e.target.value}))}>{['cp_t1','cp_t2','cp_t3','cp_t4'].map((key)=><option key={key} value={key}>{t(key)}</option>)}</select></label><label>{t('cp_details')}<textarea rows="7" value={complaint.details} onChange={e=>setComplaint(v=>({...v,details:e.target.value}))} required placeholder={t('cp_details_ph')}/></label><button className="button button-primary" type="submit"><CheckCircle2 size={16}/> {t('cp_save')}</button></form><aside className="workspace-panel workspace-side-note"><MessageSquare size={23}/><h3>{t('cp_info_title')}</h3><ul><li>{t('cp_i1')}</li><li>{t('cp_i2')}</li><li>{t('cp_i3')}</li><li>{t('cp_i4')}</li></ul><p className="workspace-muted">{t('cp_urgent')}</p></aside></div>}
    {!isComplaints && <div className="help-guide-grid">
      <article className="workspace-panel"><ClipboardList size={23}/><h2>{t('nav_check')}</h2><p>{t('hp_check_text')}</p><Link to="/check">{t('dash_open_check')} <ArrowRight size={15}/></Link></article>
      <article className="workspace-panel"><CalendarDays size={23}/><h2>{t('hp_track_title')}</h2><p>{t('hp_track_text')}</p><Link to="/tracker">{t('dash_open_tracker')} <ArrowRight size={15}/></Link></article>
      <article className="workspace-panel"><FileText size={23}/><h2>{t('hp_reports_title')}</h2><p>{t('hp_reports_text')}</p><Link to="/report">{t('dash_open_reports')} <ArrowRight size={15}/></Link></article>
      <article className="workspace-panel"><ShieldCheck size={23}/><h2>{t('hp_privacy_title')}</h2><p>{t('hp_privacy_text')}</p><Link to="/privacy">{t('hp_privacy_link')} <ArrowRight size={15}/></Link></article>
    </div>}
  </main>
}
