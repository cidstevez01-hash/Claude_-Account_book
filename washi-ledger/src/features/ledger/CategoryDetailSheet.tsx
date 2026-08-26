import { useEffect, useRef, useState } from 'react'
import { groupByDay } from '../../data/summary'
import { formatCurrency } from '../../data/currencyDisplay'
import { EntryCard } from './EntryCard'
import { dayLabel } from './dayLabel'
import { useI18n } from '../../lib/i18n'
import type { Category, Entry, PaymentMethod } from '../../types'

export interface CategoryDetailHeader {
  icon: string
  color: string
  label: string
}

interface CategoryDetailSheetProps {
  open: boolean
  /** 弹层标题图标/颜色/文字——分类维度传该分类的icon/color/catLabel()结果，标签维度
   * (#7的钻取分支)传标签对应的图标/配色/文字，两种维度是互斥的，同一时刻只会有一种 */
  header: CategoryDetailHeader | null
  /** 全量分类列表，用来给列表里每一条记录各自查它自己的分类图标/颜色——标签维度下
   * 一次钻取出来的记录可能横跨好几个不同分类(比如"外食"标签下有餐饮也有交通打车的
   * 记录)，不能像分类维度那样直接假设"列表里所有记录都是header这一个分类" */
  categories: Category[]
  paymentMethods: PaymentMethod[]
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

/** 分类/标签明细钻取——点仪表盘分类环状图的图例行，弹出该分类(或该标签，见#7)当月的
 * 明细列表，照design-assets-v2/_40(Category Detail)做，逻辑照旧仓库index.html的
 * openMonthDetail/renderMonthDetailList搬(该函数本来就同时支持catCode/tagCode两种
 * 筛选维度，不是只有分类)：标题+当月总额+按日分组的记录列表，从底部滑入的sheet而不是
 * 新开一个路由页面 */
export function CategoryDetailSheet({
  open,
  header,
  categories,
  paymentMethods,
  monthLabel,
  entries,
  currency = 'CNY',
  onClose,
  onEdit,
  onCopy,
  onDelete,
}: CategoryDetailSheetProps) {
  const { t } = useI18n()
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // 弹出/收起做平缓过渡——照旧仓库index.html真实的.sheet/.sheet.show搬：初始
  // transform:translateY(105%)，show时translateY(0)，0.3s cubic-bezier(.32,.72,0,1)。
  // 之前open变false就直接return null，没有退场动画，弹窗是"啪"一下消失/出现，
  // 这里改成open=false后还多停留300ms(退场动画时长)才真正卸载；header/entries
  // 这些内容父组件在关闭的同一刻就清空了，退场这300ms期间用一份快照兜底，不然
  // 动画播到一半内容突然变白屏
  const [mounted, setMounted] = useState(open)
  const [visible, setVisible] = useState(false)
  const snapshotRef = useRef<{
    header: CategoryDetailHeader
    categories: Category[]
    paymentMethods: PaymentMethod[]
    monthLabel: string
    entries: Entry[]
    currency: string
  } | null>(null)
  if (open && header) {
    snapshotRef.current = { header, categories, paymentMethods, monthLabel, entries, currency }
  }

  useEffect(() => {
    if (open) {
      setMounted(true)
      // 挂载的第一帧还是初始态(translateY(105%))，下一帧再切到show，这样浏览器
      // 才有"起点"可以过渡，不会直接跳到终态
      const raf = requestAnimationFrame(() => setVisible(true))
      return () => cancelAnimationFrame(raf)
    }
    setVisible(false)
    const timer = window.setTimeout(() => setMounted(false), 300)
    return () => window.clearTimeout(timer)
  }, [open])

  if (!mounted || !snapshotRef.current) return null
  const snap = snapshotRef.current

  const total = snap.entries.reduce((sum, e) => sum + e.amount, 0)
  const groups = groupByDay(snap.entries)

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center">
      <div
        className="absolute inset-0 bg-inverse-surface/40 backdrop-blur-[2px] transition-opacity duration-300"
        style={{ opacity: visible ? 1 : 0 }}
        onClick={onClose}
      />
      <div
        className="relative z-10 w-full max-w-[480px] max-h-[85vh] bg-surface rounded-t-[24px] shadow-xl flex flex-col overflow-hidden transition-transform duration-300"
        style={{ transform: visible ? 'translateY(0)' : 'translateY(105%)', transitionTimingFunction: 'cubic-bezier(.32,.72,0,1)' }}
      >
        <header className="flex items-center justify-between px-md h-16 border-b-[1.5px] border-dashed border-outline-variant shrink-0">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined" style={{ color: snap.header.color }}>
              {snap.header.icon}
            </span>
            <h2 className="font-serif text-headline-md text-on-surface">{snap.header.label}</h2>
          </div>
          <button type="button" aria-label={t('closeAria')} onClick={onClose} className="w-8 h-8 flex items-center justify-center text-on-surface-variant">
            <span className="material-symbols-outlined">close</span>
          </button>
        </header>

        <div className="flex-1 overflow-y-auto overflow-x-hidden px-md py-md">
          <div className="flex flex-col items-center mb-md">
            <span className="text-label-caps font-sans text-on-surface-variant uppercase">
              {snap.monthLabel} · TOTAL
            </span>
            <span className="font-serif text-headline-lg text-on-surface">{formatCurrency(total, snap.currency)}</span>
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
                    category={snap.categories.find((c) => c.code === entry.catCode)}
                    paymentMethod={snap.paymentMethods.find((p) => p.code === entry.paymentMethod)}
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
