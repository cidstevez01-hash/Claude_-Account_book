import { useEffect, useRef, useState } from 'react'
import { useI18n } from '../../lib/i18n'
import { captureReceiptPhoto } from '../../lib/receiptCamera'
import { blobToImage, scanReceiptDocument } from '../../lib/receiptEdgeDetect'
import { buildReceiptPdf } from '../../lib/receiptPdf'
import { logIfEnabled } from '../../lib/appLog'

interface ReceiptScanSheetProps {
  open: boolean
  entryDate: string
  onClose: () => void
  onConfirm: (pdf: Blob) => void
}

type Stage = 'capturing' | 'processing' | 'review' | 'error'

/** R-32：レシート扫描确认弹层——照Stitch设计稿(用户已确认)做：拍摄→自动裁边纠偏+
 * 增强(lib/receiptEdgeDetect.ts，"全能扫描王"式效果，不是OCR文字识别，见该文件
 * 说明)→预览确认→存为PDF。弹层一打开就直接触发拍照(不用户再多点一次"开始扫描")，
 * 拍完自动处理，处理完进入预览确认态。
 *
 * 跟CategoryDetailSheet.tsx同一套底部弹层视觉规范(遮罩+从底部滑入的rounded-t卡片) */
export function ReceiptScanSheet({ open, entryDate, onClose, onConfirm }: ReceiptScanSheetProps) {
  const { t } = useI18n()
  const [stage, setStage] = useState<Stage>('capturing')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [autoCropped, setAutoCropped] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  // R-32调试用：真机上出现过卡住/处理失败但看不出具体原因的情况，这个字段把
  // 捕获到的真实错误文本(不是翻译过的友好提示)显示在界面上，方便用户截图反馈——
  // 不影响正常使用流程(处理失败依然会自动退回原图，只是多显示一行技术细节)
  const [debugMsg, setDebugMsg] = useState<string | null>(null)
  const resultCanvasRef = useRef<HTMLCanvasElement | null>(null)

  function errText(e: unknown): string {
    return e instanceof Error ? e.message : String(e)
  }

  async function startCapture() {
    setStage('capturing')
    setDebugMsg(null)
    logIfEnabled('=== ReceiptScanSheet.startCapture 开始 ===')
    try {
      logIfEnabled('调用captureReceiptPhoto()')
      const blob = await captureReceiptPhoto()
      if (!blob) {
        logIfEnabled('用户取消了拍照/选图，关闭弹层')
        onClose() // 用户在系统拍照/选图界面点了取消，直接关掉整个弹层，不停在半吊子状态
        return
      }
      logIfEnabled(`拍照/选图完成，blob.size=${blob.size}字节`)
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
      logIfEnabled('=== startCapture 完成，进入review阶段 ===')
    } catch (e) {
      console.error('レシート拍摄失败', e)
      logIfEnabled(`startCapture外层捕获错误: ${errText(e)}`, 'error')
      setErrorMsg(`${t('receiptFailedError')}\n(${errText(e)})`)
      setStage('error')
    }
  }

  useEffect(() => {
    if (!open) return
    setPreviewUrl(null)
    resultCanvasRef.current = null
    startCapture()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  if (!open) return null

  function handleConfirm() {
    if (!resultCanvasRef.current) return
    const pdf = buildReceiptPdf(resultCanvasRef.current, { entryDate })
    onConfirm(pdf)
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center">
      <div className="absolute inset-0 bg-inverse-surface/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative z-10 w-full max-w-[480px] max-h-[90vh] bg-surface rounded-t-[24px] shadow-xl flex flex-col overflow-hidden">
        <header className="flex items-center justify-between px-md h-16 border-b-[1.5px] border-dashed border-outline-variant shrink-0">
          <h2 className="font-serif text-headline-md text-on-surface">{t('receiptScanTitle')}</h2>
          <button type="button" aria-label={t('closeAria')} onClick={onClose} className="w-8 h-8 flex items-center justify-center text-on-surface-variant">
            <span className="material-symbols-outlined">close</span>
          </button>
        </header>

        <div className="flex-1 overflow-y-auto overflow-x-hidden px-md py-md">
          {(stage === 'capturing' || stage === 'processing') && (
            <div className="flex flex-col items-center justify-center py-16 gap-md">
              <span className="ios-spinner text-primary">
                {Array.from({ length: 8 }, (_, i) => (
                  <i key={i} style={{ transform: `rotate(${i * 45}deg)`, animationDelay: `${i * 0.125 - 1}s` }} />
                ))}
              </span>
              <p className="text-body-md text-on-surface-variant">
                {stage === 'capturing' ? '' : t('receiptProcessingLabel')}
              </p>
            </div>
          )}

          {stage === 'error' && (
            <div className="flex flex-col items-center gap-md py-12 px-md text-center">
              <span className="material-symbols-outlined text-4xl text-primary">error</span>
              <p className="text-body-md text-on-surface whitespace-pre-line break-all">{errorMsg}</p>
              <button
                type="button"
                onClick={startCapture}
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
                  onClick={startCapture}
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
