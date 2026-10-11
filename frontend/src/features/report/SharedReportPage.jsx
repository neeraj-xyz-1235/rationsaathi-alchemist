// Public, read-only view of a frozen report at /r/:reportId (plan_backend.txt 2.4).
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Printer } from 'lucide-react'
import { api } from '../../api/endpoints.js'
import { errorText } from '../messages.js'
import { fmtDate } from '../format.js'
import { Alert, PageHead, Spinner } from '../ui.jsx'
import ReportView from './ReportView.jsx'

export default function SharedReportPage() {
  const { reportId } = useParams()
  const [state, setState] = useState({ loading: true, report: null, error: null })

  useEffect(() => {
    let live = true
    setState({ loading: true, report: null, error: null })
    api.getReport(reportId)
      .then((report) => { if (live) setState({ loading: false, report, error: null }) })
      .catch((error) => { if (live) setState({ loading: false, report: null, error }) })
    return () => { live = false }
  }, [reportId])

  if (state.loading) return <main className="rs-page rs-public"><Spinner>Loading the report…</Spinner></main>

  if (state.error) {
    return (
      <main className="rs-page rs-public">
        <div className="rs-panel rs-empty">
          <h2>{state.error.status === 404 ? 'This report was not found' : 'We could not load this report'}</h2>
          <p>{state.error.status === 404 ? 'The link may be incorrect or the report may have been deleted.' : errorText(state.error)}</p>
          <Link className="button button-primary" to="/">Go to RationSaathi</Link>
        </div>
      </main>
    )
  }

  const { report } = state
  return (
    <main className="rs-page rs-public">
      <PageHead eyebrow="Shared report" title="Ration report"
        subtitle={`A snapshot generated on ${fmtDate(report.generated_at)}. It shows exactly what was recorded at that time.`}>
        <button type="button" className="button button-outline rs-btn-sm" onClick={() => window.print()}><Printer size={16} /> Print</button>
      </PageHead>
      <Alert kind="info">This is a read-only copy shared by link. RationSaathi is an independent tool, not a government service.</Alert>
      <ReportView result={report.result} caseData={report.case} showComplaintsLink={false} />
    </main>
  )
}
