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
  vm.runInNewContext(code, { exports, console, require(id) {
    if (Object.hasOwn(dependencies, id)) return dependencies[id]
    throw new Error(`Unexpected dependency: ${id}`)
  } }, { filename: file })
  return exports
}
const totals = loadTs('receiptTotal.ts')
let detections = []
const receipt = loadTs('receiptFieldExtract.ts', {
  './receiptTotal': totals,
  './appLog': { logModule() {} },
  '@capacitor-community/image-to-text': { Ocr: { async detectText() { return { textDetections: detections } } } },
})
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
test('原生OCR入口保留坐标并使用新金额判定', async () => {
  const nativeBox = b => ({text:b.text,topLeft:[b.left,b.top],topRight:[b.right,b.top],bottomLeft:[b.left,b.bottom],bottomRight:[b.right,b.bottom]})
  detections = [block('合計',0.1,0.25,0.6,0.58),block('¥2,112',0.7,0.9,0.65,0.57),block('合計5,000円以上のご購入で',0.1,0.9,0.3,0.28)].map(nativeBox)
  const result = await receipt.recognizeReceiptFields('test-only', 'native-entry-fixture')
  assert.equal(result.amount,2112)
  assert.equal(result.receiptId,'native-entry-fixture')
})
