// Turns backend CODES into neutral sentences (plan_backend.txt 2.2/2.3, plan_frontend.txt 6).
// The backend returns codes and numbers; the wording lives here. Neutral language only: never
// imply anyone did anything wrong. A difference is a prompt to check details, not a conclusion.
import { fmtDate, fmtPeriod } from './format.js'

const REASON_TEXT = {
  PENDING_NOT_CONFIRMED: 'not yet confirmed',
  MISSING_DATE: 'no date entered',
  OUTSIDE_PERIOD: 'dated outside the period',
  UNIT_MISMATCH: "unit doesn't match the rule",
}
export const excludedReason = (code) => REASON_TEXT[code] || code

export const LABEL_TEXT = {
  shortfall: 'Recorded below expected',
  no_difference: 'Matches expected',
  above_expected: 'Recorded above expected',
  unclear: 'Unclear so far',
  late: 'Dated after the due date',
  unrecorded: 'Receipt not confirmed',
}

/** The main neutral sentence for one item of a /api/calculate result. */
export function itemSentence(item, period) {
  const label = item.labels[0] || {}
  const v = {
    item: item.item,
    unit: item.unit,
    received: item.received.value,
    expected: item.expected.value,
    diff: item.difference.value.replace(/^-/, ''),
    period: fmtPeriod(period),
    end: fmtDate(period.end),
  }
  if (label.code === 'shortfall') {
    return `Confirmed records for ${v.item} total ${v.received} ${v.unit} against an expected entitlement of ${v.expected} ${v.unit} for ${v.period}, a difference of ${v.diff} ${v.unit}. The reason for this difference has not been established.`
  }
  if (label.code === 'above_expected') {
    return `Confirmed records for ${v.item} total ${v.received} ${v.unit}, which is ${v.diff} ${v.unit} more than the expected entitlement of ${v.expected} ${v.unit} for ${v.period}.`
  }
  if (label.code === 'no_difference') {
    return `Confirmed records for ${v.item} total ${v.received} ${v.unit}, which matches the expected entitlement of ${v.expected} ${v.unit} for ${v.period}.`
  }
  return `So far, confirmed records for ${v.item} total ${v.received} ${v.unit} of an expected ${v.expected} ${v.unit}. The period ends on ${v.end}, so this may change.`
}

/** The balance sentence (plan_frontend.txt section 6). Never says WHY a balance exists. */
export function balanceSentence(item) {
  const b = item.balance
  const v = { item: item.item, unit: item.unit, expected: item.expected.value }
  if (b.over_by !== '0') return `${b.over_by} ${v.unit} more than the entitlement has been recorded for ${v.item}.`
  if (b.remaining === '0') return `The full ${v.expected} ${v.unit} for ${v.item} has been recorded.`
  if (b.phase === 'ongoing') {
    return `${b.remaining} ${v.unit} of your ${v.expected} ${v.unit} for ${v.item} is still to be collected this period (${b.percent_used}% recorded so far).`
  }
  return `${b.remaining} ${v.unit} of the ${v.expected} ${v.unit} entitlement for ${v.item} was not recorded as collected in this period. This does not say why.`
}

export const CARRY_NOTE =
  "Whether unused ration can be collected later depends on the scheme's own rules, which this tool does not assume. Please check with your local office."

export const REPORT_FOOTER =
  'This report compares recorded quantities with the rules you entered. It does not establish the cause of any difference.'

export function evidenceText(rec) {
  const e = rec.evidence || {}
  const parts = []
  if (e.proof_photo) parts.push('Receipt photo attached')
  if (e.receipt_ref) parts.push(`Receipt ${e.receipt_ref}`)
  if (e.receipt_text) parts.push(`Pasted text: “${e.receipt_text}”`)
  if (e.note) parts.push(e.note)
  if (e.no_receipt) parts.push('No receipt (stated by user)')
  return parts.length ? parts.join(' · ') : 'No evidence provided'
}

