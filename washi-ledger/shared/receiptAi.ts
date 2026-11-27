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
  paymentMethod?: string | null
  subtotalAmount?: number | null
  cashTenderedAmount?: number | null
  changeAmount?: number | null
  pointsUsedAmount?: number | null
  discountAmount?: number | null
  rawAmount?: number | null
  validationReasons?: string[]
  settlementChecks?: string[]
}

const nullableText = { type: ['string', 'null'] }
const nullableNumber = { type: ['number', 'null'] }
export const RECEIPT_AI_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    amount: { ...nullableNumber, description: 'Explicit final tax-inclusive purchase total, never cash tendered, change, subtotal or promotion threshold.' }, currency: nullableText, date: nullableText, storeName: nullableText,
    items: { type: 'array', items: { type: 'string' } },
    paymentAmount: nullableNumber, taxAmount: nullableNumber,
    totalEvidence: nullableText, paymentEvidence: nullableText,
    paymentMethod: nullableText,
    subtotalAmount: nullableNumber,
    cashTenderedAmount: { ...nullableNumber, description: 'Cash handed to cashier, labelled お預り/預り. Never put this in paymentAmount.' },
    changeAmount: { ...nullableNumber, description: 'Cash change returned, labelled お釣り/釣銭.' },
    pointsUsedAmount: { ...nullableNumber, description: 'Monetary value of points redeemed for this purchase, not earned points or balance.' },
    discountAmount: { ...nullableNumber, description: 'Total explicitly printed discount amount, as a positive value; null if not clear.' },
    uncertain: { type: 'boolean', description: 'True only when the final purchase total itself is unclear or conflicting, not merely because payment, points or tendered cash differ.' },
  },
  required: ['amount', 'currency', 'date', 'storeName', 'items', 'paymentAmount', 'taxAmount',
    'totalEvidence', 'paymentEvidence', 'uncertain', 'subtotalAmount', 'cashTenderedAmount',
    'changeAmount', 'pointsUsedAmount', 'discountAmount', 'paymentMethod'],
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
  // Older deployed Workers may omit the new settlement fields. Accept that wire format too.
  const settlement: Record<string, number | null> = {}
  for (const key of ['subtotalAmount', 'cashTenderedAmount', 'changeAmount', 'pointsUsedAmount', 'discountAmount']) {
    const value = v[key] ?? null
    if (value !== null && (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1_000_000_000)) return invalid()
    settlement[key] = value as number | null
  }
  const paymentMethod = v.paymentMethod ?? null
  if (paymentMethod !== null && (typeof paymentMethod !== 'string' || paymentMethod.length > 500)) return invalid()
  const reasons: string[] = []
  if (v.uncertain) reasons.push('TOTAL_UNCERTAIN')
  if (v.amount === null) reasons.push('TOTAL_MISSING')
  if (v.currency !== 'JPY') reasons.push('CURRENCY_NOT_JPY')
  if (!(typeof v.totalEvidence === 'string' && v.totalEvidence.trim())) reasons.push('TOTAL_EVIDENCE_MISSING')
  if (v.amount !== null && !Number.isInteger(v.amount)) reasons.push('JPY_TOTAL_NOT_INTEGER')
  // A payment can differ because of points, split tender or cash change. These are checks,
  // never a reason to erase an explicit, legible purchase total or replace it with payment.
  const checks: string[] = []
  if (v.amount !== null && v.paymentAmount !== null && Math.abs((v.amount as number) - (v.paymentAmount as number)) >= 0.005) {
    checks.push('PAYMENT_DIFFERS_FROM_TOTAL')
  }
  if (v.amount !== null && settlement.cashTenderedAmount !== null && settlement.changeAmount !== null) {
    checks.push(Math.abs(settlement.cashTenderedAmount - settlement.changeAmount - (v.amount as number)) < 0.005
      ? 'CASH_TENDER_MINUS_CHANGE_MATCHES_TOTAL' : 'CASH_TENDER_MINUS_CHANGE_DIFFERS_FROM_TOTAL')
  }
  const rawAmount = v.rawAmount === undefined ? v.amount : v.rawAmount
  if (rawAmount !== null && (typeof rawAmount !== 'number' || !Number.isFinite(rawAmount) || rawAmount < 0 || rawAmount > 1_000_000_000)) return invalid()
  return {
    amount: reasons.length ? null : v.amount as number,
    currency: v.currency as string | null, date: v.date as string | null,
    storeName: v.storeName as string | null, items: v.items as string[],
    paymentAmount: v.paymentAmount as number | null, taxAmount: v.taxAmount as number | null,
    totalEvidence: v.totalEvidence as string | null, paymentEvidence: v.paymentEvidence as string | null,
    uncertain: reasons.length > 0,
    ...settlement, paymentMethod: paymentMethod as string | null, rawAmount: rawAmount as number | null,
    validationReasons: Array.isArray(v.validationReasons) && v.validationReasons.every(x => typeof x === 'string')
      ? v.validationReasons as string[] : reasons,
    settlementChecks: checks,
  }
}
