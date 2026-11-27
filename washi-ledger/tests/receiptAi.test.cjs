const assert = require('node:assert/strict'), { test } = require('node:test')
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), ts = require('typescript')
const workerRequire = require('node:module').createRequire(path.resolve(__dirname, '../worker/package.json'))
const { Hono } = workerRequire('hono')
function load(file, deps = {}, extra = {}) {
  const exports = {}
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.resolve(__dirname, '..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports, Error, console, setTimeout, clearTimeout, AbortController, ...extra,
    require(id) { if (Object.hasOwn(deps, id)) return deps[id]; throw Error('Unexpected '+id) },
  })
  return exports
}
const contract = load('shared/receiptAi.ts'), { HttpError } = load('worker/src/_shared/errors.ts')
const fields = overrides => ({ amount: 258, currency: 'JPY', date: '2026-11-26', storeName: 'FamilyMart',
  items: ['グリルチキンスモーク ¥258'], paymentAmount: 258, taxAmount: 19,
  totalEvidence: '合計 ¥258', paymentEvidence: 'メルペイ支払 ¥258', uncertain: false, ...overrides })
const deps = { '../../../shared/receiptAi': contract, '../_shared/errors': { HttpError } }
const provider = (fetch, extra) => load('worker/src/receipts/openai.ts', deps, { fetch, ...extra }).recognizeWithOpenAi
const json = data => new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } })
const envelope = data => ({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(data) }] }] })
test('FamilyMart total 258 with payment evidence is accepted', () => assert.equal(contract.parseReceiptAiResult(fields()).amount, 258))
test('uncertain, foreign-currency and unevidenced amounts remain empty', () => {
  for (const overrides of [{ uncertain: true }, { currency: 'USD' }, { totalEvidence: null }, { amount: 258.5 }]) {
    const result = contract.parseReceiptAiResult(fields(overrides))
    assert.equal(result.amount, null); assert.equal(result.uncertain, true)
  }
})
test('malformed types, impossible dates and invalid numbers are rejected', () => {
  for (const overrides of [{ amount: '258' }, { amount: -1 }, { amount: NaN }, { date: '2026-02-30' },
    { date: 'nonsense' }, { items: 'item' }, { items: [1] }, { currency: 'YEN1' }, { uncertain: 'false' }]) {
    assert.throws(() => contract.parseReceiptAiResult(fields(overrides)), /RECEIPT_AI_INVALID_RESULT/)
  }
})
test('provider sends image with strict schema, no storage and bounded output', async () => {
  let sent
  const recognize = provider(async (url, init) => { sent = { url, init }; return json(envelope(fields())) })
  assert.equal((await recognize('data:image/jpeg;base64,/9j/AAAA', 'test-key', 'test-model')).amount, 258)
  const body = JSON.parse(sent.init.body)
  assert.equal(sent.url, 'https://api.openai.com/v1/responses'); assert.equal(body.model, 'test-model')
  assert.equal(body.store, false); assert.equal(body.max_output_tokens, 4000)
  assert.equal(body.text.format.strict, true); assert.equal(body.input[0].content[1].type, 'input_image')
  assert(!sent.init.body.includes('test-key'))
})
test('refusal, incomplete output, malformed JSON and upstream errors return safe errors', async () => {
  for (const [response, code] of [
    [json({ status: 'completed', output: [{ type: 'message', content: [{ type: 'refusal' }] }] }), 'UNREADABLE'],
    [json({ status: 'incomplete' }), 'INVALID_RESULT'],
    [json({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: 'bad' }] }] }), 'INVALID_RESULT'],
    [new Response('secret upstream body', { status: 401 }), 'UNAVAILABLE'],
    [new Response('', { status: 429 }), 'RATE_LIMITED'],
  ]) await assert.rejects(provider(async () => response)('image', 'key', 'model'), new RegExp('RECEIPT_AI_'+code))
})
test('provider timeout aborts fetch', async () => {
  const recognize = provider((url, init) => new Promise((resolve, reject) => init.signal.addEventListener('abort', () => reject(Error('aborted')))),
    { setTimeout: fn => setTimeout(fn, 5) })
  await assert.rejects(recognize('image', 'key', 'model'), /RECEIPT_AI_TIMEOUT/)
})
function appFor(recognize = async () => fields()) {
  const router = load('worker/src/receipts/router.ts', {
    ...deps, hono: { Hono }, 'hono/body-limit': workerRequire('hono/body-limit'),
    '../_shared/supabaseClient': { getUserScopedClient: (env, req) => req,
      getVerifiedUserId: async req => {
        if (req.headers.get('Authorization') !== 'Bearer valid') throw new HttpError(401, 'invalid session')
        return 'allowed-user'
      } }, './openai': { recognizeWithOpenAi: recognize },
  }).default
  const app = new Hono().route('/receipts', router)
  app.onError((error, c) => c.json({ error: error.message }, error.status || 500))
  return app
}
const env = () => ({ OPENAI_API_KEY: 'test', OPENAI_RECEIPT_MODEL: 'test-model', OPENAI_RECEIPT_USER_IDS: 'allowed-user',
  RECEIPT_AI_RATE_LIMIT: { async limit() { return { success: true } } } })
