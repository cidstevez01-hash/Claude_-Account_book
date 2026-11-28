import { Ocr, type TextDetection } from '@capacitor-community/image-to-text'
import { logModule } from './appLog'
import { isReceiptTotalHint, selectReceiptTotal, type ReceiptTextRow, type ReceiptTotalResult } from './receiptTotal'
import { selectReceiptDate } from './receiptDate'

/** 扫描小票后自动填金额/备注——默认使用 Google ML Kit 日文模型，无法确认金额时
 * 回退 Apple Vision。两种文字识别均在设备上执行，不调用云端收费接口。跟Claude视觉API
 * 那种"直接看懂这是金额/店名/商品"完全不是一回事：这个插件只负责把图片里的文字
 * 识别出来(每条文本自带四角坐标)，金额/店名/购入明细这三项要靠这个文件自己写规则
 * 从这堆文本框里按版面结构拆出来，不是关键词瞎猜——按Y坐标把文本框聚类成"行"，
 * 行内再按X坐标还原从左到右的阅读顺序，店名取最上面一行，金额只取明确的
 * "合計/お会計/Total"标签之后的金额，中间几行当购入明细。这套规则式解析在排版工整的
 * 小票上效果还行，遇到花哨排版/手写小票会出错——这只是自动填表单默认值，
 * 用户确认页面还能改，不是直接存进去不让改
 *
 * 坐标系注意：Vision框架的topLeft/bottomLeft是原生VNRecognizedTextObservation
 * 直通的归一化坐标(0-1)，原点在左下角、Y轴向上——"topLeft"的Y值反而比
 * "bottomLeft"更大，跟网页/图像处理里常见的"左上角原点、Y轴向下"正好相反。
 * 这里全程按"Y值越大越靠上"处理，不要凭直觉套反了方向 */

export interface RecognizedReceiptFields {
  /** 一次确认的小票扫描唯一ID；用于把OCR行与该张小票的合计绑定 */
  receiptId: string
  /** 仅属于此张小票的OCR行，禁止跨扫描混合后再找合计 */
  ocrRows: string[]
  amount: number | null
  date: string | null
  storeName: string | null
  items: string[]
  printedAmount?: number | null
  amountBasis?: 'before_points' | 'after_points' | 'unknown'
  pointsEarned?: number | null
  pointsUsed?: number | null
  pointsUsedAmount?: number | null
  pointsEarnedContext?: 'transaction' | 'promotion' | 'balance' | 'unknown'
  pointsUsedContext?: 'transaction' | 'promotion' | 'balance' | 'unknown'
  amountNeedsReview?: boolean
  /** Exact reviewed note block; undefined uses storeName/items, empty string means add no note. */
  noteText?: string
  /** Explicit edits in the scan review outrank earlier form defaults; automatic results do not. */
  reviewEdits?: { amount: boolean; date: boolean; note?: boolean }
  receiptPointsNote?: string | null
}

export type ReceiptOcrEngine = 'mlkit' | 'vision'
interface ReceiptOcrOptions {
  engine?: ReceiptOcrEngine
  signal?: AbortSignal
}

// 同一原生插件扩展方法，继续兼容项目的 Capacitor 7，不升级整个原生框架。
const mlkitOcr = Ocr as typeof Ocr & {
  detectTextMlkit(options: { base64: string }): Promise<{ textDetections: TextDetection[] }>
}

function cancelled(signal?: AbortSignal) {
  if (signal?.aborted) throw new Error('RECEIPT_SCAN_CANCELLED')
}

// 关闭/重扫后立即释放 JS 等待；原生完成的旧结果不会继续解析或回填。
function abortable<T>(pending: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return pending
  return new Promise((resolve, reject) => {
    const abort = () => reject(new Error('RECEIPT_SCAN_CANCELLED'))
    signal.addEventListener('abort', abort, { once: true })
    pending.then(
      value => { signal.removeEventListener('abort', abort); resolve(value) },
      error => { signal.removeEventListener('abort', abort); reject(error) },
    )
    if (signal.aborted) abort()
  })
}

