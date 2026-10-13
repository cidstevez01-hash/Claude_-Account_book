import { useI18n } from '../../lib/i18n'

interface ReceiptPreviewSheetProps {
  open: boolean
  /** Supabase Storage签名URL，getReceiptSignedUrl()查出来的——有时效性，弹层关闭
   * 重新打开会由调用方重新查一次，这个组件本身不缓存 */
  url: string | null
  onClose: () => void
  /** R-43：账目卡片小票角标多张凭证时支持左右切换——这三个参数只有EntryCard.tsx
   * 的角标会传(一次性打开整条记录的全部凭证)，EntryDetailSheet.tsx凭证列表逐行
   * 点开单张不传，行为不变。这个组件本身不知道怎么查下一张的签名URL，点箭头只是
   * 调onIndexChange告诉调用方"该换到第几张了"，调用方查完新的签名URL再把新url
   * 传进来——组件自己仍然不缓存/不发请求，职责不变，只是多了"知道还有几张、
   * 当前第几张"这层展示 */
  paths?: string[]
  index?: number
  onIndexChange?: (index: number) => void
}

/** R-32续：レシート凭证预览改成App内弹层，取代之前handleViewReceipt()里
 * window.open(url,'_blank')直接跳出系统浏览器的做法(用户反馈"外跳不好")。跟
 * ReceiptScanSheet.tsx/CategoryDetailSheet.tsx同一套底部弹层视觉规范(遮罩+从
 * 底部滑入的rounded-t卡片)，不是另起一套新样式。
 *
 * PDF本体用<iframe>内嵌渲染——WKWebView(iOS原生壳)原生支持在iframe里直接显示PDF，
 * 不需要额外接入pdf.js这类渲染库。保留一个"在浏览器中打开"的兜底链接，万一某些
 * WebView环境iframe内嵌PDF渲染有问题，用户还有路径能看到内容 */
export function ReceiptPreviewSheet({ open, url, onClose, paths, index = 0, onIndexChange }: ReceiptPreviewSheetProps) {
  const { t } = useI18n()
  if (!open) return null
  const showPager = !!paths && paths.length > 1

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

        {showPager && (
          <div className="flex items-center justify-center gap-md py-2 border-b-[1.5px] border-dashed border-outline-variant shrink-0">
            <button
              type="button"
              aria-label={t('receiptPrevAria')}
              disabled={index <= 0}
              onClick={() => onIndexChange?.(index - 1)}
              className="w-7 h-7 flex items-center justify-center text-on-surface-variant disabled:opacity-30"
            >
              <span className="material-symbols-outlined text-[20px]">chevron_left</span>
            </button>
            <span className="text-body-sm text-on-surface-variant tabular-nums">
              {index + 1} / {paths!.length}
            </span>
            <button
              type="button"
              aria-label={t('receiptNextAria')}
              disabled={index >= paths!.length - 1}
              onClick={() => onIndexChange?.(index + 1)}
              className="w-7 h-7 flex items-center justify-center text-on-surface-variant disabled:opacity-30"
            >
              <span className="material-symbols-outlined text-[20px]">chevron_right</span>
            </button>
          </div>
        )}

        <div className="relative flex-1 min-h-0 bg-surface-container-lowest">
          {/* R-XH：真机反馈这块内容顶到没有标题栏/圆角/遮罩，撑得比屏幕还大——
             根因是<iframe>套PDF在WebKit下height:100%这套百分比/flex链条不可靠，
             系统PDF插件经常按自己的原生尺寸撑开，不听CSS里flex-1/h-full的约束。
             改成父容器position:relative给一个明确的定位基准，iframe本身
             position:absolute+inset:0直接贴满，不依赖百分比高度传导，是解决
             "iframe不听height:100%"这类问题的标准做法 */}
          {url && <iframe src={url} title={t('receiptPreviewTitle')} className="absolute inset-0 w-full h-full border-0" />}
          {/* R-43：切换到下一张/首次打开角标时，新签名URL还没查回来——B-68同款
              .ios-spinner，不要空白一片看起来像卡住 */}
          {!url && (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="ios-spinner text-on-surface-variant">
                {Array.from({ length: 8 }, (_, j) => (
                  <i key={j} style={{ transform: `rotate(${j * 45}deg)`, animationDelay: `${j * 0.125 - 1}s` }} />
                ))}
              </span>
            </div>
          )}
        </div>

        {url && (
          // B-65：这一行是面板贴底的最后一个元素，叠加env(safe-area-inset-bottom)
          // 避免链接文字陷进iPhone Home Indicator安全区
          <div
            className="p-md shrink-0 border-t-[1.5px] border-dashed border-outline-variant"
            style={{ paddingBottom: 'calc(var(--spacing-md) + env(safe-area-inset-bottom))' }}
          >
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
