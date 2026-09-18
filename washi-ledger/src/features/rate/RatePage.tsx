import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AppLayout } from '../../design-system/components/AppLayout'
import { ThemeIcon } from '../../design-system/components/ThemeIcon'
import {
  fetchRates,
  fetchRateHistoryStats,
  fetchCentralBankRates,
  CURRENCIES,
  type RateSnapshot,
  type RateHistoryStats,
  type CentralBankRateEntry,
} from '../../data/rate'
import { useI18n } from '../../lib/i18n'

// B-40：1W按7个自然日回溯查询，但汇率数据源(frankfurter.dev，央行参考汇率)周末不
// 发布，7个自然日基本必然跨一个周末，实际只能拿到约5个交易日的真实数据点(远少于预期
// 的"一周"，右侧留白大)。改成回溯9个自然日，能多覆盖到的真实交易日更接近7个——不是
// 插值造假点，只是放宽真实查询窗口，跟fetchRateHistory本身"如实显示不插值"的原则
// 不冲突
const TIMEFRAMES = [
  { key: '1W', days: 9, labelKey: 'rateTimeframe1W', statsPrefixKey: 'rateStatsPrefix1W' },
  { key: '1M', days: 30, labelKey: 'rateTimeframe1M', statsPrefixKey: 'rateStatsPrefix1M' },
  { key: '1Y', days: 365, labelKey: 'rateTimeframe1Y', statsPrefixKey: 'rateStatsPrefix1Y' },
] as const
type TimeframeKey = (typeof TIMEFRAMES)[number]['key']

function monthDay(dateStr: string) {
  const [, m, d] = dateStr.split('-')
  return `${m}-${d}`
}

/** 走势图坐标系——照旧App renderRateTrendChart()的做法从"0-100百分比viewBox"改成
 * 固定像素坐标(W/H/top/base/left/right)，这样纵坐标数值文字、底部日期文字、选中点
 * 圆环才有稳定可读的字号，不会跟着容器宽高比被拉伸变形(之前100x40那版viewBox配合
 * preserveAspectRatio="none"只画了折线，没有文字/圆点，才没暴露这个问题) */
const CHART_W = 320
const CHART_H = 160
const CHART_TOP = 12
const CHART_BASE = 118
// B-40：纵坐标数值文字之前画在这个左边距里、跟折线共用同一个可横向滚动的<svg>——
// 往右滑看后面的点时纵坐标也跟着一起滑走了。改成纵坐标文字拆到滚动容器外面单独一个
// 不滚动的<svg>(见AXIS_W)，这里的CHART_LEFT不再需要给文字留位置，只留一点点边距
// 防止最左边的点/网格线贴边被裁
const CHART_LEFT = 10
// R-XX：纵坐标改成Stitch方案B——独立固定列不跟着横向滚动，宽度从44拓宽到54，
// 数值多一位(比如三位整数"119.234")也留得下，不会贴边被裁
const AXIS_W = 54
// 原来是8——横坐标日期文字是text-anchor="middle"，最后一个点紧贴右边缘时文字有一半会
// 超出viewBox被裁掉(这才是"08-28被截断"的真正成因，不只是之前非均匀拉伸的问题)，留够
// 边距让最后一个日期标签完整显示
const CHART_RIGHT = 20
const GRID_STEPS = 3
const MIN_LABEL_GAP_PX = 40
// R-XX：横向滚动重新带回来(之前B-38做过、B-40又撤掉，见下面chartLayout/chartGeometry
// 拆分两段计算的注释)——每个点之间固定留POINT_GAP像素，数据点越多图表越宽，这样1Y档
// 365个点才不会全挤在一屏里看不清，1W/1M这种点数少的档位如果按点数算出来的宽度小于
// 容器实际宽度，会在chartLayout里取两者较大值兜底，不会比容器还窄
const POINT_GAP = 18

/** 纵坐标数值精度——汇率数值量级差异很大(比如JPY→CNY在0.05附近，CNY→JPY在19附近)，
 * 固定小数位要么小汇率全显示0.0，要么大汇率一堆无意义的尾数，按量级动态选精度 */
function formatAxisValue(v: number) {
  if (v < 1) return v.toFixed(4)
  if (v < 10) return v.toFixed(3)
  return v.toFixed(2)
}

/** R-XX走势图重设计——把原来逐点直线连接的折线换成Catmull-Rom平滑曲线(转成三次
 * 贝塞尔控制点，张力取标准的1/6)，视觉上更接近设计稿里的"水墨笔触"曲线，不是
 * 简单加个border-radius。点数<3时退化成直线(贝塞尔曲线至少需要4个参考点才能算
 * 控制点，2个点直接连线足够，没必要为2点硬套曲线公式) */
