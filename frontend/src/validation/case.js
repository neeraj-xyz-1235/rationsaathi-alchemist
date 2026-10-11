// zod schemas for the Case object. They MIRROR the backend (plan_backend.txt 2.1) so users get
// instant feedback; the backend is still the real guard. Quantities stay STRINGS and are never
// converted to numbers or rounded.
import { z } from 'zod'

export const UNITS = ['kg', 'g', 'l', 'ml', 'pcs']
// kg and l allow up to 3 decimals (1 g / 1 ml); g, ml and pcs must be whole numbers.
const DECIMALS = { kg: 3, l: 3, g: 0, ml: 0, pcs: 0 }

/** Returns an error sentence, or '' when the value is valid for the unit. */
export function quantityError(value, unit) {
  const v = String(value ?? '').trim()
  if (!v) return 'Enter a quantity.'
  if (!/^\d{1,12}(\.\d{1,12})?$/.test(v)) return 'Enter a number such as 5 or 2.5.'
  const decimals = (v.split('.')[1] || '').replace(/0+$/, '').length
  if (decimals > (DECIMALS[unit] ?? 0)) {
    return DECIMALS[unit] ? `${unit} allows up to 3 decimals.` : `${unit} must be a whole number.`
  }
  if (!/[1-9]/.test(v)) return 'The quantity must be more than zero.'
  return ''
}

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter a valid date.')

export const familySchema = z.object({
  household_ref: z.string().trim().max(60, 'Keep this under 60 characters.').nullable(),
  members: z.coerce.number({ message: 'Enter a whole number.' })
    .int('Enter a whole number.').min(1, 'At least 1 member.').max(1000, 'That looks too high.'),
  period: z.object({ start: isoDate, end: isoDate })
    .refine((p) => p.end >= p.start, { message: 'The end date cannot be before the start date.', path: ['end'] }),
})

export const ruleSchema = z.object({
  item: z.string().trim().min(1, 'Enter an item name.').max(60, 'Keep it under 60 characters.'),
  basis: z.enum(['per_member', 'per_household']),
  quantity: z.object({ value: z.string(), unit: z.enum(UNITS) }),
  due_by: isoDate.nullable(),
}).superRefine((r, ctx) => {
  const message = quantityError(r.quantity.value, r.quantity.unit)
  if (message) ctx.addIssue({ code: 'custom', path: ['quantity'], message })
})

export const recordSchema = z.object({
  item: z.string().trim().min(1, 'Choose or enter an item.').max(60),
  quantity: z.object({ value: z.string(), unit: z.enum(UNITS) }).nullable(),
  date: isoDate.nullable(),
  status: z.enum(['confirmed', 'pending']),
  evidence: z.object({
    receipt_ref: z.string().max(60, 'Keep the receipt number under 60 characters.').nullable(),
    note: z.string().max(500, 'Keep the note under 500 characters.').nullable(),
    no_receipt: z.boolean(),
    receipt_text: z.string().max(2000).nullable(),
    proof_photo: z.boolean().optional(),
  }),
}).superRefine((r, ctx) => {
  if (r.status === 'confirmed') {
    const message = r.quantity ? quantityError(r.quantity.value, r.quantity.unit) : 'Enter a quantity.'
    if (message) ctx.addIssue({ code: 'custom', path: ['quantity'], message })
  }
})

/** Flatten zod issues to { path: message } keeping the first message per path. */
export function issuesToMap(error) {
  const map = {}
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_'
    if (!map[key]) map[key] = issue.message
  }
  return map
}
