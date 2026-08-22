import { useEffect, useMemo, useState } from 'react'
import { AppLayout } from '../../design-system/components/AppLayout'
import { fetchRates, fetchRateHistory, CURRENCIES, type RateSnapshot, type RateHistoryPoint } from '../../data/rate'
import { useI18n } from '../../lib/i18n'

const TIMEFRAMES = [
  { key: '1D', days: 2 },
  { key: '1W', days: 7 },
  { key: '1M', days: 30 },
  { key: '1Y', days: 365 },
] as const
type TimeframeKey = (typeof TIMEFRAMES)[number]['key']

function monthDay(dateStr: string) {
  const [, m, d] = dateStr.split('-')
  return `${m}-${d}`
}

/** 汇率换算——照design-assets/prototypes/.../ad647758a5e5485e84e33107fb3fac3c
 * ("汇率换算 全新重构版")这份最新Stitch设计稿重做：从"多货币搜索+热门汇率列表"换成
 * "单一货币对换算卡片(和纸胶带装饰+图章式互换按钮+实时汇率胶囊) + 走势图"这个新布局，
 * 旧的多货币列表/搜索框不再是这版设计的一部分，故未保留——如果以后还需要那个能力，
 * 应该作为独立需求另外提。
 *
 * 走势图数据源用frankfurter.dev同一个API真实存在的时间序列接口(fetchRateHistory)，
 * 不是编的假折线；这是按日更新的央行参考汇率，没有盘中粒度，周末/节假日也没有发布，
 * 短窗口(1D)真实点可能很少甚至只有1个，如实显示，不插值凑数据。 */
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

  useEffect(() => {
    const days = TIMEFRAMES.find((tf) => tf.key === timeframe)!.days
    setHistoryLoading(true)
    setHistoryError('')
    fetchRateHistory(fromCode, toCode, days)
      .then(setHistory)
      .catch((e) => setHistoryError(e instanceof Error ? e.message : String(e)))
      .finally(() => setHistoryLoading(false))
  }, [fromCode, toCode, timeframe])

  function handleSwap() {
    setFromCode(toCode)
    setToCode(fromCode)
  }

  const unitRate = snapshot && snapshot.base === fromCode ? snapshot.rates[toCode] : null
  const amountNum = parseFloat(amount)
  const converted = unitRate != null && !isNaN(amountNum) ? amountNum * unitRate : null

  const chartPath = useMemo(() => {
    if (history.length < 2) return null
    const values = history.map((p) => p.rate)
    const min = Math.min(...values)
    const max = Math.max(...values)
    const range = max - min || 1
    const points = history.map((p, i) => {
      const x = (i / (history.length - 1)) * 100
      const y = 38 - ((p.rate - min) / range) * 34
      return { x, y }
    })
    const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ')
    const area = `${line} L 100 40 L 0 40 Z`
    return { line, area }
  }, [history])

  return (
    <AppLayout title={t('rateNavLabel')}>
      <div className="px-md pt-lg pb-xl flex flex-col gap-lg">
        {/* 换算卡片(The Ledger Card)——和纸胶带装饰角+虚线描边，照旧App结余卡片同一套材质语言 */}
        <div className="relative bg-surface-container-lowest border-[1.5px] border-dashed border-outline-variant rounded-xl p-md shadow-[0_2px_0_rgba(0,0,0,0.02)]">
          <div
            className="absolute -top-1.5 -right-2 w-10 h-3 rounded-sm opacity-70"
            style={{ background: 'var(--color-tertiary-fixed-dim)', transform: 'rotate(4deg)' }}
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

        {/* 走势图 */}
        <div className="flex flex-col gap-md bg-surface-container-lowest border-[1.5px] border-dashed border-outline-variant rounded-xl p-md shadow-[0_2px_0_rgba(0,0,0,0.02)]">
          <div className="flex items-center justify-between">
            <h3 className="text-label-caps font-sans text-on-surface-variant">
              {fromCode}/{toCode} {t('rateTrendLabel')}
            </h3>
            <div className="flex gap-xs">
              {TIMEFRAMES.map((tf) => (
                <button
                  key={tf.key}
                  type="button"
                  onClick={() => setTimeframe(tf.key)}
                  className={`px-3 py-1.5 rounded text-label-caps transition-colors ${
                    timeframe === tf.key
                      ? 'bg-primary text-on-primary shadow-sm'
                      : 'bg-surface-variant/50 text-on-surface-variant'
                  }`}
                >
                  {tf.key}
                </button>
              ))}
            </div>
          </div>

          <div className="relative h-48 w-full flex items-end gap-1 px-1 mt-2">
            {historyLoading ? (
              <p className="w-full text-center text-body-md text-on-surface-variant self-center">{t('rateLoading')}</p>
            ) : historyError ? (
              <p className="w-full text-center text-body-md text-primary self-center break-all">{historyError}</p>
            ) : !chartPath ? (
              <p className="w-full text-center text-body-md text-on-surface-variant self-center">{t('rateNoHistory')}</p>
            ) : (
              <>
                <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 40">
                  <defs>
                    <linearGradient id="rateChartGradient" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-primary)" />
                      <stop offset="100%" stopColor="transparent" />
                    </linearGradient>
                  </defs>
                  <path d={chartPath.area} fill="url(#rateChartGradient)" opacity={0.15} />
                  <path
                    d={chartPath.line}
                    fill="none"
                    stroke="var(--color-primary)"
                    strokeWidth={2.5}
                    strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                  />
                </svg>
                <div className="absolute bottom-0 left-0 w-full flex justify-between pt-2 border-t border-dashed border-outline-variant/50">
                  <span className="text-[10px] text-outline font-sans">{monthDay(history[0].date)}</span>
                  <span className="text-[10px] text-outline font-sans">{monthDay(history[history.length - 1].date)}</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
