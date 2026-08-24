import { tintColor } from '../../lib/color'
import { useI18n } from '../../lib/i18n'
import { formatCurrency } from '../../data/currencyDisplay'
import { catLabel, subLabel, payLabel } from '../../lib/catalogLabel'
import { PaymentMethodIcon } from '../transactions/PaymentMethodIcon'
import type { Category, Entry, PaymentMethod } from '../../types'

interface EntryCardProps {
  entry: Entry
  category?: Category
  paymentMethod?: PaymentMethod
  expanded: boolean
  onToggle: () => void
  onEdit?: (entry: Entry) => void
  onCopy?: (entry: Entry) => void
  onDelete?: (entry: Entry) => void
}

/** 单条记账记录的可展开卡片(点击展开编辑/复制/删除操作抽屉)，照design-assets-v2/_44的
 * "Expanded Action Drawer"实现。仪表盘的最近记录列表和明细页的完整列表共用这个组件，
 * 避免同一段UI在两个页面各写一遍。 */
export function EntryCard({ entry, category, paymentMethod, expanded, onToggle, onEdit, onCopy, onDelete }: EntryCardProps) {
  const { t, lang } = useI18n()
  const isIncome = entry.type === 'income'
  // "分类·子分类"——照旧App renderEntry()的catLine真实格式(有子分类才拼，没有就只显示分类)；
  // 名字按当前语言取(catLabel/subLabel)，不是硬编码.zh
  const sub = category?.subs.find((s) => s.code === entry.subCode)
  const title = category
    ? sub
      ? `${catLabel(category, lang)} · ${subLabel(sub, lang)}`
      : catLabel(category, lang)
    : entry.note || '—'
  return (
    <div className="entry-card flex flex-col bg-surface-container-lowest mb-2 overflow-hidden">
      <button type="button" className="flex items-center p-3 text-left" onClick={onToggle}>
        <div
          className="w-[38px] h-[38px] rounded-full flex items-center justify-center mr-3 shrink-0"
          style={{ background: category ? tintColor(category.color, 0.85) : 'var(--color-surface-container-highest)' }}
        >
          <span
            className="material-symbols-outlined text-xl"
            style={{
              color: category ? category.color : 'var(--color-on-surface-variant)',
              fontVariationSettings: "'FILL' 1",
            }}
          >
            {category?.icon || (isIncome ? 'payments' : 'category')}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-sans text-body-lg font-medium text-on-surface truncate">{title}</p>
          {/* R-15：账目明细补上支付方式(图标+文字)，照旧App.entry-meta/.pay-badge真实结构——
              支付方式徽标和备注同一行并排展示，不是备注单独占一行 */}
          {(paymentMethod || entry.note) && (
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              {paymentMethod && (
                <span className="inline-flex items-center gap-1 text-[11px] text-on-surface-variant bg-surface-container rounded-md px-1.5 py-px shrink-0">
                  <PaymentMethodIcon method={paymentMethod} size={12} />
                  {payLabel(paymentMethod, lang)}
                </span>
              )}
              {entry.note && <span className="text-xs text-on-surface-variant truncate">{entry.note}</span>}
            </div>
          )}
        </div>
        <p
          className="font-serif text-entry-amount shrink-0 ml-2"
          style={{ color: isIncome ? 'var(--color-secondary)' : 'var(--color-primary)' }}
        >
          {isIncome ? '+' : '-'}
          {formatCurrency(entry.amount, entry.currency)}
        </p>
      </button>

      {expanded && (
        <div className="flex items-center justify-around py-2 px-md bg-surface-container-low border-t border-dashed border-outline-variant/30">
          <button
            type="button"
            className="flex flex-col items-center gap-1 text-on-surface-variant"
            onClick={() => onEdit?.(entry)}
          >
            <span className="material-symbols-outlined text-[20px]">edit</span>
            <span className="text-[10px] font-sans uppercase">{t('editLabel')}</span>
          </button>
          <button
            type="button"
            className="flex flex-col items-center gap-1 text-on-surface-variant"
            onClick={() => onCopy?.(entry)}
          >
            <span className="material-symbols-outlined text-[20px]">content_copy</span>
            <span className="text-[10px] font-sans uppercase">{t('copyLabel')}</span>
          </button>
          <button
            type="button"
            className="flex flex-col items-center gap-1 text-primary"
            onClick={() => onDelete?.(entry)}
          >
            <span className="material-symbols-outlined text-[20px]">delete</span>
            <span className="text-[10px] font-sans uppercase">{t('deleteLabel')}</span>
          </button>
        </div>
      )}
    </div>
  )
}
