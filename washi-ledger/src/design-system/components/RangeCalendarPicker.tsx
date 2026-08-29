import { useEffect, useRef, useState } from 'react'
import { useI18n } from '../../lib/i18n'

interface RangeCalendarPickerProps {
  open: boolean
  startDate: string
  endDate: string
  onConfirm: (startDate: string, endDate: string) => void
  onClose: () => void
}

const WEEKDAY_LABELS_ZH = ['日', '一', '二', '三', '四', '五', '六']
const WEEKDAY_LABELS_JA = ['日', '月', '火', '水', '木', '金', '土']

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** 月历格子——固定6行42格(含跨到上/下月的灰显日期)，保证每个月视图高度一致，
 * 不会因为当月周数不同导致弹层高度跳动 */
function buildMonthGrid(year: number, month: number): { date: Date; inMonth: boolean }[] {
  const first = new Date(year, month, 1)
  const startWeekday = first.getDay()
  const gridStart = new Date(year, month, 1 - startWeekday)
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i)
    return { date: d, inMonth: d.getMonth() === month }
  })
}

/** R-27自绘日历——起止日期单框触发，弹出这个月历面板做真正的区间选择(不再是原生
 * <input type=date>两个框各自唤起系统选择器)。核心是一份"草稿"状态(pendingStart/
 * pendingEnd)，只有点"确定"才会真正调onConfirm写回父组件，点"取消"/背景/关闭
 * 直接丢弃草稿，不会污染已经生效的区间。
 *
 * 点击规则(用户明确要求过)：
 * - 草稿为空 → 这次点击定为起点
 * - 只有起点、还没终点 → 这次点击定终点；如果点的日期比起点早，自动交换(终点变起点)；
 *   如果点的正好是起点当天，起点终点都设成这天——必须支持"同一天选两次"生成合法的
 *   单日区间(一天内有多条记账记录，需要能单独看某一天)
 * - 起止都已经选完(草稿完整) → 这次点击重新开始，视为新的起点，原来的终点清空
 *
 * 主题自适应：选中态用--color-primary/--color-on-primary/--color-primary-fixed这些
 * 会跟主题换的token，不是写死的颜色，怀旧主题换成什么颜色这里的高亮就跟着变 */
type PickerPage = 'calendar' | 'year' | 'month'

