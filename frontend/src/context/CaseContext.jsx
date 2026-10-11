// The case being edited (EXACTLY the Case object of plan_backend.txt 2.1), plus the last
// /api/calculate result and the saved-case / report ids. Saved to localStorage as a draft so a
// refresh or a detour through /login does not lose the user's input. Cleared on logout and on
// "Start over", because people share phones. Quantities stay STRINGS.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from './AuthContext.jsx'
import { currentMonthPeriod } from '../features/format.js'
import { clearProofs } from '../features/scan/proofStore.js'

const CaseContext = createContext(null)
const KEY = 'rationsaathi.draft.v1'

export const emptyCase = () => ({
  household_ref: null,
  members: 4,
  period: currentMonthPeriod(),
  rules: [],
  records: [],
})

function readDraft() {
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (parsed && parsed.caseData && Array.isArray(parsed.caseData.rules)) return parsed
  } catch { /* private window / blocked storage / corrupt JSON: start fresh */ }
  return null
}

function writeDraft(value) {
  try { window.localStorage.setItem(KEY, JSON.stringify(value)) } catch { /* ignore */ }
}

function clearDraft() {
  try { window.localStorage.removeItem(KEY) } catch { /* ignore */ }
}

export function CaseProvider({ children }) {
  const { user, loading } = useAuth()
  const initial = useMemo(readDraft, [])
  const [caseData, setCaseDataRaw] = useState(initial?.caseData || emptyCase())
  const [savedCaseId, setSavedCaseId] = useState(initial?.savedCaseId || null)
  const [result, setResult] = useState(null)
  const [reportId, setReportId] = useState(null)

  useEffect(() => { writeDraft({ caseData, savedCaseId }) }, [caseData, savedCaseId])

  /** Any edit makes the old result (and share link) stale, so drop them. */
  const setCase = useCallback((next) => {
    setCaseDataRaw((old) => (typeof next === 'function' ? next(old) : next))
    setResult(null)
    setReportId(null)
  }, [])

  const resetCase = useCallback(() => {
    setCaseDataRaw(emptyCase())
    setSavedCaseId(null)
    setResult(null)
    setReportId(null)
    clearDraft()
    clearProofs().catch(() => {}) // receipt photos live on this device only; people share phones
  }, [])

  /** Load a saved case from the server into the editor. */
  const loadCase = useCallback((id, data) => {
    setCaseDataRaw(data)
    setSavedCaseId(id)
    setResult(null)
    setReportId(null)
  }, [])

  // Clear the draft when the user logs out (but not on first load as a guest).
  const wasLoggedIn = useRef(false)
  useEffect(() => {
    if (loading) return
    if (user) wasLoggedIn.current = true
    else if (wasLoggedIn.current) { wasLoggedIn.current = false; resetCase() }
  }, [user, loading, resetCase])

  const value = useMemo(() => ({
    caseData, setCase, resetCase, loadCase,
    result, setResult,
    savedCaseId, setSavedCaseId,
    reportId, setReportId,
  }), [caseData, setCase, resetCase, loadCase, result, savedCaseId, reportId])

  return <CaseContext.Provider value={value}>{children}</CaseContext.Provider>
}

export function useCase() {
  const value = useContext(CaseContext)
  if (!value) throw new Error('useCase must be used within CaseProvider')
  return value
}
