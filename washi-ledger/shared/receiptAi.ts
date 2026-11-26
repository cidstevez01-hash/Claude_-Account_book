/** Shared wire contract. No credentials, browser APIs or provider SDK in this module. */
export const MAX_AI_IMAGE_BYTES = 3_000_000
export interface ReceiptAiResult {
  amount: number | null
  currency: string | null
  date: string | null
  storeName: string | null
  items: string[]
  paymentAmount: number | null
  taxAmount: number | null
  totalEvidence: string | null
  paymentEvidence: string | null
  uncertain: boolean
}

const nullableText = { type: ['string', 'null'] }
const nullableNumber = { type: ['number', 'null'] }
export const RECEIPT_AI_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    amount: nullableNumber, currency: nullableText, date: nullableText, storeName: nullableText,
    items: { type: 'array', items: { type: 'string' } },
    paymentAmount: nullableNumber, taxAmount: nullableNumber,
    totalEvidence: nullableText, paymentEvidence: nullableText, uncertain: { type: 'boolean' },
  },
  required: ['amount', 'currency', 'date', 'storeName', 'items', 'paymentAmount', 'taxAmount',
    'totalEvidence', 'paymentEvidence', 'uncertain'],
}

export function parseReceiptAiResult(value: unknown): ReceiptAiResult {
  const invalid = () => { throw new Error('RECEIPT_AI_INVALID_RESULT') }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid()
  const v = value as Record<string, unknown>
  for (const key of ['amount', 'paymentAmount', 'taxAmount']) {
    if (v[key] !== null && (typeof v[key] !== 'number' || !Number.isFinite(v[key])
      || v[key] < 0 || v[key] > 1_000_000_000)) return invalid()
  }
  for (const key of ['currency', 'date', 'storeName', 'totalEvidence', 'paymentEvidence']) {
    if (v[key] !== null && (typeof v[key] !== 'string' || v[key].length > 500)) return invalid()
  }
  if (typeof v.uncertain !== 'boolean' || !Array.isArray(v.items) || v.items.length > 100
    || v.items.some(x => typeof x !== 'string' || x.length > 500)) return invalid()
  if (v.currency !== null && !/^[A-Z]{3}$/.test(v.currency as string)) return invalid()
  if (v.date !== null) {
    const date = v.date as string
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date))
      || new Date(date).toISOString().slice(0, 10) !== date) return invalid()
  }
  // This receipt flow currently fills yen amounts. Never put another currency into a JPY total,
  // invent a missing total, or resolve a payment/total conflict by choosing the larger number.
  const conflict = v.paymentAmount !== null && v.amount !== null
    && Math.abs((v.paymentAmount as number) - (v.amount as number)) >= 0.005
  const uncertain = v.uncertain || conflict || v.currency !== 'JPY' || !v.totalEvidence || v.amount === null
    || !Number.isInteger(v.amount)
  return {
    amount: uncertain ? null : v.amount as number,
    currency: v.currency as string | null, date: v.date as string | null,
    storeName: v.storeName as string | null, items: v.items as string[],
    paymentAmount: v.paymentAmount as number | null, taxAmount: v.taxAmount as number | null,
    totalEvidence: v.totalEvidence as string | null, paymentEvidence: v.paymentEvidence as string | null,
    uncertain,
  }
}
