import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppLayout } from '../../design-system/components/AppLayout'
import { ConfirmDialog } from '../../design-system/components/ConfirmDialog'
import { HistoryEntryList } from './HistoryEntryList'
import { useAuth } from '../auth/useAuth'
import { useCatalog } from '../../hooks/useCatalog'
import { useEntries } from '../../hooks/useEntries'
import { deleteEntry } from '../../data/catalog'
import { useI18n } from '../../lib/i18n'
import type { EntryType } from '../../types'

type TypeFilter = 'all' | EntryType

function currentMonthStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function HistoryPage() {
  const { t } = useI18n()
  const { user } = useAuth()
  const { catalog } = useCatalog()
  const { entries, reload } = useEntries(user?.id ?? null)
  const navigate = useNavigate()

  const categories = useMemo(
    () => [...(catalog?.expenseCategories ?? []), ...(catalog?.incomeCategories ?? [])],
    [catalog]
  )

  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [startMonth, setStartMonth] = useState(currentMonthStr)
  const [endMonth, setEndMonth] = useState(currentMonthStr)

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    return entries.filter((e) => {
      if (typeFilter !== 'all' && e.type !== typeFilter) return false
      const month = e.date.slice(0, 7)
      if (startMonth && month < startMonth) return false
      if (endMonth && month > endMonth) return false
      if (keyword) {
        const cat = categories.find((c) => c.code === e.catCode)
        const haystack = `${cat?.zh ?? ''}${cat?.ja ?? ''}${e.note ?? ''}`.toLowerCase()
        if (!haystack.includes(keyword)) return false
      }
      return true
    })
  }, [entries, typeFilter, startMonth, endMonth, search, categories])

  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

  async function confirmDelete() {
    if (!user || !pendingDeleteId) return
    await deleteEntry(pendingDeleteId, user.id)
    setPendingDeleteId(null)
    reload()
  }

  const typeChips: { key: TypeFilter; label: string }[] = [
    { key: 'all', label: t('filterAll') },
    { key: 'expense', label: t('filterExpense') },
    { key: 'income', label: t('filterIncome') },
  ]

  return (
    <AppLayout title={t('tabHistory')}>
      <section className="flex flex-col gap-sm px-md pt-md">
        <div className="relative w-full">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline">
            search
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('historySearchPlaceholder')}
            className="w-full bg-surface-container-highest border border-outline-variant rounded-xl py-3 pl-10 pr-4 text-body-md text-on-surface placeholder:text-outline focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {typeChips.map((chip) => {
            const active = typeFilter === chip.key
            return (
              <button
                key={chip.key}
                type="button"
                onClick={() => setTypeFilter(chip.key)}
                className={`px-4 py-1.5 rounded-full border-[1.5px] text-label-caps font-sans whitespace-nowrap transition-colors ${
                  active
                    ? 'border-primary bg-primary-container text-on-primary-container'
                    : 'border-outline-variant bg-surface text-on-surface-variant hover:bg-surface-variant'
                }`}
              >
                {chip.label}
              </button>
            )
          })}
        </div>
      </section>

      <section className="flex items-center gap-2 px-md mt-sm">
        <div className="flex-1 flex flex-col gap-1">
          <label className="text-label-caps font-sans text-outline px-1">{t('startMonthLabel')}</label>
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px]">
              calendar_month
            </span>
            <input
              type="month"
              value={startMonth}
              onChange={(e) => setStartMonth(e.target.value)}
              className="w-full bg-surface-container-low border border-dashed border-outline-variant rounded-lg py-2 pl-10 pr-2 text-body-md text-on-surface focus:outline-none focus:border-primary transition-colors"
            />
          </div>
        </div>
        <div className="flex-1 flex flex-col gap-1">
          <label className="text-label-caps font-sans text-outline px-1">{t('endMonthLabel')}</label>
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px]">
              calendar_month
            </span>
            <input
              type="month"
              value={endMonth}
              onChange={(e) => setEndMonth(e.target.value)}
              className="w-full bg-surface-container-low border border-dashed border-outline-variant rounded-lg py-2 pl-10 pr-2 text-body-md text-on-surface focus:outline-none focus:border-primary transition-colors"
            />
          </div>
        </div>
      </section>

      <div className="mt-lg">
        <HistoryEntryList
          entries={filtered}
          categories={categories}
          onEdit={(entry) => navigate(`/add?editId=${entry.id}`)}
          onCopy={(entry) => navigate(`/add?copyId=${entry.id}`)}
          onDelete={(entry) => setPendingDeleteId(entry.id)}
        />
      </div>

      <ConfirmDialog
        open={pendingDeleteId != null}
        title="确定要删除这条记录吗？"
        message="删除后将无法恢复此条账单数据，您的账户余额将自动重新计算。"
        onConfirm={confirmDelete}
        onCancel={() => setPendingDeleteId(null)}
      />
    </AppLayout>
  )
}
