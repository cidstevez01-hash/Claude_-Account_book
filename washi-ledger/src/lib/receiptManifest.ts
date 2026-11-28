import type { ReceiptDetails } from '../types'

function validNumber(value: unknown, integer = false): value is number | null {
  return value === null || typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1_000_000_000 && (!integer || Number.isInteger(value))
}

/** Keep path strings in the original array; older clients already ignore non-string members. */
export function parseReceiptManifest(raw: string | null): { paths: string[]; details: ReceiptDetails[]; pointsNote?: string | null } {
  if (!raw) return { paths: [], details: [] }
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return { paths: [raw], details: [] }
    const paths = parsed.filter((p): p is string => typeof p === 'string')
    const meta = parsed.find(p => p && typeof p === 'object' && p.pigbangReceiptDetails === 1)
    const details: ReceiptDetails[] = [], ids = new Set<string>(), seenPaths = new Set<string>()
    if (Array.isArray(meta?.receipts)) for (const row of meta.receipts.slice(0, 1000)) {
      if (!row || typeof row !== 'object' || typeof row.receiptId !== 'string' || !row.receiptId
        || typeof row.path !== 'string' || !paths.includes(row.path) || ids.has(row.receiptId) || seenPaths.has(row.path)
        || !['before_points', 'after_points', 'unknown'].includes(row.amountBasis)
        || !validNumber(row.amount) || !validNumber(row.printedAmount) || !validNumber(row.pointsUsedAmount)
        || !validNumber(row.pointsEarned, true) || !validNumber(row.pointsUsed, true)) continue
      ids.add(row.receiptId); seenPaths.add(row.path)
      details.push({ receiptId: row.receiptId, path: row.path, amount: row.amount,
        printedAmount: row.printedAmount, amountBasis: row.amountBasis, pointsEarned: row.pointsEarned,
        pointsUsed: row.pointsUsed, pointsUsedAmount: row.pointsUsedAmount,
        noteText: typeof row.noteText === 'string' && row.noteText.length <= 100_000 ? row.noteText : undefined })
    }
    return { paths, details, pointsNote: typeof meta?.pointsNote === 'string' || meta?.pointsNote === null ? meta.pointsNote : undefined }
  } catch { return { paths: [raw], details: [] } }
}

export function serializeReceiptManifest(paths: string[], details: ReceiptDetails[] = [], pointsNote?: string | null): string | null {
  if (!paths.length) return null
  const active = details.filter(d => paths.includes(d.path))
  return JSON.stringify(active.length ? [...paths, { pigbangReceiptDetails: 1, receipts: active, pointsNote }] : paths)
}
