import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight, CheckCircle2, CircleAlert, Download, FileText, Mail, RefreshCw } from 'lucide-react'
import { apiGet, apiPost } from '../api/client.js'
import { useLang } from '../i18n/index.jsx'

const currentMonth = () => new Date().toISOString().slice(0, 7)

export default function ReportPage() {
  const { t, tItem, periodLabel } = useLang()
  const [month, setMonth] = useState(currentMonth)
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [missing, setMissing] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [sending, setSending] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    setMissing(false)
    try {
      const data = await apiGet(`/api/monthly-report?month=${month}`)
      setReport(data?.report || null)
    } catch (loadError) {
      setReport(null)
      if (loadError.status === 404) setMissing(true)
      else setError(t('rp_err_load'))
    } finally { setLoading(false) }
  }, [month, t])

  useEffect(() => { load() }, [load])

  async function emailReport() {
    setError('')
    setNotice('')
    setSending(true)
    try {
      const result = await apiPost('/api/monthly-report/email', { month })
      setNotice(t('rp_sent', { to: result?.sent_to || '' }))
    } catch (sendError) {
      if (sendError.code === 'EMAIL_NOT_CONFIGURED') setError(t('rp_err_email_off'))
      else if (sendError.status === 429) setError(t('rp_err_many'))
      else setError(t('rp_err_email'))
    } finally { setSending(false) }
  }

  return <main className="workspace-page report-page">
    <div className="workspace-breadcrumb"><Link to="/dashboard"><ArrowLeft size={15}/> {t('rp_back')}</Link><span>/</span><span>{t('rp_breadcrumb')}</span></div>
    <div className="workspace-page-heading"><span className="workspace-page-icon"><FileText size={24}/></span><div><p className="section-eyebrow">{t('rp_workspace')}</p><h1>{t('rp_title')}</h1><p>{t('rp_intro')}</p></div></div>
    {error && <div className="withdrawal-alert" role="alert"><CircleAlert size={18}/><span>{error}</span><button type="button" onClick={()=>setError('')}>{t('rp_dismiss')}</button></div>}
    {notice && <div className="workspace-success" role="status"><CheckCircle2 size={18}/><span>{notice}</span></div>}
    <section className="workspace-panel report-toolbar">
      <label className="report-month">{t('rp_month')}<input type="month" value={month} max={currentMonth()} onChange={(e)=>e.target.value && setMonth(e.target.value)}/></label>
      <div className="report-actions">
        <button type="button" className="button button-secondary" onClick={load}><RefreshCw size={15}/> {t('rp_refresh')}</button>
        {report && <a className="button button-secondary" href={`/api/monthly-report/pdf?month=${month}`} download><Download size={15}/> {t('rp_download')}</a>}
        {report && <button type="button" className="button button-primary" onClick={emailReport} disabled={sending}><Mail size={15}/> {sending ? t('rp_sending') : t('rp_email')}</button>}
      </div>
    </section>
    {loading ? <div className="workspace-panel loading-panel">{t('rp_loading')}</div> : missing ? <div className="workspace-panel workspace-empty"><FileText size={25}/><strong>{t('rp_none_title')}</strong><p>{t('rp_none_text')}</p><Link to="/check" className="button button-primary">{t('rp_check')} <ArrowRight size={15}/></Link></div> : report && <>
      <div className="workspace-summary-cards">{report.items.map((item) => <article key={item.item}><span>{tItem(item.item)}</span><strong>{item.withdrawn} / {item.allocated} kg</strong><small>{item.over_by !== '0' ? t('rp_over', { n: item.over_by }) : t('rp_remaining', { n: item.remaining })}</small></article>)}</div>
      <section className="workspace-panel"><div className="workspace-panel-head"><div><h2>{periodLabel(report.period, report.period_label)}</h2><p>{String(report.scheme_name).replace('Priority Household (PHH)', t('su_phh')).replace('Antyodaya Anna Yojana (AAY)', t('su_aay'))}{report.scheme_assumed ? t('rp_unconfirmed') : ''} · {t('rp_members', { n: report.household.members })}</p></div></div>
        {report.withdrawals.length === 0 ? <div className="workspace-empty"><strong>{t('rp_no_wd')}</strong></div> : <div className="workspace-record-list">{report.withdrawals.map((w) => <article className="workspace-record-row" key={w.receipt_id}><span className="workspace-record-icon rice">{w.item[0]}</span><div className="workspace-record-main"><strong>{tItem(w.item)} · {w.quantity} {w.unit}</strong><span>{w.date} · {t('wd_receipt')} {w.receipt_id}</span></div><span className="workspace-record-status"><CheckCircle2 size={14}/> {t('wd_recorded')}</span></article>)}</div>}
      </section>
    </>}
  </main>
}
