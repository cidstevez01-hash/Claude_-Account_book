import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { MAX_AI_IMAGE_BYTES } from '../../../shared/receiptAi'
import { getUserScopedClient, getVerifiedUserId, type Bindings } from '../_shared/supabaseClient'
import { HttpError } from '../_shared/errors'
import { recognizeWithOpenAi } from './openai'

const router = new Hono<{ Bindings: Bindings }>()
router.post('/recognize', bodyLimit({ maxSize: 4_100_000,
  onError: () => { throw new HttpError(413, 'RECEIPT_AI_IMAGE_TOO_LARGE') },
}), async c => {
  c.header('Cache-Control', 'no-store')
  const userId = await getVerifiedUserId(getUserScopedClient(c.env, c.req.raw))
  const allowed = (c.env.OPENAI_RECEIPT_USER_IDS ?? '').split(',').map(x => x.trim()).filter(Boolean)
  if (!allowed.includes(userId)) throw new HttpError(403, 'RECEIPT_AI_NOT_ALLOWED')
  if (!c.env.OPENAI_API_KEY || !c.env.OPENAI_RECEIPT_MODEL || !c.env.RECEIPT_AI_RATE_LIMIT) {
    throw new HttpError(503, 'RECEIPT_AI_NOT_CONFIGURED')
  }
  const body = await c.req.json().catch(() => null) as { receiptId?: unknown; image?: unknown } | null
  if (!body || typeof body.receiptId !== 'string' || !/^[a-zA-Z0-9-]{1,128}$/.test(body.receiptId)
    || typeof body.image !== 'string') throw new HttpError(400, 'RECEIPT_AI_INVALID_REQUEST')
  const base64 = body.image.match(/^data:image\/jpeg;base64,([A-Za-z0-9+/]+={0,2})$/)?.[1]
  if (!base64 || base64.length % 4 !== 0 || !base64.startsWith('/9j/')) {
    throw new HttpError(400, 'RECEIPT_AI_INVALID_REQUEST')
  }
  if (base64.length * 3 / 4 > MAX_AI_IMAGE_BYTES) throw new HttpError(413, 'RECEIPT_AI_IMAGE_TOO_LARGE')
  const limit = await c.env.RECEIPT_AI_RATE_LIMIT.limit({ key: userId })
  if (!limit.success) throw new HttpError(429, 'RECEIPT_AI_RATE_LIMITED')
  const fields = await recognizeWithOpenAi(body.image, c.env.OPENAI_API_KEY, c.env.OPENAI_RECEIPT_MODEL)
  // Numeric diagnostics only: no receipt image, item text, account identity or API key.
  console.info('[receipt-ai]', JSON.stringify({ receiptId: body.receiptId, model: c.env.OPENAI_RECEIPT_MODEL,
    rawAmount: fields.rawAmount, amount: fields.amount, currency: fields.currency,
    paymentAmount: fields.paymentAmount, cashTenderedAmount: fields.cashTenderedAmount,
    changeAmount: fields.changeAmount, validationReasons: fields.validationReasons,
    settlementChecks: fields.settlementChecks,
  }))
  return c.json({ receiptId: body.receiptId, fields })
})
export default router
