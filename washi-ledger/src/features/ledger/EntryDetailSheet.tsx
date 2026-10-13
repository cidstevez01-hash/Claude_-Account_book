import { useState, type ReactNode } from 'react'
import { ThemeIcon } from '../../design-system/components/ThemeIcon'
import { tintColor } from '../../lib/color'
import { useI18n } from '../../lib/i18n'
import { formatCurrency } from '../../data/currencyDisplay'
import { formatDateFull } from '../../lib/date'
import { catLabel, subLabel, payLabel, tagLabel } from '../../lib/catalogLabel'
import { PaymentMethodIcon } from '../transactions/PaymentMethodIcon'
import { getReceiptSignedUrl } from '../../data/receiptStorage'
import { openReceiptDocumentNative } from '../../lib/receiptViewer'
import { ReceiptPreviewSheet } from './ReceiptPreviewSheet'
import type { Category, Entry, PaymentMethod, Tag } from '../../types'

interface EntryDetailSheetProps {
  open: boolean
  entry: Entry | null
  category?: Category
  paymentMethod?: PaymentMethod
  tag?: Tag
  onClose: () => void
  /** R-42：编辑/复制/删除——原来挂在EntryCard展开抽屉上的三个操作，这版统一挪进
   * 详情弹层自己的头部(左上角图标组)，"只在仪表盘提供"这条R-40定下的限制也跟着
   * 取消了，复用EntryDetailSheet的5处现在都要传这三个handler，所以定成必传(不是
   * 可选)——用tsc -b的报错逐一揪出所有调用点，照搬R-40给onView做过的同一招，
   * 不会漏改 */
  onEdit: (entry: Entry) => void
  onCopy: (entry: Entry) => void
  onDelete: (entry: Entry) => void
}

/** R-40→R-42：记账条目"查看详情"弹层。跟项目已有的底部弹层规范共用同一套结构
 * (ReceiptPreviewSheet/ReceiptScanSheet/CategoryDetailSheet同款：遮罩点击关闭+
 * 顶部标题栏右上角✕)，不是另起一套。R-42续：头部左上角新增删除/复制/编辑三个
 * 图标(布局参考用户提供的参考App截图：左上图标组+居中标题+右上✕，只参考按钮
 * 位置，不是照抄那个App别的东西)，点击后关掉详情弹层本身(onClose)再触发对应
 * handler(跳转编辑页/复制页，或者交给调用方弹删除确认框)——不堆叠两层弹层。
 *
 * 原来EntryCard卡片右上角独立的"查看凭证"骑缝章角标在R-41合并进来了——有凭证的记录
 * 在详情页里显示凭证列表，每张一行超链接样式(虚线下划线+高亮色，跟
 * AddTransactionPage.tsx小票区域同一套视觉语言，只是这里是只读的，没有删除按钮)，
 * 点开调用方式(getReceiptSignedUrl+openReceiptDocumentNative原生优先、失败才回退
 * ReceiptPreviewSheet弹层)原样照抄EntryCard.tsx之前handleViewReceipt()的实现，
 * 不是重新发明 */
