import { useEffect, useRef, useState } from 'react'
import { ImagePlus, Plus, Trash2, X } from 'lucide-react'
import { fmtDate, newId, todayIso } from '../format.js'
import { evidenceText } from '../messages.js'
import { issuesToMap, recordSchema, UNITS } from '../../validation/case.js'
import { Chip, Field } from '../ui.jsx'
import { deleteProof, getProof, saveProof, shrinkImage } from '../scan/proofStore.js'
import ReceiptPaste from './ReceiptPaste.jsx'

function inPeriod(date, period) {
  return date >= period.start && date <= period.end
}


/** Thumbnail of a receipt photo kept on this device (it is never uploaded). */
function ProofThumb({ id, attached }) {
  const [url, setUrl] = useState('')
  useEffect(() => {
    let live = true
    let made = ''
    if (attached) {
      getProof(id).then((blob) => { if (live && blob) { made = URL.createObjectURL(blob); setUrl(made) } }).catch(() => {})
    }
    return () => { live = false; if (made) URL.revokeObjectURL(made) }
  }, [id, attached])
  if (!attached) return null
  return url
    ? <a href={url} target="_blank" rel="noreferrer" title="Open receipt photo"><img src={url} alt="Receipt photo" className="rs-thumb" /></a>
    : <span className="rs-small rs-muted">Photo is on another device</span>
}