const payload = overrides => ({ receiptId: 'receipt-id', image: 'data:image/jpeg;base64,/9j/AAAA', ...overrides })
const req = (app, environment, data = payload(), token = 'valid') => app.request('/receipts/recognize', {
  method: 'POST', headers: { Authorization: 'Bearer '+token, 'Content-Type': 'application/json' }, body: JSON.stringify(data),
}, environment)
test('authentication and allowlist prevent unauthorized paid calls', async () => {
  let calls = 0
  const app = appFor(async () => { calls++; return fields() })
  assert.equal((await req(app, env(), payload(), 'invalid')).status, 401)
  assert.equal((await req(app, { ...env(), OPENAI_RECEIPT_USER_IDS: '' })).status, 403)
  assert.equal(calls, 0)
})
test('missing configuration, malformed/oversize input and rate limits prevent paid calls', async () => {
  let calls = 0
  const app = appFor(async () => { calls++; return fields() })
  for (const key of ['OPENAI_API_KEY', 'OPENAI_RECEIPT_MODEL', 'RECEIPT_AI_RATE_LIMIT']) {
    assert.equal((await req(app, { ...env(), [key]: undefined })).status, 503)
  }
  for (const data of [payload({ image: 'https://example.com/x' }), payload({ image: 'data:image/jpeg;base64,invalid' }), payload({ receiptId: '../bad' })]) {
    assert.equal((await req(app, env(), data)).status, 400)
  }
  assert.equal((await req(app, env(), payload({ image: 'a'.repeat(4_100_001) }))).status, 413)
  assert.equal((await req(app, { ...env(), RECEIPT_AI_RATE_LIMIT: { async limit() { return { success: false } } } })).status, 429)
  assert.equal(calls, 0)
})
test('success binds fields to receipt ID with no-store response', async () => {
  const res = await req(appFor(), env())
  assert.equal(res.status, 200); assert.equal(res.headers.get('Cache-Control'), 'no-store')
  const data = await res.json(); assert.equal(data.receiptId, 'receipt-id'); assert.equal(data.fields.amount, 258)
})
const clientFor = (post, document) => load('src/lib/receiptAi.ts', {
  './apiClient': { apiClient: { post } }, '../../shared/receiptAi': contract, './i18nSync': { tSync: key => key },
}, { document })
test('AI image uses a separate resized canvas and never changes PDF source dimensions', () => {
  const source = { width: 4000, height: 8000 }, draws = [], qualities = []
  const copy = { width: 0, height: 0, getContext: () => ({ drawImage(...args) { draws.push(args) } }),
    toDataURL(type, quality) { qualities.push([type,quality]); return 'data:image/jpeg;base64,/9j/AAAA' } }
  const client = clientFor(() => assert.fail('encoding must not call API'), { createElement: () => copy })
  client.receiptAiImage(source)
  assert.deepEqual(source, { width: 4000, height: 8000 })
  assert.equal(copy.width, 1600); assert.equal(copy.height, 3200)
  assert.equal(draws[0][0], source); assert.deepEqual(qualities,[['image/jpeg',0.9]])
})
test('client refuses wrong receipt IDs and aborted responses', async () => {
  const document = { createElement: () => ({ getContext: () => ({ drawImage() {} }), toDataURL: () => 'data:image/jpeg;base64,/9j/AAAA' }) }
  const canvas = { width: 300, height: 600 }
  await assert.rejects(clientFor(async () => ({ receiptId: 'other', fields: fields() }), document)
    .recognizeReceiptAi(canvas, 'current', new AbortController().signal), /RECEIPT_AI_INVALID_RESULT/)
  const controller = new AbortController()
  await assert.rejects(clientFor(async () => { controller.abort(); return { receiptId: 'current', fields: fields() } }, document)
    .recognizeReceiptAi(canvas, 'current', controller.signal), /RECEIPT_AI_INVALID_RESULT/)
})

