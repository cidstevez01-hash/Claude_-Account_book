import { ThemeIcon } from '../../icons/Icon'
import { useEffect, useRef, useState } from 'react'
import { useI18n } from '../../lib/i18n'
import { pickFromGallery, scanDocumentNative } from '../../lib/receiptCamera'
import { blobToImage } from '../../lib/receiptEdgeDetect'
import { buildReceiptPdf } from '../../lib/receiptPdf'
import { recognizeReceiptFields, type ReceiptScanBand, type RecognizedReceiptFields } from '../../lib/receiptFieldExtract'
import { logModule } from '../../lib/appLog'
import { recognizeReceiptAi, receiptAiErrorKey } from '../../lib/receiptAi'
import type { ReceiptAiResult } from '../../../shared/receiptAi'
import { waitForReceiptFields } from '../../lib/receiptOcrWait'

// R-32三期：拍照页面改成调用系统原生扫描能力(见lib/receiptCamera.ts)，取代之前
// 自建webcam取景界面+OpenCV.js边缘检测那整套——原生扫描器自己就是一个完整的
// 系统级全屏界面(相机权限/实时检测框/透视校正都是系统原生处理)，这个组件只管
// "发起扫描→拿结果→预览确认"，不再需要camera-starting/camera-live这类中间状态
type Stage = 'scanning' | 'error' | 'review'

interface ReceiptScanSheetProps {
  open: boolean
  entryDate: string
  onClose: () => void
  onConfirm: (pdf: Blob, fields: RecognizedReceiptFields) => Promise<boolean>
}

function emptyFields(receiptId: string): RecognizedReceiptFields {
  return { receiptId, ocrRows: [], amount: null, date: null, storeName: null, items: [] }
}

function cropReceiptBand(canvas: HTMLCanvasElement, { bottom, top }: ReceiptScanBand) {
  // Vision 的 Y 轴向上，Canvas 的 Y 轴向下。保留小票整行宽度及像素尺寸。
  const start = Math.floor((1 - top) * canvas.height)
  const end = Math.ceil((1 - bottom) * canvas.height)
  const crop = document.createElement('canvas')
  crop.width = canvas.width
  crop.height = end - start
  const context = crop.getContext('2d')
  if (!context) throw new Error('Cannot crop receipt for text recognition')
  context.drawImage(canvas, 0, start, crop.width, crop.height, 0, 0, crop.width, crop.height)
  return {
    imageDataUrl: crop.toDataURL('image/png'),
    band: { bottom: 1 - end / canvas.height, top: 1 - start / canvas.height },
  }
}