function smoothLinePath(points: { x: number; y: number }[]): string {
  if (points.length < 2) return ''
  if (points.length === 2) {
    return `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)} L ${points[1].x.toFixed(1)} ${points[1].y.toFixed(1)}`
  }
  let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? i : i - 1]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[i + 2 < points.length ? i + 2 : i + 1]
    const cp1x = p1.x + (p2.x - p0.x) / 6
    const cp1y = p1.y + (p2.y - p0.y) / 6
    const cp2x = p2.x - (p3.x - p1.x) / 6
    const cp2y = p2.y - (p3.y - p1.y) / 6
    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)} ${cp2x.toFixed(1)} ${cp2y.toFixed(1)} ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`
  }
  return d
}

/** 汇率换算——照design-assets/prototypes/.../ad647758a5e5485e84e33107fb3fac3c
 * ("汇率换算 全新重构版")这份最新Stitch设计稿重做：从"多货币搜索+热门汇率列表"换成
 * "单一货币对换算卡片(和纸胶带装饰+图章式互换按钮+实时汇率胶囊) + 走势图"这个新布局，
 * 旧的多货币列表/搜索框不再是这版设计的一部分，故未保留——如果以后还需要那个能力，
 * 应该作为独立需求另外提。
 *
 * 走势图数据源用frankfurter.dev同一个API真实存在的时间序列接口(fetchRateHistory)，
 * 不是编的假折线；这是按日更新的央行参考汇率，没有盘中粒度，周末/节假日也没有发布，
 * 短窗口真实点可能会比预期少，如实显示，不插值凑数据。R-13：时间范围去掉了原来的
 * 1D档(数据点太少画不出有意义的走势)，保留的1W/1M/1Y改用翻译文案展示，不再直接秀
 * 英文缩写；纵坐标/更密的横坐标日期标签/点击折线查看选中点数值，参照旧App
 * renderRateTrendChart()同一套逻辑搬过来。 */
export function RatePage() {
  const { t } = useI18n()
  const [fromCode, setFromCode] = useState('JPY')
  const [toCode, setToCode] = useState('CNY')
  const [amount, setAmount] = useState('100')
  // R-30：换算结果那栏原来只是根据amount算出来的纯展示文字，改成也能手动输入、
  // 反向推算amount——双向互算。convertedAmount存的是用户在"下面那栏"手动输入的
  // 原始文本；lastEditedField记"哪一栏最后被手动编辑过"，没被编辑的那一栏在渲染时
  // 用汇率从被编辑的那一栏实时推算显示(见下面displayAmount/displayConverted)，
  // 不是各自维护一份互不同步的状态——这样切货币对/汇率刷新时，没在编辑的那一栏
  // 也会自动跟着重新算对
  const [convertedAmount, setConvertedAmount] = useState('')
  const [lastEditedField, setLastEditedField] = useState<'from' | 'to'>('from')
  const [snapshot, setSnapshot] = useState<RateSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [timeframe, setTimeframe] = useState<TimeframeKey>('1W')
  const [historyStats, setHistoryStats] = useState<RateHistoryStats | null>(null)
  const [historyLoading, setHistoryLoading] = useState(true)
  const [historyError, setHistoryError] = useState('')
  // 折线图选中点(R-13)——照旧App selectedRatePointIdx同一套逻辑：默认高亮最新一个点
  // (null表示"还没选，用最后一个")，点任意点会把它移过去；每次历史数据换了(切换时间
  // 范围/切换货币对)都要清空回到"默认最新点"，不然可能残留一个超出新数组长度的下标
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null)
  // R-XH：chartAreaWidth现在是横向滚动容器的"可见视口宽度"(不是整张图表的总宽度)——
  // 用来算纵轴要不要动态收窄到当前可见范围。容器div只在chartGeometry非null(有数据)
  // 时才挂载，首次进页面/切换时间范围重新loading的那一刻它会从DOM里消失再重新出现，
  // 所以用回调ref而不是useRef+空依赖数组的useEffect——后者只在组件首次挂载那一刻跑
  // 一次，如果那一刻容器还没渲染出来(数据还在加载)，就会永远错过绑定ResizeObserver
  // 的机会，chartAreaWidth会一直卡在初始默认值320，在比320窄的手机屏幕上量不准
  const [chartAreaWidth, setChartAreaWidth] = useState(CHART_W)
  const chartResizeObserverRef = useRef<ResizeObserver | null>(null)
  // R-XH：横向滚动容器本身的ref+当前滚动位置——纵轴min/max现在只按"当前可见窗口"内
  // 的点动态算(见下面chartGeometry)，需要知道滚到哪了才能算出可见窗口是哪一段
  const chartScrollElRef = useRef<HTMLDivElement | null>(null)
  const [scrollLeft, setScrollLeft] = useState(0)
  const scrollRafRef = useRef<number | null>(null)
  const chartContainerRef = useCallback((el: HTMLDivElement | null) => {
    chartResizeObserverRef.current?.disconnect()
    chartResizeObserverRef.current = null
    chartScrollElRef.current = el
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width
      if (width && width > 0) setChartAreaWidth(width)
    })
    observer.observe(el)
    chartResizeObserverRef.current = observer
  }, [])
  // 滚动事件很密集，节流成每帧最多算一次——不然每次onScroll都重算chartGeometry
  // (含Catmull-Rom平滑曲线，1Y档365个点)会掉帧
  function handleChartScroll(e: React.UIEvent<HTMLDivElement>) {
    const el = e.currentTarget
    if (scrollRafRef.current != null) return
    scrollRafRef.current = requestAnimationFrame(() => {
      scrollRafRef.current = null
      setScrollLeft(el.scrollLeft)
    })
  }

  async function refresh(base: string) {
    setLoading(true)
    setError('')
    try {
      const data = await fetchRates(base)
      setSnapshot(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh(fromCode)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromCode])

  async function loadHistory(base: string, target: string, tf: TimeframeKey) {
    const days = TIMEFRAMES.find((t) => t.key === tf)!.days
    setHistoryLoading(true)
    setHistoryError('')
    try {
      const stats = await fetchRateHistoryStats(base, target, days)
      setHistoryStats(stats)
      // B-41：顶部换算卡片的unitRate来自fetchRates()单独查的"latest快照"接口，走势图
      // 走的是这里的历史区间接口——两条链路各查各的，历史接口如果查到了比"latest快照"
      // 更新的一天，顶部就会卡在旧数据上、跟图表最新点对不上(旧App fetchRate()
      // 2026-08-04已经修过同一类问题，见DEVLOG)。这里拿历史最后一天校正顶部：只要
      // 不比当前snapshot的日期旧，就用它覆盖snapshot.rates[target]这一项——snapshot
      // 是多币种快照(base兑11种常用货币)，只改target这一项，其余货币不受影响；
      // prev.base!==base这层判断防止fromCode已经切换、history还是旧货币对结果的
      // 竞态场景下错误覆盖
      const points = stats.points
      if (points.length > 0) {
        const last = points[points.length - 1]
        setSnapshot((prev) => {
          if (!prev || prev.base !== base) return prev
          if (last.date < prev.date) return prev
          if (prev.date === last.date && prev.rates[target] === last.rate) return prev
          return { ...prev, date: last.date, rates: { ...prev.rates, [target]: last.rate } }
        })
      }
    } catch (e) {
      setHistoryError(e instanceof Error ? e.message : String(e))
    } finally {
      setHistoryLoading(false)
    }
  }

  useEffect(() => {
    setSelectedIdx(null)
    loadHistory(fromCode, toCode, timeframe)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromCode, toCode, timeframe])

  // R-XH：底部统计条第三项(两国央行利率)——一次性拿全部11个货币的利率(后端有14天
  // 缓存，不用按需查询)，不跟着fromCode/toCode变化重复请求，只在进页面/下拉刷新时拉
  const [centralBankRates, setCentralBankRates] = useState<Record<string, CentralBankRateEntry> | null>(null)
  async function loadCentralBankRates() {
    try {
      const rates = await fetchCentralBankRates()
      setCentralBankRates(rates)
    } catch (e) {
      console.error('央行利率拉取失败', e)
    }
  }
  useEffect(() => {
    loadCentralBankRates()
  }, [])

  // R-XH：横向滚动默认停在最新数据(最右)——照旧App/B-XX同样的"新进页面/切换货币对
  // 时间范围时默认看最新"预期。这里直接改DOM的scrollLeft(而不是算数学值)，因为实际
  // 可滚动宽度由浏览器排版决定(chartLayout.innerWidth虽然算出来了，但真实scrollWidth
  // 还包含容器自身padding等因素，直接读DOM更准)；historyStats变化后DOM才会重新渲染
  // 出新的图表宽度，所以在这个effect里做，不在loadHistory里提前算 */
  useEffect(() => {
    const el = chartScrollElRef.current
    if (!el || !historyStats || historyStats.points.length < 2) return
    el.scrollLeft = el.scrollWidth
    setScrollLeft(el.scrollLeft)
  }, [historyStats])

  // R-17：下拉刷新——当前货币对的实时汇率快照+走势图历史数据+央行利率都重新拉一次，
  // 互不依赖并行拉；不重置selectedIdx/timeframe/货币对，用户已经选的东西不因为
  // 刷新一下就被打乱
  async function handleRefresh() {
    await Promise.all([refresh(fromCode), loadHistory(fromCode, toCode, timeframe), loadCentralBankRates()])
  }

  function handleSwap() {
    setFromCode(toCode)
    setToCode(fromCode)
  }

  // R-31：实时汇率胶囊条上的"重置"按钮——只清空上下两个金额输入框恢复默认(不动
  // 货币对/走势图时间范围)，同时重新拉取一次最新汇率，两件事一起做才对得上图标
  // 本身的"刷新"语义
  function handleResetAmounts() {
    setAmount('100')
    setConvertedAmount('')
    setLastEditedField('from')
    refresh(fromCode)
  }

  const unitRate = snapshot && snapshot.base === fromCode ? snapshot.rates[toCode] : null
  const amountNum = parseFloat(amount)
  const convertedAmountNum = parseFloat(convertedAmount)
  // 没被编辑的那一栏用汇率从被编辑的那一栏实时推算；被编辑的那一栏直接显示用户输入
  // 的原始文本(不在这里重新格式化，不然打字打到一半"4."会被toFixed(2)吃掉)
  const derivedConverted = unitRate != null && !isNaN(amountNum) ? amountNum * unitRate : null
  const derivedAmount = unitRate != null && unitRate !== 0 && !isNaN(convertedAmountNum) ? convertedAmountNum / unitRate : null
  const displayAmount = lastEditedField === 'to' ? (derivedAmount != null ? derivedAmount.toFixed(2) : '') : amount
  const displayConverted =
    lastEditedField === 'from' ? (derivedConverted != null ? derivedConverted.toFixed(2) : '') : convertedAmount

  function handleAmountChange(v: string) {
    setAmount(v)
    setLastEditedField('from')
  }
  function handleConvertedChange(v: string) {
    setConvertedAmount(v)
    setLastEditedField('to')
  }

  // R-XH：横向滚动重新带回来，拆成两段算——原因是"纵轴min/max该按哪些点算"这件事
  // 现在依赖"当前滚动到哪"，但"每个点的x坐标"完全不依赖纵轴，为了避免滚动时重算x坐标
  // (只有y会变)，先单独算一遍x布局(chartLayout)，再算一遍真正要画的geometry(y坐标/
  // 曲线/网格线，依赖scrollLeft)。
  // 图表总宽度按点数*POINT_GAP撑开，比容器可见宽度(chartAreaWidth)大就出现横向滚动条；
  // 点数少(比如1W档不到10个点)撑出来的宽度比容器还窄时，取容器宽度兜底，不会出现
  // "一半是图一半是空白"的情况
  const chartLayout = useMemo(() => {
    const history = historyStats?.points ?? []
    if (history.length < 2) return null
    const innerWidth = Math.max(chartAreaWidth, CHART_LEFT + CHART_RIGHT + POINT_GAP * (history.length - 1))
    const stepX = (innerWidth - CHART_LEFT - CHART_RIGHT) / (history.length - 1)
    const xs = history.map((_, i) => CHART_LEFT + i * stepX)
    return { history, innerWidth, xs }
  }, [historyStats, chartAreaWidth])

  // B-38/B-40那个"1Y档滚到最右只看到最后一小段、但纵轴还是按全年range画"导致折线
  // 被压扁看起来像直线的bug，这次的修法：纵轴min/max只按"当前可见窗口内"的点动态算，
  // 随scrollLeft变化重新算——滚到哪一段，纵轴就跟着哪一段的真实波动范围显示。可见
  // 窗口前后各多包一个点，让曲线在窗口边缘也能自然连接，不会看起来突然截断；窗口内
  // 点数不够2个时(比如缩得极窄的边缘情况)退回用全部点的range兜底，不让图表直接崩掉
  const chartGeometry = useMemo(() => {
    if (!chartLayout) return null
    const { history, innerWidth, xs } = chartLayout

    let lo = 0
    while (lo < xs.length - 1 && xs[lo + 1] < scrollLeft) lo++
    let hi = xs.length - 1
    while (hi > 0 && xs[hi - 1] > scrollLeft + chartAreaWidth) hi--
    const visibleValues = history.slice(Math.max(0, lo - 1), Math.min(history.length, hi + 2)).map((p) => p.rate)
    const values = visibleValues.length >= 2 ? visibleValues : history.map((p) => p.rate)

    const min = Math.min(...values)
    const max = Math.max(...values)
    const range = max - min || max * 0.02 || 1
    const points = history.map((p, i) => {
      const y = CHART_BASE - ((p.rate - min) / range) * (CHART_BASE - CHART_TOP)
      return { x: xs[i], y, date: p.date, rate: p.rate }
    })
    // R-XX：折线改成smoothLinePath()画的平滑曲线(设计稿要求的"水墨笔触"曲线)，
    // 不再是逐点直线连接；填充区域的顶边跟着用同一条平滑曲线，只有闭合回底边这
    // 两段还是直线(L)，不用曲线
    const line = smoothLinePath(points)
    const area = `${line} L ${points[points.length - 1].x.toFixed(1)} ${CHART_BASE} L ${points[0].x.toFixed(1)} ${CHART_BASE} Z`

    // 纵坐标(R-13)——照旧App renderTrendChart()系列图表的网格线公式：GRID_STEPS+1条
    // 横向虚线，从min(底)到max(顶)等分，每条线配一个数值文字，不是只画折线不给刻度
    const gridLines = Array.from({ length: GRID_STEPS + 1 }, (_, s) => {
      const y = CHART_BASE - (s / GRID_STEPS) * (CHART_BASE - CHART_TOP)
      const value = min + (s / GRID_STEPS) * (max - min)
      return { y, value }
    })

    // 底部横坐标(R-13)——照旧App labelIdxs/filteredLabelIdxs同一套"先按间隔取样、
    // 再按最小像素间距过滤掉挤在一起的"逻辑，不是只显示头尾两个日期。R-XH：目标
    // 标签数改成按图表总宽度算(大约每150px一个)，不再固定"6个"——1Y档图表被撑得
    // 很宽，固定6个的话滚动到中间某一段基本看不到日期标签
    const targetLabelCount = Math.max(4, Math.round(innerWidth / 150))
    const showEvery = points.length > targetLabelCount ? Math.ceil(points.length / targetLabelCount) : 1
    const rawLabelIdxs: number[] = []
    for (let i = 0; i < points.length; i += showEvery) rawLabelIdxs.push(i)
    if (rawLabelIdxs[rawLabelIdxs.length - 1] !== points.length - 1) rawLabelIdxs.push(points.length - 1)
    const labelIdxs = rawLabelIdxs.filter((idx, k) => {
      const nextIdx = rawLabelIdxs[k + 1]
      return nextIdx === undefined || points[nextIdx].x - points[idx].x >= MIN_LABEL_GAP_PX
    })

    return { points, line, area, gridLines, labelIdxs, chartWidth: innerWidth }
  }, [chartLayout, scrollLeft, chartAreaWidth])

  // 选中点(R-13)——没手动点过时默认最后一个点(最新数据)，跟旧App一致
  const activeIdx =
    chartGeometry == null
      ? null
      : selectedIdx != null && selectedIdx < chartGeometry.points.length
        ? selectedIdx
        : chartGeometry.points.length - 1
  const activePoint = chartGeometry && activeIdx != null ? chartGeometry.points[activeIdx] : null

  // R-XX走势图重设计——涨跌幅徽标/区间最高最低/波动区间这几项统计值后端已经算好
  // (worker/src/rate/handlers.ts)，这里只管展示，不再自己算一遍。pctChange为null
  // (数据点不够)时不显示徽标，不是显示"0.00%"这种编出来的假数值
  const pctChange = historyStats?.pctChange ?? null
  const statsPrefixKey = TIMEFRAMES.find((tf) => tf.key === timeframe)!.statsPrefixKey

  return (
    <AppLayout title={t('rateNavLabel')} leftButton="back" onRefresh={handleRefresh}>
      <div className="px-md pt-lg pb-xl flex flex-col gap-lg">
        {/* 换算卡片(The Ledger Card)——和纸胶带装饰角+虚线描边，照旧App结余卡片同一套材质语言 */}
        <div className="rate-card relative bg-surface-container-lowest border-[1.5px] border-dashed border-outline-variant rounded-xl p-md shadow-[0_2px_0_rgba(0,0,0,0.02)]">
          {/* B-33：同BalanceCard.tsx——换成真实斜纹纹理，尺寸放大，位置/角度不动 */}
          <div
            className="absolute -top-1.5 -right-2 w-14 h-4 rounded-sm washi-tape-texture"
            style={{ transform: 'rotate(4deg)' }}
          />

          <div className="flex flex-col gap-md relative">
            {/* R-31：清空金额+刷新汇率——跟"JPY·日元"这行同一个flex行
                justify-between，保证跟这行文字在同一水平线上对齐；这一整行加了
                mt-1.5，把行本身往下挪一点点，跟右上角和纸胶带装饰(absolute
                -top-1.5)拉开一点间距，不再挤在一起 */}
            <div className="flex flex-col gap-1 pb-4 mt-1.5 border-b border-dashed border-outline-variant/50">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center bg-primary-container text-on-primary-container">
                    <span className="material-symbols-outlined text-[18px]">payments</span>
                  </div>
                  <select
                    value={fromCode}
                    onChange={(e) => setFromCode(e.target.value)}
                    className="bg-transparent border-none text-body-lg text-on-surface focus:outline-none focus:ring-0 font-semibold"
                  >
                    {CURRENCIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.code} · {c.zh}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={handleResetAmounts}
                  aria-label={t('rateResetAria')}
                  className="stamp-shadow shrink-0 w-8 h-8 rounded-full bg-surface-container-lowest border border-outline-variant flex items-center justify-center text-primary hover:-translate-y-0.5 active:scale-90 transition-transform"
                  style={{ boxShadow: '0 2px 0 var(--color-surface-variant)' }}
                >
                  <ThemeIcon icon="restart_alt" effect="bare" size={18} className="text-[18px]" />
                </button>
              </div>
              <input
                type="number"
                inputMode="decimal"
                value={displayAmount}
                onChange={(e) => handleAmountChange(e.target.value)}
                placeholder="0.00"
                className="w-full bg-transparent border-none outline-none px-0 py-1 font-serif text-[42px] leading-[48px] font-bold text-primary text-right focus:ring-0"
              />
            </div>

            {/* 互换按钮(The Stamp)——照design稿绝对定位浮在两行中间，不占布局空间 */}
            <button
              type="button"
              onClick={handleSwap}
              aria-label={t('swapCurrencyAria')}
              className="stamp-shadow absolute left-8 top-1/2 -translate-y-1/2 z-10 w-12 h-12 rounded-full bg-surface-container-lowest border-[1.5px] border-outline-variant flex items-center justify-center text-primary"
              style={{ boxShadow: '0 3px 0 var(--color-surface-variant)' }}
            >
              <span className="material-symbols-outlined text-[24px]">swap_vert</span>
            </button>

            <div className="flex flex-col gap-1 pt-2">
              <div className="flex items-center justify-end gap-2">
                <select
                  value={toCode}
                  onChange={(e) => setToCode(e.target.value)}
                  className="bg-transparent border-none text-body-lg text-on-surface focus:outline-none focus:ring-0 font-semibold text-right"
                >
                  {CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code} · {c.zh}
                    </option>
                  ))}
                </select>
                <div className="w-8 h-8 rounded-full flex items-center justify-center bg-secondary-container text-on-secondary-container">
                  <span className="material-symbols-outlined text-[18px]">account_balance</span>
                </div>
              </div>
              <input
                type="number"
                inputMode="decimal"
                value={displayConverted}
                onChange={(e) => handleConvertedChange(e.target.value)}
                placeholder="0.00"
                className="w-full bg-transparent border-none outline-none px-0 py-1 font-serif text-[42px] leading-[48px] font-bold text-on-surface text-right opacity-80 focus:ring-0"
              />
            </div>
          </div>

          {/* B-XX：这条胶囊之前mt-6(24px)+上面swap区块自带的间距叠加，跟"0.00"
              数字之间空出一大截不必要的留白，改成mt-3(12px)收紧，节省出来的空间
              用来给上面第一行(mt-1.5)腾地方，整张卡片上下重新分配，不是单纯往下堆 */}
          {/* R-04(2026-08-22)重构成Stitch这版卡片时这行更新日期被拿掉了(新设计稿本身
              没画这个元素)，用户要求恢复——日期跟汇率数值同一行显示，不单独起一行，
              照下面走势图选中点"日期 · 数值"同一种拼接格式(见下方activePoint那段) */}
          <div className="mt-3 text-center text-label-caps font-sans text-outline bg-surface-variant/30 py-2 rounded border border-dashed border-outline-variant/50">
            {loading
              ? t('rateLoading')
              : unitRate != null
                ? `${snapshot?.date ? `${snapshot.date} · ` : ''}1 ${fromCode} = ${unitRate.toFixed(4)} ${toCode}`
                : t('rateNeverFetched')}
          </div>
          {error && <p className="mt-2 text-body-md text-primary break-all">{error}</p>}
        </div>

        {/* 走势图(R-13：时间范围去掉1D、剩下三档用翻译文案；加纵坐标网格线+更密的
            横坐标日期标签+点击折线查看选中点数值，逻辑照旧App renderRateTrendChart()搬) */}
        <div className="rate-card flex flex-col gap-md bg-surface-container-lowest border-[1.5px] border-dashed border-outline-variant rounded-xl p-md shadow-[0_2px_0_rgba(0,0,0,0.02)]">
          <div className="flex items-center justify-between flex-wrap gap-xs">
            <div className="flex items-center gap-1.5">
              <h3 className="text-label-caps font-sans text-on-surface-variant">
                {fromCode}/{toCode} {t('rateTrendLabel')}
              </h3>
              {/* R-XX：涨跌幅徽标——后端算好的pctChange，null(数据点不够)时不显示，
                  正数用secondary(草木绿)配色，负数/零用primary(印章红)配色，跟
                  设计稿"涨绿跌红"的直觉一致 */}
              {pctChange != null && (
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] font-sans font-medium ${
                    pctChange >= 0
                      ? 'bg-secondary-container/60 text-on-secondary-container'
                      : 'bg-primary-container/40 text-on-primary-container'
                  }`}
                >
                  {pctChange >= 0 ? '+' : ''}
                  {pctChange.toFixed(2)}%
                </span>
              )}
            </div>
            {/* R-XX：时间范围从"三个各自独立的按钮"改成共享同一条底槽的分段控件——
                外层一个统一的圆角容器(bg-surface-variant/40)当轨道，内部按钮贴着
                排、没有button-to-button的间隙，选中的那个再叠一层实心背景 */}
            <div className="flex items-center gap-0.5 p-0.5 rounded-full bg-surface-variant/40">
              {TIMEFRAMES.map((tf) => (
                <button
                  key={tf.key}
                  type="button"
                  onClick={() => setTimeframe(tf.key)}
                  className={`px-3 py-1.5 rounded-full text-label-caps whitespace-nowrap transition-colors ${
                    timeframe === tf.key
                      ? 'bg-primary text-on-primary shadow-sm'
                      : 'text-on-surface-variant'
                  }`}
                >
                  {t(tf.labelKey)}
                </button>
              ))}
            </div>
          </div>

          {/* 选中点数值——照旧App rateTrendPointInfo，默认显示最新点，点折线上任意点会跳过来。
              R-XX：改成胶囊底色的悬浮提示样式(呼应设计稿里"浮动气泡"的观感)，仍然是固定在
              图表上方的一行文字，不是跟着选中点在SVG里左右浮动——那种做法需要额外处理
              tooltip贴近图表左右边缘时被裁切的问题，这版先用更简单可靠的固定位置实现 */}
          {chartGeometry && activePoint && (
            <div className="self-center px-3 py-1 rounded-full bg-surface-container text-label-caps font-sans text-on-surface-variant shadow-sm">
              {activePoint.date} · <span className="text-primary font-semibold">{formatAxisValue(activePoint.rate)} {toCode}</span>
            </div>
          )}

          {/* B-XX：高度之前写死h-52(208px)，跟图表实际高度常量CHART_H(160px)对不上，
              多出的48px在图表下方露出一块空白(用户真机截图确认)。改成inline style
              直接读CHART_H这个常量本身，两边永远同一个数字，不会再出现"改了图表高度
              常量、忘了同步改这个Tailwind class"这种偏差 */}
          <div className="relative w-full mt-1" style={{ height: CHART_H }}>
            {historyLoading ? (
              <p className="w-full h-full flex items-center justify-center text-body-md text-on-surface-variant">{t('rateLoading')}</p>
            ) : historyError ? (
              <p className="w-full h-full flex items-center justify-center text-body-md text-primary text-center break-all px-2">
                {historyError}
              </p>
            ) : !chartGeometry ? (
              <p className="w-full h-full flex items-center justify-center text-body-md text-on-surface-variant">{t('rateNoHistory')}</p>
            ) : (
              <div className="flex h-full">
              {/* B-40：纵坐标数值文字单独一个不滚动的<svg>，固定贴在左边——跟右边可
                  横向滚动的折线图共用同一套gridLines的y坐标，横向滑动时这一列不动，
                  数值始终看得到 */}
              <svg width={AXIS_W} height={CHART_H} className="shrink-0" style={{ display: 'block' }}>
                {chartGeometry.gridLines.map((g, i) => (
                  <text key={i} x={AXIS_W - 6} y={g.y + 3} fontSize={9} fill="var(--color-outline)" textAnchor="end">
                    {formatAxisValue(g.value)}
                  </text>
                ))}
              </svg>
              {/* R-XH：横向滚动带回来——这个容器本身可以左右滑，不用把全部数据点
                  硬塞进一屏；默认滚到最右(见上面historyStats变化时那个effect)，
                  纵轴数值(左边固定列)和这里的滚动互不影响，只是共享同一套
                  gridLines的y坐标 */}
              <div
                ref={chartContainerRef}
                onScroll={handleChartScroll}
                className="flex-1 min-w-0 h-full overflow-x-auto overflow-y-hidden"
              >
              <svg width={chartGeometry.chartWidth} height={CHART_H} viewBox={`0 0 ${chartGeometry.chartWidth} ${CHART_H}`} style={{ display: 'block' }}>
                <defs>
                  <linearGradient id="rateChartGradient" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-primary)" />
                    <stop offset="100%" stopColor="transparent" />
                  </linearGradient>
                  {/* R-XX：网格线改成两端渐隐——之前是通栏均匀虚线，横向拉一条纯色
                      渐变(两头透明、中间实色)当stroke，配合下面去掉strokeDasharray，
                      线本身还在，只是视觉上不再是一条生硬贯穿全宽的线 */}
                  <linearGradient id="rateGridFade" x1="0" x2="1" y1="0" y2="0">
                    <stop offset="0%" stopColor="var(--color-outline-variant)" stopOpacity={0} />
                    <stop offset="15%" stopColor="var(--color-outline-variant)" stopOpacity={0.8} />
                    <stop offset="85%" stopColor="var(--color-outline-variant)" stopOpacity={0.8} />
                    <stop offset="100%" stopColor="var(--color-outline-variant)" stopOpacity={0} />
                  </linearGradient>
                </defs>

                {/* 纵坐标网格线(横向线本体留在这里，会跟着滚动——只有数值文字挪到
                    左边固定列，线本身没有"消失"的问题，不用拆) */}
                {chartGeometry.gridLines.map((g, i) => (
                  <line
                    key={i}
                    x1={0}
                    y1={g.y}
                    x2={chartGeometry.chartWidth - CHART_RIGHT}
                    y2={g.y}
                    stroke="url(#rateGridFade)"
                    strokeWidth={1}
                  />
                ))}

                <path d={chartGeometry.area} fill="url(#rateChartGradient)" opacity={0.15} />
                <path
                  d={chartGeometry.line}
                  fill="none"
                  stroke="var(--color-primary)"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {/* 横坐标日期标签 */}
                {chartGeometry.labelIdxs.map((idx) => (
                  <text
                    key={idx}
                    x={chartGeometry.points[idx].x}
                    y={CHART_BASE + 16}
                    fontSize={9}
                    fill="var(--color-outline)"
                    textAnchor="middle"
                  >
                    {monthDay(chartGeometry.points[idx].date)}
                  </text>
                ))}

                {/* 每个点的透明点击热区——点哪个就把选中标记移过去 */}
                {chartGeometry.points.map((p, idx) => (
                  <circle
                    key={idx}
                    cx={p.x}
                    cy={p.y}
                    r={10}
                    fill="transparent"
                    onClick={() => setSelectedIdx(idx)}
                    style={{ cursor: 'pointer' }}
                  />
                ))}

                {/* 选中点的高亮圆环+圆点 */}
                {activePoint && (
                  <>
                    <circle cx={activePoint.x} cy={activePoint.y} r={7} fill="none" stroke="var(--color-primary)" strokeWidth={2} opacity={0.35} />
                    <circle cx={activePoint.x} cy={activePoint.y} r={3.5} fill="var(--color-primary)" stroke="var(--color-surface)" strokeWidth={1.5} />
                  </>
                )}
              </svg>
              </div>
              </div>
            )}
          </div>

          {/* R-XH：底部统计条——照方案A设计稿是3列横排+2条分割线(週間最高値｜週間
              最安値｜央行利率)，不是"最高/最低堆叠成左半+利率占右半"这种2栏布局
              (我一开始看图看错了，用户拿设计稿逐像素纠正过)。三项各用一个主题色
              区分开(最高=primary印章红/最低=secondary草木绿/利率=tertiary琥珀)。
              第三列("央行利率"+"政策利率"标签，下面两行数据外面包一圈虚线边框
              卡片)比前两列宽，用grid-cols-[1fr_1fr_1.3fr]而不是等分3列，不然
              两行利率数据会被挤得很窄。
              historyStats.high/low为null(数据点不够)时这一整条不显示，不展示
              占位假数据 */}
          {historyStats && historyStats.high != null && historyStats.low != null && (
            <div className="grid grid-cols-[1fr_1fr_1.3fr] gap-2 pt-2 border-t border-dashed border-outline-variant/50">
              <div className="flex flex-col gap-0.5 pr-2 border-r border-dashed border-outline-variant/50">
                <span className="flex items-center gap-1 text-[10px] font-sans text-primary">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" aria-hidden="true" />
                  {t(statsPrefixKey)}{t('rateStatHighSuffix')}
                </span>
                <span className="text-body-lg font-serif font-semibold text-primary">{formatAxisValue(historyStats.high)}</span>
                <span className="text-[10px] font-sans text-on-surface-variant">
                  {t(statsPrefixKey)}{t('rateStatHighCaptionSuffix')}
                </span>
              </div>
              <div className="flex flex-col gap-0.5 pr-2 border-r border-dashed border-outline-variant/50">
                <span className="flex items-center gap-1 text-[10px] font-sans text-secondary">
                  <span className="w-1.5 h-1.5 rounded-full bg-secondary shrink-0" aria-hidden="true" />
                  {t(statsPrefixKey)}{t('rateStatLowSuffix')}
                </span>
                <span className="text-body-lg font-serif font-semibold text-secondary">{formatAxisValue(historyStats.low)}</span>
                <span className="text-[10px] font-sans text-on-surface-variant">
                  {t(statsPrefixKey)}{t('rateStatLowCaptionSuffix')}
                </span>
              </div>
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="flex items-center gap-1 text-[10px] font-sans text-tertiary">
                    <span className="w-1.5 h-1.5 rounded-full bg-tertiary shrink-0" aria-hidden="true" />
                    {t('rateStatRateLabel')}
                  </span>
                  <span className="px-1.5 py-0.5 rounded-full bg-tertiary/10 text-tertiary text-[9px] font-sans">
                    {t('rateStatRateTag')}
                  </span>
                </div>
                <div className="rounded-lg border border-dashed border-outline-variant/60 divide-y divide-dashed divide-outline-variant/60 overflow-hidden">
                  {[fromCode, toCode].map((code) => {
                    const entry = centralBankRates?.[code]
                    return (
                      <div key={code} className="flex items-center justify-between gap-2 px-2 py-1.5">
                        <span className="text-[11px] font-sans text-on-surface-variant shrink-0">{entry?.country ?? code}</span>
                        {entry == null ? (
                          <span className="text-body-md font-serif font-semibold text-tertiary">···</span>
                        ) : entry.rate == null ? (
                          <span className="text-[11px] italic font-sans text-on-surface-variant text-right">{t('rateStatNoRateTarget')}</span>
                        ) : (
                          <span className="text-body-md font-serif font-semibold text-tertiary">{entry.rate.toFixed(2)}%</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
