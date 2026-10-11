// Check entitlement: household + period, the user's OWN rules, what was received (with evidence),
// then "Generate report" -> POST /api/calculate. Works without an account (plan_backend.txt 2).
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Plus, RotateCcw, ShieldCheck, Trash2, Wand2 } from 'lucide-react'
import { api } from '../../api/endpoints.js'
import { useCase } from '../../context/CaseContext.jsx'
import { blankRule, cleanCase, demoCase, ITEM_SUGGESTIONS } from '../case.js'
import { fmtPeriod } from '../format.js'
import { errorText, fieldErrorLines } from '../messages.js'
import { familySchema, issuesToMap, ruleSchema, UNITS } from '../../validation/case.js'
import { Alert, Field, PageHead } from '../ui.jsx'
import RecordsSection from './RecordsSection.jsx'

export default function CheckPage() {
  const { caseData, setCase, resetCase, loadCase, savedCaseId, setResult } = useCase()
  const navigate = useNavigate()
  const [membersText, setMembersText] = useState(String(caseData.members))
  const [showErrors, setShowErrors] = useState(false)
  const [busy, setBusy] = useState(false)
  const [serverError, setServerError] = useState({ message: '', lines: [] })

  const family = useMemo(() => familySchema.safeParse({
    household_ref: caseData.household_ref?.trim() ? caseData.household_ref : null,
    members: membersText, period: caseData.period,
  }), [caseData.household_ref, caseData.period, membersText])
  const familyErrors = family.success ? {} : issuesToMap(family.error)

  const ruleErrors = useMemo(() => caseData.rules.map((r) => {
    const p = ruleSchema.safeParse({ ...r, due_by: r.due_by || null })
    return p.success ? {} : issuesToMap(p.error)
  }), [caseData.rules])

  const setPeriod = (key, value) => setCase((c) => ({ ...c, period: { ...c.period, [key]: value } }))
  const setRule = (id, patch) => setCase((c) => ({ ...c, rules: c.rules.map((r) => (r.id === id ? { ...r, ...patch } : r)) }))

  function onMembers(value) {
    setMembersText(value)
    if (/^\d+$/.test(value) && Number(value) >= 1 && Number(value) <= 1000) {
      setCase((c) => ({ ...c, members: Number(value) }))
    }
  }

  function removeRule(id) {
    // records that pointed at the rule keep their data but become "no rule" (plan_db_schema.txt notes)
    setCase((c) => ({
      ...c,
      rules: c.rules.filter((r) => r.id !== id),
      records: c.records.map((r) => (r.rule_id === id ? { ...r, rule_id: null } : r)),
    }))
  }

  function loadDemo() {
    const demo = demoCase()
    setMembersText(String(demo.members))
    loadCase(null, demo)
    setShowErrors(false)
    setServerError({ message: '', lines: [] })
  }

  function startOver() {
    if (!window.confirm('Clear everything you have entered on this page?')) return
    resetCase()
    setMembersText('4')
    setShowErrors(false)
  }

  const problems = []
  if (!family.success) problems.push('Check the household details and dates.')
  if (caseData.rules.length === 0) problems.push('Add at least one entitlement rule.')
  if (ruleErrors.some((e) => Object.keys(e).length)) problems.push('Fix the highlighted rule fields.')

  async function generate() {
    setShowErrors(true)
    setServerError({ message: '', lines: [] })
    if (problems.length) return
    setBusy(true)
    try {
      const payload = cleanCase({ ...caseData, members: Number(membersText) })
      const result = await api.calculate(payload)
      setResult(result)
      navigate('/report')
    } catch (e) {
      setServerError({ message: errorText(e), lines: e.code === 'VALIDATION_FAILED' ? fieldErrorLines(e.fields) : [] })
    } finally { setBusy(false) }
  }

  const confirmed = caseData.records.filter((r) => r.status === 'confirmed').length

  return (
    <main className="rs-page" id="check">
      <PageHead title="Check entitlement"
        subtitle="Enter the rules that apply to your household and what was actually received. We compare them line by line and keep your evidence in the report.">
        <button type="button" className="button button-outline rs-btn-sm" onClick={loadDemo}><Wand2 size={16} /> Try the demo</button>
        <button type="button" className="button button-quiet rs-btn-sm" onClick={startOver}><RotateCcw size={16} /> Start over</button>
      </PageHead>

      <Alert kind="info">
        <strong>You don't need an account.</strong> Entering and checking works for everyone; an account is only needed to save your
        checks and share a report. Please don't enter ration card, Aadhaar or bank numbers anywhere on this page.
      </Alert>
      {savedCaseId && <Alert kind="ok">You are editing a saved check. Save it again from the report page to keep your changes.</Alert>}

      <section className="rs-panel" aria-labelledby="family-h">
        <div className="rs-panel-head"><div><h2 id="family-h"><span className="rs-step">1</span>Household and period</h2>
          <p>The period is the stretch of time the entitlement covers, usually one month.</p></div></div>
        <div className="rs-grid rs-grid-2">
          <Field label="Household label (optional)" hint="e.g. “Home – September”. Do not enter card or ID numbers." error={showErrors && familyErrors.household_ref}>
            <input value={caseData.household_ref || ''} maxLength={60}
              onChange={(e) => setCase((c) => ({ ...c, household_ref: e.target.value }))} />
          </Field>
          <Field label="Number of household members" error={(showErrors || membersText !== String(caseData.members)) && familyErrors.members}>
            <input inputMode="numeric" value={membersText} onChange={(e) => onMembers(e.target.value)} />
          </Field>
          <Field label="Period starts" error={showErrors && familyErrors['period.start']}>
            <input type="date" value={caseData.period.start} onChange={(e) => setPeriod('start', e.target.value)} />
          </Field>
          <Field label="Period ends" error={(showErrors || caseData.period.end < caseData.period.start) && familyErrors['period.end']}>
            <input type="date" value={caseData.period.end} onChange={(e) => setPeriod('end', e.target.value)} />
          </Field>
        </div>
      </section>

      <section className="rs-panel" aria-labelledby="rules-h">
        <div className="rs-panel-head"><div><h2 id="rules-h"><span className="rs-step">2</span>Your entitlement rules</h2>
          <p>Enter only the rules that apply to you, for example “5 kg of rice per member”. We never assume a rule you did not enter.</p></div></div>
        <datalist id="item-suggestions">{ITEM_SUGGESTIONS.map((i) => <option key={i} value={i} />)}</datalist>

        {caseData.rules.length === 0 && <p className="rs-muted">No rules yet. Add your first one below.</p>}
        {caseData.rules.map((r, idx) => {
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
              <Field label="Due by (optional)" hint="Only used to mark late deliveries">
                <input type="date" value={r.due_by || ''} onChange={(ev) => setRule(r.id, { due_by: ev.target.value || null })} />
              </Field>
              <button type="button" className="rs-icon-btn" aria-label={`Remove rule ${r.item || idx + 1}`} onClick={() => removeRule(r.id)}><Trash2 size={16} /></button>
            </div>
          )
        })}
        <div className="rs-actions" style={{ marginTop: 12 }}>
          <button type="button" className="button button-outline rs-btn-sm" disabled={caseData.rules.length >= 20}
            onClick={() => setCase((c) => ({ ...c, rules: [...c.rules, blankRule()] }))}><Plus size={16} /> Add another item</button>
        </div>
      </section>

      {caseData.rules.length > 0
        ? <RecordsSection caseData={caseData} setCase={setCase} />
        : <section className="rs-panel"><h2><span className="rs-step">3</span>What was received</h2><p className="rs-muted">Add at least one rule above, then record what was received.</p></section>}

      <section className="rs-panel" aria-labelledby="review-h">
        <div className="rs-panel-head"><div><h2 id="review-h"><span className="rs-step">4</span>Review and generate</h2>
          <p>The comparison is calculated on our server with exact arithmetic: no AI and no rounding.</p></div></div>
        <div className="rs-tiles">
          <div className="rs-tile"><small>Household members</small><strong>{membersText || '—'}</strong></div>
          <div className="rs-tile"><small>Period</small><strong style={{ fontSize: '.95rem' }}>{family.success ? fmtPeriod(caseData.period) : '—'}</strong></div>
          <div className="rs-tile"><small>Entitlement rules</small><strong>{caseData.rules.length}</strong></div>
          <div className="rs-tile"><small>Records (confirmed)</small><strong>{caseData.records.length} ({confirmed})</strong></div>
        </div>
        {showErrors && problems.length > 0 && <Alert kind="bad" lines={problems}>Please fix this before generating the report:</Alert>}
        {serverError.message && <Alert kind="bad" lines={serverError.lines}>{serverError.message}</Alert>}
        <div className="rs-actions">
          <button type="button" className="button button-primary button-large" onClick={generate} disabled={busy}>
            {busy ? 'Calculating…' : 'Generate report'} <ArrowRight size={18} />
          </button>
          <span className="rs-small rs-muted"><ShieldCheck size={14} style={{ verticalAlign: '-2px' }} /> Your draft is kept on this device until you start over or log out.</span>
        </div>
      </section>
    </main>
  )
}