// 店名/金额行之间夹的不只是"找不到合計时的兜底"这一种情况——真机实测过一张小票
// (京王ストアエクスプレス)店名和合計之间隔着一大段跟购入明细毫无关系的内容
// (电话号/单据标签/店内招聘广告/日期时间/流水号/税额细项/购买件数统计)，这些格式
// 本身固定，能按样式排除，不用等准确识别出"合計"才生效——所以这份列表不止服务于
// "totalRowIdx<0"这一种兜底分支，对totalRowIdx>=0时也会应用(见下面extractReceiptFields)
const METADATA_ROW_PATTERNS = [
  /\bTEL/i, // 常见写法"TEL03-5355-0607"电话号紧跟在后面没有分隔符，不能用\bTEL\b(数字也是\w，L和0之间不构成词边界)
  /\bFAX/i,
  /0\d{1,4}-\d{1,4}-\d{3,4}/, // 日本电话号码格式，哪怕前面没有"TEL"字样(真机实测case
  // "Q 03-6379-1271"——"Q"应该是电话图标被OCR认错了，电话号本身格式很固定，不用管前缀)
  /\bT\d{9,}\b/, // インボイス登録番号
  /\d{4}\/\d{1,2}\/\d{1,2}/, // 日期(西式斜杠格式)
  /\d{4}年\d{1,2}月\d{1,2}日/, // 日期(日式汉字格式，比如"2026年9月20日")
  /\d{1,2}:\d{2}/, // 时间(西式冒号格式)
  /\d{1,2}時\d{1,2}分/, // 时间(日式汉字格式，比如"16時41分")
  /^#/, // 交易流水号/レジ番号一类多以#开头(语言修复前OCR乱码常见开头)
  /[:：]\s*\d{5,}/, // "取引No/責任者番号"这类流水号/编号行，共同特征是冒号后跟一长串数字
  // (比如真机实测过的"取7488 責：106964105")，正常商品价格行不会用冒号这种标点
  /\bNo[.:：]?\s*\d+/i, // "レシートNo:2118"这类单据编号——不看数字位数(上面冒号+数字那条
  // 门槛是5位以上，这种编号可能没那么长)，专认"No"这个标签本身
  /^\d{4,}(\s+\d{4,})*$/, // 整行只有一组或几组纯数字、没有其他文字，是终端/流水号这类
  // 编码(真机实测case"000061906 000061906")，正常商品行至少会有商品名文字
  /^[<＜(（]?(領収書|領収証|レシート)[>＞)）]?$/, // 单据本身的固定标签词，独立成一行
  // (不是店名/商品名的一部分)——"領収書"(收据)和"領収証"是两个不同汉字但同义的常见
  // 写法(真机实测case"＜領収書＞"，外面还包了一层全角尖括号)，两种写法+可选的
  // 一层括号都要认
  /アルバイト|募集|お待ちしております/, // 店内招聘广告——"アルバイト募集中"/"求人"这类
  // 固定用语+"応募お待ちしております"结尾语，这段广告文字在真机实测的小票上会占好几行
  /\d{1,2}時[~～]\d{1,2}時/, // 招聘广告里的班次时间段(比如"6時～10時")，正常商品价格
  // 不会是这种"时段"格式，能顺带覆盖招聘广告里没有直接命中上面关键词的班次说明行
  /外税|内税|消費税|対象額|税額/, // 税额细项行，不是购入的商品——"外税額 8% ¥64"这类有
  // 前缀的能靠"外税"本身匹配，真机还实测过裸写"8%税額 ¥8"(没有外税/内税/消費税这些
  // 前缀词)，补上"税額"本身兜底这种写法
  /小計/, // "合計"存在时"小計"自己那一行不会被选成totalRowIdx(因为合計優先级更高)，
  // 但它本身也不是购入明细，同样要从items里过滤掉，不是只在"没有合計、小計本身
  // 被选中当金额行"这一种情况下才处理(那种情况下小計行会被itemsEnd边界天然排除，
  // 两种情况互不冲突)
  /買上点数/, // "買上点数 3点"这类购买件数统计，是汇总信息不是某件具体商品
]
function isMetadataRow(text: string): boolean {
  return METADATA_ROW_PATTERNS.some((re) => re.test(text))
}

// 日文假名/汉字的Unicode范围(平假名+片假名+CJK统一表意文字+半角片假名)，用来判断
// 一行文字里有没有日文字符——店名候选行判断要用
const CJK_RE = /[぀-ヿ一-鿿･-ﾟ]/

