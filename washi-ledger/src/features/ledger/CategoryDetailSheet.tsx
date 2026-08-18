import { useState } from 'react'
import { groupByDay } from '../../data/summary'
import { formatCurrency } from '../../data/currencyDisplay'
import { EntryCard } from './EntryCard'
import { dayLabel } from './dayLabel'
import { useI18n } from '../../lib/i18n'
import { catLabel } from '../../lib/catalogLabel'
import type { Category, Entry } from '../../types'

interface CategoryDetailSheetProps {
  open: boolean
  category: Category | null
  monthLabel: string
  entries: Entry[]
  /** 顶部总额的显示币种——调用方应该已经用toDisplayEntries()把entries统一换算成
   * 这个币种了，这里只管格式化，不做换算 */
  currency?: string
  onClose: () => void
  onEdit?: (entry: Entry) => void
  onCopy?: (entry: Entry) => void
  onDelete?: (entry: Entry) => void
}

/** 分类明细钻取——点仪表盘分类环状图的图例行，弹出该分类当月的明细列表，照
 * design-assets-v2/_40(Category Detail)做，逻辑照旧仓库index.html的
 * openMonthDetail/renderMonthDetailList(按分类筛选那条分支)搬：标题+当月总额+
 * 按日分组的记录列表，从底部滑入的sheet而不是新开一个路由页面 */
export function CategoryDetailSheet({
  open,
  category,
  monthLabel,
  entries,
  currency = 'CNY',
  onClose,
  onEdit,
  onCopy,
  onDelete,
}: CategoryDetailSheetProps) {
  const { t, lang } = useI18n()
  const [expandedId, setExpandedId] = useState<string | null>(null)

  if (!open || !category) return null

  const total = entries.reduce((sum, e) => sum + e.amount, 0)
  const groups = groupByDay(entries)

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center">
      <div className="absolute inset-0 bg-inverse-surface/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative z-10 w-full max-w-[480px] max-h-[85vh] bg-surface rounded-t-[24px] shadow-xl flex flex-col overflow-hidden">
        <header className="flex items-center justify-between px-md h-16 border-b-[1.5px] border-dashed border-outline-variant shrink-0">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined" style={{ color: category.color }}>
              {category.icon}
            </span>
            <h2 className="font-serif text-headline-md text-on-surface">{catLabel(category, lang)}</h2>
          </div>
          <button type="button" aria-label={t('closeAria')} onClick={onClose} className="w-8 h-8 flex items-center justify-center text-on-surface-variant">
            <span className="material-symbols-outlined">close</span>
          </button>
        </header>

        <div className="flex-1 overflow-y-auto overflow-x-hidden px-md py-md">
          <div className="flex flex-col items-center mb-md">
            <span className="text-label-caps font-sans text-on-surface-variant uppercase">
              {monthLabel} · TOTAL
            </span>
            <span className="font-serif text-headline-lg text-on-surface">{formatCurrency(total, currency)}</span>
          </div>
          <div className="w-full border-t border-outline-variant mb-md" />

          {groups.length === 0 ? (
            <p className="text-center text-body-md text-on-surface-variant py-8">{t('historyNoResults')}</p>
          ) : (
            groups.map((group) => (
              <div key={group.date} className="mb-3">
                <span className="inline-block bg-surface-variant text-on-surface-variant text-[10px] font-sans px-2 py-1 rounded-md mb-1">
                  {dayLabel(group.date, t)}
                </span>
                {group.entries.map((entry) => (
                  <EntryCard
                    key={entry.id}
                    entry={entry}
                    category={category}
                    expanded={expandedId === entry.id}
                    onToggle={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                    onEdit={onEdit}
                    onCopy={onCopy}
                    onDelete={onDelete}
                  />
                ))}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