function createReceiptId(): string {
  return globalThis.crypto?.randomUUID?.()
    ?? `receipt-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
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
  const receiptIdRef = useRef<string | null>(null)
  // R-XO：进入review态就在后台起一次OCR识别(不挡用户看预览图/点确认)，用户点
  // "存为PDF"时才去等这个promise的结果——大多数情况下用户看几眼预览图确认的这段
  // 时间，识别早就跑完了，真等到的时候也就是极快的一下
  const recognizeResultRef = useRef<Promise<RecognizedReceiptFields> | null>(null)
  const partialFieldsRef = useRef<RecognizedReceiptFields | null>(null)
  const scanGenerationRef = useRef(0)
  const ocrControllerRef = useRef<AbortController | null>(null)
  // 保存中状态：savingRef是真正的防重入开关(state更新是异步的，快速连点时挡不住)，
  // saving只负责界面上禁用按钮、显示转圈
  const savingRef = useRef(false)
  const [saving, setSaving] = useState(false)
  const [waitingForOcr, setWaitingForOcr] = useState(false)
  const [saveFailed, setSaveFailed] = useState(false)
  const aiControllerRef = useRef<AbortController | null>(null)
  const aiBusyRef = useRef(false)
  const aiResultRef = useRef<ReceiptAiResult | null>(null)
  const [aiBusy, setAiBusy] = useState(false)
  const [aiResult, setAiResult] = useState<ReceiptAiResult | null>(null)
  const [aiError, setAiError] = useState<string | null>(null)

  function errText(e: unknown): string {
    return e instanceof Error ? e.message : String(e)
  }

  function invalidateScan() {
    scanGenerationRef.current++
    aiControllerRef.current?.abort()
    aiControllerRef.current = null
    aiBusyRef.current = false
    aiResultRef.current = null
    setAiBusy(false)
    setAiResult(null)
    setAiError(null)
    ocrControllerRef.current?.abort()
    ocrControllerRef.current = null
    recognizeResultRef.current = null
    partialFieldsRef.current = null
    receiptIdRef.current = null
    resultCanvasRef.current = null
    return scanGenerationRef.current
  }

  function close() {
    if (savingRef.current) return
    invalidateScan()
    onClose()
  }

  async function setResultFromBlob(blob: Blob, generation: number) {
    if (scanGenerationRef.current !== generation) return
    const receiptId = createReceiptId()
    receiptIdRef.current = receiptId
    const imgEl = await blobToImage(blob)
    if (scanGenerationRef.current !== generation) return
    const canvas = document.createElement('canvas')
    canvas.width = imgEl.naturalWidth
    canvas.height = imgEl.naturalHeight
    canvas.getContext('2d')?.drawImage(imgEl, 0, 0)
    resultCanvasRef.current = canvas
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9)
    setPreviewUrl(dataUrl)
    setStage('review')
    const controller = new AbortController()
    ocrControllerRef.current = controller
    recognizeResultRef.current = recognizeReceiptFields(
      dataUrl, receiptId, (band) => cropReceiptBand(canvas, band),
      (fields) => {
        if (!controller.signal.aborted && !aiResultRef.current && receiptIdRef.current === receiptId) partialFieldsRef.current = fields
      },
      { signal: controller.signal },
    )
  }

  async function startScan() {
    if (savingRef.current) return
    const generation = invalidateScan()
    setStage('scanning')
    setErrorMsg(null)
    logModule('receipt', '=== ReceiptScanSheet.startScan 开始(原生扫描) ===')
    try {
      const blob = await scanDocumentNative()
      if (scanGenerationRef.current !== generation) return
      if (!blob) {
        logModule('receipt', '用户取消了原生扫描，关闭弹层')
        onClose()
        return
      }
      logModule('receipt', `原生扫描完成，blob.size=${blob.size}字节`)
      await setResultFromBlob(blob, generation)
    } catch (e) {
      if (scanGenerationRef.current !== generation) return
      // Web端(沙盒/浏览器预览)本来就没有原生扫描能力，插件会直接抛
      // "not supported on the web"——这不是异常情况，是预期内会走到的分支，
      // 兜底改用相册选图；真机上权限被拒绝/用户手动取消系统弹窗也会走到这里
      console.error('原生文档扫描失败', e)
      logModule('receipt', `scanDocumentNative()抛错: ${errText(e)}`, 'error')
      setErrorMsg(errText(e))
      setStage('error')
    }
  }

  async function handlePickGallery() {
    if (savingRef.current) return
    const generation = invalidateScan()
    logModule('receipt', '用户选择从相册选取')
    try {
      const blob = await pickFromGallery()
      if (scanGenerationRef.current !== generation) return
      if (!blob) {
        logModule('receipt', '用户取消了相册选图，关闭弹层')
        onClose()
        return
      }
      await setResultFromBlob(blob, generation)
    } catch (e) {
      if (scanGenerationRef.current !== generation) return
      console.error('相册选图失败', e)
      logModule('receipt', `pickFromGallery()抛错: ${errText(e)}`, 'error')
      setErrorMsg(errText(e))
      setStage('error')
    }
  }

  useEffect(() => {
    if (!open) return
    setPreviewUrl(null)
    resultCanvasRef.current = null
    recognizeResultRef.current = null
    partialFieldsRef.current = null
    receiptIdRef.current = null
    startScan()
    return () => { invalidateScan() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  if (!open) return null

  async function handleAiRecognize() {
    const canvas = resultCanvasRef.current
    const receiptId = receiptIdRef.current
    if (!canvas || !receiptId || savingRef.current || aiBusyRef.current) return
    const generation = scanGenerationRef.current
    const controller = new AbortController()
    aiControllerRef.current = controller
    aiBusyRef.current = true
    setAiBusy(true)
    setAiError(null)
    const timer = window.setTimeout(() => controller.abort(), 45_000)
    try {
      const { result, fields } = await recognizeReceiptAi(canvas, receiptId, controller.signal)
      if (controller.signal.aborted || scanGenerationRef.current !== generation) return
      aiResultRef.current = result
      setAiResult(result)
      partialFieldsRef.current = fields
      recognizeResultRef.current = Promise.resolve(fields)
      logModule('receipt', `AI识别完成 receiptId=${receiptId}: 金额=${fields.amount ?? '未确认'}`)
    } catch (error) {
      if (scanGenerationRef.current !== generation) return
      setAiError(t(controller.signal.aborted ? 'receiptAiTimeout' : receiptAiErrorKey(error)))
    } finally {
      window.clearTimeout(timer)
      if (scanGenerationRef.current === generation) {
        aiBusyRef.current = false
        setAiBusy(false)
        aiControllerRef.current = null
      }
    }
  }

  async function handleConfirm() {
    if (aiBusyRef.current || savingRef.current || !resultCanvasRef.current) return
    savingRef.current = true
    setSaving(true)
    setSaveFailed(false)
    try {
      const pdf = buildReceiptPdf(resultCanvasRef.current, { entryDate })
      const receiptId = receiptIdRef.current ?? createReceiptId()
      const generation = scanGenerationRef.current
      const controller = ocrControllerRef.current
      setWaitingForOcr(true)
      const fields = await waitForReceiptFields(recognizeResultRef.current, () => {
        const partial = partialFieldsRef.current
        return partial?.receiptId === receiptId ? partial : emptyFields(receiptId)
      }, {
        signal: controller?.signal,
        onTimeout: () => {
          logModule('receipt', `识别等待超时，保留已确认字段 receiptId=${receiptId}`, 'warn')
          controller?.abort()
        },
      })
      setWaitingForOcr(false)
      if (scanGenerationRef.current !== generation || receiptIdRef.current !== receiptId) return
      if (fields.receiptId !== receiptId) return
      const ok = await onConfirm(pdf, fields)
      if (!ok) setSaveFailed(true)
    } finally {
      savingRef.current = false
      setSaving(false)
      setWaitingForOcr(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center">
      <div className="absolute inset-0 bg-inverse-surface/40 backdrop-blur-[2px]" onClick={close} />
      <div className="relative z-10 w-full max-w-[480px] max-h-[90vh] bg-surface rounded-t-[24px] shadow-xl flex flex-col overflow-hidden">
        <header className="flex items-center justify-between px-md h-16 border-b-[1.5px] border-dashed border-outline-variant shrink-0">
          <h2 className="font-serif text-headline-md text-on-surface">{t('receiptScanTitle')}</h2>
          <button type="button" aria-label={t('closeAria')} onClick={close} disabled={saving} className="w-8 h-8 flex items-center justify-center text-on-surface-variant">
            <ThemeIcon className="material-symbols-outlined" icon="close" />
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
              <ThemeIcon className="material-symbols-outlined text-4xl text-primary" icon="error" />
              <p className="text-body-md text-on-surface">{t('receiptFailedError')}</p>
              {errorMsg && <p className="text-xs text-action-ink break-all">⚠ {errorMsg}</p>}
              <div className="flex items-center gap-2 mt-sm">
                <button
                  type="button"
                  onClick={startScan}
                  disabled={saving}
                  className="px-5 py-2.5 rounded-lg border-[1.5px] border-outline-variant text-on-surface-variant text-body-md active:scale-95 transition-transform"
                >
                  {t('receiptReplace')}
                </button>
                <button
                  type="button"
                  onClick={handlePickGallery}
                  className="px-5 py-2.5 rounded-lg bg-action text-on-action text-body-md active:scale-95 transition-transform"
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
                  disabled={saving}
                  className="absolute right-2 bottom-2 w-9 h-9 rounded-full bg-surface/90 backdrop-blur-sm border border-outline-variant flex items-center justify-center text-action-ink shadow-sm active:scale-90 transition-transform"
                >
                  <ThemeIcon className="material-symbols-outlined text-[18px]" icon="photo_camera" />
                </button>
              </div>

              <div className="mb-md space-y-2">
                <p className="text-xs text-on-surface-variant">{t('receiptAiNotice')}</p>
                <button type="button" onClick={handleAiRecognize} disabled={saving || aiBusy}
                  className="w-full px-4 py-3 rounded-xl border-[1.5px] border-outline-variant text-action-ink text-body-md active:scale-95 transition-transform disabled:opacity-60">
                  {t(aiBusy ? 'receiptAiRecognizing' : 'receiptAiRetry')}
                </button>
                {aiError && <p role="alert" className="text-xs text-action-ink">{aiError}</p>}
                {aiResult && <div role="status" className="rounded-xl border border-outline-variant p-3 text-body-md text-on-surface break-words">
                  <p className="font-medium">{t('receiptAiResult')}</p>
                  <p>{t('amountLabel')}: {aiResult.amount == null ? t('receiptAiUnconfirmed') : `¥${aiResult.amount.toLocaleString()}`}</p>
                  <p>{t('dateLabel')}: {aiResult.date ?? t('receiptAiUnconfirmed')}</p>
                  <p>{aiResult.storeName}</p>
                  <p className="text-xs text-on-surface-variant mt-2">{t(aiResult.uncertain ? 'receiptAiCheckAmount' : 'receiptAiReviewNote')}</p>
                </div>}
              </div>

              <div className="flex items-start gap-2 p-3 rounded-xl bg-surface-container border border-outline-variant/50">
                <ThemeIcon className="material-symbols-outlined text-primary text-[18px] shrink-0" icon="info" />
                <p className="text-xs text-on-surface-variant">{t('receiptPrivacyNote')}</p>
              </div>
            </>
          )}
        </div>

        {stage === 'review' && (
          <div className="p-md shrink-0 border-t-[1.5px] border-dashed border-outline-variant">
            {saveFailed && <p className="text-xs text-action-ink text-center mb-2">{t('receiptSaveFailed')}</p>}
            <button
              type="button"
              onClick={handleConfirm}
              disabled={saving || aiBusy}
              className="w-full h-[52px] bg-action text-on-action rounded-xl text-headline-md font-serif flex items-center justify-center gap-2 active:translate-y-0.5 transition-transform disabled:opacity-70"
              style={{ boxShadow: '0 4px 0 var(--color-primary-container)' }}
            >
              {saving ? (
                <span className="ios-spinner text-on-action">
                  {Array.from({ length: 8 }, (_, i) => (
                    <i key={i} style={{ transform: `rotate(${i * 45}deg)`, animationDelay: `${i * 0.125 - 1}s` }} />
                  ))}
                </span>
              ) : (
                <ThemeIcon className="material-symbols-outlined" icon="picture_as_pdf" />
              )}
              {t(waitingForOcr ? 'receiptRecognizing' : 'receiptSaveAsPdf')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
