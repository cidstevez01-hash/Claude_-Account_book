const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), ts = require('typescript')
const file = path.join(__dirname, '../src/lib/receiptOcrWait.ts')
function setup() {
  let now = 0, next = 1
  const timers = new Map(), exports = {}
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 },
  }).outputText
  vm.runInNewContext(code, { exports,
    setTimeout(fn, delay) { const id = next++; timers.set(id, { fn, at: now + delay }); return id },
    clearTimeout(id) { timers.delete(id) },
  })
  return { ...exports, timers, advance(ms) {
    now += ms
    for (const [id, timer] of [...timers]) if (timer.at <= now && timers.has(id)) { timers.delete(id); timer.fn() }
  } }
}
const empty = () => ({ receiptId: 'receipt-wait', ocrRows: [], amount: null, date: null, storeName: null, items: [] })
test('超过原来的5秒仍等待；第6秒读到合计后保存，清除超时计时器', async () => {
  const clock = setup()
  let finish, settled = false
  const wait = clock.waitForReceiptFields(new Promise(resolve => { finish = resolve }), empty)
  wait.then(() => { settled = true })
  clock.advance(5001); await Promise.resolve()
  assert.equal(settled, false)
  clock.advance(999); finish({ ...empty(), amount: 1204 })
  assert.equal((await wait).amount, 1204)
  assert.equal(clock.timers.size, 0)
})
test('最终超时仅保存安全的部分字段，取消未完成OCR且忽略迟到金额', async () => {
  const clock = setup(), controller = new AbortController()
  let finish, result
  const wait = clock.waitForReceiptFields(new Promise(resolve => { finish = resolve }),
    () => ({ ...empty(), date: '2026-11-17' }),
    { signal: controller.signal, onTimeout: () => controller.abort() })
  wait.then(fields => { result = fields })
  clock.advance(clock.RECEIPT_OCR_WAIT_MS)
  assert.equal((await wait).amount, null)
  assert.equal(result.date, '2026-11-17')
  assert.equal(controller.signal.aborted, true)
  finish({ ...empty(), amount: 5000 }); await Promise.resolve()
  assert.equal(result.amount, null)
  assert.equal(clock.timers.size, 0)
})
test('关闭弹层立即结束等待并清理计时器', async () => {
  const clock = setup(), controller = new AbortController()
  const wait = clock.waitForReceiptFields(new Promise(() => {}), empty, { signal: controller.signal })
  controller.abort()
  assert.equal((await wait).amount, null)
  assert.equal(clock.timers.size, 0)
})
test('原生识别异常不阻止保存PDF', async () => {
  const clock = setup()
  const fields = await clock.waitForReceiptFields(Promise.reject(Error('OCR failed')), empty)
  assert.equal(fields.amount, null)
  assert.equal(clock.timers.size, 0)
})
