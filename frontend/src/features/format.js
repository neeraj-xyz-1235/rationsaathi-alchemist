// Display helpers only. No ration arithmetic lives in the frontend: every number shown comes
// from the API (plan_frontend.txt section 1).
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const pad = (n) => String(n).padStart(2, '0')

/** '2026-09-03' -> '3 Sep 2026' (string handling, so no timezone surprises). */
export function fmtDate(iso) {
  if (!iso) return '—'
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number)
  if (!y || !m || !d) return String(iso)
  return `${d} ${MONTHS[m - 1]} ${y}`
}

export const fmtPeriod = (p) => (p ? `${fmtDate(p.start)} – ${fmtDate(p.end)}` : '')

export const qty = (value, unit) => `${value} ${unit}`

/** The calendar month containing today, as { start, end } ISO strings (local time). */
export function currentMonthPeriod(now = new Date()) {
  const y = now.getFullYear()
  const m = now.getMonth()
  const last = new Date(y, m + 1, 0).getDate()
  return { start: `${y}-${pad(m + 1)}-01`, end: `${y}-${pad(m + 1)}-${pad(last)}` }
}

export const todayIso = (now = new Date()) =>
  `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`

export const newId = () =>
  (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