export function EntryDetailSheet({ open, entry, category, paymentMethod, tag, onClose, onEdit, onCopy, onDelete }: EntryDetailSheetProps) {
  const { t, lang } = useI18n()
  // B-68：之前disabled:opacity-50整组变暗看不出点的是哪一条、也看不出在转；改成
  // 记录具体是哪个path在加载，点击的那一行单独换成.ios-spinner转圈(照抄
  // ReceiptScanSheet.tsx同款markup)，其余行继续禁用但不参与转圈视觉
  const [loadingReceiptPath, setLoadingReceiptPath] = useState<string | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  if (!open || !entry) return null
  // TS的null narrowing不会延续进下面这几个闭包里，单独存一份非空引用给它们用，
  // 不用每次都写entry!
  const currentEntry = entry

  function handleEdit() {
    onClose()
    onEdit(currentEntry)
  }
  function handleCopy() {
    onClose()
    onCopy(currentEntry)
  }
  // B-66：删除不像编辑/复制要跳转路由，确认框就在当前页面弹出——不用先onClose()
  // 关掉详情弹层再弹确认框，让确认框直接盖在详情弹层上面(调用方的ConfirmDialog
  // 层级已经调高过，见ConfirmDialog.tsx的z-index说明)。点"取消"时详情弹层本来
  // 就还开着，天然就是"取消后回到预览页"，不需要额外的记忆信号；点"确认"真的删掉
  // 后，调用方会把这条记录从entries里移除，留给各复用点自己的"entries里找不到
  // 当前查看的这条就自动关掉详情弹层"效果来收尾
  function handleDelete() {
    onDelete(currentEntry)
  }

  const isIncome = entry.type === 'income'
  const sub = category?.subs.find((s) => s.code === entry.subCode)
  const title = category
    ? sub
      ? `${catLabel(category, lang)} · ${subLabel(sub, lang)}`
      : catLabel(category, lang)
    : entry.note || '—'

  async function handleViewReceipt(path: string) {
    if (loadingReceiptPath) return
    setLoadingReceiptPath(path)
    try {
      const url = await getReceiptSignedUrl(path)
      const openedNative = await openReceiptDocumentNative(url)
      if (!openedNative) {
        setPreviewUrl(url)
        setPreviewOpen(true)
      }
    } catch (e) {
      console.error('查看レシート凭证失败', e)
    } finally {
      setLoadingReceiptPath(null)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center">
      <div className="absolute inset-0 bg-inverse-surface/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative z-10 w-full max-w-[480px] max-h-[85vh] bg-surface rounded-t-[24px] shadow-xl flex flex-col overflow-hidden">
        {/* 头部用三栏grid(两侧1fr+中间auto)而不是flex justify-between——左边图标组
            (3个)跟右边关闭按钮(1个)宽度本来就不对称，justify-between会让标题视觉
            偏左，grid两侧轨道等宽能保证标题真正居中，不受两边按钮数量不一致影响 */}
        <header className="grid grid-cols-[1fr_auto_1fr] items-center px-md h-16 border-b-[1.5px] border-dashed border-outline-variant shrink-0">
          <div className="flex items-center gap-1 -ml-1.5 justify-self-start">
            <button
              type="button"
              aria-label={t('deleteLabel')}
              onClick={handleDelete}
              className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-variant/50 hover:-translate-y-0.5 active:bg-primary/25 active:scale-90 active:translate-y-0 transition-[background-color,transform]"
            >
              <ThemeIcon icon="delete" effect="bare" size={20} className="text-[20px]" />
            </button>
            <button
              type="button"
              aria-label={t('copyLabel')}
              onClick={handleCopy}
              className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-variant/50 hover:-translate-y-0.5 active:bg-primary/25 active:scale-90 active:translate-y-0 transition-[background-color,transform]"
            >
              <ThemeIcon icon="content_copy" effect="bare" size={20} className="text-[20px]" />
            </button>
            <button
              type="button"
              aria-label={t('editLabel')}
              onClick={handleEdit}
              className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-variant/50 hover:-translate-y-0.5 active:bg-primary/25 active:scale-90 active:translate-y-0 transition-[background-color,transform]"
            >
              <ThemeIcon icon="edit" effect="bare" size={20} className="text-[20px]" />
            </button>
          </div>
          <h2 className="font-serif text-headline-md text-on-surface whitespace-nowrap">{t('entryDetailTitle')}</h2>
          <button
            type="button"
            aria-label={t('closeAria')}
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant justify-self-end hover:bg-surface-variant/50 hover:-translate-y-0.5 active:bg-primary/25 active:scale-90 active:translate-y-0 transition-[background-color,transform]"
          >
            <ThemeIcon icon="close" effect="bare" />
          </button>
        </header>

        {/* B-65：弹层贴着视口最底部(items-end)，内容区原来只有py-md(16px)固定
            底部内边距，没算iPhone Home Indicator安全区，滚动到底时最后一行会
            紧贴/陷进物理圆角区域。用calc叠加env(safe-area-inset-bottom)，没有
            安全区的机型/桌面预览calc结果等于原来的16px，不受影响 */}
        <div
          className="flex-1 min-h-0 overflow-y-auto p-md"
          style={{ paddingBottom: 'calc(var(--spacing-md) + env(safe-area-inset-bottom))' }}
        >
          <div className="flex flex-col items-center text-center gap-2 pb-md">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center"
              style={{ background: category ? tintColor(category.color, 0.85) : 'var(--color-surface-container-highest)' }}
            >
              <span
                className="material-symbols-outlined text-[28px]"
                style={{
                  color: category ? category.color : 'var(--color-on-surface-variant)',
                  fontVariationSettings: "'FILL' 1",
                }}
              >
                {category?.icon || (isIncome ? 'payments' : 'category')}
              </span>
            </div>
            <p className="font-serif text-headline-sm text-on-surface">{title}</p>
            <p
              className="font-serif text-hero-balance"
              style={{ color: isIncome ? 'var(--color-secondary)' : 'var(--color-primary)' }}
            >
              {isIncome ? '+' : '-'}
              {formatCurrency(entry.amount, entry.currency)}
            </p>
          </div>

          <div className="flex flex-col">
            <DetailRow label={t('dateLabel')} value={formatDateFull(entry.date)} />
            {paymentMethod && (
              <DetailRow
                label={t('entryDetailPaymentLabel')}
                value={
                  <span className="inline-flex items-center gap-1.5">
                    <PaymentMethodIcon method={paymentMethod} size={16} />
                    {payLabel(paymentMethod, lang)}
                  </span>
                }
              />
            )}
            {tag && (
              <DetailRow
                label={t('tagsLabel')}
                value={
                  <span className="text-[11px] bg-surface-container rounded-full px-2 py-0.5 text-on-surface-variant">
                    {tagLabel(tag, lang)}
                  </span>
                }
              />
            )}
            {/* B-64：备注跟日期/支付方式等短字段不一样，内容可能很长(OCR识别出的
                逐行小票明细)，不能复用DetailRow的flex justify-between——那套布局
                两边内容都变长时会一起被压缩，标签"メモ"会被挤到按字符换行。改成
                单独的块级布局：标签在上、内容在下各自占满整行宽度，长文本正常
                换行，不会反过来挤压标签 */}
            {entry.note && (
              <div className="py-2.5 border-b border-dashed border-outline-variant/40 last:border-b-0">
                <p className="text-body-sm text-on-surface-variant mb-1">{t('memoLabel')}</p>
                <p className="text-body-md text-on-surface whitespace-pre-wrap break-words">{entry.note}</p>
              </div>
            )}
            {!!entry.points && (
              <DetailRow
                label={t('pointsLabel')}
                value={
                  <span style={{ color: 'var(--color-tertiary)' }}>
                    +{entry.points}
                    {t('calendarPointsUnit')}
                  </span>
                }
              />
            )}
          </div>

          {entry.receiptPaths.length > 0 && (
            <div className="mt-md">
              <p className="text-body-sm text-on-surface-variant mb-1.5">{t('entryDetailReceiptLabel')}</p>
              <div className="flex flex-col rounded-xl border-[1.5px] border-dashed border-outline-variant bg-surface-container-lowest overflow-hidden">
                {entry.receiptPaths.map((path, i) => (
                  <button
                    key={path}
                    type="button"
                    disabled={loadingReceiptPath !== null}
                    onClick={() => handleViewReceipt(path)}
                    className="px-3 py-1.5 border-b border-dashed border-outline-variant/50 last:border-b-0 flex items-center text-left text-body-md text-[var(--color-link)] underline decoration-dashed underline-offset-2 disabled:opacity-50"
                  >
                    {loadingReceiptPath === path ? (
                      // B-68：.ios-spinner的22px是固定几何关系(内部8根小棒的transform-origin
                      // 跟着22px配套算好)，不能用inline style缩放覆盖——这个坑B-55/B-59已经
                      // 踩过，这里直接按原尺寸用，不额外包小尺寸容器
                      <span className="ios-spinner text-[var(--color-link)]">
                        {Array.from({ length: 8 }, (_, j) => (
                          <i key={j} style={{ transform: `rotate(${j * 45}deg)`, animationDelay: `${j * 0.125 - 1}s` }} />
                        ))}
                      </span>
                    ) : (
                      <>
                        {t('receiptItemLabel')}
                        {i + 1}
                      </>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      <ReceiptPreviewSheet open={previewOpen} url={previewUrl} onClose={() => setPreviewOpen(false)} />
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-dashed border-outline-variant/40 last:border-b-0">
      <span className="text-body-sm text-on-surface-variant">{label}</span>
      <span className="text-body-md text-on-surface">{value}</span>
    </div>
  )
}
