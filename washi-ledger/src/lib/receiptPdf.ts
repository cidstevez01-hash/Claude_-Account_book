import { jsPDF } from 'jspdf'

/** R-32：把原生文档扫描器(见lib/receiptCamera.ts)返回的レシート扫描图整张嵌入
 * 一份PDF存档——保留小票原本的版面(金额/数量对齐这些视觉信息)，不走OCR文字识别
 * 重新排版这条路(日文小票OCR质量不理想，实测过)。
 *
 * 拍摄的原始照片本身不会被存下来，只有原生扫描器已经裁边+透视校正后的图会生成
 * PDF存档，再压成JPEG，实际体积通常是几十到两三百KB，比直接存手机拍的原图
 * (通常几MB)小一个数量级，没有违背"不要存一张很大的图片"这个初衷 */

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
