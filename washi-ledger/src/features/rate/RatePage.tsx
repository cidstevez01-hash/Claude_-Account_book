import { useEffect, useMemo, useState } from 'react'
import { AppLayout } from '../../design-system/components/AppLayout'
import { fetchRates, fetchRateHistory, CURRENCIES, type RateSnapshot, type RateHistoryPoint } from '../../data/rate'
import { useI18n } from '../../lib/i18n'

const TIMEFRAMES = [
  { key: '1W', days: 7, labelKey: 'rateTimeframe1W' },
  { key: '1M', days: 30, labelKey: 'rateTimeframe1M' },
  { key: '1Y', days: 365, labelKey: 'rateTimeframe1Y' },
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
const CHART_LEFT = 40
// 原来是8——横坐标日期文字是text-anchor="middle"，最后一个点紧贴右边缘时文字有一半会
// 超出viewBox被裁掉(这才是"08-28被截断"的真正成因，不只是之前非均匀拉伸的问题)，留够
// 边距让最后一个日期标签完整显示
const CHART_RIGHT = 20
const GRID_STEPS = 3
const MIN_LABEL_GAP_PX = 40
// B-38：横坐标点数多(比如1Y档365个点)时按点数撑宽图表本身的像素宽度，而不是把固定
// 320的viewBox用preserveAspectRatio="none"强行拉伸/压扁去塞进容器——那样宽高比不一致
// 会导致横坐标日期文字被非均匀缩放挤压、看起来截断。改成图表按真实需要的宽度渲染，
// 外层套滚动容器，点少时Math.max兜底到原来的320不至于比容器还窄显得空荡
const POINT_GAP = 24

/** 纵坐标数值精度——汇率数值量级差异很大(比如JPY→CNY在0.05附近，CNY→JPY在19附近)，
 * 固定小数位要么小汇率全显示0.0，要么大汇率一堆无意义的尾数，按量级动态选精度 */
function formatAxisValue(v: number) {
  if (v < 1) return v.toFixed(4)
  if (v < 10) return v.toFixed(3)
  return v.toFixed(2)
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
  const [snapshot, setSnapshot] = useState<RateSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [timeframe, setTimeframe] = useState<TimeframeKey>('1W')
  const [history, setHistory] = useState<RateHistoryPoint[]>([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const [historyError, setHistoryError] = useState('')
  // 折线图选中点(R-13)——照旧App selectedRatePointIdx同一套逻辑：默认高亮最新一个点
  // (null表示"还没选，用最后一个")，点任意点会把它移过去；每次历史数据换了(切换时间
  // 范围/切换货币对)都要清空回到"默认最新点"，不然可能残留一个超出新数组长度的下标
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null)

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
      const points = await fetchRateHistory(base, target, days)
      setHistory(points)
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

  // R-17：下拉刷新——当前货币对的实时汇率快照+走势图历史数据都重新拉一次，两者
  // 互不依赖并行拉；不重置selectedIdx/timeframe/货币对，用户已经选的东西不因为
  // 刷新一下就被打乱
  async function handleRefresh() {
    await Promise.all([refresh(fromCode), loadHistory(fromCode, toCode, timeframe)])
  }

  function handleSwap() {
    setFromCode(toCode)
    setToCode(fromCode)
  }

  const unitRate = snapshot && snapshot.base === fromCode ? snapshot.rates[toCode] : null
  const amountNum = parseFloat(amount)
  const converted = unitRate != null && !isNaN(amountNum) ? amountNum * unitRate : null

  const chartGeometry = useMemo(() => {
    if (history.length < 2) return null
    const values = history.map((p) => p.rate)
    const min = Math.min(...values)
    const max = Math.max(...values)
    const range = max - min || max * 0.02 || 1
    const chartWidth = Math.max(CHART_W, CHART_LEFT + CHART_RIGHT + (history.length - 1) * POINT_GAP)
    const stepX = (chartWidth - CHART_LEFT - CHART_RIGHT) / (history.length - 1)
    const points = history.map((p, i) => {
      const x = CHART_LEFT + i * stepX
      const y = CHART_BASE - ((p.rate - min) / range) * (CHART_BASE - CHART_TOP)
      return { x, y, date: p.date, rate: p.rate }
    })
    const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
    const area = `${line} L ${points[points.length - 1].x.toFixed(1)} ${CHART_BASE} L ${points[0].x.toFixed(1)} ${CHART_BASE} Z`

    // 纵坐标(R-13)——照旧App renderTrendChart()系列图表的网格线公式：GRID_STEPS+1条
    // 横向虚线，从min(底)到max(顶)等分，每条线配一个数值文字，不是只画折线不给刻度
    const gridLines = Array.from({ length: GRID_STEPS + 1 }, (_, s) => {
      const y = CHART_BASE - (s / GRID_STEPS) * (CHART_BASE - CHART_TOP)
      const value = min + (s / GRID_STEPS) * (max - min)
      return { y, value }
    })

    // 底部横坐标(R-13)——照旧App labelIdxs/filteredLabelIdxs同一套"先按间隔取样、
    // 再按最小像素间距过滤掉挤在一起的"逻辑，不是只显示头尾两个日期
    const showEvery = points.length > 8 ? Math.ceil(points.length / 6) : 1
    const rawLabelIdxs: number[] = []
    for (let i = 0; i < points.length; i += showEvery) rawLabelIdxs.push(i)
    if (rawLabelIdxs[rawLabelIdxs.length - 1] !== points.length - 1) rawLabelIdxs.push(points.length - 1)
    const labelIdxs = rawLabelIdxs.filter((idx, k) => {
      const nextIdx = rawLabelIdxs[k + 1]
      return nextIdx === undefined || points[nextIdx].x - points[idx].x >= MIN_LABEL_GAP_PX
    })

    return { points, line, area, gridLines, labelIdxs, chartWidth }
  }, [history])

  // 选中点(R-13)——没手动点过时默认最后一个点(最新数据)，跟旧App一致
  const activeIdx =
    chartGeometry == null
      ? null
      : selectedIdx != null && selectedIdx < chartGeometry.points.length
        ? selectedIdx
        : chartGeometry.points.length - 1
  const activePoint = chartGeometry && activeIdx != null ? chartGeometry.points[activeIdx] : null

  return (
    <AppLayout title={t('rateNavLabel')} leftButton="back" onRefresh={handleRefresh}>
      <div className="px-md pt-lg pb-xl flex flex-col gap-lg">
        {/* 换算卡片(The Ledger Card)——和纸胶带装饰角+虚线描边，照旧App结余卡片同一套材质语言 */}
        <div className="relative bg-surface-container-lowest border-[1.5px] border-dashed border-outline-variant rounded-xl p-md shadow-[0_2px_0_rgba(0,0,0,0.02)]">
          {/* B-33：同BalanceCard.tsx——换成真实斜纹纹理，尺寸放大，位置/角度不动 */}
          <div
            className="absolute -top-1.5 -right-2 w-14 h-4 rounded-sm washi-tape-texture"
            style={{ transform: 'rotate(4deg)' }}
          />

          <div className="flex flex-col gap-md relative">
            <div className="flex flex-col gap-1 pb-4 border-b border-dashed border-outline-variant/50">
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
              <input
                type="number"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
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
              <div className="w-full px-0 py-1 font-serif text-[42px] leading-[48px] font-bold text-on-surface text-right opacity-80">
                {converted != null ? converted.toFixed(2) : '--'}
              </div>
            </div>
          </div>

          <div className="mt-6 text-center text-label-caps font-sans text-outline bg-surface-variant/30 py-2 rounded border border-dashed border-outline-variant/50">
            {loading
              ? t('rateLoading')
              : unitRate != null
                ? `1 ${fromCode} = ${unitRate.toFixed(4)} ${toCode}`
                : t('rateNeverFetched')}
          </div>
          {error && <p className="mt-2 text-body-md text-primary break-all">{error}</p>}
        </div>

        {/* 走势图(R-13：时间范围去掉1D、剩下三档用翻译文案；加纵坐标网格线+更密的
            横坐标日期标签+点击折线查看选中点数值，逻辑照旧App renderRateTrendChart()搬) */}
        <div className="flex flex-col gap-md bg-surface-container-lowest border-[1.5px] border-dashed border-outline-variant rounded-xl p-md shadow-[0_2px_0_rgba(0,0,0,0.02)]">
          <div className="flex items-center justify-between flex-wrap gap-xs">
            <h3 className="text-label-caps font-sans text-on-surface-variant">
              {fromCode}/{toCode} {t('rateTrendLabel')}
            </h3>
            <div className="flex gap-xs">
              {TIMEFRAMES.map((tf) => (
                <button
                  key={tf.key}
                  type="button"
                  onClick={() => setTimeframe(tf.key)}
                  className={`px-3 py-1.5 rounded text-label-caps whitespace-nowrap transition-colors ${
                    timeframe === tf.key
                      ? 'bg-primary text-on-primary shadow-sm'
                      : 'bg-surface-variant/50 text-on-surface-variant'
                  }`}
                >
                  {t(tf.labelKey)}
                </button>
              ))}
            </div>
          </div>

          {/* 选中点数值——照旧App rateTrendPointInfo，默认显示最新点，点折线上任意点会跳过来 */}
          {chartGeometry && activePoint && (
            <div className="text-center text-label-caps font-sans text-on-surface-variant">
              {activePoint.date} · {formatAxisValue(activePoint.rate)} {toCode}
            </div>
          )}

          <div className="relative h-52 w-full mt-1">
            {historyLoading ? (
              <p className="w-full h-full flex items-center justify-center text-body-md text-on-surface-variant">{t('rateLoading')}</p>
            ) : historyError ? (
              <p className="w-full h-full flex items-center justify-center text-body-md text-primary text-center break-all px-2">
                {historyError}
              </p>
            ) : !chartGeometry ? (
              <p className="w-full h-full flex items-center justify-center text-body-md text-on-surface-variant">{t('rateNoHistory')}</p>
            ) : (
              <div className="w-full h-full overflow-x-auto overflow-y-hidden">
              <svg width={chartGeometry.chartWidth} height={CHART_H} viewBox={`0 0 ${chartGeometry.chartWidth} ${CHART_H}`} style={{ display: 'block' }}>
                <defs>
                  <linearGradient id="rateChartGradient" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-primary)" />
                    <stop offset="100%" stopColor="transparent" />
                  </linearGradient>
                </defs>

                {/* 纵坐标网格线+数值 */}
                {chartGeometry.gridLines.map((g, i) => (
                  <g key={i}>
                    <line
                      x1={CHART_LEFT}
                      y1={g.y}
                      x2={chartGeometry.chartWidth - CHART_RIGHT}
                      y2={g.y}
                      stroke="var(--color-outline-variant)"
                      strokeWidth={1}
                      strokeDasharray="2,3"
                    />
                    <text x={CHART_LEFT - 6} y={g.y + 3} fontSize={9} fill="var(--color-outline)" textAnchor="end">
                      {formatAxisValue(g.value)}
                    </text>
                  </g>
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
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
