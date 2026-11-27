import { tSync } from './i18nSync'
import { apiClient } from './apiClient'
import { MAX_AI_IMAGE_BYTES, parseReceiptAiResult, type ReceiptAiResult } from '../../shared/receiptAi'
import type { RecognizedReceiptFields } from './receiptFieldExtract'

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
  return { result, fields: {
    receiptId, amount: result.amount, date: result.date, storeName: result.storeName,
    items: receiptAiNoteLines(result), ocrRows: [result.totalEvidence, result.paymentEvidence].filter((x): x is string => !!x),
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
  return {
    receiptId: incoming.receiptId,
    amount: incoming.amount ?? previous.amount,
    date: incoming.date ?? previous.date,
    storeName: incoming.storeName?.trim() ? incoming.storeName : previous.storeName,
    items: incoming.items.length ? incoming.items : previous.items,
    ocrRows: incoming.ocrRows.length ? incoming.ocrRows : previous.ocrRows,
  }
}

/** Only purchase details and relevant adjustments enter notes, never cash tender/change. */
export function receiptAiNoteLines(result: ReceiptAiResult): string[] {
  const lines = [...result.items]
  const money = (amount: number) => `${result.currency === 'JPY' ? '¥' : (result.currency ?? '')}${amount.toLocaleString()}`
  if (result.discountAmount != null && result.discountAmount > 0) lines.push(`${tSync('receiptAiDiscount')}: ${money(result.discountAmount)}`)
  if (result.taxAmount != null) lines.push(`${tSync('receiptAiTax')}: ${money(result.taxAmount)}`)
  if (result.pointsUsedAmount != null && result.pointsUsedAmount > 0) lines.push(`${tSync('receiptAiPoints')}: ${money(result.pointsUsedAmount)}`)
  if (result.paymentMethod?.trim()) lines.push(`${tSync('receiptAiPayment')}: ${result.paymentMethod}`)
  return lines
}
