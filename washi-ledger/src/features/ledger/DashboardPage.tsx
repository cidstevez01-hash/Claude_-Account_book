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
import { summarizeMonth, categoryBreakdown, isSameMonth } from '../../data/summary'
import { deleteEntry } from '../../data/catalog'
import { useI18n } from '../../lib/i18n'
import { APP_ICONS } from '../../lib/appIcons'
import type { EntryType } from '../../types'

export function DashboardPage() {
  const { t } = useI18n()
  const { user } = useAuth()
  const { catalog } = useCatalog()
  const { entries, reload } = useEntries(user?.id ?? null)
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

  // entries现在是缓存优先(见useEntries.ts)，比只走网络请求的catalog先就绪很多；
  // 在catalog没就绪前渲染entries相关UI，分类名/颜色/图标全部找不到对应数据，会
  // 闪一下"英文图标名+统一灰色"这种半成品画面，等catalog真正到位才渲染正文
  if (!catalog) return null

  const monthLabel = `${monthAnchor.getFullYear()}年${monthAnchor.getMonth() + 1}月`
  const shiftMonth = (delta: number) =>
    setMonthAnchor((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1))

  const summary = summarizeMonth(entries, monthAnchor)
  const expenseShares = categoryBreakdown(entries, categories, 'expense', monthAnchor)
  const incomeShares = categoryBreakdown(entries, categories, 'income', monthAnchor)

  async function confirmDelete() {
    if (!user || !pendingDeleteId) return
    await deleteEntry(pendingDeleteId, user.id)
    setPendingDeleteId(null)
    reload()
  }

  const detailCategory = categories.find((c) => c.code === detailSelection?.catCode) ?? null
  const detailEntries = detailSelection
    ? entries.filter(
        (e) => e.catCode === detailSelection.catCode && e.type === detailSelection.type && isSameMonth(e.date, monthAnchor)
      )
    : []

  return (
    <AppLayout title={t('appTitle')}>
      <DateRangeBar monthLabel={monthLabel} onPrevMonth={() => shiftMonth(-1)} onNextMonth={() => shiftMonth(1)} />
      <BalanceCard summary={summary} currency="CNY" />
      <CategoryDonutCard
        expenseShares={expenseShares}
        incomeShares={incomeShares}
        onSelectCategory={(catCode, type) => setDetailSelection({ catCode, type })}
        resetKey={monthLabel}
      />
      <RecentEntriesList
        entries={entries}
        categories={categories}
        onEdit={(entry) => navigate(`/add?editId=${entry.id}`)}
        onCopy={(entry) => navigate(`/add?copyId=${entry.id}`)}
        onDelete={(entry) => setPendingDeleteId(entry.id)}
      />

      <ConfirmDialog
        open={pendingDeleteId != null}
        title="确定要删除这条记录吗？"
        message="删除后将无法恢复此条账单数据，您的账户余额将自动重新计算。"
        onConfirm={confirmDelete}
        onCancel={() => setPendingDeleteId(null)}
      />

      <CategoryDetailSheet
        open={detailSelection != null}
        category={detailCategory}
        monthLabel={monthLabel}
        entries={detailEntries}
        onClose={() => setDetailSelection(null)}
        onEdit={(entry) => navigate(`/add?editId=${entry.id}`)}
        onCopy={(entry) => navigate(`/add?copyId=${entry.id}`)}
        onDelete={(entry) => setPendingDeleteId(entry.id)}
      />

      <button
        type="button"
        aria-label="记一笔"
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