/** 店名一般取最上面一行，但真机实测过一张小票的最上面一行是纯英文/罗马字招牌名
 * (比如"Kero store express"，应该是OCR把"Keio"读错了)，真正的日文店名+分店名
 * 在它下面那一行("京王ストアエクスプレス 明大前店")——这种情况下店名取第二行。
 * 不能无条件"永远取第二行"：另一张真机实测过的小票第一行本身就是正确店名
 * "まいばすけっと"、第二行是分店名"松原2丁目店"，那张小票如果也无脑取第二行，
 * 店名会变成分店名，是错的。用"第一行有没有日文字符"来区分这两种真实场景——
 * 第一行是纯英文/数字/符号(没有任何日文字符)、且第二行确实有日文字符时，才认为
 * 第一行是"店名之外的招牌英文名"，改取第二行 */
function pickStoreNameIndex(rows: ReceiptTextRow[]): number {
  if (rows.length > 1 && !CJK_RE.test(rows[0].text) && CJK_RE.test(rows[1].text)) {
    return 1
  }
  return 0
}
// 找不到金额行时购入明细最多保留这么多行——识别质量差到连"合計"都读不出来，
// 说明整体不可靠，与其把一整张小票文字原样倒进备注，不如少截一点让用户自己补
const MAX_FALLBACK_ITEMS = 8

function yCenter(box: TextDetection): number {
  return (box.topLeft[1] + box.bottomLeft[1]) / 2
}
function xCenter(box: TextDetection): number {
  return (box.topLeft[0] + box.topRight[0]) / 2
}
function boxHeight(box: TextDetection): number {
  return Math.abs(box.topLeft[1] - box.bottomLeft[1]) || 0.02
}

/** 按Y坐标把文本框聚类成行——同一行内的框Y中心差距应该在半个字高以内，
 * 不是简单按Y值相等分组(OCR识别出来的坐标不会真的完全对齐) */
type ReceiptTextDetection = TextDetection & { candidates?: { text: string; confidence: number }[] }

function groupIntoRows(boxes: ReceiptTextDetection[]): ReceiptTextRow[] {
  // Y值越大越靠上，降序排列就是从上到下的阅读顺序
  const sorted = [...boxes].sort((a, b) => yCenter(b) - yCenter(a))
  const clusters: { ySum: number; boxes: ReceiptTextDetection[] }[] = []
  for (const box of sorted) {
    const last = clusters[clusters.length - 1]
    const lastY = last ? last.ySum / last.boxes.length : null
    const sharedHeight = last ? Math.min(boxHeight(box), ...last.boxes.map(boxHeight)) : boxHeight(box)
    if (last && lastY != null && Math.abs(yCenter(box) - lastY) < sharedHeight * 0.6) {
      last.boxes.push(box)
      last.ySum += yCenter(box)
    } else {
      clusters.push({ ySum: yCenter(box), boxes: [box] })
    }
  }
  return clusters.map((c) => {
    const orderedBoxes = [...c.boxes].sort((a, b) => xCenter(a) - xCenter(b))
    return {
      y: c.ySum / c.boxes.length,
      text: orderedBoxes.map((b) => b.text).join(' ').trim(),
      blocks: orderedBoxes.map((box) => ({
        text: box.text,
        left: Math.min(box.topLeft[0], box.bottomLeft[0]),
        right: Math.max(box.topRight[0], box.bottomRight[0]),
        top: Math.max(box.topLeft[1], box.topRight[1]),
        bottom: Math.min(box.bottomLeft[1], box.bottomRight[1]),
        candidates: box.candidates,
      })),
    }
  })
}

/** 从识别出的文本行里拆金额/店名/购入明细——见文件头注释的整体思路 */
export function extractReceiptFields(
  rows: ReceiptTextRow[],
  receiptId: string,
  total = selectReceiptTotal(rows),
): RecognizedReceiptFields {
  const ocrRows = rows.map((row) => row.text)
  if (rows.length === 0) return { receiptId, ocrRows, amount: null, date: null, storeName: null, items: [] }

  const totalRowIdx = total.rowIndex
  const amount = total.amount
  logModule('receipt', `合計判定 receiptId=${receiptId}: 金额=${amount ?? '未确认'}, 原因=${total.reason}`, 'info', {
    row: totalRowIdx,
    candidates: JSON.stringify(total.candidates),
    rejectedRows: JSON.stringify(total.rejectedRows),
  })

  const storeNameIdx = pickStoreNameIndex(rows)
  const storeName = rows[storeNameIdx]?.text || null
  // 购入明细取店名行之后(店名占了第0行还是第0-1两行，看storeNameIdx)、金额行之前
  // 的中间几行；找不到金额行就取店名行之后的全部(这种情况下再叠加下面的metadata
  // 过滤+数量上限兜底)
  const itemsEnd = totalRowIdx >= 0 ? totalRowIdx : rows.length
  let items = rows
    .slice(storeNameIdx + 1, itemsEnd)
    .map((r) => r.text)
    .filter((t) => t.length > 0 && !isMetadataRow(t))
  if (totalRowIdx < 0) items = items.slice(0, MAX_FALLBACK_ITEMS)

  return { receiptId, ocrRows, amount, date: selectReceiptDate(rows), storeName, items }
}

