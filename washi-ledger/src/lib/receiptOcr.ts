import { createWorker } from 'tesseract.js'
import type { Lang } from '../types'

/** R-32：レシート扫描识别——对外只暴露这一个函数，App里所有用到扫描的地方(记一笔/
 * 编辑/复制页)只认它，不知道也不关心背后具体用的是哪家OCR。以后要换识别方案(比如
 * 换回云端视觉API、或者哪天真做了可配置开关)，只需要改这个文件内部的实现，外面
 * 调用的代码完全不用动——用户明确要求过这层隔离(R-32需求确认时提的)。
 *
 * 当前实现：Tesseract.js(纯前端WASM跑，免费、不用注册账号/绑卡、离线可用)。代价是
 * 识别准确率不如付费视觉大模型，真实皱巴巴/褪色的小票容易认错字——所以调用方(见
 * ReceiptScanSheet.tsx)在拿到结果后一定要让用户过一遍、能手动改，不能直接当最终
 * 结果存档。
 *
 * 语言包按App当前界面语言选(不是固定日语)——虽然功能叫"扫描レシート"，但App本身
 * 中日双语，用户拍的小票可能是中文的。语言包首次使用要联网下载一次(几MB到十几MB，
 * Tesseract自己的CDN)，之后会被浏览器缓存住，不是每次识别都要联网。 */
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