test('OK receipt: total 1531, tendered 2031 and change 500 preserve the clear total', () => {
  const result = contract.parseReceiptAiResult(fields({ amount:1531, paymentAmount:null,
    cashTenderedAmount:2031, changeAmount:500, totalEvidence:'合計/ 5点 ¥1,531' }))
  assert.equal(result.amount,1531); assert.equal(result.rawAmount,1531)
  assert(result.settlementChecks.includes('CASH_TENDER_MINUS_CHANGE_MATCHES_TOTAL'))
  assert.equal(result.validationReasons.length,0)
})
test('different payment from points, mixed tender or legacy tendered value cannot erase explicit total', () => {
  for (const paymentAmount of [2031, 1000, 1504]) {
    const result=contract.parseReceiptAiResult(fields({amount:1531,paymentAmount}))
    assert.equal(result.amount,1531);assert.equal(result.uncertain,false)
    assert(result.settlementChecks.includes('PAYMENT_DIFFERS_FROM_TOTAL'))
  }
})
test('rejected totals retain raw numeric diagnostics across server and client validation', () => {
  const result=contract.parseReceiptAiResult(fields({amount:1531,uncertain:true}))
  const again=contract.parseReceiptAiResult(result)
  assert.equal(again.amount,null);assert.equal(again.rawAmount,1531)
  assert(again.validationReasons.includes('TOTAL_UNCERTAIN'))
})
test('AI empty fields preserve earlier confirmed fields, valid AI fields can improve them', () => {
  const client=clientFor(()=>{}, {})
  const before={receiptId:'same',amount:1531,date:'2026-11-27',storeName:'old',items:['item'],ocrRows:['old']}
  const after={receiptId:'same',amount:null,date:null,storeName:'OK',items:[],ocrRows:[]}
  const merged=client.mergeReceiptFields(before,after)
  assert.equal(merged.amount,1531);assert.equal(merged.date,'2026-11-27');assert.equal(merged.storeName,'OK')
  assert.equal(merged.items[0],'item')
  assert.throws(()=>client.mergeReceiptFields(before,{...after,receiptId:'different'}),/INVALID_RESULT/)
})
test('notes include purchase adjustments and payment method, exclude tendered cash and change', () => {
  const client=clientFor(()=>{}, {})
  const lines=client.receiptAiNoteLines(fields({amount:1531,paymentAmount:null,cashTenderedAmount:2031,changeAmount:500,
    taxAmount:113,discountAmount:39,pointsUsedAmount:10,paymentMethod:'cash'}))
  const note=lines.join(' | ')
  assert(note.includes('113'));assert(note.includes('39'));assert(note.includes('10'));assert(note.includes('cash'))
  assert(!note.includes('2,031'));assert(!note.includes('500'))
})
