import { useEffect, useRef, useState } from 'react'
import { useI18n } from '../../lib/i18n'
import { captureFrameFromVideo, openCameraStream, pickFromGallery, stopCameraStream } from '../../lib/receiptCamera'
import { blobToImage, preloadReceiptScanWorker, scanReceiptDocument } from '../../lib/receiptEdgeDetect'
import { buildReceiptPdf } from '../../lib/receiptPdf'
import { logIfEnabled } from '../../lib/appLog'

interface ReceiptScanSheetProps {
  open: boolean
  entryDate: string
  onClose: () => void
  onConfirm: (pdf: Blob) => void
}

// R-32二期：'camera-starting'/'camera-live'/'camera-denied'是自建取景界面
// (getUserMedia+<video>)的三个状态，取代原来"弹系统相机等结果"那一个'capturing'
// 状态——取景界面暂不带实时检测框，只做取景+快门拍摄本身
type Stage = 'camera-starting' | 'camera-live' | 'camera-denied' | 'processing' | 'review' | 'error'

/** R-32：レシート扫描确认弹层——照Stitch设计稿(用户已确认)做：取景→快门拍摄→
 * 自动裁边纠偏+增强(lib/receiptEdgeDetect.ts，"全能扫描王"式效果，不是OCR文字识别，
 * 见该文件说明)→预览确认→存为PDF。弹层一打开就直接打开取景摄像头(不用户再多点一次
 * "开始扫描")，拍完自动处理，处理完进入预览确认态。
 *
 * 跟CategoryDetailSheet.tsx同一套底部弹层视觉规范(遮罩+从底部滑入的rounded-t卡片) */
