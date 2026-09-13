/** R-32：小票扫描"全能扫描王"式自动边缘检测+透视纠偏——不再走OCR文字识别那条路
 * (见receiptOcr.ts的说明，日文小票OCR质量不理想，用户明确要求改成保留原始版面的
 * 扫描件样式)。用OpenCV.js(`@techstark/opencv-js`，Apache-2.0开源免费，纯WASM在
 * 浏览器/WebView本地跑，不联网不需要账号)做：灰度化→高斯模糊→Canny边缘检测→
 * 找轮廓→挑最大的四边形轮廓当小票边界→透视变换"拉正"，再做一次基于直方图分位数的
 * 自动对比度拉伸(auto-levels)让画面更接近扫描件的清晰度。
 *
 * 检测不到合适的四边形(比如背景太复杂、小票边缘对比度不够)时不报错、不打断流程，
 * 直接兜底返回没有裁剪的原图(仍然做对比度增强)——"全自动"应该是"尽量做好，做不到
 * 就不裁"，不能因为检测失败就让用户完全扫不了。
 *
 * OpenCV.js这个包的类型声明(dist/src/index.d.ts)只导出了类型名字，跟它运行时
 * 真实的默认导出(整个cv命名空间对象/Promise，见README的用法示例)对不上，是这个包
 * 本身的已知问题；这里用any接管运行时类型，不去跟类型声明较劲，any的范围只收在
 * 这一个文件里，不向外传染 */

export interface ScanResult {
  canvas: HTMLCanvasElement
  /** true=检测到四边形并做了透视纠偏裁剪；false=没检测到，返回的是未裁剪的原图(仍增强过) */
  cropped: boolean
}

// 真机上曾经出现过卡在"処理中…"一直转圈出不来结果的情况——不清楚具体是WASM编译慢
// 还是别的环境问题，先加一个超时兜底，不管什么原因都不能无限等下去。cvReadyPromise
// (真正的加载过程本身)不因为超时就作废重来，只是每次loadCv()调用各自套一层超时——
// 万一只是这次编译慢、后台其实还在正常跑，之后再进扫描弹层时能直接用上已经跑完的结果，
// 不用重新触发一次完整的下载/编译
const CV_LOAD_TIMEOUT_MS = 20000

let cvReadyPromise: Promise<any> | null = null

function getCvReadyPromise(): Promise<any> {
  if (!cvReadyPromise) {
    cvReadyPromise = (async () => {
      const mod: any = await import('@techstark/opencv-js')
      const cvModule = mod.default ?? mod
      if (cvModule instanceof Promise) return cvModule
      if (cvModule.Mat) return cvModule
      return new Promise((resolve) => {
        cvModule.onRuntimeInitialized = () => resolve(cvModule)
      })
    })()
  }
  return cvReadyPromise
}

async function loadCv(): Promise<any> {
  const ready = getCvReadyPromise()
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`OpenCV.js加载超时(${CV_LOAD_TIMEOUT_MS / 1000}秒未完成初始化)`)),
      CV_LOAD_TIMEOUT_MS
    )
  })
  try {
    return await Promise.race([ready, timeout])
  } finally {
    clearTimeout(timer)
  }
}

export function blobToImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = (e) => {
      URL.revokeObjectURL(url)
      reject(e instanceof Event ? new Error('图片加载失败') : e)
    }
    img.src = url
  })
}

function dist(a: [number, number], b: [number, number]): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1])
}

// 四个角点排序成[左上,右上,右下,左下]——x+y最小的是左上、最大的是右下；
// x-y最大的是右上(x大y小)、最小的是左下(x小y大)。标准的透视变换角点排序算法
function orderPoints(flat: number[]): [number, number][] {
  const pts: [number, number][] = [
    [flat[0], flat[1]],
    [flat[2], flat[3]],
    [flat[4], flat[5]],
    [flat[6], flat[7]],
  ]
  const sums = pts.map((p) => p[0] + p[1])
  const diffs = pts.map((p) => p[0] - p[1])
  const tl = pts[sums.indexOf(Math.min(...sums))]
  const br = pts[sums.indexOf(Math.max(...sums))]
  const tr = pts[diffs.indexOf(Math.max(...diffs))]
  const bl = pts[diffs.indexOf(Math.min(...diffs))]
  return [tl, tr, br, bl]
}

function clamp255(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : v
}

