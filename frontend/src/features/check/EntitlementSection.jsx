// Step 2: the entitlement comes from the ration card, not from typing. The user photographs the
// card; it is read on this device and we suggest the rules for that card type. Nothing is used
// until the user confirms, and the rules stay editable for states or cards that differ.
import { useRef, useState } from 'react'
import { Camera, Pencil, Plus, ScanLine, Trash2 } from 'lucide-react'
import { blankRule, ITEM_SUGGESTIONS } from '../case.js'
import { CARD_TYPES, rulesForCard } from '../scan/entitlements.js'
import { scanCardImage } from '../scan/readCard.js'
import { UNITS } from '../../validation/case.js'
import { Alert, Field } from '../ui.jsx'

const basisText = (b) => (b === 'per_household' ? 'per household' : 'per member')

function CardScanner({ onApply }) {
  const fileRef = useRef(null)
  const [preview, setPreview] = useState('')
  const [progress, setProgress] = useState(null) // null = idle, 0..1 = reading
  const [error, setError] = useState('')
  const [found, setFound] = useState(null) // { type, members } waiting for confirmation
  const [type, setType] = useState('')

  async function onFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) { setError('Please choose a photo (JPG or PNG).'); return }
    setError('')
    setFound(null)
    setPreview((old) => { if (old) URL.revokeObjectURL(old); return URL.createObjectURL(file) })
    setProgress(0)
    try {
      const res = await scanCardImage(file, setProgress)
      setFound(res)
      setType(CARD_TYPES[res.type] ? res.type : '')
    } catch {
      setError('We could not read that photo. Choose your card type below instead, or try a clearer photo.')
      setFound({ type: null, members: null })
    } finally { setProgress(null) }
  }

  function discard() {
    setPreview((old) => { if (old) URL.revokeObjectURL(old); return '' }) // the photo is not kept
  }

  function apply() {
    onApply(type, found?.members)
    discard()
    setFound(null)
  }

  const reading = progress !== null

  return (
    <div className="rs-scan">
      <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={onFile} />
      <div className="rs-scan-drop">
        {preview
          ? <img src={preview} alt="Your ration card, shown only on this device" className="rs-scan-img" />
          : <span className="rs-scan-icon"><ScanLine size={28} /></span>}
        <div>
          <strong>Upload a photo of your ration card</strong>
          <p className="rs-muted rs-small">We read it on your phone or computer. The photo is never uploaded or saved.</p>
          <button type="button" className="button button-primary rs-btn-sm" disabled={reading} onClick={() => fileRef.current?.click()}>
            <Camera size={16} /> {reading ? `Reading… ${Math.round(progress * 100)}%` : preview ? 'Choose another photo' : 'Take or choose a photo'}
          </button>
        </div>
      </div>

      {error && <Alert kind="note">{error}</Alert>}

      {!reading && (
        <div className="rs-scan-result">
          {found && (
            <p className="rs-small" style={{ margin: '0 0 10px' }}>
              {found.type && CARD_TYPES[found.type]
                ? <>We found a <strong>{CARD_TYPES[found.type].label}</strong> card{found.members ? <> with <strong>{found.members}</strong> members</> : ''}. Please check.</>
                : found.type === 'OTHER'
                  ? 'This looks like an older BPL/APL card, which has no standard monthly grain amount. Choose a type below if it applies.'
                  : 'We could not find the card type in the photo.'}
            </p>
          )}
          <div className="rs-grid rs-grid-2">
            <Field label={found ? 'Card type' : 'Or choose your card type'} hint={CARD_TYPES[type]?.summary || 'Printed on the card as PHH or AAY.'}>
              <select value={type} onChange={(e) => setType(e.target.value)}>
                <option value="">Choose your card type…</option>
                {Object.entries(CARD_TYPES).map(([k, c]) => <option key={k} value={k}>{c.label}</option>)}
              </select>
            </Field>
            <div className="rs-actions" style={{ alignSelf: 'start', paddingTop: 26 }}>
              <button type="button" className="button button-primary rs-btn-sm" disabled={!type} onClick={apply}>Use these entitlements</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function EntitlementSection({ caseData, setCase, membersText, onMembers, membersError, showErrors, ruleErrors }) {
  const [editing, setEditing] = useState(false)
  const { rules } = caseData

  const setRule = (id, patch) => setCase((c) => ({ ...c, rules: c.rules.map((r) => (r.id === id ? { ...r, ...patch } : r)) }))
  const removeRule = (id) => setCase((c) => ({
    ...c,
    rules: c.rules.filter((r) => r.id !== id),
    // records that pointed at the rule keep their data but become "no rule"
    records: c.records.map((r) => (r.rule_id === id ? { ...r, rule_id: null } : r)),
  }))

  function applyCard(type, members) {
    if (members) onMembers(String(members))
    // records already entered re-attach to the new rule with the same item name
    setCase((c) => {
      const next = rulesForCard(type)
      const byItem = Object.fromEntries(next.map((r) => [r.item.toLowerCase(), r.id]))
      return {
        ...c,
        rules: next,
        records: c.records.map((r) => ({ ...r, rule_id: byItem[(r.item || '').trim().toLowerCase()] || null })),
      }
    })
    setEditing(false)
  }

  return (
    <section className="rs-panel" aria-labelledby="rules-h">
      <div className="rs-panel-head"><div><h2 id="rules-h"><span className="rs-step">2</span>Your entitlement</h2>
        <p>Scan your ration card and we fill in what your household is entitled to each month.</p></div></div>

      <CardScanner onApply={applyCard} />

      <div className="rs-members">
        <Field label="Household members" hint="From your card. Check it is right." error={membersError}>
          <input inputMode="numeric" value={membersText} onChange={(e) => onMembers(e.target.value)} />
        </Field>
      </div>

      {rules.length > 0 && (
        <div className="rs-ent">
          <div className="rs-ent-head">
            <h3>Entitlement we will check against</h3>
            <button type="button" className="button button-quiet rs-btn-sm" onClick={() => setEditing((v) => !v)}>
              <Pencil size={15} /> {editing ? 'Done' : 'Edit'}
            </button>
          </div>

          {!editing && (
            <ul className="rs-ent-list">
              {rules.map((r) => (
                <li key={r.id}><strong>{r.item || '(unnamed)'}</strong><span>{r.quantity.value} {r.quantity.unit} {basisText(r.basis)}</span></li>
              ))}
            </ul>
          )}

          {editing && (
            <>
              <datalist id="item-suggestions">{ITEM_SUGGESTIONS.map((i) => <option key={i} value={i} />)}</datalist>
              {rules.map((r, idx) => {
                const e = ruleErrors[idx] || {}
                const show = showErrors || (r.quantity.value !== '' && e.quantity)
                return (
                  <div className="rs-rule-row" key={r.id}>
                    <Field label="Item" error={showErrors && e.item}>
                      <input list="item-suggestions" value={r.item} maxLength={60} placeholder="e.g. Rice" onChange={(ev) => setRule(r.id, { item: ev.target.value })} />
                    </Field>
                    <Field label="Rule type">
                      <select value={r.basis} onChange={(ev) => setRule(r.id, { basis: ev.target.value })}>
                        <option value="per_member">Per member</option>
                        <option value="per_household">Per household</option>
                      </select>
                    </Field>
                    <Field label="Quantity" error={show && e.quantity}>
                      <input inputMode="decimal" value={r.quantity.value} placeholder="e.g. 5"
                        onChange={(ev) => setRule(r.id, { quantity: { ...r.quantity, value: ev.target.value } })} />
                    </Field>
                    <Field label="Unit">
                      <select value={r.quantity.unit} onChange={(ev) => setRule(r.id, { quantity: { ...r.quantity, unit: ev.target.value } })}>
                        {UNITS.map((u) => <option key={u}>{u}</option>)}
                      </select>
                    </Field>
                    <button type="button" className="rs-icon-btn" aria-label={`Remove ${r.item || 'item'}`} onClick={() => removeRule(r.id)}><Trash2 size={16} /></button>
                  </div>
                )
              })}
              <div className="rs-actions" style={{ marginTop: 12 }}>
                <button type="button" className="button button-outline rs-btn-sm" disabled={rules.length >= 20}
                  onClick={() => setCase((c) => ({ ...c, rules: [...c.rules, blankRule()] }))}><Plus size={16} /> Add another item</button>
              </div>
            </>
          )}
        </div>
      )}
    </section>
  )
}
