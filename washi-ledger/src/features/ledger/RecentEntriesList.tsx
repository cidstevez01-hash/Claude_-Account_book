import { useState } from 'react'
import { useI18n } from '../../lib/i18n'
import { groupByDayPinned } from '../../data/summary'
import { EntryCard } from './EntryCard'
import { dayLabel } from './dayLabel'
import type { Category, Entry, PaymentMethod } from '../../types'

interface RecentEntriesListProps {
  entries: Entry[]
  categories: Category[]
  paymentMethods: PaymentMethod[]
  onViewAll?: () => void
  onEdit?: (entry: Entry) => void
  onCopy?: (entry: Entry) => void
  onDelete?: (entry: Entry) => void
  /** 新建/编辑/复制保存后跳回仪表盘，要定位/高亮到这条记录——见
   * lib/dashboardFocusMemory.ts，DashboardPage挂载后consume一次传下来 */
  focusEntryId?: string | null
}

export function RecentEntriesList({
  entries,
  categories,
  paymentMethods,
  onViewAll,
  onEdit,
  onCopy,
  onDelete,
  focusEntryId,
}: RecentEntriesListProps) {
  const { t } = useI18n()
  // 传入的entries已经在DashboardPage按顶部时间范围筛选过了，这里只管排序(照旧App
  // buildDayGroupedHtml的置顶逻辑，见groupByDayPinned的说明)——之前这里还会再截取前
  // limit(=6)条，那是"仪表盘固定显示最近几条"的旧设计；现在顶部有了真正可调的日期
  // 范围，范围内该有多少条就得显示多少条，不然调节范围时列表看起来"没反应"(范围内
  // 已经有6条以上时，不管怎么调都还是那6条)
  const groups = groupByDayPinned(entries)
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
        <button
          type="button"
          onClick={onViewAll}
          className="font-sans text-label-caps text-tertiary uppercase tracking-wider"
        >
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
              const pm = paymentMethods.find((p) => p.code === entry.paymentMethod)
              return (
                <EntryCard
                  key={entry.id}
                  id={`entry-${entry.id}`}
                  highlighted={focusEntryId === entry.id}
                  entry={entry}
                  category={cat}
                  paymentMethod={pm}
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
