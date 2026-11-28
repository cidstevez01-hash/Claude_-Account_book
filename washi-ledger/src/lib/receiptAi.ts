import { tSync } from './i18nSync'
import { apiClient } from './apiClient'
import { MAX_AI_IMAGE_BYTES, parseReceiptAiResult, type ReceiptAiResult } from '../../shared/receiptAi'
import type { RecognizedReceiptFields } from './receiptFieldExtract'
import { receiptBookAmount, receiptPointLines } from './receiptPoints'

/** Separate canvas: never resize or recompress the PDF source canvas. */
export function receiptAiImage(source: HTMLCanvasElement): string {
  const canvas = document.createElement('canvas')
  const scale = Math.min(1, 3200 / Math.max(source.width, source.height))
  canvas.width = Math.max(1, Math.round(source.width * scale))
  canvas.height = Math.max(1, Math.round(source.height * scale))
  const context = canvas.getContext('2d')
  if (!context) throw new Error('RECEIPT_AI_INVALID_REQUEST')
  context.drawImage(source, 0, 0, canvas.width, canvas.height)
  for (const quality of [0.9, 0.8, 0.7, 0.6]) {
    const image = canvas.toDataURL('image/jpeg', quality)
    if ((image.length - image.indexOf(',') - 1) * 3 / 4 <= MAX_AI_IMAGE_BYTES) return image
  }
  throw new Error('RECEIPT_AI_IMAGE_TOO_LARGE')
}

export async function recognizeReceiptAi(canvas: HTMLCanvasElement, receiptId: string, signal: AbortSignal): Promise<{
  fields: RecognizedReceiptFields; result: ReceiptAiResult
}> {
  const response = await apiClient.post<{ receiptId: string; fields: unknown }>('/receipts/recognize', {
    receiptId, image: receiptAiImage(canvas),
  }, { signal })
  if (signal.aborted || response.receiptId !== receiptId) throw new Error('RECEIPT_AI_INVALID_RESULT')
  const result = parseReceiptAiResult(response.fields)
  const amount = receiptBookAmount(result.amount, result.amountBasis, result.pointsUsedAmount, result.pointsUsed)
  return { result, fields: {
    receiptId, amount, printedAmount: result.amount, amountBasis: result.amountBasis,
    pointsEarned: result.pointsEarned, pointsUsed: result.pointsUsed, pointsUsedAmount: result.pointsUsedAmount,
    pointsEarnedContext: result.pointsEarnedContext, pointsUsedContext: result.pointsUsedContext,
    amountNeedsReview: result.amount != null && amount == null,
    date: result.date, storeName: result.storeName,
    items: receiptAiNoteLines(result, false), ocrRows: [result.totalEvidence, result.paymentEvidence].filter((x): x is string => !!x),
  } }
}

export function receiptAiErrorKey(error: unknown) {
  switch (error instanceof Error ? error.message : '') {
    case 'RECEIPT_AI_NOT_ALLOWED': return 'receiptAiNotAllowed' as const
    case 'RECEIPT_AI_NOT_CONFIGURED': return 'receiptAiNotConfigured' as const
    case 'RECEIPT_AI_RATE_LIMITED': return 'receiptAiRateLimited' as const
    case 'RECEIPT_AI_TIMEOUT': return 'receiptAiTimeout' as const
    case 'RECEIPT_AI_IMAGE_TOO_LARGE': return 'receiptAiImageTooLarge' as const
    default: return 'receiptAiFailed' as const
  }
}

