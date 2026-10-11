import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Copy, Link2, Mail, Pencil, Printer, Save } from 'lucide-react'
import { api } from '../../api/endpoints.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { useCase } from '../../context/CaseContext.jsx'
import { cleanCase } from '../case.js'
import { errorText, fieldErrorLines, reportAsText } from '../messages.js'
import { Alert, PageHead, Spinner } from '../ui.jsx'
import ReportView from './ReportView.jsx'

export default function ReportPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { caseData, result, setResult, savedCaseId, setSavedCaseId, reportId, setReportId } = useCase()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState({ message: '', lines: [] })
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState('')
  const [emailOn, setEmailOn] = useState(false)
  const [lang, setLang] = useState('en')

  // After a refresh the result is gone but the draft survives: recalculate it (stateless call).
  useEffect(() => {
    if (result || caseData.rules.length === 0) return
    let live = true
    setLoading(true)
    api.calculate(cleanCase(caseData))
      .then((r) => { if (live) setResult(r) })
      .catch((e) => { if (live) setError({ message: errorText(e), lines: fieldErrorLines(e.fields) }) })
      .finally(() => { if (live) setLoading(false) })
    return () => { live = false }
  }, [result, caseData, setResult])

  useEffect(() => {
    if (!user) return
    api.health().then((h) => setEmailOn(h.email === 'configured')).catch(() => setEmailOn(false))
  }, [user])

  const shareUrl = reportId ? `${window.location.origin}/r/${reportId}` : ''

  /** Save the case (create or replace) and return its id. */
  async function ensureSaved() {
    const payload = cleanCase(caseData)
    if (savedCaseId) { await api.updateCase(savedCaseId, payload); return savedCaseId }
    const { id } = await api.saveCase(payload)
    setSavedCaseId(id)
    return id
  }

  async function run(name, fn) {
    setBusy(name); setError({ message: '', lines: [] }); setNotice('')
    try { await fn() } catch (e) {
      setError({ message: errorText(e), lines: e.code === 'VALIDATION_FAILED' ? fieldErrorLines(e.fields) : [] })
    } finally { setBusy('') }
  }

  const save = () => run('save', async () => { await ensureSaved(); setNotice('Saved. You can find it in your monthly tracker.') })

  /** A share link is a frozen snapshot made by the server from the saved case. */
  async function ensureReport() {
    if (reportId) return reportId
    const id = await ensureSaved()
    const created = await api.createReport(id)
    setReportId(created.report_id)
    setResult(created.result)
    return created.report_id
  }

  const share = () => run('share', async () => { await ensureReport(); setNotice('Share link created. It shows exactly this report, even if you edit the case later.') })

  const email = () => run('email', async () => {
    const id = await ensureReport()
    const res = await api.emailReport(id, lang)
    setNotice(`Email queued to ${res.sent_to} (your account address). Please check your inbox and spam folder.`)
  })

  async function copyText() {
    try { await navigator.clipboard.writeText(reportAsText(result, caseData)); setNotice('Report text copied.') }
    catch { setError({ message: 'Could not copy automatically. Please select the text and copy it.', lines: [] }) }
  }

  async function copyLink() {
    try { await navigator.clipboard.writeText(shareUrl); setNotice('Link copied.') }
    catch { setNotice('Select the link and copy it.') }
  }

  if (loading) return <main className="rs-page"><Spinner>Preparing your report…</Spinner></main>

  if (!result) {
    return (
      <main className="rs-page">
        <PageHead title="Ration report" />
        {error.message && <Alert kind="bad" lines={error.lines}>{error.message}</Alert>}
        <div className="rs-panel rs-empty">
          <h2>No report yet</h2>
          <p>Enter your entitlement rules and what was received, then generate a report.</p>
          <Link className="button button-primary" to="/check">Go to Check entitlement</Link>
        </div>
      </main>
    )
  }

  return (
    <main className="rs-page" id="report">
      <PageHead title="Ration report" subtitle="A line-by-line comparison of the rules you entered with what was recorded as received.">
        <button type="button" className="button button-outline rs-btn-sm" onClick={() => window.print()}><Printer size={16} /> Print</button>
        <button type="button" className="button button-outline rs-btn-sm" onClick={copyText}><Copy size={16} /> Copy text</button>
        <button type="button" className="button button-quiet rs-btn-sm" onClick={() => navigate('/check')}><Pencil size={16} /> Edit details</button>
      </PageHead>

      {error.message && <Alert kind="bad" lines={error.lines}>{error.message}</Alert>}
      {notice && <Alert kind="ok">{notice}</Alert>}

      <ReportView result={result} caseData={caseData} />

      <section className="rs-panel rs-no-print" aria-labelledby="share-h">
        <div className="rs-panel-head"><div><h2 id="share-h">Save and share</h2>
          <p>Saving, share links and email need an account. Your report works without one.</p></div></div>
        {!user ? (
          <div className="rs-actions">
            <Link className="button button-primary rs-btn-sm" to="/login?next=/report">Log in to save</Link>
            <Link className="button button-outline rs-btn-sm" to="/signup">Create an account</Link>
            <span className="rs-small rs-muted">Your entries are kept on this device while you log in.</span>
          </div>
        ) : (
          <>
            <div className="rs-actions">
              <button type="button" className="button button-primary rs-btn-sm" onClick={save} disabled={!!busy}><Save size={16} /> {busy === 'save' ? 'Saving…' : savedCaseId ? 'Save changes' : 'Save this check'}</button>
              <button type="button" className="button button-outline rs-btn-sm" onClick={share} disabled={!!busy}><Link2 size={16} /> {busy === 'share' ? 'Creating…' : 'Get share link'}</button>
              {emailOn && (
                <>
                  <select aria-label="Email language" className="rs-input" style={{ width: 'auto', minHeight: 38 }} value={lang} onChange={(e) => setLang(e.target.value)}>
                    <option value="en">English</option><option value="hi">हिन्दी</option><option value="mr">मराठी</option>
                  </select>
                  <button type="button" className="button button-outline rs-btn-sm" onClick={email} disabled={!!busy}><Mail size={16} /> {busy === 'email' ? 'Sending…' : 'Email me this report'}</button>
                </>
              )}
            </div>
            {shareUrl && (
              <div style={{ marginTop: 14 }}>
                <Alert kind="note">Anyone who has this link can view this report. Only share it with people you trust.</Alert>
                <div className="rs-actions">
                  <input className="rs-input" readOnly value={shareUrl} aria-label="Share link" style={{ flex: 1, minWidth: 220 }} onFocus={(e) => e.target.select()} />
                  <button type="button" className="button button-outline rs-btn-sm" onClick={copyLink}><Copy size={16} /> Copy link</button>
                </div>
              </div>
            )}
          </>
        )}
      </section>
    </main>
  )
}