/** Plain-text version of a whole report, for "Copy text". */
export function reportAsText(result, caseData) {
  const lines = [`RationSaathi report — ${fmtPeriod(result.period)}`, `Household members: ${result.members}`, '']
  for (const it of result.items) {
    lines.push(`${it.item}`)
    if (it.expected.basis === 'per_household') {
      lines.push(`  ${it.expected.per_unit} ${it.unit} (per household) = ${it.expected.value} ${it.unit}`)
    } else {
      lines.push(`  ${it.expected.members} × ${it.expected.per_unit} ${it.unit} = ${it.expected.value} ${it.unit}`)
    }
    const terms = it.received.terms.map((t) => `${t.value} ${it.unit}`).join(' + ')
    lines.push(`  ${terms || '0 ' + it.unit} = ${it.received.value} ${it.unit}`)
    lines.push(`  ${it.expected.value} ${it.unit} − ${it.received.value} ${it.unit} = ${it.difference.value} ${it.unit}`)
    lines.push(`  ${itemSentence(it, result.period)}`)
    lines.push(`  ${balanceSentence(it)}`)
    for (const ex of it.excluded) lines.push(`  Not counted: record ${ex.record_id} (${excludedReason(ex.reason)})`)
    lines.push('')
  }
  for (const u of result.unmatched) {
    lines.push(`Record ${u.record_id}: no entitlement rule was entered for this item, so it was not compared.`)
  }
  lines.push('Evidence:')
  for (const r of caseData.records) {
    const q = r.quantity ? `${r.quantity.value} ${r.quantity.unit}` : 'no quantity'
    lines.push(`  ${fmtDate(r.date)} · ${r.item} · ${q} · ${r.status} · ${evidenceText(r)}`)
  }
  lines.push('', CARRY_NOTE, REPORT_FOOTER)
  return lines.join('\n')
}

// ── parser issue codes (POST /api/receipt/parse) ─────────
const ISSUE_TEXT = {
  DATE_AMBIGUOUS: 'The date could be read two ways. Please pick the right one.',
  DATE_AMBIGUOUS_RESOLVED_BY_PERIOD: 'The date could be read two ways; only one falls inside your period. Please check it.',
  YEAR_INFERRED_FROM_PERIOD: 'No year was written, so the year was taken from your period.',
  DATE_NOT_FOUND: 'No date was found. Please enter it.',
  QUANTITY_NOT_FOUND: 'No quantity was found. Please enter it.',
  QUANTITY_TOO_PRECISE: 'That quantity has more decimals than we can store exactly (kg and litres allow 3, others none). Please enter it again.',
  UNIT_NOT_FOUND: 'No unit was found. Please choose one.',
  ITEM_NOT_FOUND: 'No item name was found. Please enter it.',
  ITEM_NOT_IN_RULES: 'You have no entitlement rule for this item, so it will not be compared.',
  LOW_CONFIDENCE: 'This line was only partly understood. Please check every field.',
}
export const issueText = (code) => ISSUE_TEXT[code] || code

// ── API error codes ──────────────────────────────────────
const ERROR_TEXT = {
  VALIDATION_FAILED: 'Some details are not valid. Please check the highlighted fields.',
  UNAUTHENTICATED: 'Please log in to continue.',
  RATE_LIMITED: 'Too many requests. Please wait a moment and try again.',
  NOT_FOUND: 'That could not be found.',
  PAYLOAD_TOO_LARGE: 'That is too much data to send at once.',
  BAD_ORIGIN: 'The request was blocked for safety. Please reload the page.',
  EMAIL_NOT_CONFIGURED: 'Emailing reports is not set up on this server yet.',
  EMAIL_FAILED: 'The email could not be sent. Please try again later.',
  CASE_EXISTS_FOR_PERIOD: 'You already have a case for the next month in this household.',
  INTERNAL: 'Something went wrong on our side. Please try again.',
}

export function errorText(error) {
  if (!error) return ''
  if (error.code === 'RATE_LIMITED' && error.retryAfter) {
    const mins = Math.max(1, Math.ceil(error.retryAfter / 60))
    return `Too many requests. Please try again in ${mins} minute${mins === 1 ? '' : 's'}.`
  }
  if (error.code && ERROR_TEXT[error.code]) return ERROR_TEXT[error.code]
  if (!error.status) return 'Could not reach the server. Please check your connection and try again.'
  return 'Something went wrong. Please try again.'
}

const FIELD_TEXT = {
  TOO_PRECISE: 'Too many decimals (kg and litres allow 3; g, ml and pieces must be whole numbers).',
  QUANTITY_INVALID: 'Enter a number such as 5 or 2.5.',
  QUANTITY_NOT_POSITIVE: 'The quantity must be more than zero.',
  PERIOD_END_BEFORE_START: 'The end date is before the start date.',
  UNKNOWN_RULE_ID: 'This record points at a rule that no longer exists.',
  DUPLICATE_RULE_ID: 'Two rules share an id.',
  DUPLICATE_RECORD_ID: 'Two records share an id.',
  QUANTITY_REQUIRED_WHEN_CONFIRMED: 'A confirmed record needs a quantity.',
  ITEM_REQUIRED: 'Enter an item name.',
}

/** Server validation errors ({ 'rules.0.quantity': 'TOO_PRECISE' }) as readable lines. */
export function fieldErrorLines(fields) {
  if (!fields || typeof fields !== 'object') return []
  return Object.entries(fields).map(([path, code]) => {
    const where = path.replace(/\.(\d+)/g, (_, n) => ` #${Number(n) + 1}`).replace(/\./g, ' → ')
    return `${where}: ${FIELD_TEXT[code] || String(code).toLowerCase().replace(/_/g, ' ')}`
  })
}
