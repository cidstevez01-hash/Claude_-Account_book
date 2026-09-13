import { jsPDF } from 'jspdf'

/** R-32：把OCR识别(并经用户确认/修正过)的レシート文字排版成一份PDF存档。
 *
 * 没有直接用jsPDF自带的doc.text()——jsPDF内置字体(Helvetica等)是纯拉丁字符集，
 * 不带中日文字形，直接写中文/日文字符会渲染成空白/方块。要让jsPDF正确画中日文，
 * 常规做法是额外打包一个TTF字体文件(几MB起，Noto Sans JP这类CJK字体单独一个字重
 * 就不小)转base64塞进bundle里，为了这一个功能把包体积推大不划算。
 *
 * 改成先用<canvas>把文字画出来(Canvas 2D API的字体渲染走的是WebView/浏览器自己的
 * 系统字体，Capacitor iOS WebView本身自带完整的日文字形，不需要额外打包字体)，
 * 再把这张canvas整体当一张图片塞进PDF(doc.addImage)。代价是这份PDF里的文字不是
 * "可选中/可搜索"的矢量文字，是一张排好版的图——但这份PDF本来就只是给人眼看的
 * 存档凭证，不是要拿去做全文搜索，这个取舍是合理的；且纯文字排版(不含照片纹理/
 * 光影噪点)压成JPEG后体积很小(通常几十KB)，仍然比直接存原始照片小一个数量级，
 * 没有违背"レシート存档不要用图片、要小"这个初衷。 */

const CANVAS_WIDTH = 720
const PADDING = 32
const LINE_HEIGHT = 30
const FONT = '20px -apple-system, "Noto Sans JP", "Noto Sans SC", sans-serif'
const TITLE_FONT = 'bold 26px -apple-system, "Noto Sans JP", "Noto Sans SC", sans-serif'

/** 按canvas实际可用宽度换行——不能简单按字符数切，中日文一个字符的实际像素宽度
 * 跟半角数字/字母差很多，用ctx.measureText()逐字符量真实宽度来定行 */
function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = []
  for (const rawLine of text.split('\n')) {
    if (rawLine === '') {
      lines.push('')
      continue
    }
    let current = ''
    for (const ch of rawLine) {
      const next = current + ch
      if (ctx.measureText(next).width > maxWidth && current !== '') {
        lines.push(current)
        current = ch
      } else {
        current = next
      }
    }
    lines.push(current)
  }
  return lines
}

export interface ReceiptPdfMeta {
  /** 记账页面上这条记录当时的日期(YYYY-MM-DD)，跟レシート上印的日期不一定完全
   * 一致(比如凌晨记的账)，只是给这份存档加个可读的抬头，不是权威数据来源 */
  entryDate: string
}

export function buildReceiptPdf(recognizedText: string, meta: ReceiptPdfMeta): Blob {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('无法创建canvas 2D上下文')

  const maxTextWidth = CANVAS_WIDTH - PADDING * 2
  ctx.font = FONT
  const bodyLines = wrapLines(ctx, recognizedText, maxTextWidth)

  const titleHeight = 56
  const height = titleHeight + bodyLines.length * LINE_HEIGHT + PADDING * 2

  canvas.width = CANVAS_WIDTH
  canvas.height = height

  // 二次拿ctx——改canvas.width/height会清空并重置2D上下文的所有状态(包括font)，
  // 上面量宽度时设的font在这里已经失效，必须重新setFont一遍才能真的生效
  ctx.fillStyle = '#fff8f5' // 跟App"washi"纸面同一个米白底色，不是纯白
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  ctx.fillStyle = '#231a13'
  ctx.font = TITLE_FONT
  ctx.textBaseline = 'top'
  ctx.fillText(`レシート · ${meta.entryDate}`, PADDING, PADDING)

  ctx.font = FONT
  let y = PADDING + titleHeight
  for (const line of bodyLines) {
    ctx.fillText(line, PADDING, y)
    y += LINE_HEIGHT
  }

  const imgData = canvas.toDataURL('image/jpeg', 0.85)
  const doc = new jsPDF({ unit: 'px', format: [canvas.width, canvas.height] })
  doc.addImage(imgData, 'JPEG', 0, 0, canvas.width, canvas.height)
  return doc.output('blob')
}
