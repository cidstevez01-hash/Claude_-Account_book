import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppLayout } from '../../design-system/components/AppLayout'
import { ConfirmDialog } from '../../design-system/components/ConfirmDialog'
import { CatalogLoadState } from '../../design-system/components/CatalogLoadState'
import { MonthNavBar } from './MonthNavBar'
import { TrendControls } from './TrendControls'
import { TrendLegend } from './TrendLegend'
import { PointsDonutCard } from './PointsDonutCard'
import { CategoryDonutCard } from '../ledger/CategoryDonutCard'
import { CategoryDetailSheet, type CategoryDetailHeader } from '../ledger/CategoryDetailSheet'
import { TrendBarChart } from '../../design-system/components/TrendBarChart'
import { useAuth } from '../auth/useAuth'
import { useCatalog } from '../../hooks/useCatalog'
import { useEntries } from '../../hooks/useEntries'
import { useSettings } from '../../hooks/useSettings'
import { useDisplayRates } from '../../hooks/useDisplayRates'
import {
  summarizeMonth,
  categoryBreakdown,
  pointsBreakdownByPaymentMethod,
  dailyTrendBuckets,
  monthlyTrendBuckets,
  dailyPointsTrendBuckets,
  monthlyPointsTrendBuckets,
  aggregateTrendSegments,
  hasEntriesInMonth,
  hasEntriesInYear,
} from '../../data/summary'
import { toDisplayEntries, formatCurrency, symbolFor } from '../../data/currencyDisplay'
import { deleteEntry } from '../../data/catalog'
import { useI18n } from '../../lib/i18n'
import { catLabel } from '../../lib/catalogLabel'
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

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/** 统计页——顶部收支/积分胶囊切换照design-assets-v2/_38/_39/_41做，但内部数据维度
 * 照旧仓库index.html的真实Stats页逻辑来(而不是Stitch设计稿里"Shopping Rewards"那种
 * 数据库里根本没有的虚构分类)：收支栏是分类内訳+按日/按月趋势柱状图，积分栏是按
 * 支付方式内訳+积分推移柱状图。
 *
 * 趋势图下方图例的两种状态照旧App的showTrendPointInfo/showPointsTrendDetail搬：
 * 默认显示可见范围内的聚合图例(点一行钻取该分类的CategoryDetailSheet明细)；点了
 * 某根柱子之后，切换成那一根柱子自己的分类拆分(替换掉聚合图例，不是新开弹窗)。
 * 积分推移图没有"默认聚合图例"这个状态(旧App本来就没有，只有点开才显示明细)。
 *
 * 收支趋势图和积分推移图各自维护独立的年月导航状态，不跟分类/支付方式内訳donut共用
 * 的monthAnchor混在一起——照旧App"两张趋势图互不干扰"的设计。
 *
 * 跟旧App的差距(留着，以后再补)：趋势图纵轴刻度这次是按整段可见范围的最大值算死的，
 * 不会跟着横向滚动视口实时重新适配；跨月份的"累计残高"自定义区间选择器，donut这边
 * 仍简化成单月导航
 */
