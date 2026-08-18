import { useMemo, useState } from 'react'
import { AppLayout } from '../../design-system/components/AppLayout'
import { MonthNavBar } from './MonthNavBar'
import { TrendControls } from './TrendControls'
import { PointsDonutCard } from './PointsDonutCard'
import { CategoryDonutCard } from '../ledger/CategoryDonutCard'
import { TrendBarChart } from '../../design-system/components/TrendBarChart'
import { useAuth } from '../auth/useAuth'
import { useCatalog } from '../../hooks/useCatalog'
import { useEntries } from '../../hooks/useEntries'
import {
  summarizeMonth,
  categoryBreakdown,
  pointsBreakdownByPaymentMethod,
  dailyTrendBuckets,
  monthlyTrendBuckets,
  dailyPointsTrendBuckets,
  monthlyPointsTrendBuckets,
} from '../../data/summary'
import { useI18n } from '../../lib/i18n'
import type { EntryType } from '../../types'

type StatsTab = 'cashflow' | 'points'
type TrendDim = 'day' | 'month'

function stepMonth(year: number, month: number, delta: number): [number, number] {
  let y = year
  let m = month + delta
  while (m < 1) {
    m += 12
    y--
  }
  while (m > 12) {
    m -= 12
    y++
  }
  return [y, m]
}

/** 统计页——顶部收支/积分胶囊切换照design-assets-v2/_38/_39/_41做，但内部数据维度
 * 照旧仓库index.html的真实Stats页逻辑来(而不是Stitch设计稿里"Shopping Rewards"那种
 * 数据库里根本没有的虚构分类)：收支栏是分类内訳+按日/按月趋势柱状图，积分栏是按
 * 支付方式内訳+积分推移柱状图。
 *
 * 收支趋势图和积分推移图各自维护独立的年月导航状态，不跟分类/支付方式内訳donut共用
 * 的monthAnchor混在一起——照旧App"两张趋势图互不干扰"的设计。
 *
 * 跟旧App的差距(留着，以后再补)：趋势图纵轴刻度这次是按整段可见范围的最大值算死的，
 * 不会跟着横向滚动视口实时重新适配；点柱子弹出单日/单月明细这个交互也没做；跨月份的
 * "累计残高"自定义区间选择器，donut这边仍简化成单月导航
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

  const now = new Date()

  // 收支趋势图——独立状态
  const [trendDim, setTrendDim] = useState<TrendDim>('day')
  const [trendType, setTrendType] = useState<EntryType>('expense')
  const [trendDayYear, setTrendDayYear] = useState(now.getFullYear())
  const [trendDayMonth, setTrendDayMonth] = useState(now.getMonth() + 1)
  const [trendMonthYear, setTrendMonthYear] = useState(now.getFullYear())
  const trendBuckets =
    trendDim === 'day'
      ? dailyTrendBuckets(entries, categories, trendType, trendDayYear, trendDayMonth)
      : monthlyTrendBuckets(entries, categories, trendType, trendMonthYear)
  const trendPeriodLabel = trendDim === 'day' ? `${trendDayYear}年${trendDayMonth}月` : `${trendMonthYear}年`
  function shiftTrend(delta: number) {
    if (trendDim === 'day') {
      const [y, m] = stepMonth(trendDayYear, trendDayMonth, delta)
      setTrendDayYear(y)
      setTrendDayMonth(m)
    } else {
      setTrendMonthYear((y) => y + delta)
    }
  }

  // 积分推移图——独立状态，不跟上面的收支趋势图共用年月
  const [pointsTrendDim, setPointsTrendDim] = useState<TrendDim>('day')
  const [pointsDayYear, setPointsDayYear] = useState(now.getFullYear())
  const [pointsDayMonth, setPointsDayMonth] = useState(now.getMonth() + 1)
  const [pointsMonthYear, setPointsMonthYear] = useState(now.getFullYear())
  const pointsTrendBuckets =
    pointsTrendDim === 'day'
      ? dailyPointsTrendBuckets(entries, pointsDayYear, pointsDayMonth)
      : monthlyPointsTrendBuckets(entries, pointsMonthYear)
  const pointsTrendPeriodLabel =
    pointsTrendDim === 'day' ? `${pointsDayYear}年${pointsDayMonth}月` : `${pointsMonthYear}年`
  function shiftPointsTrend(delta: number) {
    if (pointsTrendDim === 'day') {
      const [y, m] = stepMonth(pointsDayYear, pointsDayMonth, delta)
      setPointsDayYear(y)
      setPointsDayMonth(m)
    } else {
      setPointsMonthYear((y) => y + delta)
    }
  }

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

          <section className="mx-md mb-lg bg-surface-container-lowest rounded-xl p-md border-[1.5px] border-dashed border-outline-variant papercut-shadow">
            <div className="flex items-center justify-between mb-sm">
              <h3 className="font-serif text-headline-md text-on-surface">收支趋势</h3>
              <select
                value={trendType}
                onChange={(e) => setTrendType(e.target.value as EntryType)}
                className="bg-transparent border-none text-body-md text-on-surface-variant focus:outline-none focus:ring-0"
              >
                <option value="expense">支出</option>
                <option value="income">收入</option>
              </select>
            </div>
            <TrendControls
              dim={trendDim}
              onDimChange={setTrendDim}
              periodLabel={trendPeriodLabel}
              onPrev={() => shiftTrend(-1)}
              onNext={() => shiftTrend(1)}
            />
            <TrendBarChart buckets={trendBuckets} />
          </section>
        </>
      ) : (
        <>
          <PointsDonutCard shares={pointsShares} />

          <section className="mx-md mb-lg bg-surface-container-lowest rounded-xl p-md border-[1.5px] border-dashed border-outline-variant papercut-shadow">
            <h3 className="font-serif text-headline-md text-on-surface mb-sm">还元(获得积分)推移</h3>
            <TrendControls
              dim={pointsTrendDim}
              onDimChange={setPointsTrendDim}
              periodLabel={pointsTrendPeriodLabel}
              onPrev={() => shiftPointsTrend(-1)}
              onNext={() => shiftPointsTrend(1)}
            />
            <TrendBarChart buckets={pointsTrendBuckets} />
          </section>
        </>
      )}
    </AppLayout>
  )
}
