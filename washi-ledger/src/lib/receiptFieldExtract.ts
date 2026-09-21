import { Ocr, type TextDetection } from '@capacitor-community/image-to-text'
import { logIfEnabled } from './appLog'

/** 扫描小票后自动填金额/备注——免费方案，用iOS Vision框架(通过
 * @capacitor-community/image-to-text，纯本地识别不联网不花钱)。跟Claude视觉API
 * 那种"直接看懂这是金额/店名/商品"完全不是一回事：这个插件只负责把图片里的文字
 * 识别出来(每条文本自带四角坐标)，金额/店名/购入明细这三项要靠这个文件自己写规则
 * 从这堆文本框里按版面结构拆出来，不是关键词瞎猜——按Y坐标把文本框聚类成"行"，
 * 行内再按X坐标还原从左到右的阅读顺序，店名取最上面一行，金额找含"合計/小計/
 * お会計"字样那一行里的数字，中间几行当购入明细。这套规则式解析在排版工整的
 * 小票上效果还行，遇到花哨排版/手写小票会出错——这只是自动填表单默认值，
 * 用户确认页面还能改，不是直接存进去不让改
 *
 * 坐标系注意：Vision框架的topLeft/bottomLeft是原生VNRecognizedTextObservation
 * 直通的归一化坐标(0-1)，原点在左下角、Y轴向上——"topLeft"的Y值反而比
 * "bottomLeft"更大，跟网页/图像处理里常见的"左上角原点、Y轴向下"正好相反。
 * 这里全程按"Y值越大越靠上"处理，不要凭直觉套反了方向 */

export interface RecognizedReceiptFields {
  amount: number | null
  storeName: string | null
  items: string[]
}

// 按优先级找金额行，不是按"从上到下第一个匹配到关键词的行"——日式小票真实顺序
// 通常是"小計"(税前)先出现、"合計"(税后)在它下面，如果不分优先级直接找第一个
// 匹配的关键词，会先撞上"小計"就停，拿到税前金额而不是税后合計(真机实测复现过
// 这个bug：138的"小計"被当成了金额，正确的应该是加了消费税之后的"合計")。
// "合計"最优先，找不到再依次退而求其次，"小計"放最后垫底
const TOTAL_KEYWORD_PRIORITY = ['合計', 'お会計', '御会計', 'total', '小計']
// 数字块：允许千分位逗号/日元符号/円字，取一行里最后出现的一段数字当金额
// (日式小票惯例是"合計"标签在左、金额在右，同一行内金额通常是最后一段数字)
const NUMBER_RE = /[¥￥]?[\d,]{2,}[円]?/g

function findTotalRowIndex(rows: Row[]): number {
  for (const kw of TOTAL_KEYWORD_PRIORITY) {
    const idx = rows.findIndex((r) => r.text.toLowerCase().includes(kw.toLowerCase()))
    if (idx >= 0) return idx
  }
  return -1
}

