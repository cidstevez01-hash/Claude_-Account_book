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
  onEdit: (entry: Entry) => void
  onCopy: (entry: Entry) => void
  onDelete: (entry: Entry) => void
  /** R-42：明细页新建/编辑/复制保存后跳回来，要定位/高亮到这条记录——见
   * lib/historyFocusMemory.ts，HistoryPage挂载后consume一次传下来，跟仪表盘
   * RecentEntriesList同款做法 */
  focusEntryId?: string | null
}

/** 明细页的按日分组列表——跟仪表盘的RecentEntriesList不同点：不限条数、每日标题
 * 旁边带当日净额(照design-assets-v2/_13)，没有"最近记录/查看全部"标题。R-42起
 * 编辑/复制/删除不再限制"只能在仪表盘操作"，这里也要传onEdit/onCopy/onDelete给
 * EntryDetailSheet(原来点击条目完全没反应、后来R-40接上只读详情弹层，这版详情
 * 弹层自己头部多了这三个操作图标) */
export function HistoryEntryList({ entries, categories, paymentMethods, tags, currency, onEdit, onCopy, onDelete, focusEntryId }: HistoryEntryListProps) {
  const { t } = useI18n()
  const groups = groupByDay(entries)
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
                  id={`entry-${entry.id}`}
                  highlighted={focusEntryId === entry.id}
                  entry={entry}
                  category={cat}
                  paymentMethod={pm}
                  onOpenDetail={setViewEntry}
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
        onEdit={onEdit}
        onCopy={onCopy}
        onDelete={onDelete}
      />
    </div>
  )
}
