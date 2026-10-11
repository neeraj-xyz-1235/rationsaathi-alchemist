import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight, CalendarDays, ChevronLeft, ChevronRight, CircleAlert, PackageCheck, RefreshCw, ShieldCheck } from 'lucide-react'
import { apiGet } from '../api/client.js'

const pad = (value) => String(value).padStart(2, '0')
const keyFor = (year, month, day) => `${year}-${pad(month + 1)}-${pad(day)}`

export default function MonthlyTrackerPage() {
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
      setError(loadError.message || 'Unable to load saved monthly records.')
    } finally { setLoading(false) }
  }, [month])

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
    <div className="workspace-breadcrumb"><Link to="/dashboard"><ArrowLeft size={15}/> Dashboard</Link><span>/</span><span>Monthly tracker</span></div>
    <div className="workspace-page-heading"><span className="workspace-page-icon"><CalendarDays size={24}/></span><div><p className="section-eyebrow">YOUR DELIVERY HISTORY</p><h1>Monthly tracker</h1><p>Use the calendar to see which dates have recorded withdrawals and open each day’s receipts.</p></div></div>
    {error&&<div className="withdrawal-alert" role="alert"><CircleAlert size={18}/><span>{error}</span><button type="button" onClick={load}>Retry</button></div>}
    <div className="tracker-summary-grid"><article><span>Records this month</span><strong>{records.length}</strong><small>Saved server records</small></article><article><span>Total quantity recorded</span><strong>{total.toLocaleString('en-IN')} kg</strong><small>Across returned entries</small></article><article><span>Days with activity</span><strong>{recordDates.size}</strong><small>Calendar dates with records</small></article></div>
    <div className="tracker-layout"><section className="workspace-panel tracker-calendar-panel"><div className="tracker-calendar-heading"><div><span className="section-eyebrow">MONTH VIEW</span><h2>{month.toLocaleDateString('en-IN',{month:'long',year:'numeric'})}</h2></div><div className="tracker-calendar-controls"><button type="button" aria-label="Previous month" onClick={()=>setMonth(new Date(month.getFullYear(),month.getMonth()-1,1))}><ChevronLeft size={18}/></button><button type="button" aria-label="Next month" onClick={()=>setMonth(new Date(month.getFullYear(),month.getMonth()+1,1))}><ChevronRight size={18}/></button><button type="button" className="tracker-today-button" onClick={()=>{const now=new Date();setMonth(new Date(now.getFullYear(),now.getMonth(),1));setSelected(today)}}>Today</button></div></div>
      <div className="tracker-calendar-grid tracker-weekdays">{['MON','TUE','WED','THU','FRI','SAT','SUN'].map((day)=><span key={day}>{day}</span>)}</div>
      <div className="tracker-calendar-grid">{cells.map((day,index)=>{if(!day)return <span className="tracker-empty-day" key={`blank-${index}`}/>;const key=keyFor(month.getFullYear(),month.getMonth(),day);const has=recordDates.has(key);return <button key={key} type="button" className={`tracker-day ${selected===key?'selected':''} ${has?'has-record':''} ${key===today?'is-today':''}`} onClick={()=>setSelected(key)}><span>{day}</span>{has&&<i/>}</button>})}</div>
      <div className="tracker-calendar-legend"><span><i className="legend-dot green"/> Saved withdrawal</span><span><i className="legend-dot outline"/> Today</span></div>
      <div className="tracker-calendar-footnote"><ShieldCheck size={15}/> Calendar markers are based on records returned by the server; no sample dates are added.</div>
    </section>
    <section className="workspace-panel tracker-day-panel"><div className="tracker-day-heading"><div><span className="section-eyebrow">SELECTED DATE</span><h2>{new Date(`${selected}T12:00:00`).toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</h2></div><span className="tracker-date-icon"><CalendarDays size={20}/></span></div>
      {loading?<div className="workspace-empty">Loading records…</div>:selectedRecords.length===0?<div className="workspace-empty"><PackageCheck size={28}/><strong>No withdrawals on this date</strong><p>If you collected ration on this day, record it so the monthly history stays accurate.</p><Link to="/withdrawals" className="button button-primary">Record withdrawal <ArrowRight size={15}/></Link></div>:<div className="tracker-selected-records">{selectedRecords.map((record,index)=><article className="tracker-record-card" key={record.id||record.receipt_id||index}><span className="workspace-record-icon rice">{String(record.item||'R')[0].toUpperCase()}</span><div><strong>{record.item} · {record.quantity} {record.unit||'kg'}</strong><small>Receipt: {record.receipt_id||record.reference||'Not provided'}</small><small>Status: {record.status||'Recorded'}</small></div></article>)}</div>}
      <Link to="/withdrawals" className="tracker-add-link">Manage withdrawals <ArrowRight size={15}/></Link>
    </section></div>
    <div className="tracker-bottom-row"><span><RefreshCw size={14}/> Records refresh from your account’s withdrawal API.</span><button type="button" className="button button-secondary" onClick={load}><RefreshCw size={15}/> Refresh month</button></div>
  </main>
}