// 兜底保险：找不到"合計"行时(比如那一行被识别成乱码、关键词没匹配上)，购入明细会
// 退化成"店名行之后的所有行"——这时候电话/传真号、インボイス登録番号(T+13位数字，
// 日本发票登记号真实格式)、日期时间戳这类页眉页脚信息不该被当成商品塞进备注，
// 这几个格式本身就很固定，能直接按样式排除，不用等准确识别出"合計"才生效
const METADATA_ROW_PATTERNS = [
  /\bTEL/i, // 常见写法"TEL03-5355-0607"电话号紧跟在后面没有分隔符，不能用\bTEL\b(数字也是\w，L和0之间不构成词边界)
  /\bFAX/i,
  /\bT\d{9,}\b/, // インボイス登録番号
  /\d{4}\/\d{1,2}\/\d{1,2}/, // 日期
  /\d{1,2}:\d{2}/, // 时间
  /^#/, // 交易流水号/レジ番号一类多以#开头(语言修复前OCR乱码常见开头)
  /[:：]\s*\d{5,}/, // "取引No/責任者番号"这类流水号/编号行，共同特征是冒号后跟一长串数字
  // (比如真机实测过的"取7488 責：106964105")，正常商品价格行不会用冒号这种标点
]
function isMetadataRow(text: string): boolean {
  return METADATA_ROW_PATTERNS.some((re) => re.test(text))
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

interface Row {
  y: number
  text: string
}

/** 按Y坐标把文本框聚类成行——同一行内的框Y中心差距应该在半个字高以内，
 * 不是简单按Y值相等分组(OCR识别出来的坐标不会真的完全对齐) */
function groupIntoRows(boxes: TextDetection[]): Row[] {
  // Y值越大越靠上，降序排列就是从上到下的阅读顺序
  const sorted = [...boxes].sort((a, b) => yCenter(b) - yCenter(a))
  const clusters: { ySum: number; boxes: TextDetection[] }[] = []
  for (const box of sorted) {
    const last = clusters[clusters.length - 1]
    const lastY = last ? last.ySum / last.boxes.length : null
    if (last && lastY != null && Math.abs(yCenter(box) - lastY) < boxHeight(box) * 0.6) {
      last.boxes.push(box)
      last.ySum += yCenter(box)
    } else {
      clusters.push({ ySum: yCenter(box), boxes: [box] })
    }
  }
  return clusters.map((c) => {
    const orderedBoxes = [...c.boxes].sort((a, b) => xCenter(a) - xCenter(b))
    return { y: c.ySum / c.boxes.length, text: orderedBoxes.map((b) => b.text).join(' ').trim() }
  })
}

function parseAmountFromRow(text: string): number | null {
  const matches = text.match(NUMBER_RE)
  if (!matches || matches.length === 0) return null
  const last = matches[matches.length - 1].replace(/[¥￥円,]/g, '')
  const n = Number(last)
  return Number.isFinite(n) && n > 0 ? n : null
}

/** 从识别出的文本行里拆金额/店名/购入明细——见文件头注释的整体思路 */
export function extractReceiptFields(rows: Row[]): RecognizedReceiptFields {
  if (rows.length === 0) return { amount: null, storeName: null, items: [] }

  const totalRowIdx = findTotalRowIndex(rows)
  const amount = totalRowIdx >= 0 ? parseAmountFromRow(rows[totalRowIdx].text) : null

  const storeName = rows[0].text || null
  // 购入明细取店名行之后、金额行之前的中间几行；找不到金额行就取店名行之后的全部
  // (这种情况下再叠加下面的metadata过滤+数量上限兜底)
  const itemsEnd = totalRowIdx >= 0 ? totalRowIdx : rows.length
  let items = rows
    .slice(1, itemsEnd)
    .map((r) => r.text)
    .filter((t) => t.length > 0 && !isMetadataRow(t))
  if (totalRowIdx < 0) items = items.slice(0, MAX_FALLBACK_ITEMS)

  return { amount, storeName, items }
}

/** web端(沙盒/浏览器预览)没有这个原生能力，插件会抛错——调用方要兜底，返回
 * 全空结果而不是抛错中断整个扫描确认流程(自动填表单是锦上添花，失败不能挡住
 * 用户正常保存这条记录) */
export async function recognizeReceiptFields(imageDataUrl: string): Promise<RecognizedReceiptFields> {
  try {
    logIfEnabled('调用Ocr.detectText()识别小票文字')
    const { textDetections } = await Ocr.detectText({ base64: imageDataUrl })
    logIfEnabled(`Ocr.detectText()识别出${textDetections.length}个文本块`)
    const rows = groupIntoRows(textDetections)
    return extractReceiptFields(rows)
  } catch (e) {
    logIfEnabled(`Ocr.detectText()失败(web端预期内会走到这里): ${e instanceof Error ? e.message : String(e)}`, 'error')
    return { amount: null, storeName: null, items: [] }
  }
}
