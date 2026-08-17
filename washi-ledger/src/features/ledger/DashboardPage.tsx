import { useNavigate } from 'react-router-dom'
import { AppLayout } from '../../design-system/components/AppLayout'
import { BalanceCard } from './BalanceCard'
import { RecentEntriesList } from './RecentEntriesList'
import { useAuth } from '../auth/useAuth'
import { useCatalog } from '../../hooks/useCatalog'
import { useEntries } from '../../hooks/useEntries'
import { summarizeMonth } from '../../data/summary'
import { useI18n } from '../../lib/i18n'

export function DashboardPage() {
  const { t } = useI18n()
  const { user } = useAuth()
  const { catalog } = useCatalog()
  const { entries } = useEntries(user?.id ?? null)
  const navigate = useNavigate()

  const summary = summarizeMonth(entries)
  const categories = [...(catalog?.expenseCategories ?? []), ...(catalog?.incomeCategories ?? [])]

  return (
    <AppLayout title={t('appTitle')}>
      <BalanceCard summary={summary} currency="CNY" />
      <RecentEntriesList entries={entries} categories={categories} />

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
        <span className="material-symbols-outlined text-3xl">add</span>
      </button>
    </AppLayout>
  )
}
