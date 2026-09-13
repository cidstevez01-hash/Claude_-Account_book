import { jsPDF } from 'jspdf'

/** R-32：把边缘纠偏+增强后的レシート扫描图(见lib/receiptEdgeDetect.ts)整张嵌入
 * 一份PDF存档——保留小票原本的版面(金额/数量对齐这些视觉信息)，不再走OCR文字识别
 * 重新排版这条路(日文小票OCR质量不理想，见receiptOcr.ts的说明)。
 *
 * 拍摄的原始照片本身不会被存下来，只有这张裁边+增强后的扫描图会生成PDF存档——
 * 经过Canny边缘检测裁掉背景、只保留小票本体，再压成JPEG，实际体积通常是几十到
 * 两三百KB，比直接存手机拍的原图(通常几MB)小一个数量级，没有违背"不要存一张
 * 很大的图片"这个初衷 */

export interface ReceiptPdfMeta {
  /** 记账页面上这条记录当时的日期(YYYY-MM-DD)，写进PDF的文档属性(标题)里，
   * 方便在文件管理器/PDF阅读器里一眼认出是哪天的凭证，不影响PDF可见内容 */
  entryDate: string
}

export function buildReceiptPdf(canvas: HTMLCanvasElement, meta: ReceiptPdfMeta): Blob {
  const imgData = canvas.toDataURL('image/jpeg', 0.85)
  const doc = new jsPDF({ unit: 'px', format: [canvas.width, canvas.height] })
  doc.addImage(imgData, 'JPEG', 0, 0, canvas.width, canvas.height)
  doc.setProperties({ title: `レシート・${meta.entryDate}` })
  return doc.output('blob')
}
