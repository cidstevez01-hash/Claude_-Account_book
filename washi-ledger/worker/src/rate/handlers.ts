import type { Context } from 'hono'
import type { Bindings } from '../_shared/supabaseClient'
import { HttpError } from '../_shared/errors'
import type { RateHistoryPoint, RateHistoryStatsResponse } from './types'

const CURRENCY_CODE_RE = /^[A-Z]{3}$/

/** GET /rate/history-stats?base=JPY&target=CNY&days=9——R-XX汇率走势图重设计的
 * 一部分：涨跌幅/区间最高/区间最低/波动区间这几项衍生数据改成后端算好一起吐给
 * 前端，不让前端各自实现一遍口径(担心以后多端各算各的对不上)。这个接口不碰
 * Supabase/不需要用户身份——汇率数据本来就不是用户私有数据，只是把原来前端
 * 直连frankfurter.dev的这次请求挪到服务端来做，数据源和查询区间的计算方式
 * 跟之前src/data/rate.ts的fetchRateHistory完全一致，只是多算了几个统计值。
 *
 * 统计口径(都是"当前请求的这个时间区间内"，不是固定按自然周算)：
 * - pctChange：区间内最新点相对最早点的涨跌百分比
 * - high/low：区间内的最大值/最小值
 * - volatilityPct：(high-low)/low的百分比，衡量区间内波动幅度
 * points长度<2时(比如刚查到1个点或0个点)，这几项统计没有意义，返回null，
 * 前端要处理这个态，不能假设总有值 */
export async function getHistoryStats(c: Context<{ Bindings: Bindings }>) {
  const base = c.req.query('base')
  const target = c.req.query('target')
  const daysRaw = c.req.query('days')
  const days = daysRaw ? Number(daysRaw) : NaN

  if (!base || !target || !CURRENCY_CODE_RE.test(base) || !CURRENCY_CODE_RE.test(target)) {
    throw new HttpError(400, 'base/target需要是3位大写货币代码')
  }
  if (!Number.isFinite(days) || days <= 0 || days > 3650) {
    throw new HttpError(400, 'days需要是1-3650之间的正整数')
  }

  const end = new Date()
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000)
  const fmt = (d: Date) => d.toISOString().slice(0, 10)

  const upstreamRes = await fetch(
    `https://api.frankfurter.dev/v1/${fmt(start)}..${fmt(end)}?base=${base}&symbols=${target}`
  )
  if (!upstreamRes.ok) throw new HttpError(502, `汇率数据源返回${upstreamRes.status}`)
  const upstreamData = await upstreamRes.json<{ rates?: Record<string, Record<string, number>> }>()
  if (!upstreamData?.rates || typeof upstreamData.rates !== 'object') {
    throw new HttpError(502, '汇率数据源返回格式不符')
  }

  const points: RateHistoryPoint[] = Object.entries(upstreamData.rates)
    .map(([date, rates]) => ({ date, rate: rates[target] }))
    .filter((p): p is RateHistoryPoint => typeof p.rate === 'number')
    .sort((a, b) => a.date.localeCompare(b.date))

  let pctChange: number | null = null
  let high: number | null = null
  let low: number | null = null
  let volatilityPct: number | null = null

  if (points.length >= 1) {
    const rates = points.map((p) => p.rate)
    high = Math.max(...rates)
    low = Math.min(...rates)
    const first = points[0].rate
    const last = points[points.length - 1].rate
    pctChange = first !== 0 ? ((last - first) / first) * 100 : 0
    volatilityPct = low !== 0 ? ((high - low) / low) * 100 : 0
  }

  const body: RateHistoryStatsResponse = { base, target, points, pctChange, high, low, volatilityPct }
  return c.json(body)
}