// 基于亮度直方图1%/99%分位数的自动对比度拉伸(auto-levels)——比直接取绝对
// min/max更抗噪点干扰，让照片看起来更接近"扫描件"的清晰锐利，不是简单粗暴拉满对比度
function autoEnhance(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const { width, height } = canvas
  const imageData = ctx.getImageData(0, 0, width, height)
  const data = imageData.data
  const hist = new Uint32Array(256)
  for (let i = 0; i < data.length; i += 4) {
    const lum = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2])
    hist[lum]++
  }
  const total = width * height
  const lowCut = total * 0.01
  const highCut = total * 0.01
  let acc = 0
  let lo = 0
  let hi = 255
  for (let i = 0; i < 256; i++) {
    acc += hist[i]
    if (acc >= lowCut) {
      lo = i
      break
    }
  }
  acc = 0
  for (let i = 255; i >= 0; i--) {
    acc += hist[i]
    if (acc >= highCut) {
      hi = i
      break
    }
  }
  if (hi <= lo) return
  const scale = 255 / (hi - lo)
  for (let i = 0; i < data.length; i += 4) {
    data[i] = clamp255((data[i] - lo) * scale)
    data[i + 1] = clamp255((data[i + 1] - lo) * scale)
    data[i + 2] = clamp255((data[i + 2] - lo) * scale)
  }
  ctx.putImageData(imageData, 0, 0)
}

function detectAndWarp(cv: any, imgEl: HTMLImageElement): ScanResult {
  const src = cv.imread(imgEl)
  const gray = new cv.Mat()
  const blurred = new cv.Mat()
  const edges = new cv.Mat()
  const dilated = new cv.Mat()
  const kernel = cv.Mat.ones(3, 3, cv.CV_8U)
  const contours = new cv.MatVector()
  const hierarchy = new cv.Mat()

  let outCanvas: HTMLCanvasElement
  let cropped = false

  try {
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY)
    cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0)
    cv.Canny(blurred, edges, 50, 150)
    cv.dilate(edges, dilated, kernel)
    cv.findContours(dilated, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE)

    const imgArea = src.rows * src.cols
    let bestQuad: number[] | null = null
    let bestArea = 0

    for (let i = 0; i < contours.size(); i++) {
      const cnt = contours.get(i)
      const peri = cv.arcLength(cnt, true)
      const approx = new cv.Mat()
      cv.approxPolyDP(cnt, approx, 0.02 * peri, true)
      if (approx.rows === 4) {
        const area = Math.abs(cv.contourArea(approx))
        // 至少占整张照片20%面积才当作候选，滤掉背景里的小噪点轮廓
        if (area > bestArea && area > imgArea * 0.2) {
          bestArea = area
          const pts: number[] = []
          for (let j = 0; j < 4; j++) {
            pts.push(approx.data32S[j * 2], approx.data32S[j * 2 + 1])
          }
          bestQuad = pts
        }
      }
      approx.delete()
      cnt.delete()
    }

    if (bestQuad) {
      const [tl, tr, br, bl] = orderPoints(bestQuad)
      const maxWidth = Math.max(dist(tl, tr), dist(bl, br))
      const maxHeight = Math.max(dist(tl, bl), dist(tr, br))
      const srcTri = cv.matFromArray(4, 1, cv.CV_32FC2, [...tl, ...tr, ...br, ...bl])
      const dstTri = cv.matFromArray(
        4,
        1,
        cv.CV_32FC2,
        [0, 0, maxWidth, 0, maxWidth, maxHeight, 0, maxHeight]
      )
      const M = cv.getPerspectiveTransform(srcTri, dstTri)
      const dst = new cv.Mat()
      cv.warpPerspective(src, dst, M, new cv.Size(maxWidth, maxHeight))
      outCanvas = document.createElement('canvas')
      cv.imshow(outCanvas, dst)
      cropped = true
      srcTri.delete()
      dstTri.delete()
      M.delete()
      dst.delete()
    } else {
      outCanvas = document.createElement('canvas')
      cv.imshow(outCanvas, src)
    }
  } finally {
    src.delete()
    gray.delete()
    blurred.delete()
    edges.delete()
    dilated.delete()
    kernel.delete()
    contours.delete()
    hierarchy.delete()
  }

  autoEnhance(outCanvas)
  return { canvas: outCanvas, cropped }
}

export async function scanReceiptDocument(photo: Blob): Promise<ScanResult> {
  const cv = await loadCv()
  const imgEl = await blobToImage(photo)
  return detectAndWarp(cv, imgEl)
}
