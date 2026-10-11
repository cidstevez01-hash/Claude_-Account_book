import { useState } from 'react'
import { useI18n } from '../../lib/i18n'
import { groupByDay } from '../../data/summary'
import { formatCurrency } from '../../data/currencyDisplay'
import { EntryCard } from '../ledger/EntryCard'
import { EntryDetailSheet } from '../ledger/EntryDetailSheet'
import { dayLabel } from '../ledger/dayLabel'
import type { Category, Entry, PaymentMethod, Tag } from '../../types'

interface HistoryEntryListProps {
  entries: Entry[]
  categories: Category[]
  paymentMethods: PaymentMethod[]
  tags: Tag[]
  /** 当日净额的显示币种——调用方(HistoryPage)传入前应该已经用
   * data/currencyDisplay.ts的toDisplayEntries()把entries统一换算成这个币种了，
   * 这里只管格式化显示，不做换算 */
  currency: string
}

/** 明细页的按日分组列表——跟仪表盘的RecentEntriesList不同点：不限条数、每日标题
 * 旁边带当日净额(照design-assets-v2/_13)，没有"最近记录/查看全部"标题。编辑/复制/
 * 删除操作按用户要求收拢到仪表盘("全放在首页操作")，这里不传onEdit/onCopy/
 * onDelete这三个handler给EntryCard——EntryCard自己会按有没有传来决定要不要显示
 * 对应的操作抽屉。R-40续：查看详情不受这条限制，onView必传，明细页这边之前点击条目
 * 完全没反应(expanded写死false)，现在真正接上展开态+详情弹层 */
export function HistoryEntryList({ entries, categories, paymentMethods, tags, currency }: HistoryEntryListProps) {
  const { t } = useI18n()
  const groups = groupByDay(entries)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [viewEntry, setViewEntry] = useState<Entry | null>(null)

  if (entries.length === 0) {
    return (
      <div className="text-center py-16 px-md text-on-surface-variant">
        <span className="material-symbols-outlined text-4xl mb-2 block opacity-40">receipt_long</span>
        <p className="text-body-md">{t('historyNoResults')}</p>
      </div>
    )
  }

  const viewCategory = viewEntry ? categories.find((c) => c.code === viewEntry.catCode) : undefined
  const viewPaymentMethod = viewEntry ? paymentMethods.find((p) => p.code === viewEntry.paymentMethod) : undefined
  const viewTag = viewEntry ? tags.find((tg) => tg.code === viewEntry.tagCode) : undefined

  return (
    <div className="flex flex-col gap-lg px-md">
      {groups.map((group) => {
        const dayNet = group.entries.reduce((acc, e) => acc + (e.type === 'income' ? e.amount : -e.amount), 0)
        // R-32续：gap-sm(12px)→gap-md(16px)——レシート角标探出卡片顶部最多16px，
        // 这里header跟第一张卡片之间的间距(靠这个flex gap撑开，header自己没有
        // margin-bottom)原本12px不够，改成16px正好卡住不会撞线
        return (
          <section key={group.date} className="flex flex-col gap-md">
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
              const pm = paymentMethods.find((p) => p.code === entry.paymentMethod)
              return (
                <EntryCard
                  key={entry.id}
                  entry={entry}
                  category={cat}
                  paymentMethod={pm}
                  expanded={expandedId === entry.id}
                  onToggle={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                  onView={setViewEntry}
                />
              )
            })}
          </section>
        )
      })}
      <EntryDetailSheet
        open={!!viewEntry}
        entry={viewEntry}
        category={viewCategory}
        paymentMethod={viewPaymentMethod}
        tag={viewTag}
        onClose={() => setViewEntry(null)}
      />
    </div>
  )
}
