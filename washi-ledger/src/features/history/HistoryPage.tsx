import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
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
import { loadHistoryViewMemory, saveHistoryViewMemory } from '../../lib/historyViewMemory'
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
  const mainRef = useRef<HTMLElement>(null)

  const categories = useMemo(
    () => [...(catalog?.expenseCategories ?? []), ...(catalog?.incomeCategories ?? [])],
    [catalog]
  )
  // 每条记录按settings.currency统一换算后再筛选/分组显示(见data/currencyDisplay.ts)
  const displayEntries = useMemo(
    () => toDisplayEntries(entries, settings.currency, rates),
    [entries, settings.currency, rates]
  )

  // 明细页每次从别的页面导航回来都是全新挂载的组件实例(这个App的路由结构没有共享
  // Outlet布局)，筛选条件/滚动位置本来会全部重置。改成挂载时优先读上次离开前记住
  // 的状态(见lib/historyViewMemory.ts)，只有从没来过(memory是null)才用"当月"这个
  // 出厂默认值。B-12的focusDate只在"记住的区间本来就盖不住这条记录"时才用来临时
  // 顶替区间(下面的定位effect里做，不在这里)，不再无条件用focusDate覆盖记住的筛选
  const remembered = loadHistoryViewMemory()
  const [search, setSearch] = useState(() => remembered?.search ?? '')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>(() => remembered?.typeFilter ?? 'all')
  const [startDate, setStartDate] = useState(() => remembered?.startDate ?? firstOfMonthStr())
  const [endDate, setEndDate] = useState(() => remembered?.endDate ?? lastOfMonthStr())

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

  // 挂载时先把滚动位置瞬间还原到记住的值(useLayoutEffect在浏览器画第一帧之前跑，
  // 不会先闪一下顶部再跳)，不管这次是不是带着focusEntryId进来的——用户体感是"回到
  // 我刚才在的地方"，新建/复制场景下面那个effect会接着从这个位置平滑滚到新记录，
  // 而不是固定从最顶上开始滚
  const scrollRestoredRef = useRef(false)
  useLayoutEffect(() => {
    if (scrollRestoredRef.current || !catalog) return
    if (remembered && mainRef.current) {
      mainRef.current.scrollTop = remembered.scrollTop
    }
    scrollRestoredRef.current = true
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalog])

  // B-12：定位到新建/编辑/复制的那条记录。如果这条记录被当前(记住的)筛选条件挡住了
  // (不在日期区间/类型不符/搜索关键字过滤掉)，依次放宽挡住它的那一个维度，而不是
  // 整个重置成"当月"——放宽后触发重渲染，effect会再跑一次接着检查下一个维度，直到
  // 记录真的能出现在filtered里为止，再真正滚过去+高亮。放宽后的筛选会被下面的
  // "离开时存记忆"逻辑记住，下次回来就是放宽后的状态，不是又变回原来那个
  useEffect(() => {
    if (!focusEntryId || !catalog) return
    const target = entries.find((e) => e.id === focusEntryId)
    if (!target) return // 新记录还没同步进本地entries(等mergeRemote拉回来)，等下一轮
    if (target.date < startDate || target.date > endDate) {
      setStartDate(firstOfMonthStrFor(target.date))
      setEndDate(lastOfMonthStrFor(target.date))
      return
    }
    if (typeFilter !== 'all' && target.type !== typeFilter) {
      setTypeFilter('all')
      return
    }
    const keyword = search.trim().toLowerCase()
    if (keyword) {
      const cat = categories.find((c) => c.code === target.catCode)
      const haystack = `${cat?.zh ?? ''}${cat?.ja ?? ''}${target.note ?? ''}`.toLowerCase()
      if (!haystack.includes(keyword)) {
        setSearch('')
        return
      }
    }
    const el = document.getElementById(`entry-${focusEntryId}`)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    const timer = setTimeout(() => setFocusEntryId(null), 2500)
    return () => clearTimeout(timer)
  }, [focusEntryId, catalog, entries, startDate, endDate, typeFilter, search, categories])

  // 离开明细页(路由切走/组件卸载)前把当前筛选+滚动位置存起来，供下次挂载还原。用ref
  // 存"最新值"而不是直接把state放进这个effect的依赖数组——不然筛选/滚动每变一次就要
  // 重新挂一次scroll监听器，这里只需要真正卸载的那一刻才落盘一次
  const latestViewRef = useRef({ startDate, endDate, typeFilter, search, scrollTop: 0 })
  useEffect(() => {
    latestViewRef.current.startDate = startDate
    latestViewRef.current.endDate = endDate
    latestViewRef.current.typeFilter = typeFilter
    latestViewRef.current.search = search
  })
  useEffect(() => {
    const el = mainRef.current
    function onScroll() {
      if (el) latestViewRef.current.scrollTop = el.scrollTop
    }
    el?.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      el?.removeEventListener('scroll', onScroll)
      // latestViewRef不是指向React渲染的DOM节点，是纯数据存放用的ref，上面那个
      // 无依赖数组的effect每次渲染后都会把它同步成最新值，卸载时读到的就是最新的，
      // 不存在"读到过期DOM引用"这个lint规则本来想防的问题
      // eslint-disable-next-line react-hooks/exhaustive-deps
      saveHistoryViewMemory({ ...latestViewRef.current })
    }
  }, [])

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
    <AppLayout title={t('tabHistory')} onRefresh={handleRefresh} mainRef={mainRef}>
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