function ProofPicker({ file, onFile, disabled, error }) {
  const ref = useRef(null)
  const [url, setUrl] = useState('')
  useEffect(() => {
    if (!file) { setUrl(''); return undefined }
    const u = URL.createObjectURL(file)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [file])
  return (
    <div className={`rs-field ${error ? 'has-error' : ''}`}>
      Photo of the receipt (proof)
      <input ref={ref} type="file" accept="image/*" capture="environment" hidden
        onChange={(e) => { onFile(e.target.files?.[0] || null); e.target.value = '' }} />
      <div className="rs-proof-pick">
        {url && <img src={url} alt="Receipt preview" className="rs-thumb" />}
        <button type="button" className="button button-outline rs-btn-sm" disabled={disabled} onClick={() => ref.current?.click()}>
          <ImagePlus size={16} /> {file ? 'Change photo' : 'Add receipt photo'}
        </button>
        {file && <button type="button" className="rs-icon-btn" aria-label="Remove photo" onClick={() => onFile(null)}><X size={16} /></button>}
      </div>
      {error ? <p className="rs-error" role="alert">{error}</p> : <span className="rs-hint">Kept on this device only. It is not uploaded.</span>}
    </div>
  )
}

function ManualRecord({ caseData, onAdd }) {
  const { rules, period } = caseData
  const blank = () => ({
    ruleId: rules[0]?.id || '', itemText: '', value: '', unit: rules[0]?.quantity.unit || 'kg',
    date: inPeriod(todayIso(), period) ? todayIso() : period.start,
    ref: '', note: '', noReceipt: false, photo: null,
  })
  const [f, setF] = useState(blank)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const set = (key, value) => setF((old) => ({ ...old, [key]: value }))
  const rule = rules.find((r) => r.id === f.ruleId)

  function pickRule(id) {
    const r = rules.find((x) => x.id === id)
    setF((old) => ({ ...old, ruleId: id, unit: r ? r.quantity.unit : old.unit }))
  }

  async function submit(e) {
    e.preventDefault()
    const record = {
      id: newId(),
      rule_id: rule ? rule.id : null,
      item: rule ? rule.item : f.itemText.trim(),
      quantity: { value: f.value.trim(), unit: f.unit },
      date: f.date || null,
      status: 'confirmed',
      entry_method: 'manual',
      evidence: { receipt_ref: f.ref.trim() || null, note: f.note.trim() || null, no_receipt: f.noReceipt, receipt_text: null, proof_photo: Boolean(f.photo) },
    }
    const parsed = recordSchema.safeParse(record)
    const next = parsed.success ? {} : issuesToMap(parsed.error)
    if (!f.photo && !f.noReceipt) next.proof = 'Add a photo of the receipt, or tick "I have no receipt".'
    if (Object.keys(next).length) { setErrors(next); return }
    setErrors({})
    setSaving(true)
    try {
      if (f.photo) await saveProof(record.id, await shrinkImage(f.photo))
    } catch {
      setSaving(false)
      setErrors({ proof: 'We could not save that photo. Try a different one.' })
      return
    }
    setSaving(false)
    onAdd(record)
    setF({ ...blank(), ruleId: f.ruleId, unit: f.unit, date: f.date })
  }

  return (
    <form onSubmit={submit} noValidate>
      <div className="rs-grid rs-grid-4">
        <Field label="Item" error={errors.item}>
          <select value={f.ruleId} onChange={(e) => pickRule(e.target.value)}>
            {rules.map((r) => <option key={r.id} value={r.id}>{r.item || '(unnamed rule)'}</option>)}
            <option value="">Other item</option>
          </select>
        </Field>
        {!rule && (
          <Field label="Item name" error={errors.item}>
            <input value={f.itemText} maxLength={60} onChange={(e) => set('itemText', e.target.value)} placeholder="e.g. Sugar" />
          </Field>
        )}
        <Field label="Quantity received" error={errors.quantity}>
          <input inputMode="decimal" value={f.value} onChange={(e) => set('value', e.target.value)} placeholder="e.g. 8" />
        </Field>
        <Field label="Unit">
          <select value={f.unit} onChange={(e) => set('unit', e.target.value)}>
            {UNITS.map((u) => <option key={u}>{u}</option>)}
          </select>
        </Field>
        <Field label="Date received" error={errors.date}>
          <input type="date" value={f.date} onChange={(e) => set('date', e.target.value)} />
        </Field>
      </div>

      <div className="rs-grid rs-grid-2" style={{ marginTop: 14 }}>
        <ProofPicker file={f.photo} onFile={(photo) => set('photo', photo)} disabled={f.noReceipt} error={errors.proof} />
        <div className="rs-grid" style={{ gap: 10 }}>
          <Field label="Receipt number (optional)" error={errors['evidence.receipt_ref']}>
            <input value={f.ref} maxLength={60} onChange={(e) => set('ref', e.target.value)} />
          </Field>
          <label className="rs-check">
            <input type="checkbox" checked={f.noReceipt}
              onChange={(e) => setF((old) => ({ ...old, noReceipt: e.target.checked, photo: e.target.checked ? null : old.photo }))} />
            I have no receipt
          </label>
        </div>
      </div>
      <div className="rs-actions" style={{ marginTop: 14 }}>
        <button type="submit" className="button button-primary rs-btn-sm" disabled={saving}><Plus size={16} /> {saving ? 'Saving…' : 'Add record'}</button>
      </div>
    </form>
  )
}

export default function RecordsSection({ caseData, setCase }) {
  const [mode, setMode] = useState('manual')
  const { rules, records, period } = caseData

  const add = (rec) => setCase((c) => ({ ...c, records: [...c.records, rec] }))
  const remove = (id) => {
    deleteProof(id).catch(() => {})
    setCase((c) => ({ ...c, records: c.records.filter((r) => r.id !== id) }))
  }
  const confirm = (id) => setCase((c) => ({
    ...c, records: c.records.map((r) => (r.id === id ? { ...r, status: 'confirmed' } : r)),
  }))

  return (
    <section className="rs-panel" aria-labelledby="records-h">
      <div className="rs-panel-head">
        <div>
          <h2 id="records-h"><span className="rs-step">3</span>What was received</h2>
          <p>Enter only the amount you received and add a photo of the receipt as proof. Only <strong>confirmed</strong> records are counted.</p>
        </div>
        <div className="rs-actions">
          <button type="button" className={`button rs-btn-sm ${mode === 'manual' ? 'button-primary' : 'button-outline'}`} onClick={() => setMode('manual')}>Enter amount</button>
          <button type="button" className={`button rs-btn-sm ${mode === 'paste' ? 'button-primary' : 'button-outline'}`} onClick={() => setMode('paste')}>Paste receipt text</button>
        </div>
      </div>

      {mode === 'manual' ? <ManualRecord key={rules.map((r) => r.id).join()} caseData={caseData} onAdd={add} />
        : <ReceiptPaste caseData={caseData} onAdd={add} />}

      <div className="rs-table-wrap" style={{ marginTop: 18 }}>
        {records.length === 0 ? (
          <p className="rs-muted">No records yet.</p>
        ) : (
          <table className="rs-table">
            <thead>
              <tr><th>Date</th><th>Item</th><th>Quantity</th><th>Status</th><th>Evidence</th><th><span className="rs-sr-only">Actions</span></th></tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id}>
                  <td>{r.date ? fmtDate(r.date) : <Chip kind="amber">No date</Chip>}
                    {r.date && !inPeriod(r.date, period) && <div><Chip kind="amber">Outside period</Chip></div>}</td>
                  <td>{r.item}{!r.rule_id && <div><Chip kind="slate">No rule: not compared</Chip></div>}</td>
                  <td>{r.quantity ? `${r.quantity.value} ${r.quantity.unit}` : '—'}</td>
                  <td>
                    {r.status === 'confirmed' ? <Chip kind="green">Confirmed</Chip> : <Chip kind="amber">Not confirmed</Chip>}
                    {r.status === 'pending' && r.quantity && (
                      <div><button type="button" className="button button-quiet rs-btn-sm" onClick={() => confirm(r.id)}>Confirm</button></div>
                    )}
                  </td>
                  <td className="rs-evidence">{evidenceText(r)}<ProofThumb id={r.id} attached={Boolean(r.evidence?.proof_photo)} /></td>
                  <td><button type="button" className="rs-icon-btn" aria-label={`Delete record for ${r.item}`} onClick={() => remove(r.id)}><Trash2 size={16} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  )
}
