import { useI18n } from '../../lib/i18n'

interface ReceiptPreviewSheetProps {
  open: boolean
  /** Supabase Storage签名URL，getReceiptSignedUrl()查出来的——有时效性，弹层关闭
   * 重新打开会由调用方(EntryCard)重新查一次，这个组件本身不缓存 */
  url: string | null
  onClose: () => void
}

/** R-32续：レシート凭证预览改成App内弹层，取代之前handleViewReceipt()里
 * window.open(url,'_blank')直接跳出系统浏览器的做法(用户反馈"外跳不好")。跟
 * ReceiptScanSheet.tsx/CategoryDetailSheet.tsx同一套底部弹层视觉规范(遮罩+从
 * 底部滑入的rounded-t卡片)，不是另起一套新样式。
 *
 * PDF本体用<iframe>内嵌渲染——WKWebView(iOS原生壳)原生支持在iframe里直接显示PDF，
 * 不需要额外接入pdf.js这类渲染库。保留一个"在浏览器中打开"的兜底链接，万一某些
 * WebView环境iframe内嵌PDF渲染有问题，用户还有路径能看到内容 */
export function ReceiptPreviewSheet({ open, url, onClose }: ReceiptPreviewSheetProps) {
  const { t } = useI18n()
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center">
      <div className="absolute inset-0 bg-inverse-surface/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative z-10 w-full max-w-[480px] h-[90vh] bg-surface rounded-t-[24px] shadow-xl flex flex-col overflow-hidden">
        <header className="flex items-center justify-between px-md h-16 border-b-[1.5px] border-dashed border-outline-variant shrink-0">
          <h2 className="font-serif text-headline-md text-on-surface">{t('receiptPreviewTitle')}</h2>
          <button
            type="button"
            aria-label={t('closeAria')}
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-on-surface-variant"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </header>

        <div className="relative flex-1 min-h-0 bg-surface-container-lowest">
          {/* R-XH：真机反馈这块内容顶到没有标题栏/圆角/遮罩，撑得比屏幕还大——
             根因是<iframe>套PDF在WebKit下height:100%这套百分比/flex链条不可靠，
             系统PDF插件经常按自己的原生尺寸撑开，不听CSS里flex-1/h-full的约束。
             改成父容器position:relative给一个明确的定位基准，iframe本身
             position:absolute+inset:0直接贴满，不依赖百分比高度传导，是解决
             "iframe不听height:100%"这类问题的标准做法 */}
          {url && <iframe src={url} title={t('receiptPreviewTitle')} className="absolute inset-0 w-full h-full border-0" />}
        </div>

        {url && (
          <div className="p-md shrink-0 border-t-[1.5px] border-dashed border-outline-variant">
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 text-body-md text-on-surface-variant py-1"
            >
              <span className="material-symbols-outlined text-[18px]">open_in_new</span>
              {t('receiptOpenExternalLabel')}
            </a>
          </div>
        )}
      </div>
    </div>
  )
}
