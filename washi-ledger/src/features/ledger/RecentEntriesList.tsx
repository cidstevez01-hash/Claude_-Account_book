import { useState } from 'react'
import { useI18n } from '../../lib/i18n'
import { groupByDayPinned } from '../../data/summary'
import { EntryCard } from './EntryCard'
import { dayLabel } from './dayLabel'
import type { Category, Entry } from '../../types'

interface RecentEntriesListProps {
  entries: Entry[]
  categories: Category[]
  limit?: number
  onEdit?: (entry: Entry) => void
  onCopy?: (entry: Entry) => void
  onDelete?: (entry: Entry) => void
}

export function RecentEntriesList({
  entries,
  categories,
  limit = 6,
  onEdit,
  onCopy,
  onDelete,
}: RecentEntriesListProps) {
  const { t } = useI18n()
  // 传入的entries已经在DashboardPage按顶部时间范围筛选过了，这里只管排序(照旧App
  // buildDayGroupedHtml的置顶逻辑，见groupByDayPinned的说明)+截取展示条数
  const groups = groupByDayPinned(entries).slice(0, limit)
  // 点一条记录展开操作抽屉(编辑/复制/删除)，照design-assets-v2/_44的"Expanded Action Drawer"，
  // 同一时间只展开一条，不用给每条记录单独维护一个boolean状态
  const [expandedId, setExpandedId] = useState<string | null>(null)

  if (entries.length === 0) {
    return (
      <div className="text-center py-16 px-md text-on-surface-variant">
        <span className="material-symbols-outlined text-4xl mb-2 block opacity-40">receipt_long</span>
        <p className="text-body-md">{t('emptyLine1')}</p>
        <p className="text-body-md">{t('emptyLine2')}</p>
      </div>
    )
  }

  return (
    <section className="px-md">
      <div className="flex justify-between items-end mb-2">
        <h3 className="font-serif text-headline-md text-on-surface">{t('recent')}</h3>
        <button type="button" className="font-sans text-label-caps text-tertiary uppercase tracking-wider">
          {t('viewAll')}
        </button>
      </div>
      <div className="space-y-2">
        {groups.map((group) => (
          <div key={group.date}>
            <div className="mt-3 mb-1">
              <span className="inline-block bg-surface-variant text-on-surface-variant text-[10px] font-sans px-2 py-1 rounded-md">
                {dayLabel(group.date, t)}
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
          </div>
        ))}
      </div>
    </section>
  )
}
