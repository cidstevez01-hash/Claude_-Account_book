/** R-32：小票扫描"全能扫描王"式自动边缘检测+透视纠偏——不再走OCR文字识别那条路
 * (见receiptOcr.ts的说明，日文小票OCR质量不理想，用户明确要求改成保留原始版面的
 * 扫描件样式)。真正的OpenCV.js加载+边缘检测逻辑跑在独立的Worker线程里(见
 * receiptEdgeDetectWorker.ts)——真机实测确认`import('@techstark/opencv-js')`
 * 这一步本身会阻塞它所在的线程，放在主线程上连超时保护都触发不了(事件循环被
 * 同一线程的长时间同步任务占住)，这个文件现在只是主线程这边的薄封装：创建/
 * 复用Worker、发送拍摄的照片、等待结果、处理超时。
 *
 * 超时在主线程这边——因为主线程现在完全不受Worker内部执行进度影响，
 * 定时器能按预期正常触发；超时后会terminate()掉那个worker(它可能还卡在
 * 死循环/超长同步任务里)，下次扫描重新起一个干净的。
 *
 * 超时时长从20秒放宽到35秒——真机实测过20秒不够(在全分辨率照片上跑边缘检测
 * 本身就慢)，receiptEdgeDetectWorker.ts那边已经把检测阶段换成缩小图跑(见
 * DETECT_MAX_DIM说明)大幅提速，这里放宽超时是给"检测阶段之前"的OpenCV.js
 * 库加载这个一次性固定成本多留一点余量；因为现在跑在Worker里不占用主线程，
 * 放宽超时不会让App在这期间变得没反应，用户仍然能正常操作其他部分 */

import { logIfEnabled } from './appLog'
import { tSync } from './i18nSync'

export interface ScanResult {
  canvas: HTMLCanvasElement
  /** true=检测到四边形并做了透视纠偏裁剪；false=没检测到，返回的是未裁剪的原图(仍增强过) */
  cropped: boolean
}

const CV_LOAD_TIMEOUT_MS = 35000

// receiptEdgeDetectWorker.ts那边没有localStorage访问权限(拿不到当前语言)，
// 只能抛语言无关的错误码，这里查表翻译成用户可见文字——不认识的码(比如浏览器
// 原生抛出的技术性报错)原样透传，那类文本本来也不是我们自己写的中/日文案，
// 谈不上"翻译"，直接显示原文技术细节反而更有诊断价值
const WORKER_ERROR_MESSAGES: Record<string, () => string> = {
  ERR_OFFSCREEN_CANVAS_CONTEXT: () => tSync('receiptOffscreenCanvasError'),
}

function translateWorkerError(code: string | undefined): string {
  if (code && WORKER_ERROR_MESSAGES[code]) return WORKER_ERROR_MESSAGES[code]()
  return code ?? tSync('receiptWorkerUnknownError')
}

let worker: Worker | null = null

function getWorker(): Worker {
  if (!worker) {
    logIfEnabled('创建receiptEdgeDetectWorker')
    worker = new Worker(new URL('./receiptEdgeDetectWorker.ts', import.meta.url), { type: 'module' })
  }
  return worker
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
      reject(e instanceof Event ? new Error(tSync('receiptImageLoadError')) : e)
    }
    img.src = url
  })
}

export async function scanReceiptDocument(photo: Blob): Promise<ScanResult> {
  logIfEnabled(`scanReceiptDocument开始(Worker模式)，photo.size=${photo.size}字节`)
  const w = getWorker()

  const resultPromise = new Promise<{ bitmap: ImageBitmap; cropped: boolean }>((resolve, reject) => {
    function onMessage(e: MessageEvent) {
      cleanup()
      if (e.data?.ok) {
        resolve({ bitmap: e.data.bitmap, cropped: e.data.cropped })
      } else {
        reject(new Error(translateWorkerError(e.data?.error)))
      }
    }
    function onError(e: ErrorEvent) {
      cleanup()
      reject(new Error(`${tSync('receiptWorkerErrorPrefix')}: ${e.message}`))
    }
    function cleanup() {
      w.removeEventListener('message', onMessage)
      w.removeEventListener('error', onError)
    }
    w.addEventListener('message', onMessage)
    w.addEventListener('error', onError)
    logIfEnabled('向Worker发送照片，开始处理')
    w.postMessage({ photo })
  })

  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      logIfEnabled(`Worker处理超过${CV_LOAD_TIMEOUT_MS / 1000}秒未完成，触发超时`, 'warn')
      // 超时后销毁这个worker——它可能还卡在耗时很长的同步任务里，下次扫描
      // 重新创建一个干净的，不复用这个可能还在跑的实例
      worker?.terminate()
      worker = null
      reject(new Error(tSync('receiptScanTimeoutError', { s: String(CV_LOAD_TIMEOUT_MS / 1000) })))
    }, CV_LOAD_TIMEOUT_MS)
  })

  let result: { bitmap: ImageBitmap; cropped: boolean }
  try {
    result = await Promise.race([resultPromise, timeout])
  } finally {
    clearTimeout(timer)
  }

  logIfEnabled(`Worker返回结果，cropped=${result.cropped}`)
  const canvas = document.createElement('canvas')
  canvas.width = result.bitmap.width
  canvas.height = result.bitmap.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error(tSync('receiptCanvasContextError'))
  ctx.drawImage(result.bitmap, 0, 0)
  result.bitmap.close()
  return { canvas, cropped: result.cropped }
}