export function StatsPage() {
  const { t, lang } = useI18n()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { catalog, loading: catalogLoading, reload: reloadCatalog } = useCatalog()
  const { entries, reload, removeLocal } = useEntries(user?.id ?? null)
  const { settings } = useSettings()
  const rates = useDisplayRates(settings.currency)

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
  // 每条记录按settings.currency统一换算后再参与求和/趋势图计算(见data/currencyDisplay.ts)；
  // 积分不是货币，pointsBreakdownByPaymentMethod/积分推移图继续吃原始entries，不用换算
  const displayEntries = useMemo(
    () => toDisplayEntries(entries, settings.currency, rates),
    [entries, settings.currency, rates]
  )

  const summary = summarizeMonth(displayEntries, monthAnchor)
  const expenseShares = categoryBreakdown(displayEntries, categories, 'expense', monthAnchor, lang)
  const incomeShares = categoryBreakdown(displayEntries, categories, 'income', monthAnchor, lang)
  const pointsShares = pointsBreakdownByPaymentMethod(entries, paymentMethods, monthAnchor, lang)

  const now = new Date()

  // 收支趋势图——独立状态
  const [trendDim, setTrendDim] = useState<TrendDim>('day')
  const [trendType, setTrendType] = useState<EntryType>('expense')
  const [trendDayYear, setTrendDayYear] = useState(now.getFullYear())
  const [trendDayMonth, setTrendDayMonth] = useState(now.getMonth() + 1)
  const [trendMonthYear, setTrendMonthYear] = useState(now.getFullYear())
  const [selectedTrendIdx, setSelectedTrendIdx] = useState<number | null>(null)
  const trendBuckets =
    trendDim === 'day'
      ? dailyTrendBuckets(displayEntries, categories, trendType, trendDayYear, trendDayMonth, lang)
      : monthlyTrendBuckets(displayEntries, categories, trendType, trendMonthYear, lang)
  const trendPeriodLabel = trendDim === 'day' ? `${trendDayYear}年${trendDayMonth}月` : `${trendMonthYear}年`
  const trendAggregate = useMemo(() => aggregateTrendSegments(trendBuckets), [trendBuckets])

  function changeTrendDim(dim: TrendDim) {
    setTrendDim(dim)
    setSelectedTrendIdx(null)
  }
  function changeTrendType(type: EntryType) {
    setTrendType(type)
    setSelectedTrendIdx(null)
  }
  function shiftTrend(delta: number) {
    setSelectedTrendIdx(null)
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
  const [selectedPointsTrendIdx, setSelectedPointsTrendIdx] = useState<number | null>(null)
  const pointsTrendBuckets =
    pointsTrendDim === 'day'
      ? dailyPointsTrendBuckets(entries, categories, pointsDayYear, pointsDayMonth, lang)
      : monthlyPointsTrendBuckets(entries, categories, pointsMonthYear, lang)
  const pointsTrendPeriodLabel =
    pointsTrendDim === 'day' ? `${pointsDayYear}年${pointsDayMonth}月` : `${pointsMonthYear}年`

  function changePointsTrendDim(dim: TrendDim) {
    setPointsTrendDim(dim)
    setSelectedPointsTrendIdx(null)
  }
  function shiftPointsTrend(delta: number) {
    setSelectedPointsTrendIdx(null)
    if (pointsTrendDim === 'day') {
      const [y, m] = stepMonth(pointsDayYear, pointsDayMonth, delta)
      setPointsDayYear(y)
      setPointsDayMonth(m)
    } else {
      setPointsMonthYear((y) => y + delta)
    }
  }

  // 用户反馈：顶部月份导航条切换年月后，下面两张趋势图完全没跟着变，感知上像坏了——
  // 两张趋势图各自维护独立年月状态这个设计本身没问题(点开趋势图之后还能各自继续往前
  // 后翻看)，但至少切顶部月份的这一刻应该把两张图都重新定位到那个月/那一年，不能让
  // 它们停在"App刚打开时的当前月"纹丝不动
  useEffect(() => {
    const y = monthAnchor.getFullYear()
    const m = monthAnchor.getMonth() + 1
    setTrendDayYear(y)
    setTrendDayMonth(m)
    setTrendMonthYear(y)
    setSelectedTrendIdx(null)
    setPointsDayYear(y)
    setPointsDayMonth(m)
    setPointsMonthYear(y)
    setSelectedPointsTrendIdx(null)
  }, [monthAnchor])

  // 照旧App monthHasAnyEntries()的真实逻辑：切到完全没有记录的月份/年份没有意义，禁用
  // 对应方向的箭头。这几个月份导航条(顶部+两张趋势图各自的)都是同一类"切过去看到一张
  // 空图"的场景，一并套用
  const [monthAnchorPrevY, monthAnchorPrevM] = stepMonth(monthAnchor.getFullYear(), monthAnchor.getMonth() + 1, -1)
  const [monthAnchorNextY, monthAnchorNextM] = stepMonth(monthAnchor.getFullYear(), monthAnchor.getMonth() + 1, 1)
  const monthAnchorDisablePrev = !hasEntriesInMonth(entries, monthAnchorPrevY, monthAnchorPrevM)
  const monthAnchorDisableNext = !hasEntriesInMonth(entries, monthAnchorNextY, monthAnchorNextM)

  const trendDisablePrev =
    trendDim === 'day'
      ? !hasEntriesInMonth(entries, ...stepMonth(trendDayYear, trendDayMonth, -1))
      : !hasEntriesInYear(entries, trendMonthYear - 1)
  const trendDisableNext =
    trendDim === 'day'
      ? !hasEntriesInMonth(entries, ...stepMonth(trendDayYear, trendDayMonth, 1))
      : !hasEntriesInYear(entries, trendMonthYear + 1)

  const pointsTrendDisablePrev =
    pointsTrendDim === 'day'
      ? !hasEntriesInMonth(entries, ...stepMonth(pointsDayYear, pointsDayMonth, -1))
      : !hasEntriesInYear(entries, pointsMonthYear - 1)
  const pointsTrendDisableNext =
    pointsTrendDim === 'day'
      ? !hasEntriesInMonth(entries, ...stepMonth(pointsDayYear, pointsDayMonth, 1))
      : !hasEntriesInYear(entries, pointsMonthYear + 1)

  // 点收支趋势图的聚合图例一行——钻取那个分类在当前趋势图可见范围(按日=当月，按月=当年)内的明细
  const [detailCatCode, setDetailCatCode] = useState<string | null>(null)
  const detailCategory = categories.find((c) => c.code === detailCatCode) ?? null
  const detailHeader: CategoryDetailHeader | null = detailCategory
    ? { icon: detailCategory.icon, color: detailCategory.color, label: catLabel(detailCategory, lang) }
    : null
  const detailRangePrefix = trendDim === 'day' ? `${trendDayYear}-${pad2(trendDayMonth)}` : `${trendMonthYear}`
  const detailEntries = detailCatCode
    ? displayEntries.filter((e) => e.catCode === detailCatCode && e.type === trendType && e.date.startsWith(detailRangePrefix))
    : []

  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

  async function confirmDelete() {
    if (!user || !pendingDeleteId) return
    await deleteEntry(pendingDeleteId, user.id)
    removeLocal(pendingDeleteId)
    setPendingDeleteId(null)
    reload()
  }

  // R-17：下拉刷新——重新拉一次账目记录+分类/支付方式目录，两个互不依赖并行拉
  async function handleRefresh() {
    await Promise.all([reload(), reloadCatalog()])
  }

  return (
    <AppLayout title={t('tabStats')} onRefresh={handleRefresh}>
      <div className="px-md pt-md mb-md">
        <div className="w-full bg-surface-container rounded-full p-1 flex relative border-[1.5px] border-dashed border-outline-variant/50">
          <div
            className="absolute top-1 bottom-1 w-[calc(50%-4px)] bg-primary-container rounded-full transition-transform duration-200"
            style={{ transform: tab === 'points' ? 'translateX(calc(100% + 8px))' : 'translateX(0)' }}
          />
          <button
            type="button"
            onClick={() => setTab('cashflow')}
            className={`relative z-10 flex-1 py-2 text-center text-body-lg font-normal ${
              tab === 'cashflow' ? 'text-on-primary-container' : 'text-on-surface-variant'
            }`}
          >
            {t('statsTabMoney')}
          </button>
          <button
            type="button"
            onClick={() => setTab('points')}
            className={`relative z-10 flex-1 py-2 text-center text-body-lg font-normal ${
              tab === 'points' ? 'text-on-primary-container' : 'text-on-surface-variant'
            }`}
          >
            {t('statsTabPoints')}
          </button>
        </div>
      </div>

      {/* catalog未就绪前只挡数据区域，顶部tab胶囊(不依赖catalog)照常显示——原理同
          DashboardPage.tsx，见那边的注释 */}
      {!catalog ? (
        <CatalogLoadState loading={catalogLoading} onRetry={reloadCatalog} />
      ) : (
      <>
      <div className="mb-md">
        <MonthNavBar
          monthLabel={monthLabel}
          onPrevMonth={() => shiftMonth(-1)}
          onNextMonth={() => shiftMonth(1)}
          disablePrev={monthAnchorDisablePrev}
          disableNext={monthAnchorDisableNext}
        />
      </div>

      {tab === 'cashflow' ? (
        <>
          <div className="flex gap-sm px-md mb-lg">
            <div className="flex-1 bg-surface-container-lowest border border-outline-variant rounded-xl p-sm text-center">
              <p className="text-label-caps font-sans text-on-surface-variant uppercase">{t('monthIncome')}</p>
              <p className="font-serif text-stat-figure text-secondary">{formatCurrency(summary.income, settings.currency)}</p>
            </div>
            <div className="flex-1 bg-surface-container-lowest border border-outline-variant rounded-xl p-sm text-center">
              <p className="text-label-caps font-sans text-on-surface-variant uppercase">{t('monthExpense')}</p>
              <p className="font-serif text-stat-figure text-primary">{formatCurrency(summary.expense, settings.currency)}</p>
            </div>
          </div>
          <CategoryDonutCard expenseShares={expenseShares} incomeShares={incomeShares} resetKey={monthLabel} currency={settings.currency} />

          <section className="mx-md mb-lg bg-surface-container-lowest rounded-xl p-md border-[1.5px] border-dashed border-outline-variant papercut-shadow">
            <div className="flex items-center justify-between mb-sm">
              <h3 className="font-serif text-headline-md text-on-surface">{t('statsTrendTitle')}</h3>
              <select
                value={trendType}
                onChange={(e) => changeTrendType(e.target.value as EntryType)}
                className="bg-transparent border-none text-body-md text-on-surface-variant focus:outline-none focus:ring-0"
              >
                <option value="expense">{t('typeExpense')}</option>
                <option value="income">{t('typeIncome')}</option>
              </select>
            </div>
            <TrendControls
              dim={trendDim}
              onDimChange={changeTrendDim}
              periodLabel={trendPeriodLabel}
              onPrev={() => shiftTrend(-1)}
              onNext={() => shiftTrend(1)}
              disablePrev={trendDisablePrev}
              disableNext={trendDisableNext}
            />
            <TrendBarChart
              buckets={trendBuckets}
              selectedIndex={selectedTrendIdx}
              onSelectBucket={(idx) => setSelectedTrendIdx(idx === selectedTrendIdx ? null : idx)}
            />
            <TrendLegend
              aggregate={trendAggregate}
              selectedBucket={selectedTrendIdx != null ? trendBuckets[selectedTrendIdx] : null}
              valuePrefix={symbolFor(settings.currency)}
              onSelectCategory={(catCode) => setDetailCatCode(catCode)}
              onClosePoint={() => setSelectedTrendIdx(null)}
              resetKey={`${trendDim}-${trendType}-${trendPeriodLabel}`}
            />
          </section>
        </>
      ) : (
        <>
          <PointsDonutCard shares={pointsShares} resetKey={monthLabel} />

          <section className="mx-md mb-lg bg-surface-container-lowest rounded-xl p-md border-[1.5px] border-dashed border-outline-variant papercut-shadow">
            <h3 className="font-serif text-headline-md text-on-surface mb-sm">{t('pointsTrendTitle')}</h3>
            <TrendControls
              dim={pointsTrendDim}
              onDimChange={changePointsTrendDim}
              periodLabel={pointsTrendPeriodLabel}
              onPrev={() => shiftPointsTrend(-1)}
              onNext={() => shiftPointsTrend(1)}
              disablePrev={pointsTrendDisablePrev}
              disableNext={pointsTrendDisableNext}
            />
            <TrendBarChart
              buckets={pointsTrendBuckets}
              selectedIndex={selectedPointsTrendIdx}
              onSelectBucket={(idx) => setSelectedPointsTrendIdx(idx === selectedPointsTrendIdx ? null : idx)}
            />
            <TrendLegend
              aggregate={[]}
              selectedBucket={selectedPointsTrendIdx != null ? pointsTrendBuckets[selectedPointsTrendIdx] : null}
              valuePrefix="+"
              onClosePoint={() => setSelectedPointsTrendIdx(null)}
            />
          </section>
        </>
      )}

      <CategoryDetailSheet
        open={detailCatCode != null}
        header={detailHeader}
        categories={categories}
        paymentMethods={paymentMethods}
        monthLabel={trendPeriodLabel}
        entries={detailEntries}
        currency={settings.currency}
        onClose={() => setDetailCatCode(null)}
        onEdit={(entry) => navigate(`/add?editId=${entry.id}`)}
        onCopy={(entry) => navigate(`/add?copyId=${entry.id}`)}
        onDelete={(entry) => setPendingDeleteId(entry.id)}
      />

      <ConfirmDialog
        open={pendingDeleteId != null}
        title={t('confirmDeleteTitle')}
        message={t('confirmDeleteMessage')}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDeleteId(null)}
      />
      </>
      )}
    </AppLayout>
  )
}
