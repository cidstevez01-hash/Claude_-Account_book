import { useState } from 'react'
import { useI18n } from '../../lib/i18n'
import { groupByDay } from '../../data/summary'
import { formatCurrency } from '../../data/currencyDisplay'
import { EntryCard } from '../ledger/EntryCard'
import { dayLabel } from '../ledger/dayLabel'
import type { Category, Entry } from '../../types'

interface HistoryEntryListProps {
  entries: Entry[]
  categories: Category[]
  /** 当日净额的显示币种——调用方(HistoryPage)传入前应该已经用
   * data/currencyDisplay.ts的toDisplayEntries()把entries统一换算成这个币种了，
   * 这里只管格式化显示，不做换算 */
  currency: string
  onEdit?: (entry: Entry) => void
  onCopy?: (entry: Entry) => void
  onDelete?: (entry: Entry) => void
}

/** 明细页的按日分组列表——跟仪表盘的RecentEntriesList不同点：不限条数、每日标题
 * 旁边带当日净额(照design-assets-v2/_13)，没有"最近记录/查看全部"标题 */
export function HistoryEntryList({ entries, categories, currency, onEdit, onCopy, onDelete }: HistoryEntryListProps) {
  const { t } = useI18n()
  const groups = groupByDay(entries)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  if (entries.length === 0) {
    return (
      <div className="text-center py-16 px-md text-on-surface-variant">
        <span className="material-symbols-outlined text-4xl mb-2 block opacity-40">receipt_long</span>
        <p className="text-body-md">{t('historyNoResults')}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-lg px-md">
      {groups.map((group) => {
        const dayNet = group.entries.reduce((acc, e) => acc + (e.type === 'income' ? e.amount : -e.amount), 0)
        return (
          <section key={group.date} className="flex flex-col gap-sm">
            <div className="flex justify-between items-end border-b-[1.5px] border-dashed border-outline-variant pb-1">
              <span className="inline-block bg-surface-variant text-on-surface-variant px-2 py-1 rounded-md text-label-caps font-sans">
                {dayLabel(group.date, t)}
              </span>
              <span
                className="font-serif text-stat-figure"
                style={{ color: dayNet >= 0 ? 'var(--color-secondary)' : 'var(--color-primary)' }}
              >
                {dayNet >= 0 ? '+' : '-'}
                {formatCurrency(Math.abs(dayNet), currency)}
              </span>
            </div>
            {group.entries.map((entry) => {
              const cat = categories.find((c) => c.code === entry.catCode)
              return (
                <EntryCard
                  key={entry.id}
                  entry={entry}
                  category={cat}
                  expanded={expandedId === entry.id}
                  onToggle={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                  onEdit={onEdit}
                  onCopy={onCopy}
                  onDelete={onDelete}
                />
              )
            })}
          </section>
        )
      })}
    </div>
  )
}