/** Merge only fields for the same scan. An empty AI field must not erase a confirmed value. */
export function mergeReceiptFields(previous: RecognizedReceiptFields | null, incoming: RecognizedReceiptFields): RecognizedReceiptFields {
  if (!previous) return incoming
  if (previous.receiptId !== incoming.receiptId) throw new Error('RECEIPT_AI_INVALID_RESULT')
  const incomingPrinted = incoming.printedAmount === undefined ? incoming.amount : incoming.printedAmount
  const printedAmount = incomingPrinted ?? previous.printedAmount ?? previous.amount
  const amountBasis = incoming.amountBasis ?? previous.amountBasis ?? 'before_points'
  const excluded = (context: RecognizedReceiptFields['pointsEarnedContext']) => context === 'promotion' || context === 'balance'
  const pointsEarned = excluded(incoming.pointsEarnedContext) ? null : incoming.pointsEarned ?? previous.pointsEarned
  const pointsUsed = excluded(incoming.pointsUsedContext) ? null : incoming.pointsUsed ?? previous.pointsUsed
  const pointsUsedAmount = excluded(incoming.pointsUsedContext) ? null : incoming.pointsUsedAmount ?? (incoming.pointsUsed === 0 ? 0
    : incoming.pointsUsed != null && incoming.pointsUsed !== previous.pointsUsed ? null : previous.pointsUsedAmount)
  const amount = receiptBookAmount(printedAmount, amountBasis, pointsUsedAmount, pointsUsed)
  return {
    receiptId: incoming.receiptId,
    amount, printedAmount, amountBasis, pointsEarned, pointsUsed, pointsUsedAmount,
    pointsEarnedContext: incoming.pointsEarnedContext ?? previous.pointsEarnedContext,
    pointsUsedContext: incoming.pointsUsedContext ?? previous.pointsUsedContext,
    amountNeedsReview: printedAmount != null && amount == null,
    date: incoming.date ?? previous.date,
    storeName: incoming.storeName?.trim() ? incoming.storeName : previous.storeName,
    items: incoming.items.length ? incoming.items : previous.items,
    ocrRows: incoming.ocrRows.length ? incoming.ocrRows : previous.ocrRows,
  }
}

/** Only purchase details and relevant adjustments enter notes, never cash tender/change. */
export function receiptAiNoteLines(result: ReceiptAiResult, includePoints = true): string[] {
  const money = (amount: number) => `${result.currency === 'JPY' ? '¥' : (result.currency ?? '')}${amount.toLocaleString()}`
  const lines = result.itemDetails?.length ? result.itemDetails.map(item => {
    const details: string[] = []
    if (item.unitPrice != null) {
      details.push(`${tSync('receiptAiUnitPrice')} ${money(item.unitPrice)}${item.quantity != null ? ` × ${item.quantity}` : ''}`)
    } else if (item.quantity != null) details.push(`${tSync('receiptAiQuantity')} ${item.quantity}`)
    if (item.lineAmount != null && (item.unitPrice == null || item.quantity != null && item.quantity !== 1 || item.lineAmount !== item.unitPrice)) {
      details.push(`${tSync('receiptAiLineAmount')} ${money(item.lineAmount)}`)
    }
    return [item.name, ...details].join(' · ')
  }) : [...result.items]
  if (result.itemDetails?.length) {
    // A partial structured list must not hide other recognized purchases. Match each
    // product at most once, allowing the legacy line's printed price suffix.
    const remaining = result.itemDetails.map(item => item.name)
    for (const raw of result.items) {
      const text = raw.trim()
      if (!text) continue
      const index = remaining.findIndex(name => text === name
        || text.startsWith(name) && /^[\s¥￥:：・·]/.test(text.slice(name.length)))
      if (index >= 0) remaining.splice(index, 1)
      else lines.push(raw)
    }
  }
  if (result.discountAmount != null && result.discountAmount > 0) lines.push(`${tSync('receiptAiDiscount')}: ${money(result.discountAmount)}`)
  if (result.taxAmount != null) lines.push(`${tSync('receiptAiTax')}: ${money(result.taxAmount)}`)
  if (includePoints) lines.push(...receiptPointLines(result, tSync))
  if (result.paymentMethod?.trim()) lines.push(`${tSync('receiptAiPayment')}: ${result.paymentMethod}`)
  return lines
}
