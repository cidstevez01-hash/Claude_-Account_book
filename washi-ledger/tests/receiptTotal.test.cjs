const assert = require('node:assert/strict')
const { test } = require('node:test')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

// 金额解析回归不依赖 iOS、相机、账号或网络；直接执行生产 TypeScript 的解析函数。
function loadTs(name, dependencies = {}) {
  const file = path.join(__dirname, '../src/lib', name)
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 },
  }).outputText
  const exports = {}
  vm.runInNewContext(code, { exports, console, performance, require(id) {
    if (Object.hasOwn(dependencies, id)) return dependencies[id]
    throw new Error(`Unexpected dependency: ${id}`)
  } }, { filename: file })
  return exports
}
const totals = loadTs('receiptTotal.ts')
const dates = loadTs('receiptDate.ts', { './date': loadTs('date.ts') })
const detectionsByImage = new Map()
const mlkitDetectionsByImage = new Map()
const ocrCalls = []
const extraction = loadTs('receiptFieldExtract.ts', {
  './receiptTotal': totals,
  './receiptDate': dates,
  './appLog': { logModule() {} },
  '@capacitor-community/image-to-text': { Ocr: { async detectTextMlkit({ base64 }) {
    ocrCalls.push(['mlkit', base64])
    assert.ok(mlkitDetectionsByImage.has(base64), `Unexpected ML Kit scan of ${base64}`)
    const result = await mlkitDetectionsByImage.get(base64)
    if (result instanceof Error) throw result
    return { textDetections: result }
  }, async detectText({ base64 }) {
    ocrCalls.push(['vision', base64])
    assert.ok(detectionsByImage.has(base64), `Unexpected scan of ${base64}`)
    const result = detectionsByImage.get(base64)
    if (result instanceof Error) throw result
    return { textDetections: result }
  } } },
})
// 既有置信度/候选测试明确验证 Vision 路径；新增测试验证真实默认的 ML Kit 路径。
const receipt = { ...extraction, recognizeReceiptFields(image, id, crop, onRetry) {
  return extraction.recognizeReceiptFields(image, id, crop, onRetry, { engine: 'vision' })
} }
const rows = lines => lines.map((text, index) => ({ text, y: 1 - index * 0.02 }))
const check = (name, lines, expected) => test(name, () => {
  const result = receipt.extractReceiptFields(rows(['店舗', ...lines]), name)
  assert.equal(result.amount, expected)
  assert.equal(result.receiptId, name)
})

