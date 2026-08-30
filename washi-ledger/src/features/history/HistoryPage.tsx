import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { AppLayout } from '../../design-system/components/AppLayout'
import { CatalogLoadState } from '../../design-system/components/CatalogLoadState'
import { DateRangeBar } from '../../design-system/components/DateRangeBar'
import { HistoryEntryList } from './HistoryEntryList'
import { useAuth } from '../auth/useAuth'
import { useCatalog } from '../../hooks/useCatalog'
import { useEntries } from '../../hooks/useEntries'
import { useSettings } from '../../hooks/useSettings'
import { useDisplayRates } from '../../hooks/useDisplayRates'
import { toDisplayEntries } from '../../data/currencyDisplay'
import { matchesEntrySearch, fullDataRange } from '../../data/summary'
import { useI18n } from '../../lib/i18n'
import { firstOfMonthStr, lastOfMonthStr } from '../../lib/date'
import { loadHistoryViewMemory, saveHistoryViewMemory } from '../../lib/historyViewMemory'
import { loadHistoryRange, saveHistoryRange } from '../../lib/dateRangeStorage'
import type { EntryType } from '../../types'

type TypeFilter = 'all' | EntryType

export function HistoryPage() {
  const { t } = useI18n()
  const { user } = useAuth()
  const { catalog, loading: catalogLoading, reload: reloadCatalog } = useCatalog()
  const { entries, reload } = useEntries(user?.id ?? null)
  const { settings } = useSettings()
  const rates = useDisplayRates(settings.currency)
  const mainRef = useRef<HTMLElement>(null)

  const categories = useMemo(
    () => [...(catalog?.expenseCategories ?? []), ...(catalog?.incomeCategories ?? [])],
    [catalog]
  )
  const tags = useMemo(() => [...(catalog?.expenseTags ?? []), ...(catalog?.incomeTags ?? [])], [catalog])
  // 每条记录按settings.currency统一换算后再筛选/分组显示(见data/currencyDisplay.ts)
  const displayEntries = useMemo(
    () => toDisplayEntries(entries, settings.currency, rates),
    [entries, settings.currency, rates]
  )

  // 明细页每次从别的页面导航回来都是全新挂载的组件实例(这个App的路由结构没有共享
  // Outlet布局)，筛选条件/滚动位置本来会全部重置。改成挂载时优先读上次离开前记住
  // 的状态(见lib/historyViewMemory.ts)，只有从没来过(memory是null)才用出厂默认值——
  // R-26：出厂默认值改成"第一条数据到最新一条数据"(全量，可跨月跨年)，不再是"当月"。
  // entries的初始state本来就直接读本地缓存(见useEntries.ts)，挂载这一刻就有数据，
  // 不用等网络请求。真的一条记录都没有(全新用户)才退回"当月"这个还算合理的默认区间
  //
  // 起止日期区间单独优先读dateRangeStorage.ts的localStorage(真正跨App重启持久化，
  // 用户明确要求过)，historyViewMemory只在App进程内有效，退化成第二优先级(处理"在
  // 同一次App运行期间去新建/编辑页面再返回"这种比localStorage更即时的场景)
  const remembered = loadHistoryViewMemory()
  const storedRange = loadHistoryRange()
  const defaultRange = fullDataRange(entries)
  const [search, setSearch] = useState(() => remembered?.search ?? '')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>(() => remembered?.typeFilter ?? 'all')
  const [startDate, setStartDate] = useState(
    () => storedRange?.startDate ?? remembered?.startDate ?? defaultRange?.start ?? firstOfMonthStr()
  )
  const [endDate, setEndDate] = useState(
    () => storedRange?.endDate ?? remembered?.endDate ?? defaultRange?.end ?? lastOfMonthStr()
  )
  useEffect(() => {
    saveHistoryRange({ startDate, endDate })
  }, [startDate, endDate])

  const filtered = useMemo(() => {
    return displayEntries.filter((e) => {
      if (typeFilter !== 'all' && e.type !== typeFilter) return false
      if (e.date < startDate || e.date > endDate) return false
      // 搜索匹配逻辑抽到data/summary.ts的matchesEntrySearch，R-22仪表盘"最近记录"
      // 也复用同一份，不是两边各写一套容易走样
      if (!matchesEntrySearch(e, search, categories, tags, catalog?.paymentMethods ?? [])) return false
      return true
    })
  }, [displayEntries, typeFilter, startDate, endDate, search, categories, tags, catalog])

  // 挂载时先把滚动位置瞬间还原到记住的值(useLayoutEffect在浏览器画第一帧之前跑，
  // 不会先闪一下顶部再跳)，用户体感是"回到我刚才在的地方"
  const scrollRestoredRef = useRef(false)
  useLayoutEffect(() => {
    if (scrollRestoredRef.current || !catalog) return
    if (!remembered) {
      scrollRestoredRef.current = true
      return
    }
    const el = mainRef.current
    if (!el) return
    // catalog和entries是两个独立的hook，各自异步就绪，这个effect只依赖catalog——
    // entries(尤其是从编辑页navigate(-1)回来这种场景，entries hook全新挂载要重新
    // 走一遍"读缓存→可能还有一次网络合并"的流程)如果比catalog晚到位，这一刻列表
    // 内容还没撑起来，直接赋值scrollTop会被浏览器夹回0(容器还没那么高，滚不过去)，
    // 且这个effect只跑一次、不会再重试，"记住的位置"就白记了。改成用rAF反复重试
    // 几帧，只要内容还没长到能到达目标位置就继续试，真的到了(或者试够10帧还是
    // 到不了，比如筛选条件让内容本来就比之前矮)才停手
    let attempts = 0
    function tryRestore() {
      el!.scrollTop = remembered!.scrollTop
      attempts++
      if (el!.scrollTop < remembered!.scrollTop && attempts < 10) {
        requestAnimationFrame(tryRestore)
      } else {
        scrollRestoredRef.current = true
      }
    }
    tryRestore()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalog])

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
          <span className="material-symbols-outlined text-[16px] absolute left-3 top-1/2 -translate-y-1/2 text-outline">
            search
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('historySearchPlaceholder')}
            className="w-full bg-surface-container-highest border-[1.5px] border-dashed border-outline-variant rounded-full py-2 pl-10 pr-4 text-body-md text-on-surface placeholder:text-outline focus:outline-none focus:border-primary transition-colors"
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
          />
        )}
      </div>
    </AppLayout>
  )
}