// Vision 的置信度仅用来触发复读；有独立结算证据时优先采用结算证据。
const MIN_TOTAL_CONFIDENCE = 0.65

function needsTotalRetry(total: ReceiptTotalResult): boolean {
  if (total.amount == null) return true
  if (total.corroborated) return false
  return total.candidates.filter(({ amount }) => amount === total.amount)
    .every(({ confidence, hasAlternative }) => hasAlternative || (confidence ?? 1) < MIN_TOTAL_CONFIDENCE)
}

export interface ReceiptScanBand {
  bottom: number
  top: number
}

function findTotalBand(rows: ReceiptTextRow[], total: ReceiptTotalResult): ReceiptScanBand | null {
  const candidateRows = new Set(total.candidates.map(({ rowIndex }) => rowIndex))
  const hints = rows.filter((row, i) => candidateRows.has(i) || isReceiptTotalHint(row.text)
    || row.blocks?.some(({ candidates }, index, blocks) =>
      candidates?.slice(1).some(({ text }) =>
        isReceiptTotalHint(blocks.map((block, j) => j === index ? text : block.text).join(' ')),
      ),
    ))
  const blocks = hints.flatMap(({ blocks }) => blocks ?? [])
  if (!blocks.length) return null
  const pad = Math.min(0.08, Math.max(0.025, ...blocks.map(({ top, bottom }) => (top - bottom) * 1.5)))
  const bottom = Math.max(0, Math.min(...blocks.map((block) => block.bottom)) - pad)
  const top = Math.min(1, Math.max(...blocks.map((block) => block.top)) + pad)
  return top - bottom <= 0.55 ? { bottom, top } : null
}

async function detectRows(base64: string, band: ReceiptScanBand | undefined, engine: ReceiptOcrEngine, signal?: AbortSignal): Promise<ReceiptTextRow[]> {
  cancelled(signal)
  const result = await abortable(engine === 'mlkit'
    ? mlkitOcr.detectTextMlkit({ base64 }) : Ocr.detectText({ base64 }), signal)
  cancelled(signal)
  const detections: ReceiptTextDetection[] = result.textDetections
  const boxes = band ? detections.map((box) => {
    const project = ([x, y]: [number, number]): [number, number] => [x, band.bottom + y * (band.top - band.bottom)]
    return {
      ...box, topLeft: project(box.topLeft), topRight: project(box.topRight),
      bottomLeft: project(box.bottomLeft), bottomRight: project(box.bottomRight),
    }
  }) : detections
  return groupIntoRows(boxes)
}

