export type ReceiptAmountBasis = 'before_points' | 'after_points' | 'unknown'

export interface ReceiptPointValues {
  pointsEarned?: number | null
  pointsUsed?: number | null
  pointsUsedAmount?: number | null
}

/** Input is a printed total. An already-net amount must never be discounted twice. */
export function receiptBookAmount(amount: number | null, basis: ReceiptAmountBasis = 'before_points', usedAmount?: number | null, usedPoints?: number | null): number | null {
  if (amount == null) return null
  if (basis === 'after_points') return amount
  if (basis === 'unknown' && ((usedAmount ?? 0) > 0 || (usedPoints ?? 0) > 0)) return null
  if (usedAmount == null) return (usedPoints ?? 0) > 0 ? null : amount
  if (usedAmount > amount) return null
  return Math.round((amount - usedAmount) * 100) / 100
}

export function earnedPointsTotal(receiptEarned: number, amount: number, rate: number | null) {
  const payment = rate != null && Number.isFinite(amount) && amount > 0 ? Math.floor(amount * rate) : 0
  return { receipt: receiptEarned, payment, total: receiptEarned + payment }
}

type PointLabel = 'receiptPointsEarned' | 'receiptPointsUsed' | 'receiptPointsDeduction'
export function receiptPointLines(values: ReceiptPointValues, label: (key: PointLabel) => string): string[] {
  const lines: string[] = []
  if (values.pointsEarned != null) lines.push(`${label('receiptPointsEarned')}: ${values.pointsEarned.toLocaleString()}P`)
  if (values.pointsUsed != null) lines.push(`${label('receiptPointsUsed')}: ${values.pointsUsed.toLocaleString()}P`)
  if (values.pointsUsedAmount != null && values.pointsUsedAmount > 0) lines.push(`${label('receiptPointsDeduction')}: ¥${values.pointsUsedAmount.toLocaleString()}`)
  return lines
}

/** Only replace our exact generated block. A manually changed/deleted block remains owned by the user. */
export function syncReceiptRuleNote(note: string, previous: string | null | undefined, next: string | null) {
  if (previous === null) return { note, marker: null }
  if (previous === undefined) return next ? { note: note.trim() ? `${note.trimEnd()}\n\n${next}` : next, marker: next } : { note, marker: undefined }
  const blocks = note.split('\n\n'), index = blocks.indexOf(previous)
  if (index < 0) return { note, marker: null }
  if (next) blocks[index] = next
  else blocks.splice(index, 1)
  return { note: blocks.join('\n\n'), marker: next ?? undefined }
}