// 来自用户日志的结算字段；不保存会员信息、交易编号、签名链接或商品明细。
const realCases = [
  ['2112：排除票尾满5000送积分广告', ['小計 ¥1,956', '(外8% 対象 ¥1,956)', '外8% ¥156', '合計 ¥2,112', '支払合計 ¥2,112', '8%税込額 ¥2,112', '(うち8%税額 ¥156)', 'メルペイ ¥2,112', 'お買上点数 8点', '決済金額 ¥2,112', 'オンラインストア', '合計5,000円(本体価格)以上のご購入で(配達料除く)', '1,000進呈！ ポイント'], 2112],
  ['257：支付246和积分11不覆盖合计', ['小計 ¥238', '(外税 8%対象額 ¥238)', '外税額 8% ¥19', '買上点数 1点', '合計 ¥257', '(税率8%対象額 ¥257)', '(内消費税等 8% ¥19)', '楽天ポイント 11P', 'コード決済 ¥246', 'お釣り ¥0', '決済金額 ¥246'], 257],
  ['967：不选预收1000', ['小計 ¥896', '(外税対象額 ¥896)', '外税額 8% ¥71', '買上点数 2点', '合計 ¥967', 'お預り ¥1,000', '(内消費税等 ¥71)', 'お釣り ¥33'], 967],
  ['370：合计与件数同一行，全角货币', ['割引前合計 ¥353', 'F 食料品3/103割引 -10', '小計 ¥343', '8%対象 ¥343 税 27', '合計/ 2点 ¥370', 'お預り ￥1,070', 'お釣り ¥700'], 370],
  ['370：相同票面第二次OCR', ['割引前合計 ¥353', '小計 ¥343', '8%対象 ¥343 税 27', '合計/ 2点 ¥370', 'お預り ¥1,070', 'お釣り ¥700'], 370],
  ['4982：内税不重复相加', ['小計 ¥4,613', '内税率8%税額 ¥4,982', '税率8%税額 ¥369', '(税合計 ¥369)', '合計 ¥4,982', 'クレジット ¥4,982', 'お釣り ¥0'], 4982],
  ['621：外税后合计', ['小計 ¥575', '(外税 8%対象額 ¥575)', '外税額 8% ¥46', '買上点数 3点', '合計 ¥621', '(税率8%対象額 ¥621)', 'コード決済 ¥621', '決済金額 ¥621'], 621],
  ['550：不选小计500及税额50', ['小計 5点 ¥500', '10%税抜対象額 ¥500', '10%税額 ¥50', '合計 ¥550', 'メルペイ ¥550', 'お釣り ¥0', 'ご利用金額 ¥550'], 550],
  ['550：重复扫描独立ID', ['小計 5点 ¥500', '10%対象額 ¥500', '10%税額 ¥50', '合計 ¥550', 'メルペイ ¥550', 'ご利用金額 ¥550'], 550],
  ['299：不选扣积分后支付272', ['10%対象 1点 ¥299', '(内税10%対象税額 ¥27)', '合計 ¥299', 'ポイント利用', 'SmartCode ¥272', '決済合計 ¥299', '利用ポイント 27P', '取引金額 ¥272'], 299],
  ['386：有优惠的真实小计和外税', ['割引 20% -90', '小計 ¥358', '(外税 8%対象額 ¥358)', '外税額 8% ¥28', '買上点数 1点', '合計 ¥386', 'コード決済 ¥386'], 386],
  ['626：其他小票不混入', ['小計 ¥580', '(外税8%対象額 ¥580)', '外税額 8% ¥46', '買上点数 1点', '合計 ¥626', '決済金額 ¥626'], 626],
  ['1031：带优惠的外税票', ['割引 20% -48', '小計 ¥955', '(外税 8%対象額 ¥955)', '外税額 8% ¥76', '買上点数 4点', '合計 ¥1,031', 'コード決済 ¥1,031'], 1031],
  ['974：合计含斜杠和件数', ['割引前合計 ¥929', '小計 ¥902', '8%対象 ¥902 税 72', '合計/ 2点 ¥974', 'お預り ¥1,000', 'お釣り ¥26'], 974],
  ['128：个位数税额', ['小計 ¥119', '(外税 8%対象額 ¥119)', '外税額 8% ¥9', '買上点数 1点', '合計 ¥128', 'コード決済 ¥128'], 128],
  ['1990：不选扣积分后1987', ['10%対象 1点 ¥1,990', '(内税10%対象税額 ¥180)', '合計 ¥1,990', 'ポイント利用 ¥3', 'SmartCode ¥1,987', '決済合計 ¥1,990', '取引金額 ¥1,987'], 1990],
  ['2420：损坏的小计不替代真实合计', ['小計 1点 ¥2,42L', '合計 ¥2,420', '(内、消費税等 ¥220)', '(10%対象 ¥2,420税 ¥220)', 'メルペイ ¥2,420'], 2420],
  ['416：不选重复商品码10100', ['外8 010100 商品 ¥238', '外8 010100 商品 ¥148', '小計 ¥386', '外税額 8% ¥30', '合計 ¥416', 'お預り ¥416', 'お釣り ¥0'], 416],
  ['1204：小计14是拆行乱码，完整小计1115在下一行', ['小計 14', '¥1,115', '(外税8%対象額 ¥1,115)', '外税額 8% ¥89', '買上点数 3点', '合計 ¥1,204', '(税率8%対象額 ¥1,204)', 'コード決済 ¥1,204'], 1204],
  ['384：合计504串行，裸金额384与小计外税相符', ['小計 ¥356', '(外税文:額 ¥356)', '外税額 8% ¥28', '買上点数 2点', '¥384', '合計 ¥504', 'お預り (内消費税等 ¥28)', '¥120', 'お釣り'], 384],
  ['430：标签漏读但票面金额与明确外税算式相符', ['小計 ¥399', '(外税文:額 ¥399)', '外税額 8% ¥31', '買上点数 1点', '¥430', 'お預り ¥1,000', '(内消費税等 ¥31)', 'お釣り ¥570'], 430],
  ['537：合计后多出士字，必须核对结算', ['小計 ¥498', '(外税 8%対象額 ¥498', '外税額 8% ¥39', '買上点数 1片', '合計士 ¥537', '(税率8%対象額 ¥537', 'コード決済 ¥53'], 537],
  ['1880：人数前缀及全角逗号', ['1品 小計 ¥1,880', '(10%課税対象 ¥1，880)', '1名様 合計 ¥1，880', 'お預り明細 メルペイ ¥1,880', 'お預り合計 ¥1，880'], 1880],
]
for (const args of realCases) check(...args)

