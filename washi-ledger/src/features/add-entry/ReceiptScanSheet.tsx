import { useEffect, useRef, useState } from 'react'
import { useI18n } from '../../lib/i18n'
import { pickFromGallery, scanDocumentNative } from '../../lib/receiptCamera'
import { blobToImage } from '../../lib/receiptEdgeDetect'
import { buildReceiptPdf } from '../../lib/receiptPdf'
import { logIfEnabled } from '../../lib/appLog'

// R-32三期：拍照页面改成调用系统原生扫描能力(见lib/receiptCamera.ts)，取代之前
// 自建webcam取景界面+OpenCV.js边缘检测那整套——原生扫描器自己就是一个完整的
// 系统级全屏界面(相机权限/实时检测框/透视校正都是系统原生处理)，这个组件只管
// "发起扫描→拿结果→预览确认"，不再需要camera-starting/camera-live这类中间状态
type Stage = 'scanning' | 'error' | 'review'

interface ReceiptScanSheetProps {
  open: boolean
  entryDate: string
  onClose: () => void
  onConfirm: (pdf: Blob) => void
}

/** R-32：レシート扫描确认弹层——照Stitch设计稿(用户已确认)做：原生扫描(系统全屏
 * 界面，自带实时边缘检测+透视校正)→预览确认→存为PDF。弹层一打开就直接调用原生
 * 扫描器(不用户再多点一次"开始扫描")，扫描器自己是取消/失败/成功三种结果，成功
 * 后直接进入预览确认态——原生扫描器本身已经做了裁边纠偏，不会有"没检测到边缘用
 * 原图兜底"这种中间状态了。
 *
 * 跟CategoryDetailSheet.tsx同一套底部弹层视觉规范(遮罩+从底部滑入的rounded-t卡片) */
export function ReceiptScanSheet({ open, entryDate, onClose, onConfirm }: ReceiptScanSheetProps) {
  const { t } = useI18n()
  const [stage, setStage] = useState<Stage>('scanning')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const resultCanvasRef = useRef<HTMLCanvasElement | null>(null)

  function errText(e: unknown): string {
    return e instanceof Error ? e.message : String(e)
  }

  async function setResultFromBlob(blob: Blob) {
    const imgEl = await blobToImage(blob)
    const canvas = document.createElement('canvas')
    canvas.width = imgEl.naturalWidth
    canvas.height = imgEl.naturalHeight
    canvas.getContext('2d')?.drawImage(imgEl, 0, 0)
    resultCanvasRef.current = canvas
    setPreviewUrl(canvas.toDataURL('image/jpeg', 0.9))
    setStage('review')
  }

  async function startScan() {
    setStage('scanning')
    setErrorMsg(null)
    logIfEnabled('=== ReceiptScanSheet.startScan 开始(原生扫描) ===')
    try {
      const blob = await scanDocumentNative()
      if (!blob) {
        logIfEnabled('用户取消了原生扫描，关闭弹层')
        onClose()
        return
      }
      logIfEnabled(`原生扫描完成，blob.size=${blob.size}字节`)
      await setResultFromBlob(blob)
    } catch (e) {
      // Web端(沙盒/浏览器预览)本来就没有原生扫描能力，插件会直接抛
      // "not supported on the web"——这不是异常情况，是预期内会走到的分支，
      // 兜底改用相册选图；真机上权限被拒绝/用户手动取消系统弹窗也会走到这里
      console.error('原生文档扫描失败', e)
      logIfEnabled(`scanDocumentNative()抛错: ${errText(e)}`, 'error')
      setErrorMsg(errText(e))
      setStage('error')
    }
  }

  async function handlePickGallery() {
    logIfEnabled('用户选择从相册选取')
    try {
      const blob = await pickFromGallery()
      if (!blob) {
        logIfEnabled('用户取消了相册选图，关闭弹层')
        onClose()
        return
      }
      await setResultFromBlob(blob)
    } catch (e) {
      console.error('相册选图失败', e)
      logIfEnabled(`pickFromGallery()抛错: ${errText(e)}`, 'error')
      setErrorMsg(errText(e))
      setStage('error')
    }
  }

  useEffect(() => {
    if (!open) return
    setPreviewUrl(null)
    resultCanvasRef.current = null
    startScan()
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
          {stage === 'scanning' && (
            <div className="flex flex-col items-center justify-center py-16 gap-md">
              <span className="ios-spinner text-primary">
                {Array.from({ length: 8 }, (_, i) => (
                  <i key={i} style={{ transform: `rotate(${i * 45}deg)`, animationDelay: `${i * 0.125 - 1}s` }} />
                ))}
              </span>
            </div>
          )}

          {stage === 'error' && (
            <div className="flex flex-col items-center gap-md py-12 px-md text-center">
              <span className="material-symbols-outlined text-4xl text-primary">error</span>
              <p className="text-body-md text-on-surface">{t('receiptFailedError')}</p>
              {errorMsg && <p className="text-xs text-primary break-all">⚠ {errorMsg}</p>}
              <div className="flex items-center gap-2 mt-sm">
                <button
                  type="button"
                  onClick={startScan}
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

          {stage === 'review' && (
            <>
              <p className="text-label-caps font-sans text-on-surface-variant tracking-widest uppercase mb-1.5">
                {t('receiptCapturedLabel')}
              </p>
              <div className="relative w-full rounded-xl overflow-hidden border-[1.5px] border-dashed border-outline-variant mb-md bg-surface-container-lowest">
                {previewUrl && <img src={previewUrl} alt="" className="w-full max-h-[420px] object-contain" />}
                <button
                  type="button"
                  aria-label={t('receiptRetakeAria')}
                  onClick={startScan}
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
