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
function pickStoreNameIndex(rows: Row[]): number {
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
