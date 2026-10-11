// Renders a /api/calculate result. Every number comes from the API; this file only formats it
// into line-by-line text a person can check (plan_backend.txt 2.2: "4 × 5 kg = 20 kg" etc.).
import { Link } from 'react-router-dom'
import { Info } from 'lucide-react'
import { fmtDate, fmtPeriod } from '../format.js'
import {
  balanceSentence, CARRY_NOTE, evidenceText, excludedReason, itemSentence, LABEL_TEXT, REPORT_FOOTER,
} from '../messages.js'
import { Chip } from '../ui.jsx'

const LABEL_KIND = { shortfall: 'amber', no_difference: 'green', above_expected: 'info', unclear: 'slate', late: 'amber', unrecorded: 'amber' }

function recordLabel(rec) {
  if (!rec) return 'a record'
  const q = rec.quantity ? `${rec.quantity.value} ${rec.quantity.unit}` : 'no quantity'
  return `${fmtDate(rec.date)} · ${q}`
}

function ItemSection({ item, result, caseData }) {
  const recs = Object.fromEntries(caseData.records.map((r) => [r.id, r]))
  const rule = caseData.rules.find((r) => r.id === item.rule_id)
  const u = item.unit
  const e = item.expected
  const terms = item.received.terms.map((t) => `${t.value} ${u}`)
  const bar = Math.max(0, Math.min(100, parseFloat(item.balance.percent_used) || 0)) // display only
  const late = item.labels.find((l) => l.code === 'late')
  const dirText = { below: 'expected minus received', equal: 'expected minus received', above: 'received is above expected' }[item.difference.direction]
  const labels = []
  for (const l of item.labels) if (!labels.includes(l.code)) labels.push(l.code)

  return (
    <section className="rs-item" aria-labelledby={`item-${item.rule_id}`}>
      <h2 id={`item-${item.rule_id}`}>{item.item}</h2>
      <div className="rs-actions" style={{ marginBottom: 14 }}>
        {labels.map((c) => <Chip key={c} kind={LABEL_KIND[c]}>{LABEL_TEXT[c] || c}</Chip>)}
      </div>

      <div className="rs-cards3">
        <div className="rs-card green"><small>Expected</small><strong>{e.value} {u}</strong></div>
        <div className="rs-card slate"><small>Total received (confirmed)</small><strong>{item.received.value} {u}</strong></div>
        <div className="rs-card amber"><small>Difference</small><strong>{item.difference.value} {u}</strong><div className="rs-small rs-muted">{dirText}</div></div>
      </div>

      <ul className="rs-lines" aria-label="Calculation breakdown">
        <li><span>Expected</span><strong>
          {e.basis === 'per_household' ? `${e.per_unit} ${u} (per household) = ${e.value} ${u}` : `${e.members} × ${e.per_unit} ${u} = ${e.value} ${u}`}
        </strong></li>
        <li><span>Received</span><strong>{terms.length ? `${terms.join(' + ')} = ${item.received.value} ${u}` : `No confirmed records = 0 ${u}`}</strong></li>
        <li><span>Difference</span><strong>{e.value} {u} − {item.received.value} {u} = {item.difference.value} {u}</strong></li>
      </ul>

      <div className="rs-bar-row">
        <div className="rs-bar" role="img" aria-label={`${item.balance.percent_used}% recorded`}><span style={{ width: `${bar}%` }} /></div>
        <strong>{item.received.value} of {e.value} {u} recorded ({item.balance.percent_used}%)</strong>
      </div>
      <p style={{ margin: '4px 0 2px' }}>{balanceSentence(item)}</p>
      <p className="rs-small rs-muted" style={{ margin: '0 0 14px' }}>{CARRY_NOTE}</p>

      <p className="rs-observe"><Info size={16} style={{ verticalAlign: '-3px', marginRight: 6 }} aria-hidden="true" />{itemSentence(item, result.period)}</p>

      {item.excluded.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <strong className="rs-small">Not counted in the total:</strong>
          <ul className="rs-small" style={{ margin: '6px 0 0', paddingLeft: 18 }}>
            {item.excluded.map((x) => <li key={x.record_id}>{recordLabel(recs[x.record_id])}: {excludedReason(x.reason)}. Please review it.</li>)}
          </ul>
        </div>
      )}
      {late && rule?.due_by && (
        <p className="rs-small" style={{ margin: 0 }}>
          {late.record_ids.length} distribution(s) of {item.item} are dated after the due date of {fmtDate(rule.due_by)} that you entered.
        </p>
      )}
    </section>
  )
}

export default function ReportView({ result, caseData, showComplaintsLink = true }) {
  const s = result.evidence_summary
  const unmatchedRecs = result.unmatched.map((u) => caseData.records.find((r) => r.id === u.record_id)).filter(Boolean)

  return (
    <div>
      <p className="rs-muted" style={{ marginTop: -8 }}>
        {fmtPeriod(result.period)} · {result.members} household member{result.members === 1 ? '' : 's'} ·{' '}
        <Chip kind={result.period.status === 'ended' ? 'slate' : 'info'}>{result.period.status === 'ended' ? 'Period ended' : 'Period ongoing'}</Chip>
        {caseData.household_ref ? <> · {caseData.household_ref}</> : null}
      </p>

      {result.items.length === 0 && <p className="rs-muted">No entitlement rules were entered, so there is nothing to compare.</p>}
      {result.items.map((it) => <ItemSection key={it.rule_id} item={it} result={result} caseData={caseData} />)}

      {unmatchedRecs.length > 0 && (
        <section className="rs-panel">
          <h2>Records with no rule</h2>
          <ul className="rs-small" style={{ paddingLeft: 18 }}>
            {unmatchedRecs.map((r) => <li key={r.id}>{r.item}: no entitlement rule was entered for this item, so it was not compared ({recordLabel(r)}).</li>)}
          </ul>
        </section>
      )}

      <section className="rs-panel">
        <h2>Distribution records and evidence</h2>
        <p className="rs-muted rs-small">{s.records} record(s): {s.with_proof_photo} with a receipt photo, {s.with_receipt_ref} with a receipt number, {s.with_receipt_text} with pasted receipt text, {s.no_receipt} stated as having no receipt, {s.no_evidence} with no evidence given.</p>
        <div className="rs-table-wrap">
          <table className="rs-table">
            <thead><tr><th>Date</th><th>Item</th><th>Quantity</th><th>Status</th><th>Evidence</th></tr></thead>
            <tbody>
              {caseData.records.map((r) => (
                <tr key={r.id}>
                  <td>{fmtDate(r.date)}</td>
                  <td>{r.item}</td>
                  <td>{r.quantity ? `${r.quantity.value} ${r.quantity.unit}` : '—'}</td>
                  <td>{r.status === 'confirmed' ? 'Confirmed' : 'Not confirmed'}</td>
                  <td className="rs-evidence">{evidenceText(r)}</td>
                </tr>
              ))}
              {caseData.records.length === 0 && <tr><td colSpan={5} className="rs-muted">No records were entered.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <p className="rs-small rs-muted">{REPORT_FOOTER} RationSaathi is an independent tool, not a government service.</p>
      {showComplaintsLink && (
        <p className="rs-small rs-no-print">Want someone to review this? <Link to="/complaints">See where to raise a query</Link>.</p>
      )}
    </div>
  )
}
