import { useI18n } from '../../lib/i18n'
import { groupByDay } from '../../data/summary'
import type { Category, Entry } from '../../types'

interface RecentEntriesListProps {
  entries: Entry[]
  categories: Category[]
  limit?: number
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

export function RecentEntriesList({ entries, categories, limit = 6 }: RecentEntriesListProps) {
  const { t } = useI18n()
  const groups = groupByDay(entries).slice(0, limit)

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
              return (
                <div
                  key={entry.id}
                  className="flex items-center bg-surface-container-lowest rounded-lg p-3 mb-2 border border-outline-variant papercut-shadow"
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
                    <p className="text-body-lg text-on-surface truncate">
                      {cat ? cat.zh : entry.note || '—'}
                    </p>
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
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </section>
  )
}
