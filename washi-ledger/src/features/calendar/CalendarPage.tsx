import { useEffect, useMemo, useRef, useState } from 'react'
import { AppLayout } from '../../design-system/components/AppLayout'
import { CashPointToggle } from '../../design-system/components/CashPointToggle'
import { CatalogLoadState } from '../../design-system/components/CatalogLoadState'
import { ConfirmDialog } from '../../design-system/components/ConfirmDialog'
import { MonthNavBar } from '../stats/MonthNavBar'
import { EntryCard } from '../ledger/EntryCard'
import { EntryDetailSheet } from '../ledger/EntryDetailSheet'
import { dayLabel } from '../ledger/dayLabel'
import { useAppNavigate } from '../../hooks/useAppNavigate'
import { useAuth } from '../auth/useAuth'
import { useCatalog } from '../../hooks/useCatalog'
import { useEntries } from '../../hooks/useEntries'
import { useSettings } from '../../hooks/useSettings'
import { useDisplayRates } from '../../hooks/useDisplayRates'
import { useJpHolidays } from '../../hooks/useJpHolidays'
import { useEntryHighlight } from '../../hooks/useEntryHighlight'
import { toDisplayEntries } from '../../data/currencyDisplay'
import { formatCurrency, formatAmountNoSymbol } from '../../data/currencyDisplay'
import { hasEntriesInMonth } from '../../data/summary'
import { deleteEntry } from '../../data/catalog'
import { useI18n } from '../../lib/i18n'
import { todayStr } from '../../lib/date'
import { consumeDetailSheetReturnMemory, setDetailSheetReturnMemory } from '../../lib/detailSheetReturnMemory'
import type { Entry } from '../../types'

const WEEKDAY_LABELS_ZH = ['日', '一', '二', '三', '四', '五', '六']
const WEEKDAY_LABELS_JA = ['日', '月', '火', '水', '木', '金', '土']

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

interface DayCell {
  dateStr: string
  day: number
  inMonth: boolean
}

/** 月历格子——固定6行42格(含跨到上/下月的灰显日期)，照抄RangeCalendarPicker.tsx
 * buildMonthGrid()同一个算法，这里再写一份而不是抽共享函数：两边需要的返回值形状
 * 不完全一样(这里额外要带这个格子当天的收支汇总)，函数本身只有7行，"三行相似代码"
 * 好过为了复用硬凑一个公共接口 */
function buildMonthGrid(year: number, month: number): DayCell[] {
  const first = new Date(year, month, 1)
  const startWeekday = first.getDay()
  const gridStart = new Date(year, month, 1 - startWeekday)
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i)
    return { dateStr: ymd(d), day: d.getDate(), inMonth: d.getMonth() === month }
  })
}

interface DaySummary {
  expense: number
  income: number
  points: number
}

const EMPTY_SUMMARY: DaySummary = { expense: 0, income: 0, points: 0 }

/** R-34~R-37：日历统计页——抽屉(NavDrawer)和出入金页面(HistoryPage)各有一个入口，
 * 点返回统一用leftButton="back"+navigate(-1)，天然回到进来时的那个页面，不用
 * 自己判断"从哪来的"。月历网格只显示当前查看月份的数据(R-36消费强度色也只按当前
 * 月份内的最大支出算相对深浅，不是全量数据的最大值)；下方"当天总览+当天明细"
 * 显示的是选中日期，跟当前查看月份是两件独立的事——切换月份不会重置已选中的日期，
 * 只有真的点了某个日期格子才会换选中对象(R-35原话："点击日历上任何一天就切换该
 * 区域内容为那一天"，切月份本身没提过要重置选中) */
