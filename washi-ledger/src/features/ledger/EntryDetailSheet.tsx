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
}

/** R-40→R-41：记账条目"查看详情"弹层——纯只读展示，不含编辑/删除(用户明确要求"这只是
 * 详情"，编辑/删除继续走EntryCard展开抽屉原有的入口，不重复放进这里)。跟项目已有的
 * 底部弹层规范共用同一套结构(ReceiptPreviewSheet/ReceiptScanSheet/CategoryDetailSheet
 * 同款：遮罩点击关闭+顶部标题栏右上角✕)，不是另起一套。
 *
 * 原来EntryCard卡片右上角独立的"查看凭证"骑缝章角标在这版合并进来了——有凭证的记录
 * 在详情页里显示凭证列表，每张一行超链接样式(虚线下划线+主色高亮，跟
 * AddTransactionPage.tsx小票区域同一套视觉语言，只是这里是只读的，没有删除按钮)，
 * 点开调用方式(getReceiptSignedUrl+openReceiptDocumentNative原生优先、失败才回退
 * ReceiptPreviewSheet弹层)原样照抄EntryCard.tsx之前handleViewReceipt()的实现，
 * 不是重新发明 */
export function EntryDetailSheet({ open, entry, category, paymentMethod, tag, onClose }: EntryDetailSheetProps) {
  const { t, lang } = useI18n()
  const [receiptBusy, setReceiptBusy] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  if (!open || !entry) return null

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
        <header className="flex items-center justify-between px-md h-16 border-b-[1.5px] border-dashed border-outline-variant shrink-0">
          <h2 className="font-serif text-headline-md text-on-surface">{t('entryDetailTitle')}</h2>
          <button
            type="button"
            aria-label={t('closeAria')}
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-on-surface-variant"
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
                    className="px-3 py-1.5 border-b border-dashed border-outline-variant/50 last:border-b-0 text-left text-body-md text-primary underline decoration-dashed underline-offset-2 disabled:opacity-50"
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
