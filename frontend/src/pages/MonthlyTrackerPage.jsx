import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight, CalendarDays, ChevronLeft, ChevronRight, CircleAlert, PackageCheck, RefreshCw, ShieldCheck } from 'lucide-react'
import { apiGet } from '../api/client.js'
import { useLang } from '../i18n/index.jsx'

const pad = (value) => String(value).padStart(2, '0')
const keyFor = (year, month, day) => `${year}-${pad(month + 1)}-${pad(day)}`
const LOCALES = { en: 'en-IN', hi: 'hi-IN', mr: 'mr-IN' }

export default function MonthlyTrackerPage() {
  const { t, tItem, language } = useLang()
  const locale = LOCALES[language] || 'en-IN'
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  const [selected, setSelected] = useState(() => new Date().toISOString().slice(0, 10))
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    const monthKey = `${month.getFullYear()}-${pad(month.getMonth() + 1)}`
    try {
      const data = await apiGet(`/api/withdrawals?month=${monthKey}`)
      setRecords(data?.items || data?.withdrawals || data || [])
    } catch (loadError) {
      setRecords([])
      setError(loadError.message || t('err_generic'))
    } finally { setLoading(false) }
  }, [month, t])

  useEffect(() => { load() }, [load])

  const recordDates = useMemo(() => new Set(records.map((record) => String(record.withdrawal_date || record.date || '').slice(0, 10))), [records])
  const selectedRecords = records.filter((record) => String(record.withdrawal_date || record.date || '').slice(0, 10) === selected)
  const first = new Date(month.getFullYear(), month.getMonth(), 1)
  const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  const offset = (first.getDay() + 6) % 7
  const cells = [...Array(offset).fill(null), ...Array.from({ length: count }, (_, index) => index + 1)]
  const today = new Date().toISOString().slice(0, 10)
  const total = records.reduce((sum, row) => sum + Number(row.quantity || 0), 0)

  return <main className="workspace-page monthly-tracker-page">
    <div className="workspace-breadcrumb"><Link to="/dashboard"><ArrowLeft size={15}/> {t('tr_dashboard')}</Link><span>/</span><span>{t('tr_breadcrumb')}</span></div>
    <div className="workspace-page-heading"><span className="workspace-page-icon"><CalendarDays size={24}/></span><div><p className="section-eyebrow">{t('tr_eyebrow')}</p><h1>{t('tr_title')}</h1><p>{t('tr_intro')}</p></div></div>
    {error&&<div className="withdrawal-alert" role="alert"><CircleAlert size={18}/><span>{error}</span><button type="button" onClick={load}>{t('tr_retry')}</button></div>}
    <div className="tracker-summary-grid"><article><span>{t('tr_records')}</span><strong>{records.length}</strong><small>{t('tr_saved')}</small></article><article><span>{t('tr_total')}</span><strong>{total.toLocaleString(locale)} kg</strong><small>{t('tr_across')}</small></article><article><span>{t('tr_days')}</span><strong>{recordDates.size}</strong><small>{t('tr_days_text')}</small></article></div>
    <div className="tracker-layout"><section className="workspace-panel tracker-calendar-panel"><div className="tracker-calendar-heading"><div><span className="section-eyebrow">{t('tr_month_view')}</span><h2>{month.toLocaleDateString(locale,{month:'long',year:'numeric'})}</h2></div><div className="tracker-calendar-controls"><button type="button" aria-label={t('tr_prev')} onClick={()=>setMonth(new Date(month.getFullYear(),month.getMonth()-1,1))}><ChevronLeft size={18}/></button><button type="button" aria-label={t('tr_next')} onClick={()=>setMonth(new Date(month.getFullYear(),month.getMonth()+1,1))}><ChevronRight size={18}/></button><button type="button" className="tracker-today-button" onClick={()=>{const now=new Date();setMonth(new Date(now.getFullYear(),now.getMonth(),1));setSelected(today)}}>{t('tr_today')}</button></div></div>
      <div className="tracker-calendar-grid tracker-weekdays">{t('tr_weekdays').split(',').map((day)=><span key={day}>{day}</span>)}</div>
      <div className="tracker-calendar-grid">{cells.map((day,index)=>{if(!day)return <span className="tracker-empty-day" key={`blank-${index}`}/>;const key=keyFor(month.getFullYear(),month.getMonth(),day);const has=recordDates.has(key);return <button key={key} type="button" className={`tracker-day ${selected===key?'selected':''} ${has?'has-record':''} ${key===today?'is-today':''}`} onClick={()=>setSelected(key)}><span>{day}</span>{has&&<i/>}</button>})}</div>
      <div className="tracker-calendar-legend"><span><i className="legend-dot green"/> {t('tr_legend_saved')}</span><span><i className="legend-dot outline"/> {t('tr_legend_today')}</span></div>
      <div className="tracker-calendar-footnote"><ShieldCheck size={15}/> {t('tr_footnote')}</div>
    </section>
    <section className="workspace-panel tracker-day-panel"><div className="tracker-day-heading"><div><span className="section-eyebrow">{t('tr_selected')}</span><h2>{new Date(`${selected}T12:00:00`).toLocaleDateString(locale,{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</h2></div><span className="tracker-date-icon"><CalendarDays size={20}/></span></div>
      {loading?<div className="workspace-empty">{t('tr_loading')}</div>:selectedRecords.length===0?<div className="workspace-empty"><PackageCheck size={28}/><strong>{t('tr_no_day')}</strong><p>{t('tr_no_day_text')}</p><Link to="/withdrawals" className="button button-primary">{t('tr_record')} <ArrowRight size={15}/></Link></div>:<div className="tracker-selected-records">{selectedRecords.map((record,index)=><article className="tracker-record-card" key={record.id||record.receipt_id||index}><span className="workspace-record-icon rice">{String(record.item||'R')[0].toUpperCase()}</span><div><strong>{tItem(record.item)} · {record.quantity} {record.unit||'kg'}</strong><small>{t('tr_receipt')}: {record.receipt_id||record.reference||t('tr_not_provided')}</small><small>{t('tr_status')}: {record.status&&record.status!=='recorded'?record.status:t('wd_recorded')}</small></div></article>)}</div>}
      <Link to="/withdrawals" className="tracker-add-link">{t('tr_manage')} <ArrowRight size={15}/></Link>
    </section></div>
    <div className="tracker-bottom-row"><span><RefreshCw size={14}/> {t('tr_refresh_note')}</span><button type="button" className="button button-secondary" onClick={load}><RefreshCw size={15}/> {t('tr_refresh')}</button></div>
  </main>
}
