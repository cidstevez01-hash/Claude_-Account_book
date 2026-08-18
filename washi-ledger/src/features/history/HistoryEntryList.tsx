import { useState } from 'react'
import { useI18n } from '../../lib/i18n'
import { groupByDay } from '../../data/summary'
import { EntryCard } from '../ledger/EntryCard'
import { dayLabel } from '../ledger/dayLabel'
import type { Category, Entry } from '../../types'

interface HistoryEntryListProps {
  entries: Entry[]
  categories: Category[]
  onEdit?: (entry: Entry) => void
  onCopy?: (entry: Entry) => void
  onDelete?: (entry: Entry) => void
}

/** 明细页的按日分组列表——跟仪表盘的RecentEntriesList不同点：不限条数、每日标题
 * 旁边带当日净额(照design-assets-v2/_13)，没有"最近记录/查看全部"标题 */
export function HistoryEntryList({ entries, categories, onEdit, onCopy, onDelete }: HistoryEntryListProps) {
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
                {dayNet >= 0 ? '+' : '-'}¥{Math.abs(dayNet).toLocaleString()}
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