async function retryTotal(
  rows: ReceiptTextRow[],
  initial: ReceiptTotalResult,
  crop: (band: ReceiptScanBand) => { imageDataUrl: string; band: ReceiptScanBand },
  receiptId: string,
  engine: ReceiptOcrEngine,
  signal?: AbortSignal,
): Promise<ReceiptTotalResult> {
  const uncertain = initial.amount == null ? initial : { ...initial, amount: null, reason: '合计候选不确定，需要确认' }
  const region = findTotalBand(rows, initial)
  if (!region) return uncertain
  try {
    const { imageDataUrl, band } = crop(region)
    const reread = await detectRows(imageDataUrl, band, engine, signal)
    const rereadCandidates = selectReceiptTotal(reread).candidates
    if (!rereadCandidates.length) return uncertain
    const merged = [...rows.filter(({ y }) => y < band.bottom || y > band.top), ...reread].sort((a, b) => b.y - a.y)
    const result = selectReceiptTotal(merged)
    logModule('receipt', `合计局部重读 receiptId=${receiptId}: ${result.amount ?? '未确认'}，${result.reason}`)
    if (result.amount == null || !rereadCandidates.some(({ amount }) => amount === result.amount)) return uncertain
    // 新旧识别均读到同一合计，或重读结果通过独立结算核对，才填入不确定的金额。
    const repeated = initial.candidates.length > 0
      && initial.candidates.every(({ amount }) => amount === result.amount)
      && rereadCandidates.some(({ amount, confidence, hasAlternative }) =>
        amount === result.amount && !hasAlternative && (confidence ?? 0) >= MIN_TOTAL_CONFIDENCE,
      )
    if (!result.corroborated && !repeated) return uncertain
    const row = merged[result.rowIndex]
    const originalIndex = rows.findIndex(({ y }) => Math.abs(y - row.y) <= 0.01)
    const rowIndex = originalIndex >= 0 ? originalIndex : rows.findIndex(({ y }) => y < row.y)
    return { ...result, rowIndex: rowIndex >= 0 ? rowIndex : rows.length }
  } catch (error) {
    logModule('receipt', `合计局部重读失败 receiptId=${receiptId}: ${String(error)}`, 'warn')
    return uncertain
  }
}

/** web端(沙盒/浏览器预览)没有这个原生能力，插件会抛错——调用方要兜底，返回
 * 全空结果而不是抛错中断整个扫描确认流程(自动填表单是锦上添花，失败不能挡住
 * 用户正常保存这条记录) */
export async function recognizeReceiptFields(
  imageDataUrl: string,
  receiptId: string,
  crop?: (band: ReceiptScanBand) => { imageDataUrl: string; band: ReceiptScanBand },
  onRetry?: (fields: RecognizedReceiptFields) => void,
  { engine = 'mlkit', signal }: ReceiptOcrOptions = {},
): Promise<RecognizedReceiptFields> {
  const primary = await recognizeWithEngine(imageDataUrl, receiptId, crop, onRetry, engine, signal)
  if (engine === 'vision' || primary.amount != null || signal?.aborted) return primary
  // 仅对同一张原图重试，每个引擎各自解析，不拼接两套 OCR 行或跨小票求合计。
  onRetry?.(primary)
  logModule('receipt', `ML Kit 未确认合计，回退 Vision receiptId=${receiptId}`)
  const fallback = await recognizeWithEngine(imageDataUrl, receiptId, crop, onRetry, 'vision', signal)
  return fallback.amount != null || primary.ocrRows.length === 0 ? fallback : primary
}

async function recognizeWithEngine(
  imageDataUrl: string,
  receiptId: string,
  crop: ((band: ReceiptScanBand) => { imageDataUrl: string; band: ReceiptScanBand }) | undefined,
  onRetry: ((fields: RecognizedReceiptFields) => void) | undefined,
  engine: ReceiptOcrEngine,
  signal?: AbortSignal,
): Promise<RecognizedReceiptFields> {
  try {
    cancelled(signal)
    const started = performance.now()
    logModule('receipt', `调用本地 OCR engine=${engine} receiptId=${receiptId}`)
    const rows = await detectRows(imageDataUrl, undefined, engine, signal)
    logModule('receipt', `OCR原始行 receiptId=${receiptId} engine=${engine} (${rows.length}行): ${rows.map((r) => r.text).join(' | ')}`)
    const initial = selectReceiptTotal(rows)
    let fields = extractReceiptFields(rows, receiptId, initial)
    if (crop && needsTotalRetry(initial)) {
      onRetry?.({ ...fields, amount: null })
      fields = extractReceiptFields(rows, receiptId, await retryTotal(rows, initial, crop, receiptId, engine, signal))
    }
    cancelled(signal)
    logModule('receipt',
      `OCR解析 receiptId=${receiptId} engine=${engine} elapsedMs=${Math.round(performance.now() - started)}: 金额=${fields.amount}, 日期=${fields.date}, 店名=${fields.storeName}, 明细${fields.items.length}件`,
    )
    return fields
  } catch (e) {
    if (!signal?.aborted) logModule('receipt', `OCR失败 receiptId=${receiptId} engine=${engine}: ${e instanceof Error ? e.message : String(e)}`, 'warn')
    return { receiptId, ocrRows: [], amount: null, date: null, storeName: null, items: [] }
  }
}