export function ReceiptScanSheet({ open, entryDate, onClose, onConfirm }: ReceiptScanSheetProps) {
  const { t } = useI18n()
  const [stage, setStage] = useState<Stage>('camera-starting')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [autoCropped, setAutoCropped] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  // R-32调试用：真机上出现过卡住/处理失败但看不出具体原因的情况，这个字段把
  // 捕获到的真实错误文本(不是翻译过的友好提示)显示在界面上，方便用户截图反馈——
  // 不影响正常使用流程(处理失败依然会自动退回原图，只是多显示一行技术细节)
  const [debugMsg, setDebugMsg] = useState<string | null>(null)
  const resultCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  // 取景请求的"代次"——startCameraPreview()是异步的，可能在openCameraStream()/
  // video.play()这些await期间，组件已经被关闭/又触发了新一轮取景请求(React
  // StrictMode下的挂载→卸载→重新挂载连续调用就会复现)。每次调用领取一个新代次号，
  // await结束后如果代次已经不是自己领的那个，说明这次请求已经过期，直接把拿到的
  // 摄像头流关掉，不再更新state/ref——不然会出现"晚到的旧流"静默覆盖当前流、
  // 或者摄像头一直占用不释放
  const cameraGenerationRef = useRef(0)

  function errText(e: unknown): string {
    return e instanceof Error ? e.message : String(e)
  }

  function releaseStream() {
    cameraGenerationRef.current++ // 让任何还没resolve的旧取景请求作废
    if (streamRef.current) {
      stopCameraStream(streamRef.current)
      streamRef.current = null
    }
  }

  async function startCameraPreview() {
    const generation = ++cameraGenerationRef.current
    setStage('camera-starting')
    setDebugMsg(null)
    logIfEnabled('=== ReceiptScanSheet.startCameraPreview 开始 ===')
    try {
      const stream = await openCameraStream()
      if (generation !== cameraGenerationRef.current) {
        stopCameraStream(stream) // 这次请求已经过期，流不能留着白占用
        return
      }
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      if (generation !== cameraGenerationRef.current) {
        stopCameraStream(stream)
        streamRef.current = null
        return
      }
      setStage('camera-live')
      logIfEnabled('取景摄像头已就绪')
    } catch (e) {
      if (generation !== cameraGenerationRef.current) return
      console.error('取景摄像头打开失败', e)
      logIfEnabled(`openCameraStream()抛错: ${errText(e)}`, 'error')
      setDebugMsg(errText(e))
      setStage('camera-denied')
    }
  }

  async function processBlob(blob: Blob) {
    setStage('processing')
    let canvas: HTMLCanvasElement
    let cropped = false
    try {
      const result = await scanReceiptDocument(blob)
      canvas = result.canvas
      cropped = result.cropped
      logIfEnabled(`scanReceiptDocument()返回成功，cropped=${cropped}`)
    } catch (e) {
      // 边缘检测流水线本身出意外(比如OpenCV.js加载超时/失败)不该整个卡住扫描功能，
      // 兜底改用没处理过的原图，用户依然能存下一份凭证；但要把真实报错显示出来
      // (不只是console.error打到看不见的日志里)，不然没法知道具体卡在哪一步
      console.error('レシート边缘检测失败，改用原图', e)
      logIfEnabled(`scanReceiptDocument()抛错，改用原图兜底: ${errText(e)}`, 'error')
      setDebugMsg(errText(e))
      const imgEl = await blobToImage(blob)
      canvas = document.createElement('canvas')
      canvas.width = imgEl.naturalWidth
      canvas.height = imgEl.naturalHeight
      canvas.getContext('2d')?.drawImage(imgEl, 0, 0)
      cropped = false
    }
    resultCanvasRef.current = canvas
    setPreviewUrl(canvas.toDataURL('image/jpeg', 0.85))
    setAutoCropped(cropped)
    setStage('review')
    logIfEnabled('=== processBlob 完成，进入review阶段 ===')
  }

  async function handleShutter() {
    if (!videoRef.current) return
    logIfEnabled('用户点击快门拍摄')
    try {
      const blob = await captureFrameFromVideo(videoRef.current)
      releaseStream()
      await processBlob(blob)
    } catch (e) {
      console.error('取景帧捕获失败', e)
      logIfEnabled(`captureFrameFromVideo()抛错: ${errText(e)}`, 'error')
      setErrorMsg(`${t('receiptFailedError')}\n(${errText(e)})`)
      setStage('error')
    }
  }

  async function handlePickGallery() {
    releaseStream()
    logIfEnabled('用户选择从相册选取')
    try {
      const blob = await pickFromGallery()
      if (!blob) {
        logIfEnabled('用户取消了相册选图，回到取景界面')
        await startCameraPreview()
        return
      }
      await processBlob(blob)
    } catch (e) {
      console.error('相册选图失败', e)
      logIfEnabled(`pickFromGallery()抛错: ${errText(e)}`, 'error')
      setErrorMsg(`${t('receiptFailedError')}\n(${errText(e)})`)
      setStage('error')
    }
  }

  useEffect(() => {
    if (!open) {
      releaseStream()
      return
    }
    setPreviewUrl(null)
    resultCanvasRef.current = null
    // 弹层一打开就提前开始加载OpenCV.js——真机实测确认这个库加载本身要花很久，
    // 提前触发能把这段固定成本藏在用户取景/拍摄这几秒里，等真的拍完调
    // scanReceiptDocument()时库很可能已经加载完了
    preloadReceiptScanWorker()
    startCameraPreview()
    return () => releaseStream()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  if (!open) return null

  function handleConfirm() {
    if (!resultCanvasRef.current) return
    const pdf = buildReceiptPdf(resultCanvasRef.current, { entryDate })
    onConfirm(pdf)
  }

  function handleClose() {
    releaseStream()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center">
      <div className="absolute inset-0 bg-inverse-surface/40 backdrop-blur-[2px]" onClick={handleClose} />
      <div className="relative z-10 w-full max-w-[480px] max-h-[90vh] bg-surface rounded-t-[24px] shadow-xl flex flex-col overflow-hidden">
        <header className="flex items-center justify-between px-md h-16 border-b-[1.5px] border-dashed border-outline-variant shrink-0">
          <h2 className="font-serif text-headline-md text-on-surface">{t('receiptScanTitle')}</h2>
          <button type="button" aria-label={t('closeAria')} onClick={handleClose} className="w-8 h-8 flex items-center justify-center text-on-surface-variant">
            <span className="material-symbols-outlined">close</span>
          </button>
        </header>

        <div className="flex-1 overflow-y-auto overflow-x-hidden px-md py-md">
          {(stage === 'camera-starting' || stage === 'camera-live') && (
            <div className="relative w-full aspect-[3/4] rounded-xl overflow-hidden bg-[#111]">
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
              {stage === 'camera-starting' && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                  <span className="ios-spinner text-white">
                    {Array.from({ length: 8 }, (_, i) => (
                      <i key={i} style={{ transform: `rotate(${i * 45}deg)`, animationDelay: `${i * 0.125 - 1}s` }} />
                    ))}
                  </span>
                </div>
              )}
              {stage === 'camera-live' && (
                <>
                  <button
                    type="button"
                    aria-label={t('receiptGalleryAria')}
                    onClick={handlePickGallery}
                    className="absolute left-3 bottom-3.5 w-11 h-11 rounded-full bg-black/45 backdrop-blur-sm flex items-center justify-center text-white active:scale-90 transition-transform"
                  >
                    <span className="material-symbols-outlined text-[22px]">photo_library</span>
                  </button>
                  <button
                    type="button"
                    aria-label={t('receiptShutterAria')}
                    onClick={handleShutter}
                    className="absolute left-1/2 -translate-x-1/2 bottom-3 w-16 h-16 rounded-full bg-white border-[3px] border-white/60 shadow-lg active:scale-90 transition-transform"
                  />
                </>
              )}
            </div>
          )}

          {stage === 'camera-denied' && (
            <div className="flex flex-col items-center gap-md py-12 px-md text-center">
              <span className="material-symbols-outlined text-4xl text-primary">no_photography</span>
              <p className="text-body-md text-on-surface">{t('receiptCameraDeniedError')}</p>
              {debugMsg && <p className="text-xs text-primary break-all">⚠ {debugMsg}</p>}
              <div className="flex items-center gap-2 mt-sm">
                <button
                  type="button"
                  onClick={startCameraPreview}
                  className="px-5 py-2.5 rounded-lg border-[1.5px] border-outline-variant text-on-surface-variant text-body-md active:scale-95 transition-transform"
                >
                  {t('receiptReplace')}
                </button>
                <button
                  type="button"
                  onClick={handlePickGallery}
                  className="px-5 py-2.5 rounded-lg bg-primary text-on-primary text-body-md active:scale-95 transition-transform"
                >
                  {t('receiptUseGalleryInstead')}
                </button>
              </div>
            </div>
          )}

          {stage === 'processing' && (
            <div className="flex flex-col items-center justify-center py-16 gap-md">
              <span className="ios-spinner text-primary">
                {Array.from({ length: 8 }, (_, i) => (
                  <i key={i} style={{ transform: `rotate(${i * 45}deg)`, animationDelay: `${i * 0.125 - 1}s` }} />
                ))}
              </span>
              <p className="text-body-md text-on-surface-variant">{t('receiptProcessingLabel')}</p>
            </div>
          )}

          {stage === 'error' && (
            <div className="flex flex-col items-center gap-md py-12 px-md text-center">
              <span className="material-symbols-outlined text-4xl text-primary">error</span>
              <p className="text-body-md text-on-surface whitespace-pre-line break-all">{errorMsg}</p>
              <button
                type="button"
                onClick={startCameraPreview}
                className="mt-sm px-6 py-2.5 rounded-lg bg-primary text-on-primary text-body-md active:scale-95 transition-transform"
              >
                {t('receiptReplace')}
              </button>
            </div>
          )}

          {stage === 'review' && (
            <>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-label-caps font-sans text-on-surface-variant tracking-widest uppercase">
                  {t('receiptCapturedLabel')}
                </p>
                <span className="text-xs text-on-surface-variant">
                  {autoCropped ? t('receiptAutoCroppedHint') : t('receiptNoCropHint')}
                </span>
              </div>
              {/* 调试信息：只在处理流程真的报过错(不是"没检测到边缘"这种正常兜底)时才
                  显示，红字+可换行，方便用户截图把具体报错发回来 */}
              {debugMsg && (
                <p className="text-xs text-primary break-all mb-1.5">⚠ {debugMsg}</p>
              )}
              <div className="relative w-full rounded-xl overflow-hidden border-[1.5px] border-dashed border-outline-variant mb-md bg-surface-container-lowest">
                {previewUrl && <img src={previewUrl} alt="" className="w-full max-h-[420px] object-contain" />}
                <button
                  type="button"
                  aria-label={t('receiptRetakeAria')}
                  onClick={startCameraPreview}
                  className="absolute right-2 bottom-2 w-9 h-9 rounded-full bg-surface/90 backdrop-blur-sm border border-outline-variant flex items-center justify-center text-primary shadow-sm active:scale-90 transition-transform"
                >
                  <span className="material-symbols-outlined text-[18px]">photo_camera</span>
                </button>
              </div>

              <div className="flex items-start gap-2 p-3 rounded-xl bg-surface-container border border-outline-variant/50">
                <span className="material-symbols-outlined text-primary text-[18px] shrink-0">info</span>
                <p className="text-xs text-on-surface-variant">{t('receiptPrivacyNote')}</p>
              </div>
            </>
          )}
        </div>

        {stage === 'review' && (
          <div className="p-md shrink-0 border-t-[1.5px] border-dashed border-outline-variant">
            <button
              type="button"
              onClick={handleConfirm}
              className="w-full h-[52px] bg-primary text-on-primary rounded-xl text-headline-md font-serif flex items-center justify-center gap-2 active:translate-y-0.5 transition-transform"
              style={{ boxShadow: '0 4px 0 var(--color-primary-container)' }}
            >
              <span className="material-symbols-outlined">picture_as_pdf</span>
              {t('receiptSaveAsPdf')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
