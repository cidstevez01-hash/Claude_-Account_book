import { createWorker } from 'tesseract.js'
import type { Lang } from '../types'

/** R-32：レシート扫描OCR文字识别——对外只暴露这一个函数，以后要换识别方案只需要
 * 改这个文件内部的实现，外面调用的代码完全不用动——用户明确要求过这层隔离(R-32
 * 需求确认时提的)。
 *
 * ⚠️ 这个模块目前**没有被主流程调用**：Tesseract.js对真实日文小票的识别质量
 * 不理想(容易整段认成乱码)，用户体验后明确要求改成保留原始版面的"全能扫描王"式
 * 扫描(见lib/receiptEdgeDetect.ts + lib/receiptPdf.ts，直接把裁边纠偏后的图片
 * 嵌进PDF，不走文字识别)。这个文件留着不删，是因为以后"自动读取金额填入字段"这个
 * 滞后需求(R-32确认时用户明确说可以先不做)如果要捡回来，这套OCR接口还用得上，
 * 到时候只需要在需要的地方重新import这个函数，不用重新设计解耦层。
 *
 * 当前实现：Tesseract.js(纯前端WASM跑，免费、不用注册账号/绑卡)。语言包按App当前
 * 界面语言选(不是固定日语)——虽然功能叫"扫描レシート"，但App本身中日双语，用户
 * 拍的小票可能是中文的。语言包首次使用要联网下载一次(几MB到十几MB，Tesseract
 * 自己的CDN)，之后会被浏览器缓存住，不是每次识别都要联网。 */
const LANG_MAP: Record<Lang, string> = {
  ja: 'jpn',
  zh: 'chi_sim',
}

export async function recognizeReceiptText(image: Blob, lang: Lang): Promise<string> {
  const worker = await createWorker(LANG_MAP[lang])
  try {
    const {
      data: { text },
    } = await worker.recognize(image)
    return text.trim()
  } finally {
    await worker.terminate()
  }
}