check('仅广告阈值，金额留空', ['合計5,000円(本体価格)以上のご購入で(配達料除く)', '1,000進呈！'], null)
check('广告条件不是只屏蔽特定5000数值', ['合計 ¥416', '合計8,000円以上のお買い上げで割引'], 416)
check('税合计不覆盖真实总计', ['合計 ¥416', '消費税合計 ¥30'], 416)
check('全角金额及标签空格', ['合 計 ￥４１６'], 416)
check('不选商品件数', ['合計 ¥416', '合計点数 12点'], 416)
check('英文合计和件数分开', ['TOTAL ¥416', 'Total items 12'], 416)
check('装饰框合计', ['【合計】 ¥416'], 416)
check('总计前税制注释', ['合計(税込8%) ¥416'], 416)
check('个位数金额', ['合計 ¥9'], 9)
check('OCR数字夹字不能截断', ['合計 ¥4l6'], null)
check('没有合计不以小计兜底', ['小計 ¥386', '外税額 ¥30'], null)
check('金额后有未解释流水号时留空', ['合計 ¥416 取引No 12345'], null)
check('金额不从税率猜测', ['合計 8% ¥416'], null)
check('真实合计不同且无交叉证据时留空', ['合計 ¥416', '支払合計 ¥500'], null)
check('重复同一错误金额不等于更可信', ['合計 ¥416', '合計 ¥500', '合計 ¥500'], null)
check('不同语义的合计与结算合计可核对', ['合計 ¥416', '支払合計 ¥416', '合計 ¥500'], 416)
check('明确外税算式可排除错误候选', ['小計 ¥386', '外税額 8% ¥30', '合計 ¥416', '合計 ¥500'], 416)
check('外税与合计冲突不擅改成算式结果', ['小計 ¥386', '外税額 8% ¥30', '合計 ¥500'], null)
check('内税不能与小计再次相加', ['小計 ¥416', '内税額 ¥30', '合計 ¥416'], 416)
check('外税后存在优惠，不能套简单加法', ['小計 ¥1000', '外税額 10% ¥100', 'クーポン -100', '合計 ¥1000'], 1000)
check('不同税率外税分项求和', ['小計 ¥1000', '外税額 8% ¥40', '外税額 10% ¥50', '合計 ¥1090'], 1090)
check('税额总计与分项不重复相加', ['小計 ¥1000', '外税額 8% ¥40', '外税額 10% ¥50', '外税額 ¥90', '合計 ¥1090'], 1090)
check('小计裸数字没有货币证据，不用它否决完整总计', ['小計 14', '外税額 8% ¥89', '合計 ¥1204'], 1204)
check('没有票面总额时不直接用算式生成金额', ['小計 ¥399', '外税額 8% ¥31', 'お預り ¥1000', 'お釣り ¥570'], null)
check('无标签的错额不会按算式擅改', ['小計 ¥399', '外税額 8% ¥31', '¥500', 'お預り ¥1000', 'お釣り ¥570'], null)
check('无标签金额不从预收或找零区取值', ['小計 ¥399', '外税額 8% ¥31', 'お預り', '¥430', 'お釣り ¥0'], null)
check('优惠之后的裸金额无法套小计加税', ['小計 ¥399', '外税額 8% ¥31', 'クーポン -10', '¥430'], null)
check('广告正文不变成裸金额候选', ['小計 ¥399', '外税額 8% ¥31', '合計430円以上のご購入で', 'お預り ¥1000'], null)
check('标签残缺时缺乏结算证据留空', ['合計士 ¥537'], null)
check('其他文本前缀不被人数兼容误识别', ['会員番号1 合計 ¥1880'], null)
check('小计金额拆行与标签的完整数值冲突时留空', ['小計 ¥400', '¥399', '外税額 8% ¥31', '合計 ¥430'], null)

