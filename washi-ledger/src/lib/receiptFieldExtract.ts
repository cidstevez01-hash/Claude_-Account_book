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

const TOTAL_KEYWORDS = ['合計', '小計', 'お会計', '御会計', 'total']
// 数字块：允许千分位逗号/日元符号/円字，取一行里最后出现的一段数字当金额
// (日式小票惯例是"合計"标签在左、金额在右，同一行内金额通常是最后一段数字)
const NUMBER_RE = /[¥￥]?[\d,]{2,}[円]?/g

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

  const totalRowIdx = rows.findIndex((r) =>
    TOTAL_KEYWORDS.some((kw) => r.text.toLowerCase().includes(kw.toLowerCase())),
  )
  const amount = totalRowIdx >= 0 ? parseAmountFromRow(rows[totalRowIdx].text) : null

  const storeName = rows[0].text || null
  // 购入明细取店名行之后、金额行之前的中间几行；找不到金额行就取店名行之后的全部
  const itemsEnd = totalRowIdx >= 0 ? totalRowIdx : rows.length
  const items = rows
    .slice(1, itemsEnd)
    .map((r) => r.text)
    .filter((t) => t.length > 0)

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
