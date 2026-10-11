// Check entitlement: household + period, the user's OWN rules, what was received (with evidence),
// then "Generate report" -> POST /api/calculate. Works without an account (plan_backend.txt 2).
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, RotateCcw, ShieldCheck, Wand2 } from 'lucide-react'
import { api } from '../../api/endpoints.js'
import { useCase } from '../../context/CaseContext.jsx'
import { cleanCase, demoCase } from '../case.js'
import { fmtPeriod } from '../format.js'
import { errorText, fieldErrorLines } from '../messages.js'
import { familySchema, issuesToMap, ruleSchema } from '../../validation/case.js'
import { Alert, Field, PageHead } from '../ui.jsx'
import EntitlementSection from './EntitlementSection.jsx'
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
  function onMembers(value) {
    setMembersText(value)
    if (/^\d+$/.test(value) && Number(value) >= 1 && Number(value) <= 1000) {
      setCase((c) => ({ ...c, members: Number(value) }))
    }
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
  if (caseData.rules.length === 0) problems.push('Scan your ration card or choose its type to set your entitlement.')
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
        subtitle="Scan your ration card to get your entitlement, then enter what you actually received with a photo of the receipt. We compare them line by line.">
        <button type="button" className="button button-outline rs-btn-sm" onClick={loadDemo}><Wand2 size={16} /> Try the demo</button>
        <button type="button" className="button button-quiet rs-btn-sm" onClick={startOver}><RotateCcw size={16} /> Start over</button>
      </PageHead>

      <Alert kind="info">
        <strong>You don't need an account.</strong> Entering and checking works for everyone; an account is only needed to save your
        checks and share a report. Your card photo is read on your device and is never uploaded. Please don't type ration card, Aadhaar or bank numbers anywhere.
      </Alert>
      {savedCaseId && <Alert kind="ok">You are editing a saved check. Save it again from the report page to keep your changes.</Alert>}

      <section className="rs-panel" aria-labelledby="family-h">
        <div className="rs-panel-head"><div><h2 id="family-h"><span className="rs-step">1</span>Month to check</h2>
          <p>The period is the stretch of time the entitlement covers, usually one month.</p></div></div>
        <div className="rs-grid rs-grid-3">
          <Field label="Household label (optional)" hint="e.g. “Home – September”. Do not enter card or ID numbers." error={showErrors && familyErrors.household_ref}>
            <input value={caseData.household_ref || ''} maxLength={60}
              onChange={(e) => setCase((c) => ({ ...c, household_ref: e.target.value }))} />
          </Field>
          <Field label="Period starts" error={showErrors && familyErrors['period.start']}>
            <input type="date" value={caseData.period.start} onChange={(e) => setPeriod('start', e.target.value)} />
          </Field>
          <Field label="Period ends" error={(showErrors || caseData.period.end < caseData.period.start) && familyErrors['period.end']}>
            <input type="date" value={caseData.period.end} onChange={(e) => setPeriod('end', e.target.value)} />
          </Field>
        </div>
      </section>

      <EntitlementSection caseData={caseData} setCase={setCase} membersText={membersText} onMembers={onMembers}
        membersError={(showErrors || membersText !== String(caseData.members)) && familyErrors.members}
        showErrors={showErrors} ruleErrors={ruleErrors} />

      {caseData.rules.length > 0
        ? <RecordsSection caseData={caseData} setCase={setCase} />
        : <section className="rs-panel"><h2><span className="rs-step">3</span>What was received</h2><p className="rs-muted">Scan your ration card above first, then record what was received.</p></section>}

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
