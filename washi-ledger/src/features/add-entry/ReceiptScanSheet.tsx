import { useEffect, useState } from 'react'
import { useI18n } from '../../lib/i18n'
import { captureReceiptPhoto } from '../../lib/receiptCamera'
import { recognizeReceiptText } from '../../lib/receiptOcr'
import { buildReceiptPdf } from '../../lib/receiptPdf'

interface ReceiptScanSheetProps {
  open: boolean
  entryDate: string
  onClose: () => void
  onConfirm: (pdf: Blob) => void
}

type Stage = 'capturing' | 'recognizing' | 'review' | 'error'

/** R-32：レシート扫描确认弹层——照Stitch设计稿(用户已确认)做：拍摄原图缩略预览+
 * 重拍按钮、可编辑的OCR识别文字、隐私提示、底部"存为PDF"主按钮。弹层一打开就直接
 * 触发拍照(不用户再多点一次"开始扫描")，拍完自动识别，识别完进入可编辑review态。
 *
 * 跟CategoryDetailSheet.tsx同一套底部弹层视觉规范(遮罩+从底部滑入的rounded-t卡片)，
 * 内容区域按Stitch确认稿的信息层级重新排布(这个组件没有照搬底部弹层，因为设计稿
 * 本身画的是整屏页面；改成弹层是因为这个流程本来就嵌在记一笔页面中间，不需要单独
 * 开一个路由页) */
export function ReceiptScanSheet({ open, entryDate, onClose, onConfirm }: ReceiptScanSheetProps) {
  const { t, lang } = useI18n()
  const [stage, setStage] = useState<Stage>('capturing')
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [text, setText] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  async function startCapture() {
    setStage('capturing')
    try {
      const blob = await captureReceiptPhoto()
      if (!blob) {
        onClose() // 用户在系统拍照/选图界面点了取消，直接关掉整个弹层，不停在半吊子状态
        return
      }
      setPhotoUrl(URL.createObjectURL(blob))
      setStage('recognizing')
      const recognized = await recognizeReceiptText(blob, lang)
      if (!recognized) {
        setErrorMsg(t('receiptEmptyError'))
        setStage('error')
        return
      }
      setText(recognized)
      setStage('review')
    } catch (e) {
      console.error('レシート识别失败', e)
      setErrorMsg(t('receiptFailedError'))
      setStage('error')
    }
  }

  useEffect(() => {
    if (!open) return
    setText('')
    setPhotoUrl(null)
    startCapture()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // photoUrl是createObjectURL()出来的blob URL，弹层关闭/重新拍摄时要主动释放，
  // 不然每扫一次都会泄漏一个blob URL
  useEffect(() => {
    return () => {
      if (photoUrl) URL.revokeObjectURL(photoUrl)
    }
  }, [photoUrl])

  if (!open) return null

  function handleConfirm() {
    const pdf = buildReceiptPdf(text, { entryDate })
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
          {(stage === 'capturing' || stage === 'recognizing') && (
            <div className="flex flex-col items-center justify-center py-16 gap-md">
              <span className="ios-spinner text-primary">
                {Array.from({ length: 8 }, (_, i) => (
                  <i key={i} style={{ transform: `rotate(${i * 45}deg)`, animationDelay: `${i * 0.125 - 1}s` }} />
                ))}
              </span>
              <p className="text-body-md text-on-surface-variant">
                {stage === 'capturing' ? '' : t('receiptRecognizingLabel')}
              </p>
            </div>
          )}

          {stage === 'error' && (
            <div className="flex flex-col items-center gap-md py-12 px-md text-center">
              <span className="material-symbols-outlined text-4xl text-primary">error</span>
              <p className="text-body-md text-on-surface">{errorMsg}</p>
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
              <p className="text-label-caps font-sans text-on-surface-variant tracking-widest uppercase mb-1.5">
                {t('receiptCapturedLabel')}
              </p>
              <div className="relative w-full rounded-xl overflow-hidden border-[1.5px] border-dashed border-outline-variant mb-md">
                {photoUrl && <img src={photoUrl} alt="" className="w-full max-h-[200px] object-cover" />}
                <button
                  type="button"
                  aria-label={t('receiptRetakeAria')}
                  onClick={startCapture}
                  className="absolute right-2 bottom-2 w-9 h-9 rounded-full bg-surface/90 backdrop-blur-sm border border-outline-variant flex items-center justify-center text-primary shadow-sm active:scale-90 transition-transform"
                >
                  <span className="material-symbols-outlined text-[18px]">photo_camera</span>
                </button>
              </div>

              <div className="flex items-center justify-between mb-1.5">
                <p className="text-label-caps font-sans text-on-surface-variant tracking-widest uppercase">
                  {t('receiptRecognizedLabel')}
                </p>
              </div>
              <p className="text-body-md text-on-surface-variant mb-2">{t('receiptRecognizedHint')}</p>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={10}
                className="w-full bg-surface-container-lowest border-[1.5px] border-dashed border-outline-variant rounded-xl p-3 text-body-md text-on-surface focus:outline-none focus:border-primary resize-none font-mono"
              />

              <div className="flex items-start gap-2 mt-md p-3 rounded-xl bg-surface-container border border-outline-variant/50">
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
              disabled={!text.trim()}
              className="w-full h-[52px] bg-primary text-on-primary rounded-xl text-headline-md font-serif disabled:opacity-50 flex items-center justify-center gap-2 active:translate-y-0.5 transition-transform"
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