export function CalendarPage() {
  const { t, lang } = useI18n()
  const navigate = useAppNavigate()
  const { user } = useAuth()
  const { catalog, loading: catalogLoading, reload: reloadCatalog } = useCatalog()
  const { entries, reload, removeLocal } = useEntries(user?.id ?? null)
  const { settings } = useSettings()
  const rates = useDisplayRates(settings.currency)
  const holidays = useJpHolidays()

  const categories = useMemo(
    () => [...(catalog?.expenseCategories ?? []), ...(catalog?.incomeCategories ?? [])],
    [catalog]
  )
  const paymentMethods = catalog?.paymentMethods ?? []
  const tags = useMemo(() => [...(catalog?.expenseTags ?? []), ...(catalog?.incomeTags ?? [])], [catalog])
  const displayEntries = useMemo(
    () => toDisplayEntries(entries, settings.currency, rates),
    [entries, settings.currency, rates]
  )

  const [viewAnchor, setViewAnchor] = useState(() => new Date())
  const year = viewAnchor.getFullYear()
  const month = viewAnchor.getMonth()
  const monthLabel = `${year}年${month + 1}月`
  const shiftMonth = (delta: number) => setViewAnchor((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1))
  const prevAnchor = new Date(year, month - 1, 1)
  const nextAnchor = new Date(year, month + 1, 1)
  const disablePrev = !hasEntriesInMonth(entries, prevAnchor.getFullYear(), prevAnchor.getMonth() + 1)
  const disableNext = !hasEntriesInMonth(entries, nextAnchor.getFullYear(), nextAnchor.getMonth() + 1)

  const [selectedDate, setSelectedDate] = useState(() => todayStr())

  // 現金/積分切换——哪个图标在徽章左下角哪个就高亮，这个规则在CashPointToggle组件
  // 内部处理，这里只管页面内容跟着mode切换哪些东西显示。cashTab只在現金模式下用
  // (支出/収入两个tab)；積分模式下明细是单一列表，不需要tab状态
  const [mode, setMode] = useState<'cash' | 'point'>('cash')
  const [cashTab, setCashTab] = useState<'expense' | 'income'>('expense')

  const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`
  const monthEntries = useMemo(() => displayEntries.filter((e) => e.date.startsWith(monthKey)), [displayEntries, monthKey])

  const daySummaries = useMemo(() => {
    const map = new Map<string, DaySummary>()
    for (const e of monthEntries) {
      const cur = map.get(e.date) ?? { expense: 0, income: 0, points: 0 }
      if (e.type === 'income') cur.income += e.amount
      else cur.expense += e.amount
      cur.points += e.points ?? 0
      map.set(e.date, cur)
    }
    return map
  }, [monthEntries])

  // R-36：消费强度深浅只用--color-expense一个色相做透明度梯度，相对当前查看月份内
  // 支出最高的那一天算比例(不是拿全量历史数据的最大值算，不然某天花了一大笔钱之后
  // 其它月份看起来永远都很浅，失去"这个月里哪几天花得多"的对比意义)
  const maxExpense = useMemo(() => {
    let max = 0
    for (const s of daySummaries.values()) if (s.expense > max) max = s.expense
    return max
  }, [daySummaries])

  // 積分模式格子热力同理，按当前查看月份内积分最高的那一天算比例
  const maxPoints = useMemo(() => {
    let max = 0
    for (const s of daySummaries.values()) if (s.points > max) max = s.points
    return max
  }, [daySummaries])

  const grid = useMemo(() => buildMonthGrid(year, month), [year, month])
  const weekdayLabels = lang === 'ja' ? WEEKDAY_LABELS_JA : WEEKDAY_LABELS_ZH

  // 当天总览+当天明细：故意不从daySummaries/monthEntries(只含当前查看月份)取，
  // 直接过滤全量displayEntries——选中日期可能落在跟当前查看月份不同的月份(见上面
  // 组件说明)，如果只在monthEntries里查会漏数据
  const selectedEntries = useMemo(() => displayEntries.filter((e) => e.date === selectedDate), [displayEntries, selectedDate])
  const selectedSummary = useMemo<DaySummary>(() => {
    if (selectedEntries.length === 0) return EMPTY_SUMMARY
    let expense = 0
    let income = 0
    let points = 0
    for (const e of selectedEntries) {
      if (e.type === 'income') income += e.amount
      else expense += e.amount
      points += e.points ?? 0
    }
    return { expense, income, points }
  }, [selectedEntries])
  // 当天明细按模式过滤：現金模式下按cashTab(支出/収入)分两个tab；積分模式下是单一
  // 列表，只看有积分的支出记录(积分只会挂在支出上，见Entry.points的真实口径)
  const filteredEntries = useMemo(
    () =>
      mode === 'cash'
        ? selectedEntries.filter((e) => e.type === cashTab)
        : selectedEntries.filter((e) => (e.points ?? 0) > 0),
    [selectedEntries, mode, cashTab]
  )
  const hasSelectedRecord = filteredEntries.length > 0
  const selectedHolidayName = holidays[selectedDate]
  const [viewEntry, setViewEntry] = useState<Entry | null>(null)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const { highlightedId, highlightEntry } = useEntryHighlight('entry')

  // B-66→R-XX：同RecentEntriesList.tsx——从详情弹层点编辑/复制跳去/add，不管点返回
  // 还是保存成功，都要重新打开那条记录的详情弹层。CalendarPage跳/add不走goToAdd
  // (日历页故意不传addEntryOrigin，R-42就是这么设计的，这里的返回定位信号是独立的
  // 另一套，不受影响)。复制保存后entryId换成了新记录，要等它真的同步回本地entries
  // 才查得到，不能只在挂载这一刻查一次
  const pendingEntryIdRef = useRef<string | null>(null)
  useEffect(() => {
    const m = consumeDetailSheetReturnMemory('calendar')
    if (!m) return
    pendingEntryIdRef.current = m.entryId
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    const pendingId = pendingEntryIdRef.current
    if (!pendingId) return
    const found = entries.find((e) => e.id === pendingId)
    if (found) {
      setViewEntry(found)
      pendingEntryIdRef.current = null
    }
  }, [entries])
  // 删除确认框现在盖在详情弹层上面，确认删除后entries会把这条记录移除，这里跟着
  // 自动关掉详情弹层
  useEffect(() => {
    if (viewEntry && !entries.some((e) => e.id === viewEntry.id)) setViewEntry(null)
  }, [entries, viewEntry])

  async function handleRefresh() {
    await Promise.all([reload(), reloadCatalog()])
  }

  async function confirmDelete() {
    if (!user || !pendingDeleteId) return
    await deleteEntry(pendingDeleteId, user.id)
    removeLocal(pendingDeleteId)
    setPendingDeleteId(null)
    reload()
  }

  return (
    <AppLayout
      title={t('calendarTitle')}
      leftButton="back"
      onRefresh={handleRefresh}
      rightHeaderContent={
        <CashPointToggle
          mode={mode}
          onToggle={() => setMode((m) => (m === 'cash' ? 'point' : 'cash'))}
          ariaLabel={t('calendarModeToggleAria')}
        />
      }
    >
      {!catalog ? (
        <CatalogLoadState loading={catalogLoading} onRetry={reloadCatalog} />
      ) : (
        <div className="flex flex-col gap-md px-md pt-md pb-8">
          <MonthNavBar
            monthLabel={monthLabel}
            onPrevMonth={() => shiftMonth(-1)}
            onNextMonth={() => shiftMonth(1)}
            disablePrev={disablePrev}
            disableNext={disableNext}
          />

          <div className="bg-surface-container-lowest rounded-xl p-md border-[1.5px] border-dashed border-outline-variant papercut-shadow">
            <div className="grid grid-cols-7 gap-1 mb-1">
              {weekdayLabels.map((w) => (
                <div key={w} className="text-center text-label-caps text-on-surface-variant font-sans">
                  {w}
                </div>
              ))}
            </div>
            {/* B-58：格子金额去掉formatCurrency()自带的货币符号，只保留+/-和数字本身——
                7列栅格每格只有~48px宽，塞下带符号+千分位的完整格式太挤；格子下方的
                汇总卡片/当日明细列表已经有带完整符号的金额，格子本身只是概览。
                B-59→B-61→B-62→B-63续：热力图背景最初用category颜色(--color-expense/
                --color-tertiary)，heatPct接近1时背景被染到快饱和，金额文字(同样是
                支出红/收入绿/积分金，用户明确要求这几个语义色不能改)跟背景撞色，
                对比度实测跌到1.4~2.0:1、加了描边也还是不够清楚(真机反馈多轮"看不清"/
                "都是白的")。问题根子在背景跟文字抢同一个色相——先试过换成--color-outline
                中性灰，用户仍不满意；B-62让Stitch出6组候选配色AB对比，但那次对比图
                是独立实色色块摆在中性背景上看，跟实际"低透明度叠加在格子自己的底色
                上"是两回事，色块选出来的"クールブルーグレー"落代码后用户反馈"完全
                和背景重叠了"——拿错测试方式误导了选择。B-63改成直接用这里真实的
                color-mix公式(45%强度+真实格子底色)现场渲染对比图，这次选出来的
                "暖棕"方向(见index.css B-63注释)才是所见即所得验证过的。背景最大
                混合强度保持45%(10+heatPct*35)不变 */}
            <div className="grid grid-cols-7 gap-1">
              {grid.map((cell) => {
                const summary = cell.inMonth ? (daySummaries.get(cell.dateStr) ?? EMPTY_SUMMARY) : EMPTY_SUMMARY
                const hasData = mode === 'cash' ? summary.expense > 0 || summary.income > 0 : summary.points > 0
                const heatColor = 'var(--color-calendar-heat)'
                const heatBase = mode === 'cash' ? summary.expense : summary.points
                const heatMax = mode === 'cash' ? maxExpense : maxPoints
                const heatPct = heatMax > 0 ? Math.min(1, heatBase / heatMax) : 0
                const isSelected = cell.dateStr === selectedDate
                // R-38续：祝日标红只改日期数字颜色这一个独立元素，不碰热力图背景/金额
                // 文字——用户明确要求"支出会对格子有影响的，不能当金额不存在，要考虑
                // 两者共存"，日期数字跟下面的金额是完全分开的两行，互不遮挡，不会有
                // B-61那种同色系/对比度冲突问题
                const holidayName = cell.inMonth ? holidays[cell.dateStr] : undefined
                const amountShadow = {
                  textShadow:
                    '1px 0 0 var(--color-surface-container-lowest), -1px 0 0 var(--color-surface-container-lowest), 0 1px 0 var(--color-surface-container-lowest), 0 -1px 0 var(--color-surface-container-lowest)',
                }
                return (
                  <button
                    key={cell.dateStr}
                    type="button"
                    onClick={() => setSelectedDate(cell.dateStr)}
                    disabled={!cell.inMonth}
                    className={`relative aspect-square rounded-lg flex flex-col items-center justify-center gap-0.5 py-1 transition-colors ${
                      isSelected ? 'border-2 border-primary' : 'border border-transparent'
                    } ${cell.inMonth ? '' : 'opacity-0 pointer-events-none'}`}
                    style={hasData ? { background: `color-mix(in srgb, ${heatColor} ${10 + heatPct * 35}%, transparent)` } : undefined}
                  >
                    {/* B-XX：之前这个角标圆点标的是"今天"，用户反馈没什么用——改成标
                        "祝日"，跟下面日期数字变红是同一个holidayName判断，两处一起
                        提示"这天是祝日" */}
                    {holidayName && (
                      <span
                        className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full"
                        style={{ background: 'var(--color-holiday)' }}
                        aria-hidden="true"
                      />
                    )}
                    <span
                      className="text-body-sm font-serif leading-none"
                      style={{ color: holidayName ? 'var(--color-holiday)' : 'var(--color-on-surface)' }}
                    >
                      {cell.day}
                    </span>
                    {mode === 'cash' ? (
                      <>
                        {summary.expense > 0 && (
                          <span className="text-[9px] leading-none" style={{ color: 'var(--color-expense)', ...amountShadow }}>
                            -{formatAmountNoSymbol(summary.expense, settings.currency)}
                          </span>
                        )}
                        {summary.income > 0 && (
                          <span className="text-[9px] leading-none" style={{ color: 'var(--color-income)', ...amountShadow }}>
                            +{formatAmountNoSymbol(summary.income, settings.currency)}
                          </span>
                        )}
                      </>
                    ) : (
                      summary.points > 0 && (
                        <span className="text-[9px] leading-none" style={{ color: 'var(--color-tertiary)', ...amountShadow }}>
                          +{summary.points}
                          {t('calendarPointsUnit')}
                        </span>
                      )
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          <p className="text-label-caps text-on-surface-variant text-center">{t('calendarTapHint')}</p>

          <div className="flex flex-col gap-sm">
            <div className="flex items-center justify-between">
              <h2 className="font-serif text-headline-sm text-on-surface">{dayLabel(selectedDate, t)}</h2>
              <span className="text-label-caps text-on-surface-variant font-sans">
                {t('calendarEntryCountLabel').replace('{n}', String(filteredEntries.length))}
              </span>
            </div>
            {/* R-38续：祝日详情卡片，放在支出/収入汇总卡片"上方"(用户原话)，只在选中的
                这天真的是祝日时才渲染——数据源见hooks/useJpHolidays.ts */}
            {selectedHolidayName && (
              <div
                className="rounded-lg px-sm py-2 border-[1.5px] border-dashed flex items-center gap-2"
                style={{ borderColor: 'var(--color-holiday)', background: 'color-mix(in srgb, var(--color-holiday) 10%, transparent)' }}
              >
                <span className="material-symbols-outlined text-[18px]" style={{ color: 'var(--color-holiday)' }}>
                  event
                </span>
                <span className="text-body-md" style={{ color: 'var(--color-holiday)' }}>
                  {t('calendarHolidayLabel')}：{selectedHolidayName}
                </span>
              </div>
            )}
            {mode === 'cash' ? (
              <div className="grid grid-cols-2 gap-sm">
                <div className="bg-surface-container-low rounded-lg px-2 py-2 border-[1.5px] border-dashed border-outline-variant text-center">
                  <p className="text-label-caps text-on-surface-variant">{t('filterExpense')}</p>
                  <p
                    className="font-serif text-body-md"
                    style={{ color: hasSelectedRecord ? 'var(--color-expense)' : undefined }}
                  >
                    {formatCurrency(selectedSummary.expense, settings.currency)}
                  </p>
                </div>
                <div className="bg-surface-container-low rounded-lg px-2 py-2 border-[1.5px] border-dashed border-outline-variant text-center">
                  <p className="text-label-caps text-on-surface-variant">{t('filterIncome')}</p>
                  <p
                    className="font-serif text-body-md"
                    style={{ color: hasSelectedRecord ? 'var(--color-income)' : undefined }}
                  >
                    {formatCurrency(selectedSummary.income, settings.currency)}
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-surface-container-low rounded-lg px-2 py-2 border-[1.5px] border-dashed border-outline-variant text-center">
                <p className="text-label-caps text-on-surface-variant">{t('pointsLabel')}</p>
                <p
                  className="font-serif text-body-md"
                  style={{ color: hasSelectedRecord && selectedSummary.points > 0 ? 'var(--color-tertiary)' : undefined }}
                >
                  {selectedSummary.points}
                </p>
              </div>
            )}

            <div className="flex items-center justify-between mt-sm">
              <h3 className="font-serif text-body-lg text-on-surface">{t('calendarDailyDetailTitle')}</h3>
              {/* 積分只增不减，積分模式的明细不需要支出/収入两个tab——这是用户明确
                  纠正过的规则，跟現金模式的tab是两件独立的事 */}
              {mode === 'cash' && (
                <div
                  className="flex p-0.5 rounded-full border border-dashed border-outline-variant"
                  style={{ background: 'var(--color-surface-container-highest)' }}
                >
                  <button
                    type="button"
                    onClick={() => setCashTab('expense')}
                    className={`px-3 py-1 rounded-full text-label-caps transition-colors ${
                      cashTab === 'expense' ? 'text-on-primary' : 'text-on-surface-variant'
                    }`}
                    style={cashTab === 'expense' ? { background: 'var(--color-expense)' } : undefined}
                  >
                    {t('filterExpense')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCashTab('income')}
                    className={`px-3 py-1 rounded-full text-label-caps transition-colors ${
                      cashTab === 'income' ? 'text-on-primary' : 'text-on-surface-variant'
                    }`}
                    style={cashTab === 'income' ? { background: 'var(--color-income)' } : undefined}
                  >
                    {t('filterIncome')}
                  </button>
                </div>
              )}
            </div>
            {hasSelectedRecord ? (
              <div className="flex flex-col gap-md">
                {filteredEntries.map((entry) => {
                  const cat = categories.find((c) => c.code === entry.catCode)
                  const pm = paymentMethods.find((p) => p.code === entry.paymentMethod)
                  return (
                    <EntryCard
                      key={entry.id}
                      id={`entry-${entry.id}`}
                      highlighted={highlightedId === entry.id}
                      entry={entry}
                      category={cat}
                      paymentMethod={pm}
                      onOpenDetail={setViewEntry}
                      amountDisplay={mode === 'point' ? 'points' : 'currency'}
                    />
                  )
                })}
              </div>
            ) : (
              <div className="text-center py-10 text-on-surface-variant">
                <span className="material-symbols-outlined text-4xl mb-2 block opacity-40">event_busy</span>
                <p className="text-body-md">{t('noRecordsThisDay')}</p>
              </div>
            )}
          </div>
        </div>
      )}
      <EntryDetailSheet
        open={!!viewEntry}
        entry={viewEntry}
        category={viewEntry ? categories.find((c) => c.code === viewEntry.catCode) : undefined}
        paymentMethod={viewEntry ? paymentMethods.find((p) => p.code === viewEntry.paymentMethod) : undefined}
        tag={viewEntry ? tags.find((tg) => tg.code === viewEntry.tagCode) : undefined}
        onClose={() => {
          if (viewEntry) highlightEntry(viewEntry.id)
          setViewEntry(null)
        }}
        onEdit={(entry) => {
          setDetailSheetReturnMemory('calendar', entry.id)
          navigate(`/add?editId=${entry.id}`)
        }}
        onCopy={(entry) => {
          setDetailSheetReturnMemory('calendar', entry.id)
          navigate(`/add?copyId=${entry.id}`)
        }}
        onDelete={(entry) => setPendingDeleteId(entry.id)}
      />
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
