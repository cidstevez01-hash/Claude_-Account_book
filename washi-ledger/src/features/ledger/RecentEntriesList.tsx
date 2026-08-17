import { useState } from 'react'
import { useI18n } from '../../lib/i18n'
import { groupByDay } from '../../data/summary'
import type { Category, Entry } from '../../types'

interface RecentEntriesListProps {
  entries: Entry[]
  categories: Category[]
  limit?: number
  onEdit?: (entry: Entry) => void
  onCopy?: (entry: Entry) => void
  onDelete?: (entry: Entry) => void
}

function dayLabel(dateStr: string, t: (k: 'today' | 'yesterday') => string) {
  const d = new Date(dateStr)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  if (sameDay(d, today)) return t('today')
  if (sameDay(d, yesterday)) return t('yesterday')
  return dateStr
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
  const groups = groupByDay(entries).slice(0, limit)
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
              const isIncome = entry.type === 'income'
              const expanded = expandedId === entry.id
              return (
                <div
                  key={entry.id}
                  className="flex flex-col bg-surface-container-lowest rounded-lg mb-2 border border-outline-variant papercut-shadow overflow-hidden"
                >
                  <button
                    type="button"
                    className="flex items-center p-3 text-left"
                    onClick={() => setExpandedId(expanded ? null : entry.id)}
                  >
                    <div
                      className="w-[38px] h-[38px] rounded-full border-2 flex items-center justify-center bg-surface-container-highest mr-3 shrink-0"
                      style={{ borderColor: isIncome ? 'var(--color-secondary)' : 'var(--color-primary-container)' }}
                    >
                      <span
                        className="material-symbols-outlined text-xl"
                        style={{
                          color: isIncome ? 'var(--color-secondary)' : 'var(--color-primary)',
                          fontVariationSettings: "'FILL' 1",
                        }}
                      >
                        {isIncome ? 'payments' : cat?.icon || 'category'}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-body-lg text-on-surface truncate">{cat ? cat.zh : entry.note || '—'}</p>
                      <p className="text-body-md text-on-surface-variant text-xs truncate">
                        {entry.note || cat?.zh || ''}
                      </p>
                    </div>
                    <p
                      className="font-serif text-entry-amount shrink-0 ml-2"
                      style={{ color: isIncome ? 'var(--color-secondary)' : 'var(--color-on-surface)' }}
                    >
                      {isIncome ? '+' : '-'}¥{entry.amount.toLocaleString()}
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
                        <span className="text-[10px] font-sans uppercase">编辑</span>
                      </button>
                      <button
                        type="button"
                        className="flex flex-col items-center gap-1 text-on-surface-variant"
                        onClick={() => onCopy?.(entry)}
                      >
                        <span className="material-symbols-outlined text-[20px]">content_copy</span>
                        <span className="text-[10px] font-sans uppercase">复制</span>
                      </button>
                      <button
                        type="button"
                        className="flex flex-col items-center gap-1 text-primary"
                        onClick={() => onDelete?.(entry)}
                      >
                        <span className="material-symbols-outlined text-[20px]">delete</span>
                        <span className="text-[10px] font-sans uppercase">删除</span>
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </section>
  )
}
