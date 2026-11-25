import type { RecognizedReceiptFields } from './receiptFieldExtract'

// 日文识别、局部重读及本地回退共享这个等待上限，避免旧版 5 秒静默丢掉结果。
export const RECEIPT_OCR_WAIT_MS = 30_000

export function waitForReceiptFields(
  pending: Promise<RecognizedReceiptFields> | null,
  fallback: () => RecognizedReceiptFields,
  { signal, onTimeout, timeoutMs = RECEIPT_OCR_WAIT_MS }: {
    signal?: AbortSignal
    onTimeout?: () => void
    timeoutMs?: number
  } = {},
): Promise<RecognizedReceiptFields> {
  if (!pending || signal?.aborted) return Promise.resolve(fallback())
  return new Promise(resolve => {
    let settled = false
    const finish = (fields: RecognizedReceiptFields) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      signal?.removeEventListener('abort', abort)
      resolve(fields)
    }
    const abort = () => finish(fallback())
    const timer = setTimeout(() => {
      finish(fallback())
      onTimeout?.()
    }, timeoutMs)
    signal?.addEventListener('abort', abort, { once: true })
    pending.then(finish, () => finish(fallback()))
    if (signal?.aborted) abort()
  })
}
