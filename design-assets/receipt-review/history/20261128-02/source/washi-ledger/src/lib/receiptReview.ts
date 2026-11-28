import type { RecognizedReceiptFields } from './receiptFieldExtract'
import { tSync } from './i18nSync'
import { receiptBookAmount, receiptPointLines } from './receiptPoints'

export interface ReceiptReviewEdits {
  amount?: string
  date?: string
  note?: string
  pointsEarned?: string
  pointsUsed?: string
  pointsUsedAmount?: string
}

/** The scan editor and the entry form use this same note block, including explicit clearing. */
export function formatReceiptNote(fields: RecognizedReceiptFields): string {
  if (fields.noteText !== undefined) return fields.noteText
  return [fields.storeName, ...[...fields.items, ...receiptPointLines(fields, tSync)].map(item => `・${item}`)].filter(Boolean).join('\n')
}

export function receiptReviewValues(fields: RecognizedReceiptFields, edits: ReceiptReviewEdits) {
  const numberValue = (value: string | undefined, original: number | null | undefined, points = false) => {
    if (value === undefined) return original ?? null
    const text = points ? value.replace(/[,\sPpＰ]/g, '') : amountText(value)
    return text && Number.isFinite(Number(text)) ? Number(text) : null
  }
  const pointValues = {
    pointsEarned: numberValue(edits.pointsEarned, fields.pointsEarned, true),
    pointsUsed: numberValue(edits.pointsUsed, fields.pointsUsed, true),
    pointsUsedAmount: numberValue(edits.pointsUsedAmount, fields.pointsUsedAmount),
  }
  const printedAmount = fields.printedAmount === undefined ? fields.amount : fields.printedAmount
  const amount = receiptBookAmount(printedAmount, fields.amountBasis, pointValues.pointsUsedAmount, pointValues.pointsUsed)
  return {
    amount: edits.amount ?? (amount == null ? '' : String(amount)),
    date: edits.date ?? fields.date ?? '',
    note: edits.note ?? formatReceiptNote({ ...fields, ...pointValues }),
    pointsEarned: edits.pointsEarned ?? (pointValues.pointsEarned == null ? '' : String(pointValues.pointsEarned)),
    pointsUsed: edits.pointsUsed ?? (pointValues.pointsUsed == null ? '' : String(pointValues.pointsUsed)),
    pointsUsedAmount: edits.pointsUsedAmount ?? (pointValues.pointsUsedAmount == null ? '' : String(pointValues.pointsUsedAmount)),
    pointValues,
    amountNeedsReview: edits.amount === undefined && printedAmount != null && amount == null,
  }
}

function amountText(value: string): string {
  return value.replace(/[,\s¥￥]/g, '')
}

export function receiptReviewError(edits: ReceiptReviewEdits): 'amount' | 'date' | 'pointsEarned' | 'pointsUsed' | 'pointsUsedAmount' | null {
  for (const field of ['amount', 'pointsUsedAmount'] as const) if (edits[field]?.trim()) {
    const value = amountText(edits[field])
    if (!/^(?:\d+(?:\.\d{0,2})?|\.\d{1,2})$/.test(value)
      || !Number.isFinite(Number(value)) || Number(value) > 1_000_000_000) return field
  }
  for (const field of ['pointsEarned', 'pointsUsed'] as const) if (edits[field]?.trim()) {
    const value = edits[field].replace(/[,\sPpＰ]/g, '')
    if (!/^\d+$/.test(value) || Number(value) > 1_000_000_000) return field
  }
  if (edits.date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(edits.date) || !Number.isFinite(Date.parse(edits.date))
      || new Date(edits.date).toISOString().slice(0, 10) !== edits.date) return 'date'
  }
  return null
}

/** Apply at confirmation, after any async result. Field-presence protects even a manual clear. */
export function applyReceiptReviewEdits(fields: RecognizedReceiptFields, edits: ReceiptReviewEdits): RecognizedReceiptFields {
  if (receiptReviewError(edits)) throw new Error('RECEIPT_REVIEW_INVALID')
  const values = receiptReviewValues(fields, edits)
  return {
    ...fields,
    amount: values.amount.trim() ? Number(amountText(values.amount)) : null,
    date: edits.date === undefined ? fields.date : values.date || null,
    noteText: values.note,
    ...values.pointValues,
    amountNeedsReview: values.amountNeedsReview,
    reviewEdits: { amount: edits.amount !== undefined, date: edits.date !== undefined, note: edits.note !== undefined },
  }
}

/** Preview and confirmation both include the same entry-level payment-rule note. */
export function withReceiptPointsNote(fields: RecognizedReceiptFields, calculate?: (fields: RecognizedReceiptFields) => string | null): RecognizedReceiptFields {
  const ruleNote = calculate?.(fields) ?? null
  let noteText = formatReceiptNote(fields)
  if (ruleNote && !fields.reviewEdits?.note) noteText = noteText ? `${noteText}\n\n${ruleNote}` : ruleNote
  return { ...fields, noteText, receiptPointsNote: ruleNote ? noteText.split('\n\n').includes(ruleNote) ? ruleNote : null : undefined }
}
