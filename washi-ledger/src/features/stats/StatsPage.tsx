import { useMemo, useState } from 'react'
import { AppLayout } from '../../design-system/components/AppLayout'
import { MonthNavBar } from './MonthNavBar'
import { PointsDonutCard } from './PointsDonutCard'
import { CategoryDonutCard } from '../ledger/CategoryDonutCard'
import { useAuth } from '../auth/useAuth'
import { useCatalog } from '../../hooks/useCatalog'
import { useEntries } from '../../hooks/useEntries'
import { summarizeMonth, categoryBreakdown, pointsBreakdownByPaymentMethod } from '../../data/summary'
import { useI18n } from '../../lib/i18n'

type StatsTab = 'cashflow' | 'points'

/** 统计页——顶部收支/积分胶囊切换照design-assets-v2/_38/_39/_41做，但内部数据维度
 * 照旧仓库index.html的真实Stats页逻辑来(而不是Stitch设计稿里"Shopping Rewards"那种
 * 数据库里根本没有的虚构分类)：收支栏是分类内訳，积分栏是按支付方式内訳。
 *
 * 跟旧App的差距(先留着，以后再补)：
 * - 旧App的按日/按月收支趋势折线图、积分推移折线图这两张可横向滚动的SVG图表这里没做，
 *   工作量接近半个仪表盘，先只做月度快照(分类/支付方式内訳donut)
 * - 旧App头部有个跨月份的"累计残高"自定义区间选择器，这里先简化成单月导航
 */
export function StatsPage() {
  const { t } = useI18n()
  const { user } = useAuth()
  const { catalog } = useCatalog()
  const { entries } = useEntries(user?.id ?? null)

  const [tab, setTab] = useState<StatsTab>('cashflow')
  const [monthAnchor, setMonthAnchor] = useState(() => new Date())
  const monthLabel = `${monthAnchor.getFullYear()}年${monthAnchor.getMonth() + 1}月`
  const shiftMonth = (delta: number) =>
    setMonthAnchor((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1))

  const categories = useMemo(
    () => [...(catalog?.expenseCategories ?? []), ...(catalog?.incomeCategories ?? [])],
    [catalog]
  )
  const paymentMethods = catalog?.paymentMethods ?? []

  const summary = summarizeMonth(entries, monthAnchor)
  const expenseShares = categoryBreakdown(entries, categories, 'expense', monthAnchor)
  const incomeShares = categoryBreakdown(entries, categories, 'income', monthAnchor)
  const pointsShares = pointsBreakdownByPaymentMethod(entries, paymentMethods, monthAnchor)

  return (
    <AppLayout title={t('tabStats')}>
      <div className="px-md pt-md mb-md">
        <div className="w-full bg-surface-container rounded-full p-1 flex relative border-[1.5px] border-dashed border-outline-variant/50">
          <div
            className="absolute top-1 bottom-1 w-[calc(50%-4px)] bg-primary-container rounded-full transition-transform duration-200"
            style={{ transform: tab === 'points' ? 'translateX(calc(100% + 8px))' : 'translateX(0)' }}
          />
          <button
            type="button"
            onClick={() => setTab('cashflow')}
            className={`relative z-10 flex-1 py-2 text-center text-body-lg font-semibold ${
              tab === 'cashflow' ? 'text-on-primary-container' : 'text-on-surface-variant'
            }`}
          >
            收支
          </button>
          <button
            type="button"
            onClick={() => setTab('points')}
            className={`relative z-10 flex-1 py-2 text-center text-body-lg font-semibold ${
              tab === 'points' ? 'text-on-primary-container' : 'text-on-surface-variant'
            }`}
          >
            积分
          </button>
        </div>
      </div>

      <div className="mb-md">
        <MonthNavBar monthLabel={monthLabel} onPrevMonth={() => shiftMonth(-1)} onNextMonth={() => shiftMonth(1)} />
      </div>

      {tab === 'cashflow' ? (
        <>
          <div className="flex gap-sm px-md mb-lg">
            <div className="flex-1 bg-surface-container-lowest border border-outline-variant rounded-xl p-sm text-center">
              <p className="text-label-caps font-sans text-on-surface-variant uppercase">{t('monthIncome')}</p>
              <p className="font-serif text-stat-figure text-secondary">¥{summary.income.toLocaleString()}</p>
            </div>
            <div className="flex-1 bg-surface-container-lowest border border-outline-variant rounded-xl p-sm text-center">
              <p className="text-label-caps font-sans text-on-surface-variant uppercase">{t('monthExpense')}</p>
              <p className="font-serif text-stat-figure text-primary">¥{summary.expense.toLocaleString()}</p>
            </div>
          </div>
          <CategoryDonutCard expenseShares={expenseShares} incomeShares={incomeShares} />
        </>
      ) : (
        <PointsDonutCard shares={pointsShares} />
      )}
    </AppLayout>
  )
}
