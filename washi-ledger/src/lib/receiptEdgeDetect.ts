/** R-32：小票扫描"全能扫描王"式自动边缘检测+透视纠偏——不再走OCR文字识别那条路
 * (见receiptOcr.ts的说明，日文小票OCR质量不理想，用户明确要求改成保留原始版面的
 * 扫描件样式)。真正的OpenCV.js加载+边缘检测逻辑跑在独立的Worker线程里(见
 * receiptEdgeDetectWorker.ts)——真机实测确认`import('@techstark/opencv-js')`
 * 这一步本身会阻塞它所在的线程，放在主线程上连超时保护都触发不了(事件循环被
 * 同一线程的长时间同步任务占住)，这个文件现在只是主线程这边的薄封装：创建/
 * 复用Worker、发送拍摄的照片、等待结果、处理超时。
 *
 * 超时(20秒)在主线程这边——因为主线程现在完全不受Worker内部执行进度影响，
 * 定时器能按预期正常触发；超时后会terminate()掉那个worker(它可能还卡在
 * 死循环/超长同步任务里)，下次扫描重新起一个干净的 */

import { logIfEnabled } from './appLog'

export interface ScanResult {
  canvas: HTMLCanvasElement
  /** true=检测到四边形并做了透视纠偏裁剪；false=没检测到，返回的是未裁剪的原图(仍增强过) */
  cropped: boolean
}

const CV_LOAD_TIMEOUT_MS = 20000

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
      reject(e instanceof Event ? new Error('图片加载失败') : e)
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
        reject(new Error(e.data?.error ?? 'Worker返回未知错误'))
      }
    }
    function onError(e: ErrorEvent) {
      cleanup()
      reject(new Error(`Worker出错: ${e.message}`))
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
      reject(new Error(`小票扫描处理超时(${CV_LOAD_TIMEOUT_MS / 1000}秒)`))
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
  if (!ctx) throw new Error('无法创建canvas 2D上下文')
  ctx.drawImage(result.bitmap, 0, 0)
  result.bitmap.close()
  return { canvas, cropped: result.cropped }
}
