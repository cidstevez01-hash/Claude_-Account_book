import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AppLayout } from '../../design-system/components/AppLayout'
import { ConfirmDialog } from '../../design-system/components/ConfirmDialog'
import { CatalogLoadState } from '../../design-system/components/CatalogLoadState'
import { DateRangeBar } from '../../design-system/components/DateRangeBar'
import { HistoryEntryList } from './HistoryEntryList'
import { useAuth } from '../auth/useAuth'
import { useCatalog } from '../../hooks/useCatalog'
import { useEntries } from '../../hooks/useEntries'
import { useSettings } from '../../hooks/useSettings'
import { useDisplayRates } from '../../hooks/useDisplayRates'
import { toDisplayEntries } from '../../data/currencyDisplay'
import { deleteEntry } from '../../data/catalog'
import { useI18n } from '../../lib/i18n'
import { firstOfMonthStr, lastOfMonthStr, firstOfMonthStrFor, lastOfMonthStrFor } from '../../lib/date'
import type { EntryType } from '../../types'

/** B-12：新建/编辑/复制保存后从AddTransactionPage带过来的导航state——要定位到
 * 哪条记录、那条记录是哪天的(用来把日期区间调整成能覆盖到它所在的月份，不然
 * 默认当月区间可能根本不包含这条记录，定位无从谈起) */
interface HistoryLocationState {
  focusEntryId?: string
  focusDate?: string
}

type TypeFilter = 'all' | EntryType

export function HistoryPage() {
  const { t } = useI18n()
  const { user } = useAuth()
  const { catalog, loading: catalogLoading, reload: reloadCatalog } = useCatalog()
  const { entries, reload, removeLocal } = useEntries(user?.id ?? null)
  const { settings } = useSettings()
  const rates = useDisplayRates(settings.currency)
  const navigate = useNavigate()
  const location = useLocation()
  const navState = location.state as HistoryLocationState | null
  const [focusEntryId, setFocusEntryId] = useState<string | null>(navState?.focusEntryId ?? null)

  const categories = useMemo(
    () => [...(catalog?.expenseCategories ?? []), ...(catalog?.incomeCategories ?? [])],
    [catalog]
  )
  // 每条记录按settings.currency统一换算后再筛选/分组显示(见data/currencyDisplay.ts)
  const displayEntries = useMemo(
    () => toDisplayEntries(entries, settings.currency, rates),
    [entries, settings.currency, rates]
  )

  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  // 起止日期区间——跟仪表盘顶部(#8)同一个DateRangeBar组件、同一套校验逻辑(#9)，
  // 默认值也保持一致：当月完整一个月(1日到月末)，不是"1日到今天"(那样月中打开时
  // 后半个月的数据会被默认区间挡在外面，看起来像"缺失"/"搜不到")。B-12：如果是
  // 从保存记账跳转过来定位某条记录，区间改成覆盖那条记录所在的月份，不然默认
  // 当月区间可能根本不包含它(比如补记了一笔上个月的账)，定位无从谈起
  const [startDate, setStartDate] = useState(() =>
    navState?.focusDate ? firstOfMonthStrFor(navState.focusDate) : firstOfMonthStr()
  )
  const [endDate, setEndDate] = useState(() =>
    navState?.focusDate ? lastOfMonthStrFor(navState.focusDate) : lastOfMonthStr()
  )

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    return displayEntries.filter((e) => {
      if (typeFilter !== 'all' && e.type !== typeFilter) return false
      if (e.date < startDate || e.date > endDate) return false
      if (keyword) {
        const cat = categories.find((c) => c.code === e.catCode)
        const haystack = `${cat?.zh ?? ''}${cat?.ja ?? ''}${e.note ?? ''}`.toLowerCase()
        if (!haystack.includes(keyword)) return false
      }
      return true
    })
  }, [displayEntries, typeFilter, startDate, endDate, search, categories])

  // B-12：等目标记录真的出现在DOM里(EntryCard带id="entry-<id>")才滚过去，catalog/
  // 列表数据到位的时机不确定，所以依赖这几个可能让目标行渲染出来的值，滚到之后
  // 停留几秒(给用户看清是哪一条)再把focusEntryId清空，高亮态跟着一起自动退场
  useEffect(() => {
    if (!focusEntryId || !catalog) return
    const el = document.getElementById(`entry-${focusEntryId}`)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    const timer = setTimeout(() => setFocusEntryId(null), 2500)
    return () => clearTimeout(timer)
  }, [focusEntryId, catalog, filtered])

  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

  async function confirmDelete() {
    if (!user || !pendingDeleteId) return
    await deleteEntry(pendingDeleteId, user.id)
    removeLocal(pendingDeleteId)
    setPendingDeleteId(null)
    reload()
  }

  const typeChips: { key: TypeFilter; label: string }[] = [
    { key: 'all', label: t('filterAll') },
    { key: 'expense', label: t('filterExpense') },
    { key: 'income', label: t('filterIncome') },
  ]

  // R-17：下拉刷新——重新拉一次账目记录+分类/支付方式目录，两个互不依赖并行拉
  async function handleRefresh() {
    await Promise.all([reload(), reloadCatalog()])
  }

  return (
    <AppLayout title={t('tabHistory')} onRefresh={handleRefresh}>
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

      <section className="px-md mt-sm">
        <DateRangeBar
          startDate={startDate}
          endDate={endDate}
          onChange={(s, e) => {
            setStartDate(s)
            setEndDate(e)
          }}
        />
      </section>

      {/* catalog未就绪前(entries缓存优先比catalog先就绪，见useEntries.ts)先不渲染
          明细列表——分类名/颜色/图标全部找不到对应数据会闪一下半成品画面；只挡列表
          区域，上面的搜索/筛选/日期区间栏不依赖catalog，照常显示 */}
      <div className="mt-lg">
        {!catalog ? (
          <CatalogLoadState loading={catalogLoading} onRetry={reloadCatalog} />
        ) : (
          <HistoryEntryList
            entries={filtered}
            categories={categories}
            paymentMethods={catalog.paymentMethods}
            currency={settings.currency}
            focusEntryId={focusEntryId}
            onEdit={(entry) => navigate(`/add?editId=${entry.id}`)}
            onCopy={(entry) => navigate(`/add?copyId=${entry.id}`)}
            onDelete={(entry) => setPendingDeleteId(entry.id)}
          />
        )}
      </div>

      <ConfirmDialog
        open={pendingDeleteId != null}
        title={t('confirmDeleteTitle')}
        message={t('confirmDeleteMessage')}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDeleteId(null)}
      />
    </AppLayout>
  )
}
