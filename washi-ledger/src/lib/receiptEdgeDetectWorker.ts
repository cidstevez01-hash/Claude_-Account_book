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
 * 类型交给逻辑正确性保证，不用类型系统死磕。
 *
 * i18n：这个文件里抛出的Error message**不是**给用户看的翻译文字，是纯英文的
 * 错误码(如`ERR_OFFSCREEN_CANVAS_CONTEXT`)——Web Storage API(localStorage)
 * 只挂在Window接口上，Worker全局作用域访问不到，这里没办法调用lib/i18nSync.ts
 * 读取当前语言。真正翻译成用户可见文字的活在主线程做(receiptEdgeDetect.ts收到
 * 这些错误码后查表转成zh/ja文案)，不要在这个文件里写死任何一种语言的提示文字 */

interface WorkerScope {
  onmessage: ((e: MessageEvent<{ photo: Blob }>) => void) | null
  postMessage: (data: unknown, transfer?: Transferable[]) => void
}
const workerSelf = self as unknown as WorkerScope

// 脚本顶层、不在onmessage里——只要这个Worker模块本身被成功加载执行就会立刻
// 发出这条消息，跟"onmessage收到照片后才打的日志"是两件不同的事：如果主线程
// 连这条都收不到，说明问题出在Worker模块本身没加载起来(比如WKWebView真机上
// `type:'module'`这种写法的兼容性问题)，不是消息传递或OpenCV.js加载慢；如果
// 收到了这条但收不到'worker-received-photo'，说明模块加载没问题，是postMessage
// 传照片过去这一步出了问题
workerSelf.postMessage({ kind: 'progress', stage: 'worker-module-loaded' })

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

// 检测阶段(找小票四个角点)用的最长边上限——手机相机拍的照片常常是十几MP
// (比如3024×4032)，直接在全分辨率图上跑Canny+找轮廓，计算量跟像素数近似
// 线性甚至更高增长，真机上实测这是20秒超时还没跑完检测的主要原因。缩到
// 最长边1200px再跑检测，像素量能降一个数量级以上，检测阶段大幅提速；
// 检测只是为了拿到四个角点的坐标，跟分辨率无关，缩小不影响角点定位准确度。
// 真正的透视裁剪(warpPerspective)还是在原图上做，坐标按缩放比例换算回去，
// 裁出来的成片清晰度不受影响，跟真机原图一样清楚
const DETECT_MAX_DIM = 1200

/** 在(可能缩小过的)图像上找小票的四个角点——只返回坐标，不做任何裁剪，
 * 坐标是相对传入的这张imageData自己的尺寸，调用方按需要换算 */
function findQuad(cv: any, imageData: ImageData): number[] | null {
  const src = cv.matFromImageData(imageData)
  const gray = new cv.Mat()
  const blurred = new cv.Mat()
  const edges = new cv.Mat()
  const dilated = new cv.Mat()
  const kernel = cv.Mat.ones(3, 3, cv.CV_8U)
  const contours = new cv.MatVector()
  const hierarchy = new cv.Mat()

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
    return bestQuad
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
}

/** 把ImageData缩放到目标最长边——先画到一个跟原图同尺寸的canvas上(ImageData
 * 本身不能直接drawImage)，再画到缩小的canvas上，用浏览器自己的图片缩放算法，
 * 不用自己写重采样 */
function resizeImageData(imageData: ImageData, maxDim: number): { data: ImageData; scale: number } {
  const scale = Math.min(1, maxDim / Math.max(imageData.width, imageData.height))
  if (scale >= 1) return { data: imageData, scale: 1 }

  const srcCanvas = new OffscreenCanvas(imageData.width, imageData.height)
  const srcCtx = srcCanvas.getContext('2d')
  // Worker线程内没有localStorage访问权限(拿不到当前语言)，这里只抛语言无关的
  // 错误码，翻译成用户可见文字的活交给主线程(见receiptEdgeDetect.ts)
  if (!srcCtx) throw new Error('ERR_OFFSCREEN_CANVAS_CONTEXT')
  srcCtx.putImageData(imageData, 0, 0)

  const dstW = Math.max(1, Math.round(imageData.width * scale))
  const dstH = Math.max(1, Math.round(imageData.height * scale))
  const dstCanvas = new OffscreenCanvas(dstW, dstH)
  const dstCtx = dstCanvas.getContext('2d')
  if (!dstCtx) throw new Error('ERR_OFFSCREEN_CANVAS_CONTEXT')
  dstCtx.drawImage(srcCanvas, 0, 0, dstW, dstH)

  return { data: dstCtx.getImageData(0, 0, dstW, dstH), scale }
}

interface DetectResult {
  imageData: ImageData
  cropped: boolean
}

function detectAndWarp(
  cv: any,
  fullImageData: ImageData,
  report: (stage: string) => void
): DetectResult {
  report('resize-start')
  const { data: detectImageData, scale } = resizeImageData(fullImageData, DETECT_MAX_DIM)
  report('resize-done')
  const bestQuadSmall = findQuad(cv, detectImageData)
  report(bestQuadSmall ? 'find-quad-done-found' : 'find-quad-done-notfound')

  const src = cv.matFromImageData(fullImageData)
  let outData: ImageData
  let cropped = false

  try {
    if (bestQuadSmall) {
      // 检测阶段的坐标是缩小图上的，除以scale换算回全分辨率原图的坐标系
      const bestQuad = bestQuadSmall.map((v) => v / scale)
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
      report('warp-done')
    } else {
      outData = new ImageData(new Uint8ClampedArray(src.data), src.cols, src.rows)
    }
  } finally {
    src.delete()
  }

  report('enhance-start')
  autoEnhance(outData)
  report('enhance-done')
  return { imageData: outData, cropped }
}

// 主线程(receiptEdgeDetect.ts)拿不到Worker内部执行到哪一步——之前35秒超时
// 期间日志完全是黑盒，不知道卡在OpenCV.js库加载还是检测计算。这里在每个阶段
// 边界都postMessage一条进度消息(kind:'progress')回主线程写日志，跟最终结果
// (kind:'done')用kind字段区分，方便下次真机超时时能看到具体卡在哪一步、
// 每一步各花了多久
function reportProgress(stage: string): void {
  workerSelf.postMessage({ kind: 'progress', stage })
}

workerSelf.onmessage = async (e) => {
  try {
    reportProgress('worker-received-photo')
    reportProgress('cv-load-start')
    const cv = await getCv()
    reportProgress('cv-load-done')
    const bitmap = await createImageBitmap(e.data.photo)
    reportProgress('bitmap-decoded')
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('ERR_OFFSCREEN_CANVAS_CONTEXT')
    ctx.drawImage(bitmap, 0, 0)
    bitmap.close()
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    reportProgress('imagedata-ready')
    const result = detectAndWarp(cv, imageData, reportProgress)
    const outBitmap = await createImageBitmap(result.imageData)
    workerSelf.postMessage(
      { kind: 'done', ok: true, bitmap: outBitmap, cropped: result.cropped },
      [outBitmap]
    )
  } catch (err) {
    workerSelf.postMessage({
      kind: 'done',
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    })
  }
}
