import { useState, type ReactNode } from 'react'
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
  const [receiptBusy, setReceiptBusy] = useState(false)
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
  function handleDelete() {
    onClose()
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
    if (receiptBusy) return
    setReceiptBusy(true)
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
      setReceiptBusy(false)
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
              className="w-8 h-8 flex items-center justify-center text-on-surface-variant"
            >
              <span className="material-symbols-outlined text-[20px]">delete</span>
            </button>
            <button
              type="button"
              aria-label={t('copyLabel')}
              onClick={handleCopy}
              className="w-8 h-8 flex items-center justify-center text-on-surface-variant"
            >
              <span className="material-symbols-outlined text-[20px]">content_copy</span>
            </button>
            <button
              type="button"
              aria-label={t('editLabel')}
              onClick={handleEdit}
              className="w-8 h-8 flex items-center justify-center text-on-surface-variant"
            >
              <span className="material-symbols-outlined text-[20px]">edit</span>
            </button>
          </div>
          <h2 className="font-serif text-headline-md text-on-surface whitespace-nowrap">{t('entryDetailTitle')}</h2>
          <button
            type="button"
            aria-label={t('closeAria')}
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-on-surface-variant justify-self-end"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </header>

        <div className="flex-1 min-h-0 overflow-y-auto p-md">
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
            {entry.note && <DetailRow label={t('memoLabel')} value={entry.note} />}
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
                    disabled={receiptBusy}
                    onClick={() => handleViewReceipt(path)}
                    className="px-3 py-1.5 border-b border-dashed border-outline-variant/50 last:border-b-0 text-left text-body-md text-[var(--color-link)] underline decoration-dashed underline-offset-2 disabled:opacity-50"
                  >
                    {t('receiptItemLabel')}
                    {i + 1}
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
