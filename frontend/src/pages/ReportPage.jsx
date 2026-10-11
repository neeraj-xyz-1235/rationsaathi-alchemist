import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight, CheckCircle2, CircleAlert, Download, FileText, Mail, RefreshCw } from 'lucide-react'
import { apiGet, apiPost } from '../api/client.js'

const currentMonth = () => new Date().toISOString().slice(0, 7)

export default function ReportPage() {
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
      else setError(loadError.message || 'Could not load the report.')
    } finally { setLoading(false) }
  }, [month])

  useEffect(() => { load() }, [load])

  async function emailReport() {
    setError('')
    setNotice('')
    setSending(true)
    try {
      const result = await apiPost('/api/monthly-report/email', { month })
      setNotice(`The report is on its way to ${result?.sent_to || 'your account email'}.`)
    } catch (sendError) {
      if (sendError.code === 'EMAIL_NOT_CONFIGURED') setError('Email is not set up on the server yet. You can still download the PDF.')
      else if (sendError.status === 429) setError('Too many emails sent recently. Please try again later.')
      else setError(sendError.message || 'The report could not be emailed.')
    } finally { setSending(false) }
  }

  return <main className="workspace-page report-page">
    <div className="workspace-breadcrumb"><Link to="/dashboard"><ArrowLeft size={15}/> Back to dashboard</Link><span>/</span><span>Ration reports</span></div>
    <div className="workspace-page-heading"><span className="workspace-page-icon"><FileText size={24}/></span><div><p className="section-eyebrow">RATIONSAATHI WORKSPACE</p><h1>Ration reports</h1><p>Your monthly allocation against what was recorded, ready to download or email to yourself.</p></div></div>
    {error && <div className="withdrawal-alert" role="alert"><CircleAlert size={18}/><span>{error}</span><button type="button" onClick={()=>setError('')}>Dismiss</button></div>}
    {notice && <div className="workspace-success" role="status"><CheckCircle2 size={18}/><span>{notice}</span></div>}
    <section className="workspace-panel report-toolbar">
      <label className="report-month">Month<input type="month" value={month} max={currentMonth()} onChange={(e)=>e.target.value && setMonth(e.target.value)}/></label>
      <div className="report-actions">
        <button type="button" className="button button-secondary" onClick={load}><RefreshCw size={15}/> Refresh</button>
        {report && <a className="button button-secondary" href={`/api/monthly-report/pdf?month=${month}`} download><Download size={15}/> Download PDF</a>}
        {report && <button type="button" className="button button-primary" onClick={emailReport} disabled={sending}><Mail size={15}/> {sending ? 'Sending…' : 'Email me this report'}</button>}
      </div>
    </section>
    {loading ? <div className="workspace-panel loading-panel">Loading report…</div> : missing ? <div className="workspace-panel workspace-empty"><FileText size={25}/><strong>No allocation for this month</strong><p>Calculate your monthly allocation first, then the report will be available.</p><Link to="/check" className="button button-primary">Check entitlement <ArrowRight size={15}/></Link></div> : report && <>
      <div className="workspace-summary-cards">{report.items.map((item) => <article key={item.item}><span>{item.item}</span><strong>{item.withdrawn} / {item.allocated} kg</strong><small>{item.over_by !== '0' ? `Over by ${item.over_by} kg` : `${item.remaining} kg remaining`}</small></article>)}</div>
      <section className="workspace-panel"><div className="workspace-panel-head"><div><h2>{report.period_label}</h2><p>{report.scheme_name}{report.scheme_assumed ? ' · card category not confirmed' : ''} · {report.household.members} member{report.household.members === 1 ? '' : 's'}</p></div></div>
        {report.withdrawals.length === 0 ? <div className="workspace-empty"><strong>No withdrawals recorded this month</strong></div> : <div className="workspace-record-list">{report.withdrawals.map((w) => <article className="workspace-record-row" key={w.receipt_id}><span className="workspace-record-icon rice">{w.item[0]}</span><div className="workspace-record-main"><strong>{w.item} · {w.quantity} {w.unit}</strong><span>{w.date} · Receipt {w.receipt_id}</span></div><span className="workspace-record-status"><CheckCircle2 size={14}/> Recorded</span></article>)}</div>}
      </section>
    </>}
  </main>
}
