// Monthly tracker (plan_backend.txt 2.7). Every saved case is one month. The numbers come from
// GET /api/tracker, which runs each case through the SAME engine as the report.
import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CalendarPlus, FileText, FolderOpen, Trash2 } from 'lucide-react'
import { api } from '../../api/endpoints.js'
import { useCase } from '../../context/CaseContext.jsx'
import { fmtPeriod } from '../format.js'
import { errorText, LABEL_TEXT } from '../messages.js'
import { Alert, Chip, PageHead, Spinner } from '../ui.jsx'

const KIND = { shortfall: 'amber', no_difference: 'green', above_expected: 'info', unclear: 'slate', late: 'amber', unrecorded: 'amber' }

function balanceLine(it, status) {
  if (it.over_by !== '0') return `${it.over_by} ${it.unit} more than expected recorded`
  if (it.remaining === '0') return 'Full amount recorded'
  return status === 'ongoing'
    ? `${it.remaining} ${it.unit} still to be collected`
    : `${it.remaining} ${it.unit} not recorded as collected`
}

function MonthCard({ month, busy, onOpen, onReport, onDelete }) {
  return (
    <div className="rs-month">
      <div className="rs-month-head">
        <h3>{fmtPeriod(month.period)}</h3>
        <Chip kind={month.period.status === 'ongoing' ? 'info' : 'slate'}>{month.period.status === 'ongoing' ? 'Ongoing' : 'Ended'}</Chip>
      </div>
      {month.items.length === 0 ? <p className="rs-muted rs-small">No entitlement rules in this month.</p> : (
        <ul className="rs-month-items">
          {month.items.map((it) => {
            const pct = Math.max(0, Math.min(100, parseFloat(it.percent_used) || 0)) // display only
            const labels = []
            for (const l of it.labels) if (!labels.includes(l)) labels.push(l)
            return (
              <li key={it.item + it.unit}>
                <div className="rs-month-line"><strong>{it.item}</strong><span>{it.received} of {it.expected} {it.unit} · {balanceLine(it, month.period.status)}</span></div>
                <div className="rs-bar-row">
                  <div className="rs-bar" role="img" aria-label={`${it.percent_used}% recorded`}><span style={{ width: `${pct}%` }} /></div>
                  <strong>{it.percent_used}%</strong>
                </div>
                <div className="rs-actions">{labels.map((l) => <Chip key={l} kind={KIND[l]}>{LABEL_TEXT[l] || l}</Chip>)}</div>
              </li>
            )
          })}
        </ul>
      )}
      <div className="rs-actions" style={{ marginTop: 10 }}>
        <button type="button" className="button button-outline rs-btn-sm" disabled={busy} onClick={() => onOpen(month.case_id)}><FolderOpen size={15} /> Open and edit</button>
        <button type="button" className="button button-outline rs-btn-sm" disabled={busy} onClick={() => onReport(month.case_id)}><FileText size={15} /> View report</button>
        <button type="button" className="rs-icon-btn" aria-label={`Delete ${fmtPeriod(month.period)}`} disabled={busy} onClick={() => onDelete(month)}><Trash2 size={16} /></button>
      </div>
    </div>
  )
}

export default function TrackerPage() {
  const navigate = useNavigate()
  const { loadCase } = useCase()
  const [months, setMonths] = useState(6)
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try { setData(await api.tracker(months)); setError('') } catch (e) { setError(errorText(e)) }
  }, [months])

  useEffect(() => { load() }, [load])

  async function act(fn) {
    setBusy(true); setError(''); setNotice('')
    try { await fn() } catch (e) { setError(errorText(e)) } finally { setBusy(false) }
  }

  const open = (id, to) => act(async () => { loadCase(id, await api.getCase(id)); navigate(to) })
  const next = (id) => act(async () => { await api.nextMonth(id); setNotice('Next month created with the same rules and no records. Open it to add what was received.'); await load() })
  const remove = (month) => {
    if (!window.confirm(`Delete the check for ${fmtPeriod(month.period)}? This also deletes its shared reports and notes.`)) return
    act(async () => { await api.deleteCase(month.case_id); await load() })
  }

  return (
    <main className="rs-page" id="tracker">
      <PageHead title="Monthly tracker" subtitle="Each saved check is one month. Months are shown side by side; each is compared only with its own rules.">
        <label className="rs-small rs-muted" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>Show
          <select className="rs-input" style={{ width: 'auto', minHeight: 38 }} value={months} onChange={(e) => setMonths(Number(e.target.value))}>
            {[3, 6, 12, 24].map((n) => <option key={n} value={n}>{n} months</option>)}
          </select>
        </label>
        <Link className="button button-primary rs-btn-sm" to="/check">New check</Link>
      </PageHead>

      <Alert kind="info">Unused ration from one month is <strong>not</strong> added to the next. This tool only applies the rules you entered and does not assume carry-over.</Alert>
      {error && <Alert kind="bad">{error}</Alert>}
      {notice && <Alert kind="ok">{notice}</Alert>}

      {!data && !error && <Spinner>Loading your months…</Spinner>}
      {data && data.households.length === 0 && (
        <div className="rs-panel rs-empty">
          <h2>No saved checks yet</h2>
          <p>Generate a report and choose “Save this check” to see it here.</p>
          <Link className="button button-primary" to="/check">Start a check</Link>
        </div>
      )}
      {data && data.households.map((h) => (
        <section className="rs-panel" key={h.household_ref ?? '__none'}>
          <div className="rs-panel-head">
            <div><h2>{h.household_ref || 'My household'}</h2><p>{h.months.length} month{h.months.length === 1 ? '' : 's'} shown, newest first</p></div>
            <button type="button" className="button button-outline rs-btn-sm" disabled={busy} onClick={() => next(h.months[0].case_id)}><CalendarPlus size={16} /> Start next month</button>
          </div>
          {h.months.map((m) => <MonthCard key={m.case_id} month={m} busy={busy} onOpen={(id) => open(id, '/check')} onReport={(id) => open(id, '/report')} onDelete={remove} />)}
        </section>
      ))}
    </main>
  )
}
