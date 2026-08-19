import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppLayout } from '../../design-system/components/AppLayout'
import { ConfirmDialog } from '../../design-system/components/ConfirmDialog'
import { CatalogLoadState } from '../../design-system/components/CatalogLoadState'
import { DateRangeBar } from '../../design-system/components/DateRangeBar'
import { BalanceCard } from './BalanceCard'
import { CategoryDonutCard } from './CategoryDonutCard'
import { CategoryDetailSheet } from './CategoryDetailSheet'
import { RecentEntriesList } from './RecentEntriesList'
import { useAuth } from '../auth/useAuth'
import { useCatalog } from '../../hooks/useCatalog'
import { useEntries } from '../../hooks/useEntries'
import { useSettings } from '../../hooks/useSettings'
import { useDisplayRates } from '../../hooks/useDisplayRates'
import { summarizeRange, categoryBreakdownRange } from '../../data/summary'
import { toDisplayEntries } from '../../data/currencyDisplay'
import { deleteEntry } from '../../data/catalog'
import { useI18n } from '../../lib/i18n'
import { APP_ICONS } from '../../lib/appIcons'
import { todayStr, firstOfMonthStr, formatDateRangeLabel } from '../../lib/date'
import type { EntryType } from '../../types'

export function DashboardPage() {
  const { t, lang } = useI18n()
  const { user } = useAuth()
  const { catalog, loading: catalogLoading, reload: reloadCatalog } = useCatalog()
  const { entries, reload } = useEntries(user?.id ?? null)
  const { settings } = useSettings()
  const rates = useDisplayRates(settings.currency)
  const navigate = useNavigate()

  // 起止日期区间——默认当月1日到今天(#8)，仪表盘结余/环状图/最近明细全部跟着这个区间走，
  // 不再固定按"当前日历月"算
  const [startDate, setStartDate] = useState(() => firstOfMonthStr())
  const [endDate, setEndDate] = useState(() => todayStr())
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  // 点分类环状图图例钻取明细——照design-assets-v2/_40，逻辑照旧App openMonthDetail
  // (按分类筛选那条分支)搬：记住点的是哪个分类+当时环状图在看支出还是收入
  const [detailSelection, setDetailSelection] = useState<{ catCode: string; type: EntryType } | null>(null)
  const categories = useMemo(
    () => [...(catalog?.expenseCategories ?? []), ...(catalog?.incomeCategories ?? [])],
    [catalog]
  )
  // 每条记录按settings.currency统一换算后再参与后面的求和/占比计算(照旧App
  // dayTotal用reduce(...+toBase(...))的真实模式，见data/currencyDisplay.ts的说明)
  const displayEntries = useMemo(
    () => toDisplayEntries(entries, settings.currency, rates),
    [entries, settings.currency, rates]
  )

  const rangeLabel = formatDateRangeLabel(startDate, endDate)

  const summary = summarizeRange(displayEntries, startDate, endDate)
  const expenseShares = categoryBreakdownRange(displayEntries, categories, 'expense', startDate, endDate, lang)
  const incomeShares = categoryBreakdownRange(displayEntries, categories, 'income', startDate, endDate, lang)
  // 最近明细(#6)——只显示当前选中区间内的记录，排序用groupByDayPinned(见RecentEntriesList.tsx)
  const recentEntries = useMemo(
    () => displayEntries.filter((e) => e.date >= startDate && e.date <= endDate),
    [displayEntries, startDate, endDate]
  )

  async function confirmDelete() {
    if (!user || !pendingDeleteId) return
    await deleteEntry(pendingDeleteId, user.id)
    setPendingDeleteId(null)
    reload()
  }

  const detailCategory = categories.find((c) => c.code === detailSelection?.catCode) ?? null
  const detailEntries = detailSelection
    ? displayEntries.filter(
        (e) =>
          e.catCode === detailSelection.catCode &&
          e.type === detailSelection.type &&
          e.date >= startDate &&
          e.date <= endDate
      )
    : []

  return (
    <AppLayout title={t('appTitle')}>
      {/* entries缓存优先(见useEntries.ts)，比只走网络请求的catalog先就绪很多；catalog没
          就绪前渲染entries相关UI，分类名/颜色/图标全部找不到对应数据，会闪一下"英文图标名
          +统一灰色"的半成品画面——之前用if(!catalog)return null整页提前返回，连header/
          底部导航都出不来，真机上就是"进App白屏一段时间"；改成只在内容区域挡一个轻量的
          loading占位，外壳(header/bottom nav)立刻能看到。catalogLoading为false但catalog
          仍是null说明请求失败了(比如网络问题)，不能一直转圈圈却什么反馈都没有，
          CatalogLoadState按这两种状态分别显示转圈圈/错误提示+重试按钮 */}
      {!catalog ? (
        <CatalogLoadState loading={catalogLoading} onRetry={reloadCatalog} />
      ) : (
        <>
          <div className="mx-md mt-md mb-2">
            <DateRangeBar
              startDate={startDate}
              endDate={endDate}
              onChange={(s, e) => {
                setStartDate(s)
                setEndDate(e)
              }}
            />
          </div>
          <BalanceCard summary={summary} currency={settings.currency} />
          <CategoryDonutCard
            expenseShares={expenseShares}
            incomeShares={incomeShares}
            onSelectCategory={(catCode, type) => setDetailSelection({ catCode, type })}
            resetKey={rangeLabel}
            currency={settings.currency}
            tagDimension={{
              entries: displayEntries,
              expenseTags: catalog.expenseTags,
              incomeTags: catalog.incomeTags,
              startDate,
              endDate,
            }}
          />
          <RecentEntriesList
            entries={recentEntries}
            categories={categories}
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

          <CategoryDetailSheet
            open={detailSelection != null}
            category={detailCategory}
            monthLabel={rangeLabel}
            entries={detailEntries}
            currency={settings.currency}
            onClose={() => setDetailSelection(null)}
            onEdit={(entry) => navigate(`/add?editId=${entry.id}`)}
            onCopy={(entry) => navigate(`/add?copyId=${entry.id}`)}
            onDelete={(entry) => setPendingDeleteId(entry.id)}
          />
        </>
      )}

      <button
        type="button"
        aria-label={t('addTitle')}
        onClick={() => navigate('/add')}
        className="stamp-shadow fixed z-40 flex items-center justify-center w-[58px] h-[58px] rounded-full bg-primary text-on-primary"
        style={{
          right: 'max(20px, calc(50% - 240px + 20px))',
          bottom: 'calc(6rem + 24px)',
          boxShadow: '0 4px 0 var(--color-primary-container)',
        }}
      >
        <span className="material-symbols-outlined text-3xl">{APP_ICONS.addTransaction}</span>
      </button>
    </AppLayout>
  )
}