function block(text, left, right, top, bottom) { return { text, left, right, top, bottom } }
test('标签与大字号金额分在两行时按坐标关联', () => {
  const result = totals.selectReceiptTotal([
    { text: '¥2,112', y: 0.61, blocks: [block('¥2,112', 0.7, 0.9, 0.65, 0.57)] },
    { text: '合計', y: 0.59, blocks: [block('合計', 0.1, 0.25, 0.6, 0.58)] },
  ])
  assert.equal(result.amount, 2112)
  assert.equal(result.candidates[0].source, 'position')
})
test('标签右侧有两个不同金额时不凭距离猜测', () => {
  const result = totals.selectReceiptTotal([
    { text: '合計', y: 0.59, blocks: [block('合計', 0.1, 0.25, 0.6, 0.58)] },
    { text: '¥2,112 ¥5,000', y: 0.6, blocks: [block('¥2,112', 0.4, 0.6, 0.62, 0.57), block('¥5,000', 0.7, 0.9, 0.62, 0.57)] },
  ])
  assert.equal(result.amount, null)
})
test('其他行/标签左边的数字不与总计关联', () => {
  const result = totals.selectReceiptTotal([
    { text: '合計', y: 0.59, blocks: [block('合計', 0.4, 0.6, 0.6, 0.58)] },
    { text: '¥5000', y: 0.8, blocks: [block('¥5000', 0.7, 0.9, 0.81, 0.79)] },
    { text: '¥2112', y: 0.59, blocks: [block('¥2112', 0.1, 0.3, 0.6, 0.58)] },
  ])
  assert.equal(result.amount, null)
})
function nativeBox(b, confidence = 0.95, alternative) {
  return {
    text: b.text,
    topLeft: [b.left, b.top], topRight: [b.right, b.top],
    bottomLeft: [b.left, b.bottom], bottomRight: [b.right, b.bottom],
    candidates: [{ text: b.text, confidence }, ...(alternative ? [{ text: alternative, confidence: 0.4 }] : [])],
  }
}
test('原生OCR入口保留坐标并使用新金额判定', async () => {
  detectionsByImage.set('test-only', [
    block('合計', 0.1, 0.25, 0.6, 0.58),
    block('¥2,112', 0.7, 0.9, 0.65, 0.57),
    block('合計5,000円以上のご購入で', 0.1, 0.9, 0.3, 0.28),
  ].map(b => nativeBox(b)))
  const result = await receipt.recognizeReceiptFields('test-only', 'native-entry-fixture')
  assert.equal(result.amount,2112)
  assert.equal(result.receiptId,'native-entry-fixture')
})

for (const [label, textRows, expected] of [
  ['OCR 日文日期与尾部活动期限', ['2026年11月07日(土)11:08 レジ0631', 'キャンペーン期限 2026/12/10'], '2026-11-07'],
  ['明确的交易日期优先', ['2026/12/10', '取引日時', '２０２６／１１／０７ １１：０８'], '2026-11-07'],
  ['日文年号', ['購入日 令和8年11月7日'], '2026-11-07'],
  ['无效日期', ['取引日 2026/02/29'], null],
  ['两个交易日期冲突', ['取引日 2026-11-07', '決済日 2026-11-08'], null],
  ['分行期限标签', ['クーポン有効期限', '2026/12/10'], null],
  ['活动日期区间', ['2026/11/01 ～ 2026/11/30'], null],
]) {
  test(label, () => assert.equal(dates.selectReceiptDate(rows(textRows)), expected))
}

test('低置信度的合计仅重读一次，保留第一次识别的日期', async () => {
  const full = 'low-confidence'
  const cropped = 'low-confidence-crop'
  detectionsByImage.set(full, [
    nativeBox(block('2026年11月7日(土)11:08', 0.1, 0.9, 0.9, 0.88)),
    nativeBox(block('合計 ¥2,112', 0.1, 0.9, 0.5, 0.48), 0.45),
    nativeBox(block('合計5,000円以上のご購入で', 0.1, 0.9, 0.24, 0.22)),
  ])
  detectionsByImage.set(cropped, [nativeBox(block('合計 ¥2,112', 0.1, 0.9, 0.63, 0.37))])
  let attempts = 0
  let partial
  const result = await receipt.recognizeReceiptFields(full, 'low-confidence-id', band => {
    attempts++
    assert.ok(band.bottom > 0.24 && band.top < 0.88)
    return { imageDataUrl: cropped, band }
  }, fields => { partial = fields })
  assert.equal(attempts, 1)
  assert.equal(partial.amount, null)
  assert.equal(partial.date, '2026-11-07')
  assert.equal(result.amount, 2112)
  assert.equal(result.date, '2026-11-07')
})

