import type { Context } from 'hono'
import type { Bindings } from '../_shared/supabaseClient'
import { HttpError } from '../_shared/errors'
import type { RateHistoryPoint, RateHistoryStatsResponse, CentralBankRatesResponse } from './types'
import { CENTRAL_BANK_RATES_SEED, parseCentralBankRatesHtml, mergeCentralBankRates, fetchBojCallRate } from './centralBankRates'

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

const CENTRAL_BANK_RATES_SOURCE = 'https://unirateapi.com/central-bank-rates'
// R-XX：央行法定利率——"定时拉取，不用很频繁"，用Cache API缓存14天，缓存过期后
// 才会真的重新抓一次源站，不是每次请求都打unirateapi.com。这个数据本身变化很慢
// (央行一年就调几次)，14天的缓存粒度跟数据本身的更新频率是匹配的，不是随便定的数字
const CENTRAL_BANK_CACHE_TTL_SECONDS = 60 * 60 * 24 * 14

/** GET /rate/central-bank-rates——R-XX走势图重设计里"週間最高値/週間最安値/利率"
 * 三项底部统计的第三项，从"波动区间"换成两国央行法定利率。这类数据大多没有免费
 * 实时API(见centralBankRates.ts顶部注释)，源站是个季度更新的静态页面，所以这里
 * 对unirateapi.com的"抓取"只是尽力而为地去核对是否有更新——抓取失败、解析不出、
 * 或者抓到的数据比静态兜底表(CENTRAL_BANK_RATES_SEED，2026-09-17手动核实)还旧，
 * 都直接用静态表，不会因为抓取失败就报错或者显示更旧的数据。这个接口不碰
 * Supabase/不需要用户身份，跟/rate/history-stats一样是公开数据。
 *
 * JPY是例外——日本银行有官方免key的时系列API(见fetchBojCallRate())，比unirateapi
 * 这条通用抓取路径更可靠，所以在unirateapi的结果基础上再单独用日银官方数据覆盖
 * JPY这一项(同样是"更新的数据才覆盖"的口径，日银API请求失败不影响其余10个货币) */
export async function getCentralBankRates(c: Context<{ Bindings: Bindings }>) {
  const cache = caches.default
  const cacheKey = new Request(new URL('/rate/central-bank-rates-cache-v2', c.req.url).toString())
  const cached = await cache.match(cacheKey)
  if (cached) return cached

  let merged = CENTRAL_BANK_RATES_SEED
  try {
    const upstreamRes = await fetch(CENTRAL_BANK_RATES_SOURCE)
    if (upstreamRes.ok) {
      const html = await upstreamRes.text()
      const scraped = parseCentralBankRatesHtml(html)
      merged = mergeCentralBankRates(scraped)
    }
  } catch (e) {
    console.error('央行利率源站抓取失败，使用静态兜底表', e)
  }

  try {
    const boj = await fetchBojCallRate()
    const current = merged.JPY
    if (boj && (!current?.asOf || boj.asOf > current.asOf)) {
      merged = { ...merged, JPY: { country: current.country, bank: current.bank, rate: boj.rate, asOf: boj.asOf } }
    }
  } catch (e) {
    console.error('日银官方API拉取失败，沿用现有JPY数值', e)
  }

  const body: CentralBankRatesResponse = { rates: merged }
  const response = c.json(body)
  response.headers.set('Cache-Control', `public, max-age=${CENTRAL_BANK_CACHE_TTL_SECONDS}`)
  c.executionCtx.waitUntil(cache.put(cacheKey, response.clone()))
  return response
}
