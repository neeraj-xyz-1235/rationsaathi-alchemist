// Complaints & help. We NEVER file anything for the user and never contact a portal. This page
// has (1) a static list of official places to raise a query, (2) a neutral summary to copy, and
// (3) a private diary of the user's own notes (grievance notes API).
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Copy, ExternalLink, Pencil, Trash2 } from 'lucide-react'
import { api } from '../../api/endpoints.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { useCase } from '../../context/CaseContext.jsx'
import links from '../../data/complaintLinks.json'
import { fmtDate, fmtPeriod } from '../format.js'
import { errorText, itemSentence, REPORT_FOOTER } from '../messages.js'
import { Alert, Chip, Field, PageHead, Spinner } from '../ui.jsx'

const STATUSES = [['prepared', 'Prepared'], ['filed', 'Filed'], ['resolved', 'Resolved'], ['closed', 'Closed']]
const blankNote = () => ({ portal_key: links[0].key, reference_no: '', filed_on: '', status: 'prepared', note: '' })

function summaryText(result) {
  if (!result) return ''
  const lines = [`I compared my household's ration records with the entitlement rules I entered for ${fmtPeriod(result.period)}.`, '']
  for (const it of result.items) lines.push(itemSentence(it, result.period))
  lines.push('', REPORT_FOOTER, 'I would like to understand this and would appreciate any help in checking the records.')
  return lines.join('\n')
}

