import { newId } from './format.js'

/** Common item names offered as suggestions (kept in sync with plan_backend.txt 4.1). */
export const ITEM_SUGGESTIONS = ['Rice', 'Wheat', 'Sugar', 'Dal', 'Edible oil']

const orNull = (s) => {
  const v = typeof s === 'string' ? s.trim() : s
  return v === '' || v === undefined ? null : v
}

/** Tidy a case for the API: trim text, '' -> null. Never touches quantity values. */
export function cleanCase(c) {
  return {
    household_ref: orNull(c.household_ref),
    members: Number(c.members),
    period: { start: c.period.start, end: c.period.end },
    rules: c.rules.map((r) => ({
      id: r.id,
      item: r.item.trim(),
      basis: r.basis,
      quantity: { value: String(r.quantity.value).trim(), unit: r.quantity.unit },
      due_by: orNull(r.due_by),
    })),
    records: c.records.map((r) => ({
      id: r.id,
      rule_id: r.rule_id || null,
      item: r.item.trim(),
      quantity: r.quantity && String(r.quantity.value).trim()
        ? { value: String(r.quantity.value).trim(), unit: r.quantity.unit }
        : null,
      date: orNull(r.date),
      status: r.status,
      entry_method: r.entry_method,
      evidence: {
        receipt_ref: orNull(r.evidence?.receipt_ref),
        note: orNull(r.evidence?.note),
        no_receipt: Boolean(r.evidence?.no_receipt),
        receipt_text: r.evidence?.receipt_text ? r.evidence.receipt_text : null, // verbatim
        proof_photo: Boolean(r.evidence?.proof_photo),
      },
    })),
  }
}

/** The demo scenario from plan_overview.txt section 6 (period already ENDED). */
export function demoCase() {
  const rice = newId()
  const wheat = newId()
  return {
    household_ref: 'Home – September',
    members: 4,
    period: { start: '2026-09-01', end: '2026-09-30' },
    rules: [
      { id: rice, item: 'Rice', basis: 'per_member', quantity: { value: '5', unit: 'kg' }, due_by: null },
      { id: wheat, item: 'Wheat', basis: 'per_member', quantity: { value: '2.5', unit: 'kg' }, due_by: null },
    ],
    records: [
      { id: newId(), rule_id: rice, item: 'Rice', quantity: { value: '8', unit: 'kg' }, date: '2026-09-03',
        status: 'confirmed', entry_method: 'extracted_confirmed',
        evidence: { receipt_ref: '101', note: null, no_receipt: false, receipt_text: 'Rice 8kg recvd 03/09 Rcpt#101' } },
      { id: newId(), rule_id: rice, item: 'Rice', quantity: { value: '6', unit: 'kg' }, date: '2026-09-20',
        status: 'confirmed', entry_method: 'manual',
        evidence: { receipt_ref: '145', note: null, no_receipt: false, receipt_text: null } },
      { id: newId(), rule_id: wheat, item: 'Wheat', quantity: { value: '10', unit: 'kg' }, date: '2026-09-05',
        status: 'confirmed', entry_method: 'manual',
        evidence: { receipt_ref: null, note: 'Collected at shop', no_receipt: true, receipt_text: null } },
    ],
  }
}

export const blankRule = () => ({
  id: newId(), item: '', basis: 'per_member', quantity: { value: '', unit: 'kg' }, due_by: null,
})
