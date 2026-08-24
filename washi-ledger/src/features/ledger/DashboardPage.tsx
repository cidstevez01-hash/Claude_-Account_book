import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppLayout } from '../../design-system/components/AppLayout'
import { ConfirmDialog } from '../../design-system/components/ConfirmDialog'
import { CatalogLoadState } from '../../design-system/components/CatalogLoadState'
import { DateRangeBar } from '../../design-system/components/DateRangeBar'
import { BalanceCard } from './BalanceCard'
import { CategoryDonutCard, type TagGroupSelection } from './CategoryDonutCard'
import { CategoryDetailSheet, type CategoryDetailHeader } from './CategoryDetailSheet'
import { RecentEntriesList } from './RecentEntriesList'
import { useAuth } from '../auth/useAuth'
import { useCatalog } from '../../hooks/useCatalog'
import { useEntries } from '../../hooks/useEntries'
import { useSettings } from '../../hooks/useSettings'
import { useDisplayRates } from '../../hooks/useDisplayRates'
import { summarizeRange, categoryBreakdownRange, TAG_MATCHED_COLOR, TAG_OTHER_COLOR } from '../../data/summary'
import { toDisplayEntries } from '../../data/currencyDisplay'
import { deleteEntry } from '../../data/catalog'
import { useI18n } from '../../lib/i18n'
import { catLabel } from '../../lib/catalogLabel'
import { APP_ICONS } from '../../lib/appIcons'
import { firstOfMonthStr, lastOfMonthStr, formatDateRangeLabel } from '../../lib/date'
import type { EntryType } from '../../types'

/** 分类明细钻取(#7扩展)——照旧App openMonthDetail(filter, monthKey)真实逻辑，filter
 * 本来就同时支持{catCode,type}和{tagCode,tagExclude,tagLabelText,type}两种维度，
 * 不是只有分类；标签维度下"点匹配的组"和"点其他那组"都要能钻取，不能禁用 */
type DetailSelection =
  | { kind: 'category'; catCode: string; type: EntryType }
  | { kind: 'tag'; tagCode: string; tagExclude: boolean; tagLabelText: string; type: EntryType }

export function DashboardPage() {
  const { t, lang } = useI18n()
  const { user } = useAuth()
  const { catalog, loading: catalogLoading, reload: reloadCatalog } = useCatalog()
  const { entries, reload, removeLocal } = useEntries(user?.id ?? null)
  const { settings } = useSettings()
  const rates = useDisplayRates(settings.currency)
  const navigate = useNavigate()

  // 起止日期区间——默认当月完整一个月(1日到月末最后一天)，仪表盘结余/环状图/最近明细
  // 全部跟着这个区间走；区间本身可以自由改成任意起止(#8)，只是初始值不能是"1日到今天"，
  // 那样月中打开App时后半个月的数据(包括预先录入的未来日期记录)会被默认区间挡在外面，
  // 看起来像"数据缺失"
  const [startDate, setStartDate] = useState(() => firstOfMonthStr())
  const [endDate, setEndDate] = useState(() => lastOfMonthStr())
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  // 点分类环状图图例钻取明细——照design-assets-v2/_40，逻辑照旧App openMonthDetail搬：
  // 记住点的是分类还是标签维度、具体是哪一个+当时环状图在看支出还是收入
  const [detailSelection, setDetailSelection] = useState<DetailSelection | null>(null)
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
    removeLocal(pendingDeleteId)
    setPendingDeleteId(null)
    reload()
  }

  const detailEntries = useMemo(() => {
    if (!detailSelection) return []
    return displayEntries.filter((e) => {
      if (e.type !== detailSelection.type || e.date < startDate || e.date > endDate) return false
      if (detailSelection.kind === 'category') return e.catCode === detailSelection.catCode
      return detailSelection.tagExclude ? e.tagCode !== detailSelection.tagCode : e.tagCode === detailSelection.tagCode
    })
  }, [detailSelection, displayEntries, startDate, endDate])

  const detailHeader: CategoryDetailHeader | null = useMemo(() => {
    if (!detailSelection) return null
    if (detailSelection.kind === 'category') {
      const cat = categories.find((c) => c.code === detailSelection.catCode)
      return cat ? { icon: cat.icon, color: cat.color, label: catLabel(cat, lang) } : null
    }
    // Material Symbols没有跟旧App自绘"tag"图标完全对应的名字，"sell"(价签图案)是
    // 最接近的现成图标；配色沿用donut图例行同一套TAG_MATCHED_COLOR/TAG_OTHER_COLOR，
    // 跟点进来之前看到的颜色保持一致
    return {
      icon: 'sell',
      color: detailSelection.tagExclude ? TAG_OTHER_COLOR : TAG_MATCHED_COLOR,
      label: detailSelection.tagLabelText,
    }
  }, [detailSelection, categories, lang])

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
            onSelectCategory={(catCode, type) => setDetailSelection({ kind: 'category', catCode, type })}
            onSelectTagGroup={(sel: TagGroupSelection) => setDetailSelection({ kind: 'tag', ...sel })}
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
            paymentMethods={catalog.paymentMethods}
            onViewAll={() => navigate('/history')}
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
            header={detailHeader}
            categories={categories}
            paymentMethods={catalog.paymentMethods}
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
