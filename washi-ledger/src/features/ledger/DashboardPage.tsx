import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppLayout } from '../../design-system/components/AppLayout'
import { ConfirmDialog } from '../../design-system/components/ConfirmDialog'
import { BalanceCard } from './BalanceCard'
import { DateRangeBar } from './DateRangeBar'
import { CategoryDonutCard } from './CategoryDonutCard'
import { CategoryDetailSheet } from './CategoryDetailSheet'
import { RecentEntriesList } from './RecentEntriesList'
import { useAuth } from '../auth/useAuth'
import { useCatalog } from '../../hooks/useCatalog'
import { useEntries } from '../../hooks/useEntries'
import { useSettings } from '../../hooks/useSettings'
import { useDisplayRates } from '../../hooks/useDisplayRates'
import { summarizeMonth, categoryBreakdown, isSameMonth } from '../../data/summary'
import { toDisplayEntries } from '../../data/currencyDisplay'
import { deleteEntry } from '../../data/catalog'
import { useI18n } from '../../lib/i18n'
import { APP_ICONS } from '../../lib/appIcons'
import type { EntryType } from '../../types'

export function DashboardPage() {
  const { t, lang } = useI18n()
  const { user } = useAuth()
  const { catalog } = useCatalog()
  const { entries, reload } = useEntries(user?.id ?? null)
  const { settings } = useSettings()
  const rates = useDisplayRates(settings.currency)
  const navigate = useNavigate()

  const [monthAnchor, setMonthAnchor] = useState(() => new Date())
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

  const monthLabel = `${monthAnchor.getFullYear()}年${monthAnchor.getMonth() + 1}月`
  const shiftMonth = (delta: number) =>
    setMonthAnchor((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1))

  const summary = summarizeMonth(displayEntries, monthAnchor)
  const expenseShares = categoryBreakdown(displayEntries, categories, 'expense', monthAnchor, lang)
  const incomeShares = categoryBreakdown(displayEntries, categories, 'income', monthAnchor, lang)

  async function confirmDelete() {
    if (!user || !pendingDeleteId) return
    await deleteEntry(pendingDeleteId, user.id)
    setPendingDeleteId(null)
    reload()
  }

  const detailCategory = categories.find((c) => c.code === detailSelection?.catCode) ?? null
  const detailEntries = detailSelection
    ? displayEntries.filter(
        (e) => e.catCode === detailSelection.catCode && e.type === detailSelection.type && isSameMonth(e.date, monthAnchor)
      )
    : []

  return (
    <AppLayout title={t('appTitle')}>
      {/* entries缓存优先(见useEntries.ts)，比只走网络请求的catalog先就绪很多；catalog没
          就绪前渲染entries相关UI，分类名/颜色/图标全部找不到对应数据，会闪一下"英文图标名
          +统一灰色"的半成品画面——之前用if(!catalog)return null整页提前返回，连header/
          底部导航都出不来，真机上就是"进App白屏一段时间"；改成只在内容区域挡一个轻量的
          loading占位，外壳(header/bottom nav)立刻能看到 */}
      {!catalog ? (
        <div className="flex items-center justify-center py-24">
          <span className="material-symbols-outlined animate-spin text-3xl text-outline">progress_activity</span>
        </div>
      ) : (
        <>
          <DateRangeBar monthLabel={monthLabel} onPrevMonth={() => shiftMonth(-1)} onNextMonth={() => shiftMonth(1)} />
          <BalanceCard summary={summary} currency={settings.currency} />
          <CategoryDonutCard
            expenseShares={expenseShares}
            incomeShares={incomeShares}
            onSelectCategory={(catCode, type) => setDetailSelection({ catCode, type })}
            resetKey={monthLabel}
            currency={settings.currency}
          />
          <RecentEntriesList
            entries={displayEntries}
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
            monthLabel={monthLabel}
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
