import { newId } from '../format.js'

// Monthly foodgrain entitlement by ration card type under the National Food Security Act, as
// distributed in Maharashtra. Other states split rice and wheat differently, so the user always
// reviews (and can edit) the rules before anything is compared.
export const CARD_TYPES = {
  PHH: {
    label: 'Priority Household (PHH)',
    summary: '2 kg rice + 3 kg wheat per member, every month',
    rules: [
      { item: 'Rice', basis: 'per_member', value: '2' },
      { item: 'Wheat', basis: 'per_member', value: '3' },
    ],
  },
  AAY: {
    label: 'Antyodaya Anna Yojana (AAY)',
    summary: '15 kg rice + 20 kg wheat per household, every month',
    rules: [
      { item: 'Rice', basis: 'per_household', value: '15' },
      { item: 'Wheat', basis: 'per_household', value: '20' },
    ],
  },
}

/** Fresh rule objects (the Case shape) for a card type, or [] for an unknown type. */
export function rulesForCard(type) {
  const card = CARD_TYPES[type]
  if (!card) return []
  return card.rules.map((r) => ({
    id: newId(), item: r.item, basis: r.basis, quantity: { value: r.value, unit: 'kg' }, due_by: null,
  }))
}
