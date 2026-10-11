// Paste receipt text -> POST /api/receipt/parse -> SUGGESTIONS the user must confirm.
// Nothing is counted until the user confirms (golden rule 1). The backend does all the
// interpretation (units, dates, item matching); this component only displays and edits.
import { useState } from 'react'
import { Sparkles, X } from 'lucide-react'
import { api } from '../../api/endpoints.js'
import { newId } from '../format.js'
import { errorText, issueText } from '../messages.js'
import { issuesToMap, recordSchema, UNITS } from '../../validation/case.js'
import { Alert, Field } from '../ui.jsx'

function SuggestionCard({ s, rawText, rules, onAdd, onDismiss }) {
  const matched = rules.find((r) => r.item.trim().toLowerCase() === (s.item || '').trim().toLowerCase())
  const first = {
    ruleId: matched?.id || '',
    itemText: s.item || '',
    value: s.quantity?.value || '',
    unit: s.quantity?.unit || matched?.quantity.unit || 'kg',
    date: s.date || '',
    ref: s.receipt_ref || '',
  }
  const [f, setF] = useState(first)
  const [errors, setErrors] = useState({})
  const set = (key, value) => setF((old) => ({ ...old, [key]: value }))
  const edited = Object.keys(first).some((k) => first[k] !== f[k])

  function build(status) {
    const rule = rules.find((r) => r.id === f.ruleId)
    return {
      id: newId(),
      rule_id: rule ? rule.id : null,
      item: rule ? rule.item : f.itemText.trim(),
      quantity: f.value.trim() ? { value: f.value.trim(), unit: f.unit } : null,
      date: f.date || null,
      status,
      entry_method: edited ? 'extracted_edited' : 'extracted_confirmed',
      // the pasted text is kept VERBATIM as evidence
      evidence: { receipt_ref: f.ref.trim() || null, note: null, no_receipt: false, receipt_text: rawText },
    }
  }

  function add(status) {
    const record = build(status)
    const parsed = recordSchema.safeParse(record)
    if (!parsed.success) { setErrors(issuesToMap(parsed.error)); return }
    setErrors({})
    onAdd(record)
  }

  return (
    <div className="rs-sugg">
      <h3>Suggested record</h3>
      <div className="rs-grid rs-grid-4">
        <Field label="Item" error={errors.item}>
          <select value={f.ruleId} onChange={(e) => set('ruleId', e.target.value)}>
            {rules.map((r) => <option key={r.id} value={r.id}>{r.item || '(unnamed rule)'}</option>)}
            <option value="">No rule for this item</option>
          </select>
        </Field>
        {!f.ruleId && (
          <Field label="Item name as written">
            <input value={f.itemText} maxLength={60} onChange={(e) => set('itemText', e.target.value)} />
          </Field>
        )}
        <Field label="Quantity" error={errors.quantity}>
          <input inputMode="decimal" value={f.value} onChange={(e) => set('value', e.target.value)} placeholder="e.g. 8" />
        </Field>
        <Field label="Unit">
          <select value={f.unit} onChange={(e) => set('unit', e.target.value)}>
            {UNITS.map((u) => <option key={u}>{u}</option>)}
          </select>
        </Field>
        <Field label="Date" error={errors.date}>
          <input type="date" value={f.date} onChange={(e) => set('date', e.target.value)} />
        </Field>
        <Field label="Receipt number">
          <input value={f.ref} maxLength={60} onChange={(e) => set('ref', e.target.value)} />
        </Field>
      </div>

      {s.date_candidates?.length > 1 && (
        <div className="rs-cand" aria-label="Possible dates">
          <span className="rs-small rs-muted">Possible dates:</span>
          {s.date_candidates.map((d) => (
            <button type="button" key={d} className={f.date === d ? 'on' : ''} onClick={() => set('date', d)}>{d}</button>
          ))}
        </div>
      )}
      {s.issues?.length > 0 && <ul className="rs-issues">{s.issues.map((c) => <li key={c}>{issueText(c)}</li>)}</ul>}

      <div className="rs-actions" style={{ marginTop: 12 }}>
        <button type="button" className="button button-primary rs-btn-sm" onClick={() => add('confirmed')}>Confirm and add</button>
        <button type="button" className="button button-outline rs-btn-sm" onClick={() => add('pending')}>Keep for later (not counted)</button>
        <button type="button" className="button button-quiet rs-btn-sm" onClick={onDismiss}><X size={15} /> Dismiss</button>
      </div>
    </div>
  )
}

export default function ReceiptPaste({ caseData, onAdd }) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [out, setOut] = useState(null)
  const [dismissed, setDismissed] = useState([])

  async function read() {
    setError('')
    setOut(null)
    setDismissed([])
    if (!text.trim()) { setError('Paste some receipt text first.'); return }
    setBusy(true)
    try {
      const res = await api.parseReceipt({
        text,
        period: caseData.period,
        knownItems: caseData.rules.map((r) => r.item.trim()).filter(Boolean).slice(0, 20),
      })
      setOut(res)
    } catch (e) {
      setError(e.status === 422 ? 'Check the receipt text (1 to 2,000 characters) and your period dates.' : errorText(e))
    } finally { setBusy(false) }
  }

  const visible = out ? out.suggestions.map((s, i) => ({ s, i })).filter(({ i }) => !dismissed.includes(i)) : []

  return (
    <div>
      <Field label="Receipt text" hint="Paste what the receipt says (English, Hindi or Marathi). Suggestions are never counted until you confirm them.">
        <textarea value={text} maxLength={2000} onChange={(e) => setText(e.target.value)} placeholder="e.g. Rice 8kg recvd 03/09 Rcpt#101" />
      </Field>
      <div className="rs-actions" style={{ marginTop: 10 }}>
        <button type="button" className="button button-outline rs-btn-sm" onClick={read} disabled={busy}>
          <Sparkles size={16} /> {busy ? 'Reading…' : 'Read receipt'}
        </button>
        <span className="rs-small rs-muted">{text.length}/2000</span>
      </div>
      {error && <div style={{ marginTop: 12 }}><Alert kind="bad">{error}</Alert></div>}
      {out && (
        <div style={{ marginTop: 12 }}>
          <Alert kind="info">
            {out.method === 'llm' ? 'Read by the AI assistant.' : 'Read by simple pattern matching.'}{' '}
            These are suggestions only: please check each one. The totals never depend on AI.
          </Alert>
          {visible.length === 0 && <p className="rs-muted">No items were found in that text. You can add the record manually instead.</p>}
          {visible.map(({ s, i }) => (
            <SuggestionCard key={i} s={s} rawText={out.raw_text} rules={caseData.rules}
              onAdd={(rec) => { onAdd(rec); setDismissed((d) => [...d, i]) }}
              onDismiss={() => setDismissed((d) => [...d, i])} />
          ))}
        </div>
      )}
    </div>
  )
}