test('同一票面两次结果仍有金额候选冲突时留空', async () => {
  const full = 'alternatives'
  const cropped = 'alternatives-crop'
  detectionsByImage.set(full, [nativeBox(block('合計 ¥2,112', 0.1, 0.9, 0.51, 0.49), 0.95, '合計 ¥2,172')])
  detectionsByImage.set(cropped, [nativeBox(block('合計 ¥2,112', 0.1, 0.9, 0.63, 0.37), 0.95, '合計 ¥2,172')])
  let attempts = 0
  const result = await receipt.recognizeReceiptFields(full, 'alternatives-id', band => {
    attempts++
    return { imageDataUrl: cropped, band }
  })
  assert.equal(attempts, 1)
  assert.equal(result.amount, null)
})

test('金额重读失败仍返回日期与小票ID', async () => {
  const full = 'retry-error'
  const cropped = 'retry-error-crop'
  detectionsByImage.set(full, [
    nativeBox(block('2026/11/07 11:08', 0.1, 0.9, 0.8, 0.78)),
    nativeBox(block('合計 ¥2,112', 0.1, 0.9, 0.51, 0.49), 0.45),
  ])
  detectionsByImage.set(cropped, new Error('OCR failed'))
  const result = await receipt.recognizeReceiptFields(full, 'retry-error-id', band => ({ imageDataUrl: cropped, band }))
  assert.equal(result.amount, null)
  assert.equal(result.date, '2026-11-07')
  assert.equal(result.receiptId, 'retry-error-id')
})

test('原生识别入口处理拆行小计且保留日期和独立ID', async () => {
  const image = 'split-subtotal-1204'
  const lines = ['2026年11月17日(火曜日)19時51分', '小計 14', '¥1,115', '(外税8%対象額 ¥1,115)', '外税額 8% ¥89', '買上点数 3点', '合計 ¥1,204']
  detectionsByImage.set(image, lines.map((text, i) =>
    nativeBox(block(text, 0.1, 0.9, 0.9 - i * 0.04, 0.88 - i * 0.04)),
  ))
  const result = await receipt.recognizeReceiptFields(image, 'split-subtotal-id', () => {
    assert.fail('已通过外税结算核对的合计无需重读')
  })
  assert.equal(result.amount, 1204)
  assert.equal(result.date, '2026-11-17')
  assert.equal(result.receiptId, 'split-subtotal-id')
})

test('残缺标签也能定位局部重读，两轮相同金额且标签修正后可确认', async () => {
  const image = 'damaged-total-537'
  const cropped = 'damaged-total-537-crop'
  const lines = ['小計 ¥498', '外税額 8% ¥39', '買上点数 1片', '合計士 ¥537']
  // 首轮税额不可确认，原图的合计标签仍能定位局部区域。
  detectionsByImage.set(image, lines.map((text, i) =>
    nativeBox(block(text.replace('¥39', '¥3g'), 0.1, 0.9, 0.8 - i * 0.04, 0.78 - i * 0.04)),
  ))
  let attempts = 0
  const result = await receipt.recognizeReceiptFields(image, 'damaged-total-id', band => {
    attempts++
    // 复读识别出完整合计字段，与首轮候选金额一致。
    detectionsByImage.set(cropped, [nativeBox(block('合計 ¥537', 0.1, 0.9, 0.6, 0.4))])
    return { imageDataUrl: cropped, band }
  })
  assert.equal(attempts, 1)
  assert.equal(result.amount, 537)
})

function mlkitLines(lines) {
  return lines.map((text, i) => ({ text,
    topLeft: [0.1, 0.9 - i * 0.045], topRight: [0.9, 0.9 - i * 0.045],
    bottomLeft: [0.1, 0.88 - i * 0.045], bottomRight: [0.9, 0.88 - i * 0.045],
  }))
}

