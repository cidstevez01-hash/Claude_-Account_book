/** R-32：小票扫描边缘检测+透视纠偏——独立Worker线程版，真正的执行体。
 *
 * 真机日志实测确认：`import('@techstark/opencv-js')`这一步本身(内嵌约8MB
 * base64编码的WASM数据，模块加载时要同步解码成二进制)会把调用它的那个线程
 * 整个卡住不动——之前这段代码跑在主线程上时，连我们自己加的20秒`setTimeout`
 * 超时保护都没机会触发(JS事件循环被同一线程上的长时间同步任务占住，定时器
 * 排不上队执行)，日志显示卡在"开始动态import"这一步之后就再没有任何输出，
 * 不是WASM初始化慢，是这一步本身在阻塞。
 *
 * 改成在独立Worker线程里跑这整段"加载+边缘检测"逻辑——不管这段解码/计算
 * 实际有多慢，主线程(UI线程)完全不受影响，主线程那边的超时保护也才能真正
 * 按预期工作(见receiptEdgeDetect.ts)。
 *
 * Worker全局作用域没有document/Image()这些主线程专属DOM API，改用
 * createImageBitmap()+OffscreenCanvas——这两个是Worker里就有的标准API，
 * 不需要主线程桥接。cv.matFromImageData()接受标准ImageData对象，比
 * cv.imread(canvasElement)更适合"不挑调用方是主线程还是Worker"这个场景。
 *
 * 类型层面：`self`在DOM lib类型下解析成`Window & typeof globalThis`，跟
 * Worker全局作用域真实的`DedicatedWorkerGlobalScope`对不上，这里用类型
 * 断言接管，不引入单独的tsconfig project(webworker lib会跟主app用的DOM lib
 * 全局类型冲突)——这个文件本来就跟receiptEdgeDetect.ts的cv:any一样，运行时
 * 类型交给逻辑正确性保证，不用类型系统死磕 */

interface WorkerScope {
  onmessage: ((e: MessageEvent<{ photo: Blob }>) => void) | null
  postMessage: (data: unknown, transfer?: Transferable[]) => void
}
const workerSelf = self as unknown as WorkerScope

let cvReadyPromise: Promise<any> | null = null

function getCv(): Promise<any> {
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

function dist(a: [number, number], b: [number, number]): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1])
}

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

// 基于亮度直方图1%/99%分位数的自动对比度拉伸(auto-levels)，逻辑跟之前
// 主线程版本完全一致，只是操作对象从HTMLCanvasElement换成裸ImageData
function autoEnhance(imageData: ImageData): void {
  const data = imageData.data
  const hist = new Uint32Array(256)
  for (let i = 0; i < data.length; i += 4) {
    const lum = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2])
    hist[lum]++
  }
  const total = imageData.width * imageData.height
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
}

interface DetectResult {
  imageData: ImageData
  cropped: boolean
}

function detectAndWarp(cv: any, imageData: ImageData): DetectResult {
  const src = cv.matFromImageData(imageData)
  const gray = new cv.Mat()
  const blurred = new cv.Mat()
  const edges = new cv.Mat()
  const dilated = new cv.Mat()
  const kernel = cv.Mat.ones(3, 3, cv.CV_8U)
  const contours = new cv.MatVector()
  const hierarchy = new cv.Mat()

  let outData: ImageData
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
      // matFromImageData来源的src是4通道(RGBA)，warpPerspective默认保持通道数不变，
      // dst同样是4通道，数据布局天然跟ImageData一致，直接包一层就能用
      outData = new ImageData(new Uint8ClampedArray(dst.data), dst.cols, dst.rows)
      cropped = true
      srcTri.delete()
      dstTri.delete()
      M.delete()
      dst.delete()
    } else {
      outData = new ImageData(new Uint8ClampedArray(src.data), src.cols, src.rows)
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

  autoEnhance(outData)
  return { imageData: outData, cropped }
}

workerSelf.onmessage = async (e) => {
  try {
    const cv = await getCv()
    const bitmap = await createImageBitmap(e.data.photo)
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('OffscreenCanvas 2D上下文创建失败')
    ctx.drawImage(bitmap, 0, 0)
    bitmap.close()
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const result = detectAndWarp(cv, imageData)
    const outBitmap = await createImageBitmap(result.imageData)
    workerSelf.postMessage({ ok: true, bitmap: outBitmap, cropped: result.cropped }, [outBitmap])
  } catch (err) {
    workerSelf.postMessage({ ok: false, error: err instanceof Error ? err.message : String(err) })
  }
}