function Notes() {
  const [cases, setCases] = useState(null)
  const [caseId, setCaseId] = useState('')
  const [notes, setNotes] = useState([])
  const [form, setForm] = useState(blankNote())
  const [editing, setEditing] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api.listCases().then((c) => { setCases(c); if (c[0]) setCaseId(c[0].id) }).catch((e) => setError(errorText(e)))
  }, [])

  const load = useCallback(async () => {
    if (!caseId) { setNotes([]); return }
    try { setNotes(await api.listGrievances(caseId)); setError('') } catch (e) { setError(errorText(e)) }
  }, [caseId])
  useEffect(() => { load() }, [load])

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))
  const body = () => ({
    portal_key: form.portal_key,
    reference_no: form.reference_no.trim() || null,
    filed_on: form.filed_on || null,
    status: form.status,
    note: form.note.trim() || null,
  })

  async function submit(e) {
    e.preventDefault()
    setBusy(true); setError('')
    try {
      if (editing) await api.updateGrievance(caseId, editing, body())
      else await api.createGrievance(caseId, body())
      setForm(blankNote()); setEditing(null); await load()
    } catch (err) { setError(errorText(err)) } finally { setBusy(false) }
  }

  async function remove(id) {
    if (!window.confirm('Delete this note?')) return
    try { await api.deleteGrievance(caseId, id); await load() } catch (err) { setError(errorText(err)) }
  }

  function edit(n) {
    setEditing(n.id)
    setForm({ portal_key: n.portal_key, reference_no: n.reference_no || '', filed_on: n.filed_on || '', status: n.status, note: n.note || '' })
  }

  const portalName = (key) => links.find((l) => l.key === key)?.name || key

  if (!cases) return error ? <Alert kind="bad">{error}</Alert> : <Spinner />
  if (cases.length === 0) return <p className="rs-muted">Save a check first (from the report page), then you can keep notes about it here.</p>

  return (
    <div>
      {error && <Alert kind="bad">{error}</Alert>}
      <Field label="Which saved check are these notes about?">
        <select value={caseId} onChange={(e) => { setCaseId(e.target.value); setEditing(null); setForm(blankNote()) }}>
          {cases.map((c) => <option key={c.id} value={c.id}>{(c.household_ref || 'My household')} — {fmtPeriod(c.period)}</option>)}
        </select>
      </Field>

      <form onSubmit={submit} style={{ marginTop: 14 }}>
        <div className="rs-grid rs-grid-2">
          <Field label="Where did you raise it?">
            <select value={form.portal_key} onChange={(e) => set('portal_key', e.target.value)}>
              {links.map((l) => <option key={l.key} value={l.key}>{l.name}</option>)}
            </select>
          </Field>
          <Field label="Status">
            <select value={form.status} onChange={(e) => set('status', e.target.value)}>
              {STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </Field>
          <Field label="Reference number (optional)"><input maxLength={60} value={form.reference_no} onChange={(e) => set('reference_no', e.target.value)} /></Field>
          <Field label="Date filed (optional)"><input type="date" value={form.filed_on} onChange={(e) => set('filed_on', e.target.value)} /></Field>
        </div>
        <div style={{ marginTop: 12 }}>
          <Field label="Your note (optional)" hint="Please don't write ID or card numbers here.">
            <textarea maxLength={500} value={form.note} onChange={(e) => set('note', e.target.value)} />
          </Field>
        </div>
        <div className="rs-actions" style={{ marginTop: 12 }}>
          <button className="button button-primary rs-btn-sm" disabled={busy || !caseId}>{editing ? 'Save changes' : 'Add note'}</button>
          {editing && <button type="button" className="button button-quiet rs-btn-sm" onClick={() => { setEditing(null); setForm(blankNote()) }}>Cancel</button>}
        </div>
      </form>

      <div style={{ marginTop: 18 }}>
        {notes.length === 0 && <p className="rs-muted">No notes for this check yet.</p>}
        {notes.map((n) => (
          <div className="rs-note" key={n.id}>
            <div>
              <strong>{portalName(n.portal_key)}</strong>{' '}<Chip kind={n.status === 'resolved' ? 'green' : 'slate'}>{STATUSES.find(([v]) => v === n.status)?.[1]}</Chip>
              <div className="rs-small rs-muted">{n.reference_no ? `Ref ${n.reference_no} · ` : ''}{n.filed_on ? `Filed ${fmtDate(n.filed_on)}` : 'Not filed yet'}</div>
              {n.note && <p style={{ margin: '6px 0 0', overflowWrap: 'anywhere' }}>{n.note}</p>}
            </div>
            <div className="rs-actions">
              <button type="button" className="rs-icon-btn" aria-label="Edit note" onClick={() => edit(n)}><Pencil size={15} /></button>
              <button type="button" className="rs-icon-btn" aria-label="Delete note" onClick={() => remove(n.id)}><Trash2 size={15} /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function ComplaintsPage() {
  const { user } = useAuth()
  const { result } = useCase()
  const summary = useMemo(() => summaryText(result), [result])
  const [copied, setCopied] = useState(false)

  async function copy() {
    try { await navigator.clipboard.writeText(summary); setCopied(true) } catch { setCopied(false) }
  }

  return (
    <main className="rs-page" id="complaints">
      <PageHead title="Complaints & help" subtitle="Where to ask for a review, and a private place to keep your own notes." />
      <Alert kind="note">
        <strong>RationSaathi never files or submits anything for you.</strong> A difference in the records is a reason to check details,
        not a conclusion about why it happened. Please open the official sites yourself and confirm they are correct.
      </Alert>

      <section className="rs-panel">
        <div className="rs-panel-head"><div><h2>Official places to raise a query</h2></div></div>
        <div className="rs-grid rs-grid-2">
          {links.map((l) => {
            const inner = (
              <>
                <strong>{l.name}{l.url && <ExternalLink size={14} style={{ marginLeft: 6, verticalAlign: '-2px' }} />}</strong>
                <span className="rs-small rs-muted">{l.description}</span>
                {!l.last_verified && l.url && <div className="rs-small" style={{ color: '#7a4b05', marginTop: 6 }}>Not yet verified by our team. Please check that it opens the official site.</div>}
              </>
            )
            return l.url
              ? <a className="rs-link-card" key={l.key} href={l.url} target="_blank" rel="noopener noreferrer">{inner}</a>
              : <div className="rs-link-card" key={l.key}>{inner}</div>
          })}
        </div>
      </section>

      <section className="rs-panel">
        <div className="rs-panel-head"><div><h2>A neutral summary you can copy</h2><p>Plain wording with the numbers from your report. It does not say why any difference exists.</p></div></div>
        {summary ? (
          <>
            <textarea className="rs-copybox" readOnly value={summary} aria-label="Neutral summary" />
            <div className="rs-actions" style={{ marginTop: 10 }}>
              <button type="button" className="button button-outline rs-btn-sm" onClick={copy}><Copy size={16} /> {copied ? 'Copied' : 'Copy summary'}</button>
            </div>
          </>
        ) : (
          <p className="rs-muted">Generate a report first and a summary will appear here. <Link to="/check">Go to Check entitlement</Link></p>
        )}
      </section>

      <section className="rs-panel">
        <div className="rs-panel-head"><div><h2>My notes</h2><p>A private diary for your own reference. Nothing here is sent to anyone.</p></div></div>
        {user ? <Notes /> : <p className="rs-muted"><Link to="/login?next=/complaints">Log in</Link> to keep private notes about your checks.</p>}
      </section>
    </main>
  )
}