export function RangeCalendarPicker({ open, startDate, endDate, onConfirm, onClose }: RangeCalendarPickerProps) {
  const { t, lang } = useI18n()
  const [pendingStart, setPendingStart] = useState(startDate)
  const [pendingEnd, setPendingEnd] = useState<string | null>(endDate)
  // 日历一次只显示一个月，长区间(比如"过去一年")默认停在结束月而不是起始月——
  // 结束月更接近用户当前关心的时间点(比如"最近这段时间"往往是想调整靠近今天的
  // 那一头)，起始月对长区间来说反而是相对不重要的边界
  const [viewYear, setViewYear] = useState(() => Number(endDate.split('-')[0]))
  const [viewMonth, setViewMonth] = useState(() => Number(endDate.split('-')[1]) - 1)
  // 年/月快速跳转(两个独立页面，不是混一起滚动)——page切换视图，decadeStart只在
  // 年份页用，翻页时按10年一段前后移动
  const [page, setPage] = useState<PickerPage>('calendar')
  const [decadeStart, setDecadeStart] = useState(() => Math.floor(Number(endDate.split('-')[0]) / 10) * 10)
  // 弹出页面覆盖式的年/月快速跳转，切页要有平稳过渡——照Windows日历"钻取"的缩放
  // 效果：往下钻(年→月、月→日)是从略小+半透明放大到位；往上跳(点标题回年份页)是
  // 反过来从略大+半透明缩小到位，靠这个方向感区分"进一步聚焦"和"往回看全局"两种
  // 不同的操作意图，不是同一个模糊的淡入淡出。具体动画见index.css的
  // .picker-zoom-in/.picker-zoom-out
  const [transitionDir, setTransitionDir] = useState<'in' | 'out'>('in')
  // 左右‹›翻月按钮拿掉了，改成日历格子区域本身左右滑动切月——这个ref必须跟其他
  // hooks一样放在"if (!open) return null"之前，不然open从true变false时组件这次
  // 渲染会少调一个hook，触发React"hooks数量不一致"报错(#310)，之前踩过这个坑
  const touchStartXRef = useRef<number | null>(null)

  // 每次重新打开都用当时真正生效的startDate/endDate重置草稿——不然上次点"取消"
  // 丢弃的半路草稿会在下次打开时还留着(组件本身没卸载，state不会自动清空)
  useEffect(() => {
    if (!open) return
    setPendingStart(startDate)
    setPendingEnd(endDate)
    // 长区间默认停在结束月，理由同上面useState初始值那条注释
    setViewYear(Number(endDate.split('-')[0]))
    setViewMonth(Number(endDate.split('-')[1]) - 1)
    setPage('calendar')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  if (!open) return null

  const weekdayLabels = lang === 'ja' ? WEEKDAY_LABELS_JA : WEEKDAY_LABELS_ZH
  const complete = pendingStart != null && pendingEnd != null
  const grid = buildMonthGrid(viewYear, viewMonth)

  // 预设选项要能显示"当前生效的区间正好是哪个预设"——不然点了预设只是那一瞬间关闭
  // 弹层，下次重新打开完全看不出选的是哪个预设，跟没选一样。用户明确要求过这个
  // 高亮态，且要能"切自定义区间后自动取消预设高亮"：不额外维护一个"选中了哪个预设"
  // 的state，直接每次渲染都用当前草稿(pendingStart/pendingEnd，弹层一打开就用真实
  // startDate/endDate初始化)去反推匹配哪个预设——自定义点选一改草稿，天然就不再匹配
  // 任何预设，高亮自动消失，不用额外写"清除预设选中"这一步
  const now = new Date()
  const thisMonthRange: [string, string] = [ymd(new Date(now.getFullYear(), now.getMonth(), 1)), ymd(new Date(now.getFullYear(), now.getMonth() + 1, 0))]
  const pastMonthRange: [string, string] = [ymd(new Date(now.getFullYear(), now.getMonth() - 1, now.getDate() + 1)), ymd(now)]
  const pastYearRange: [string, string] = [ymd(new Date(now.getFullYear() - 1, now.getMonth(), now.getDate() + 1)), ymd(now)]
  function matchesPreset([s, e]: [string, string]): boolean {
    return pendingStart === s && pendingEnd === e
  }

  function applyPreset(start: string, end: string) {
    onConfirm(start, end)
    onClose()
  }

  function handlePrevMonth() {
    const d = new Date(viewYear, viewMonth - 1, 1)
    setViewYear(d.getFullYear())
    setViewMonth(d.getMonth())
  }
  function handleNextMonth() {
    const d = new Date(viewYear, viewMonth + 1, 1)
    setViewYear(d.getFullYear())
    setViewMonth(d.getMonth())
  }

  // 40px是滑动判定阈值，太小容易跟"点某一天"的轻触误判成滑动
  function handleGridTouchStart(e: React.TouchEvent) {
    touchStartXRef.current = e.touches[0].clientX
  }
  function handleGridTouchEnd(e: React.TouchEvent) {
    const startX = touchStartXRef.current
    touchStartXRef.current = null
    if (startX == null) return
    const deltaX = e.changedTouches[0].clientX - startX
    if (deltaX <= -40) handleNextMonth()
    else if (deltaX >= 40) handlePrevMonth()
  }

  // 日历页点标题"2026年8月"打开月份快速跳转页——完全仿照Windows日历的层级顺序：
  // 日→月→年，逐级放大到更粗粒度的视图，不是日→年→月。这是往上跳一级，过渡方向
  // 是'out'(缩小到位)
  function openMonthPage() {
    setTransitionDir('out')
    setPage('month')
  }
  // 月份页点标题再往上跳一级到年份页(十年网格)——decadeStart定位到viewYear所在的
  // 十年段，同样是'out'(缩小到位)
  function openYearPage() {
    setDecadeStart(Math.floor(viewYear / 10) * 10)
    setTransitionDir('out')
    setPage('year')
  }
  // 选年份/选月份都是往下钻回更具体的视图，过渡方向是'in'(放大到位)：年份页选完
  // 年份退回月份页(停在选好的年份，继续选月)，月份页选完月份退回日历页
  function pickYear(y: number) {
    setViewYear(y)
    setTransitionDir('in')
    setPage('month')
  }
  function pickMonth(m: number) {
    setViewMonth(m)
    setTransitionDir('in')
    setPage('calendar')
  }

  function tapDay(dateStr: string) {
    if (pendingStart && pendingEnd) {
      // 已经是完整区间——这次点击重新开始，视为新起点
      setPendingStart(dateStr)
      setPendingEnd(null)
      return
    }
    if (!pendingStart) {
      setPendingStart(dateStr)
      return
    }
    // 只有起点，这次点击定终点
    if (dateStr === pendingStart) {
      // 同一天点两次——生成合法的单日区间，不是无效点击
      setPendingEnd(dateStr)
    } else if (dateStr < pendingStart) {
      setPendingEnd(pendingStart)
      setPendingStart(dateStr)
    } else {
      setPendingEnd(dateStr)
    }
  }

  function handleConfirm() {
    if (!pendingStart || !pendingEnd) return
    onConfirm(pendingStart, pendingEnd)
    onClose()
  }

  function handleCancel() {
    // 丢弃草稿，不回写——下次重新打开会用最新的真实startDate/endDate重新初始化
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center px-md" onClick={handleCancel}>
      <div className="absolute inset-0 bg-inverse-surface/40" />
      <div
        className="picker-panel-glass relative w-full max-w-[360px] rounded-2xl border-[1.5px] border-dashed border-outline-variant p-md papercut-shadow"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-serif text-headline-md text-on-surface">
            {page === 'year' ? t('rangePickerYearTitle') : page === 'month' ? t('rangePickerMonthTitle') : t('rangePickerTitle')}
          </h2>
          <button type="button" aria-label={t('closeAria')} onClick={handleCancel} className="text-on-surface-variant">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="border-t border-dashed border-outline-variant mb-3" />

        {page === 'year' && (
          <div key="year" className={transitionDir === 'in' ? 'picker-zoom-in' : 'picker-zoom-out'}>
            <YearPage
              decadeStart={decadeStart}
              activeYear={viewYear}
              onPrevDecade={() => setDecadeStart((v) => v - 10)}
              onNextDecade={() => setDecadeStart((v) => v + 10)}
              onPick={pickYear}
            />
          </div>
        )}
        {page === 'month' && (
          <div key="month" className={transitionDir === 'in' ? 'picker-zoom-in' : 'picker-zoom-out'}>
            <MonthPage
              year={viewYear}
              activeMonth={viewMonth}
              pendingStart={pendingStart}
              pendingEnd={pendingEnd}
              onPrevYear={() => setViewYear((v) => v - 1)}
              onNextYear={() => setViewYear((v) => v + 1)}
              onOpenYearPage={openYearPage}
              onPick={pickMonth}
            />
          </div>
        )}
        {page === 'calendar' && (
          <div key="calendar" className={transitionDir === 'in' ? 'picker-zoom-in' : 'picker-zoom-out'}>

        <div className="flex gap-1.5 flex-wrap mb-3">
          <PresetChip
            label={t('presetThisMonth')}
            active={matchesPreset(thisMonthRange)}
            onClick={() => applyPreset(...thisMonthRange)}
          />
          <PresetChip
            label={t('presetPastMonth')}
            active={matchesPreset(pastMonthRange)}
            onClick={() => applyPreset(...pastMonthRange)}
          />
          <PresetChip
            label={t('presetPastYear')}
            active={matchesPreset(pastYearRange)}
            onClick={() => applyPreset(...pastYearRange)}
          />
        </div>

        {/* 只选开始日期时原来想加一句引导文案，手机屏幕窄，"已选开始日期：X·请再选一个
            结束日期"这句要么被截断要么挤占太多空间，用户明确要求"显示不全索性不要"——
            拿掉了，靠日历本身的状态(只有一个实心圆点/确定按钮禁用)传达"还没选完" */}
        {/* 左右‹›翻月按钮拿掉了——用户明确要求让位给日历本身，改成日历格子区域直接
            左右滑动切月(见下面handleGridTouchStart/End)。标题保留，点它打开月份快速
            跳转页(日→月→年逐级上跳，仿照Windows日历，不是日→年→月)，这个跟滑动
            翻月是两回事 */}
        <div className="flex items-center justify-center mb-2">
          <button
            type="button"
            onClick={openMonthPage}
            className="px-2.5 py-1 rounded-lg bg-primary-fixed font-serif text-body-lg text-primary"
          >
            {viewYear}年{viewMonth + 1}月
          </button>
        </div>

        <div className="grid grid-cols-7 text-center mb-1">
          {weekdayLabels.map((w) => (
            <span key={w} className="text-label-caps font-sans text-on-surface-variant py-1">
              {w}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-7" onTouchStart={handleGridTouchStart} onTouchEnd={handleGridTouchEnd}>
          {grid.map(({ date, inMonth }) => {
            const dateStr = ymd(date)
            const isStart = dateStr === pendingStart
            const isEnd = pendingEnd != null && dateStr === pendingEnd
            const isBoundary = isStart || isEnd
            const inRange = pendingStart != null && pendingEnd != null && dateStr > pendingStart && dateStr < pendingEnd
            return (
              <button
                key={dateStr}
                type="button"
                onClick={() => tapDay(dateStr)}
                className="relative h-9 flex items-center justify-center"
              >
                {inRange && <span className="absolute inset-y-1 inset-x-0 bg-primary-fixed" />}
                {isStart && pendingEnd && pendingEnd !== pendingStart && (
                  <span className="absolute inset-y-1 left-1/2 right-0 bg-primary-fixed" />
                )}
                {isEnd && pendingStart && pendingStart !== pendingEnd && (
                  <span className="absolute inset-y-1 left-0 right-1/2 bg-primary-fixed" />
                )}
                <span
                  className={`relative z-[1] w-7 h-7 flex items-center justify-center rounded-full font-serif text-body-md ${
                    isBoundary
                      ? 'bg-primary text-on-primary'
                      : inMonth
                        ? 'text-on-surface'
                        : 'text-on-surface-variant/40'
                  }`}
                >
                  {date.getDate()}
                </span>
              </button>
            )
          })}
        </div>

        <div className="border-t border-dashed border-outline-variant mt-3 pt-3 flex items-center justify-between">
          <button type="button" onClick={handleCancel} className="font-sans text-on-surface-variant px-2 py-1">
            {t('cancelLabel')}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!complete}
            className="font-sans font-bold px-4 py-1.5 rounded-lg disabled:text-on-surface-variant/50 text-primary"
          >
            {t('confirmLabel')}
          </button>
        </div>
          </div>
        )}
      </div>
    </div>
  )
}

function PresetChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2.5 py-1 rounded-full border-[1.5px] font-sans text-[11.5px] transition-colors ${
        active
          ? 'border-primary bg-primary-container text-on-primary-container'
          : 'border-outline-variant text-on-surface active:bg-surface-variant/50'
      }`}
    >
      {label}
    </button>
  )
}

/** 年份快速跳转页(mock-v8确认版)——独立页面，不是跟月份混一起滚动。整块连续网格
 * (4列)不是一堆圆角胶囊；十年一段翻页，前后各多显示2年做"上一段/下一段"的视觉过渡
 * (灰显，不可跳出当前十年段之外单独强调，只是让翻页边界不那么突兀) */
function YearPage({
  decadeStart,
  activeYear,
  onPrevDecade,
  onNextDecade,
  onPick,
}: {
  decadeStart: number
  activeYear: number
  onPrevDecade: () => void
  onNextDecade: () => void
  onPick: (year: number) => void
}) {
  const years = Array.from({ length: 16 }, (_, i) => decadeStart - 2 + i)
  return (
    <>
      <div className="flex items-center justify-center gap-2 mb-2">
        <button type="button" onClick={onPrevDecade} className="text-on-surface-variant">
          <span className="material-symbols-outlined">chevron_left</span>
        </button>
        <span className="font-serif text-body-lg text-on-surface min-w-[110px] text-center">
          {decadeStart} - {decadeStart + 9}
        </span>
        <button type="button" onClick={onNextDecade} className="text-on-surface-variant">
          <span className="material-symbols-outlined">chevron_right</span>
        </button>
      </div>
      {/* 格子线拿掉了，不再是border-collapse那种整块网格，单元格之间靠gap留白+
          自己的圆角背景区分，不靠边框线 */}
      <div className="grid grid-cols-4 gap-1">
        {years.map((y) => {
          const inDecade = y >= decadeStart && y <= decadeStart + 9
          return (
            <button
              key={y}
              type="button"
              onClick={() => onPick(y)}
              className={`py-3.5 text-center font-sans text-body-md rounded-lg ${
                y === activeYear
                  ? 'bg-primary text-on-primary font-bold'
                  : inDecade
                    ? 'text-on-surface'
                    : 'text-on-surface-variant/40'
              }`}
            >
              {y}
            </button>
          )
        })}
      </div>
    </>
  )
}

/** 月份快速跳转页(mock-v8确认版)——选完年份后进这一页，独立页面。‹›直接翻上一年/
 * 下一年(留在月份页不用回年份页)；点顶部"YYYY年"标题才跳回年份页做大跨度年份跳转。
 * 落在当前草稿区间内的月份(pendingStart~pendingEnd跨月时)用主色浅底标出，跟当前
 * 选中月份(实心)区分开 */
function MonthPage({
  year,
  activeMonth,
  pendingStart,
  pendingEnd,
  onPrevYear,
  onNextYear,
  onOpenYearPage,
  onPick,
}: {
  year: number
  activeMonth: number
  pendingStart: string | null
  pendingEnd: string | null
  onPrevYear: () => void
  onNextYear: () => void
  onOpenYearPage: () => void
  onPick: (month: number) => void
}) {
  const activeYm = `${year}-${String(activeMonth + 1).padStart(2, '0')}`
  return (
    <>
      <div className="flex items-center justify-center gap-2 mb-2">
        <button type="button" onClick={onPrevYear} className="text-on-surface-variant">
          <span className="material-symbols-outlined">chevron_left</span>
        </button>
        <button
          type="button"
          onClick={onOpenYearPage}
          className="px-2.5 py-1 rounded-lg bg-primary-fixed font-serif text-body-lg text-primary min-w-[110px] text-center"
        >
          {year}年
        </button>
        <button type="button" onClick={onNextYear} className="text-on-surface-variant">
          <span className="material-symbols-outlined">chevron_right</span>
        </button>
      </div>
      {/* 格子线拿掉了，理由同YearPage */}
      <div className="grid grid-cols-4 gap-1">
        {Array.from({ length: 12 }, (_, m) => m).map((m) => {
          const ym = `${year}-${String(m + 1).padStart(2, '0')}`
          const isActive = ym === activeYm
          const inRange = pendingStart != null && pendingEnd != null && ym >= pendingStart.slice(0, 7) && ym <= pendingEnd.slice(0, 7)
          return (
            <button
              key={m}
              type="button"
              onClick={() => onPick(m)}
              className={`py-3.5 text-center font-sans text-body-md rounded-lg ${
                isActive
                  ? 'bg-primary text-on-primary font-bold'
                  : inRange
                    ? 'bg-primary-fixed text-primary font-semibold'
                    : 'text-on-surface'
              }`}
            >
              {m + 1}月
            </button>
          )
        })}
      </div>
    </>
  )
}
