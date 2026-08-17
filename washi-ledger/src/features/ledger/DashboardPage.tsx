import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppLayout } from '../../design-system/components/AppLayout'
import { BalanceCard } from './BalanceCard'
import { DateRangeBar } from './DateRangeBar'
import { CategoryDonutCard } from './CategoryDonutCard'
import { RecentEntriesList } from './RecentEntriesList'
import { useAuth } from '../auth/useAuth'
import { useCatalog } from '../../hooks/useCatalog'
import { useEntries } from '../../hooks/useEntries'
import { summarizeMonth, categoryBreakdown } from '../../data/summary'
import { deleteEntry } from '../../data/catalog'
import { useI18n } from '../../lib/i18n'
import { APP_ICONS } from '../../lib/appIcons'

export function DashboardPage() {
  const { t } = useI18n()
  const { user } = useAuth()
  const { catalog } = useCatalog()
  const { entries, reload } = useEntries(user?.id ?? null)
  const navigate = useNavigate()

  const [monthAnchor, setMonthAnchor] = useState(() => new Date())
  const monthLabel = `${monthAnchor.getFullYear()}年${monthAnchor.getMonth() + 1}月`
  const shiftMonth = (delta: number) =>
    setMonthAnchor((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1))

  const summary = summarizeMonth(entries, monthAnchor)
  const categories = useMemo(
    () => [...(catalog?.expenseCategories ?? []), ...(catalog?.incomeCategories ?? [])],
    [catalog]
  )
  const expenseShares = categoryBreakdown(entries, categories, 'expense', monthAnchor)
  const incomeShares = categoryBreakdown(entries, categories, 'income', monthAnchor)

  async function handleDelete(entryId: string) {
    if (!user) return
    // TODO: 换成照design-assets-v2/_43(Confirm Delete)做的和纸风格确认弹窗，
    // 现在先用原生confirm保证功能可用
    if (!window.confirm('确定删除这条记录吗？删除后无法恢复。')) return
    await deleteEntry(entryId, user.id)
    reload()
  }

  return (
    <AppLayout title={t('appTitle')}>
      <DateRangeBar monthLabel={monthLabel} onPrevMonth={() => shiftMonth(-1)} onNextMonth={() => shiftMonth(1)} />
      <BalanceCard summary={summary} currency="CNY" />
      <CategoryDonutCard expenseShares={expenseShares} incomeShares={incomeShares} />
      <RecentEntriesList
        entries={entries}
        categories={categories}
        onEdit={(entry) => navigate(`/add?editId=${entry.id}`)}
        onCopy={(entry) => navigate(`/add?copyId=${entry.id}`)}
        onDelete={(entry) => handleDelete(entry.id)}
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
