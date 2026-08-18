import { useState } from 'react'
import { DonutRing } from '../../design-system/components/DonutRing'
import { ScrollLegendList } from '../../design-system/components/ScrollLegendList'
import type { CategoryShare } from '../../data/summary'
import type { EntryType } from '../../types'

interface CategoryDonutCardProps {
  expenseShares: CategoryShare[]
  incomeShares: CategoryShare[]
  onSelectCategory?: (catCode: string, type: EntryType) => void
  /** 数据源整体切换时(比如翻月)传一个变化的值进来，图例滚动位置跟着回到顶部——
   * 照旧App resetScroll=true的场景("翻月"也算)，不只是切支出/收入这一种情况 */
  resetKey?: string | number
}

export function CategoryDonutCard({ expenseShares, incomeShares, onSelectCategory, resetKey }: CategoryDonutCardProps) {
  const [tab, setTab] = useState<EntryType>('expense')
  const shares = tab === 'expense' ? expenseShares : incomeShares
  const total = shares.reduce((sum, s) => sum + s.amount, 0)

  return (
    <section className="mx-md mb-lg bg-surface-container-lowest rounded-xl p-md border-[1.5px] border-dashed border-outline-variant papercut-shadow">
      <div className="flex border-b border-dashed border-outline-variant mb-3">
        {(['expense', 'income'] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`flex-1 py-2 font-serif text-headline-md transition-colors border-b-2 ${
              tab === key ? 'text-primary border-primary' : 'text-on-surface-variant border-transparent'
            }`}
          >
            {key === 'expense' ? '支出' : '收入'}
          </button>
        ))}
      </div>

      {shares.length === 0 ? (
        <p className="text-center text-body-md text-on-surface-variant py-8">这个月还没有记录</p>
      ) : (
        <div className="flex flex-col items-center py-2">
          <div className="relative w-48 h-48 mb-3">
            <DonutRing shares={shares.map((s) => ({ key: s.catCode, color: s.color, ratio: s.ratio }))} />
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-[10px] font-sans text-on-surface-variant uppercase">
                {tab === 'expense' ? 'Total Expenses' : 'Total Income'}
              </span>
              <span className="font-serif text-stat-figure text-primary">
                ¥{total.toLocaleString()}
              </span>
            </div>
          </div>

          <ScrollLegendList key={`${tab}-${resetKey ?? ''}`}>
            <div className="flex flex-col gap-y-2 w-full px-2 mt-2">
              {shares.map((share) => (
                <button
                  key={share.catCode}
                  type="button"
                  onClick={() => onSelectCategory?.(share.catCode, tab)}
                  className="flex items-center gap-3 py-1 border-b border-dashed border-outline-variant/30 text-left active:opacity-70"
                >
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ background: share.color }} />
                  <span className="text-body-md text-on-surface flex-1">{share.label}</span>
                  <span className="text-stat-figure text-xs text-on-surface-variant mr-4">
                    {Math.round(share.ratio * 100)}%
                  </span>
                  <span className="font-serif text-stat-figure text-on-surface">¥{share.amount.toLocaleString()}</span>
                </button>
              ))}
            </div>
          </ScrollLegendList>
        </div>
      )}
    </section>
  )
}