test('默认走 ML Kit，完整合计可回填且促销5000不会覆盖2112', async () => {
  const image = 'mlkit-primary-2112'
  mlkitDetectionsByImage.set(image, mlkitLines(['店舗', '2026年11月7日(土)11:08', '小計 ¥1,956',
    '外8% ¥156', '合計 ¥2,112', 'オンラインストア', '合計5,000円以上のご購入で']))
  const fields = await extraction.recognizeReceiptFields(image, 'mlkit-primary')
  assert.equal(fields.amount, 2112)
  assert.equal(fields.date, '2026-11-07')
  assert.deepEqual(ocrCalls.filter(([, key]) => key === image), [['mlkit', image]])
})

test('ML Kit 没有置信度仍能按保留的坐标关联不同字号的标签和金额', async () => {
  const image = 'mlkit-spatial'
  mlkitDetectionsByImage.set(image, [
    { ...nativeBox(block('合計', 0.1, 0.25, 0.6, 0.58)), candidates: undefined },
    { ...nativeBox(block('¥1,204', 0.7, 0.9, 0.65, 0.57)), candidates: undefined },
  ])
  const fields = await extraction.recognizeReceiptFields(image, 'mlkit-spatial-id')
  assert.equal(fields.amount, 1204)
  assert.deepEqual(ocrCalls.filter(([, key]) => key === image), [['mlkit', image]])
})

test('ML Kit 插件报错时用同一原图回退 Vision，保持独立小票ID', async () => {
  const image = 'mlkit-error-fallback'
  mlkitDetectionsByImage.set(image, new Error('native unavailable'))
  detectionsByImage.set(image, mlkitLines(['店舗', '小計 ¥1,115', '外税額 8% ¥89', '合計 ¥1,204']))
  const fields = await extraction.recognizeReceiptFields(image, 'fallback-id')
  assert.equal(fields.amount, 1204)
  assert.equal(fields.receiptId, 'fallback-id')
  assert.deepEqual(ocrCalls.filter(([, key]) => key === image), [['mlkit', image], ['vision', image]])
})

test('ML Kit 无合计时回退并整套采用 Vision 结果，不混入其他引擎的行', async () => {
  const image = 'mlkit-null-fallback'
  mlkitDetectionsByImage.set(image, mlkitLines(['MLKit店舗', '合計5,000円以上のご購入で']))
  detectionsByImage.set(image, mlkitLines(['Vision店舗', '小計 ¥498', '外税額 8% ¥39', '合計士 ¥537']))
  const fields = await extraction.recognizeReceiptFields(image, 'fallback-null-id')
  assert.equal(fields.amount, 537)
  assert.equal(fields.storeName, 'Vision店舗')
  assert(!fields.ocrRows.some(text => text.includes('MLKit店舗')))
})

test('两个引擎都不能确认时不选最大数，保留 ML Kit 日期和备注', async () => {
  const image = 'mlkit-both-unconfirmed'
  mlkitDetectionsByImage.set(image, mlkitLines(['店舗', '2026/11/17 19:51', '小計 ¥100', '合計5000円以上のご購入で']))
  detectionsByImage.set(image, mlkitLines(['別店舗', '合計 ¥200', '合計 ¥300']))
  const fields = await extraction.recognizeReceiptFields(image, 'both-unconfirmed')
  assert.equal(fields.amount, null)
  assert.equal(fields.date, '2026-11-17')
  assert.equal(fields.storeName, '店舗')
})

test('关闭或重扫会中断旧识别等待，不启动回退和后续回填回调', async () => {
  const image = 'mlkit-cancelled'
  let complete
  mlkitDetectionsByImage.set(image, new Promise(resolve => { complete = resolve }))
  const controller = new AbortController()
  let callbacks = 0
  const pending = extraction.recognizeReceiptFields(image, 'cancelled-id', undefined,
    () => { callbacks++ }, { signal: controller.signal })
  controller.abort()
  const fields = await pending
  complete(mlkitLines(['合計 ¥5,000']))
  assert.equal(fields.amount, null)
  assert.equal(callbacks, 0)
  assert.deepEqual(ocrCalls.filter(([, key]) => key === image), [['mlkit', image]])
})

test('已经取消的扫描不调用任何原生引擎', async () => {
  const controller = new AbortController()
  controller.abort()
  const fields = await extraction.recognizeReceiptFields('cancelled-before-start', 'before-start', undefined, undefined,
    { signal: controller.signal })
  assert.equal(fields.amount, null)
  assert.equal(ocrCalls.some(([, key]) => key === 'cancelled-before-start'), false)
})
