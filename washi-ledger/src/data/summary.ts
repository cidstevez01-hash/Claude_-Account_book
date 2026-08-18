import type { Category, Entry, EntryType, PaymentMethod } from '../types'

/** 图表配色兜底盘——照抄旧仓库index.html的CHART_PALETTE，分类有自己的color字段用不到这个，
 * 支付方式没有color字段，只有badge.bg(不是所有支付方式都设了badge)，没有badge时按顺序
 * 从这个调色盘里取色，跟旧App保持一致的视觉映射 */
const CHART_PALETTE = ['#d1665a', '#7a9b6e', '#b58838', '#5b7a99', '#7a5c3e', '#8a5b7a', '#4a6b8a', '#c96b5f', '#a99c86']

export function isSameMonth(dateStr: string, ref: Date): boolean {
  const d = new Date(dateStr)
  return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth()
}

export interface MonthSummary {
  balance: number
  income: number
  expense: number
  points: number
}

export function summarizeMonth(entries: Entry[], ref: Date = new Date()): MonthSummary {
  let income = 0
  let expense = 0
  let points = 0
  for (const e of entries) {
    if (!isSameMonth(e.date, ref)) continue
    if (e.type === 'income') income += e.amount
    else expense += e.amount
    points += e.points ?? 0
  }
  return { balance: income - expense, income, expense, points }
}

export interface CategoryShare {
  catCode: string
  label: string
  color: string
  amount: number
  ratio: number // 0~1
}

/** 仪表盘分类环状图用——按分类聚合某个类型(收入/支出)在给定月份内的金额占比，
 * 照design-assets-v2/_44这屏的"Expenses/Income tabs + donut + legend"实现 */
export function categoryBreakdown(
  entries: Entry[],
  categories: Category[],
  type: EntryType,
  ref: Date = new Date()
): CategoryShare[] {
  const totals = new Map<string, number>()
  let grandTotal = 0
  for (const e of entries) {
    if (e.type !== type || !isSameMonth(e.date, ref)) continue
    totals.set(e.catCode, (totals.get(e.catCode) ?? 0) + e.amount)
    grandTotal += e.amount
  }
  if (grandTotal === 0) return []
  return Array.from(totals.entries())
    .map(([catCode, amount]) => {
      const cat = categories.find((c) => c.code === catCode)
      return {
        catCode,
        label: cat?.zh ?? catCode,
        color: cat?.color ?? '#85736d',
        amount,
        ratio: amount / grandTotal,
      }
    })
    .sort((a, b) => b.amount - a.amount)
}

export interface PaymentPointsShare {
  payCode: string
  label: string
  color: string
  points: number
  ratio: number // 0~1
}

/** 积分内訳(按支付方式)——逻辑照抄旧仓库index.html的renderPointsDonut()：只统计支出记录
 * 里有积分的(积分是花钱后的返还，只可能来自支出)，按支付方式分组求和，没填支付方式的
 * 记录归到'cash'。颜色跟旧App一致：优先用支付方式自己的badge.bg，没有就按顺序从
 * CHART_PALETTE兜底取色，方便同一个支付方式在不同图表里颜色能对上号。
 *
 * 跟旧App的差异：旧App用的是页面级"累计残高"自定义日期区间(cumRangeStart/End)，
 * 这里先简化成传入的单个月份，累计区间选择器留到以后再做(跟仪表盘DateRangeBar的
 * 完整范围选择器是同一类型的deferred scope) */
export function pointsBreakdownByPaymentMethod(
  entries: Entry[],
  paymentMethods: PaymentMethod[],
  ref: Date = new Date()
): PaymentPointsShare[] {
  const totals = new Map<string, number>()
  let grandTotal = 0
  for (const e of entries) {
    if (e.type !== 'expense' || !e.points || !isSameMonth(e.date, ref)) continue
    const key = e.paymentMethod || 'cash'
    totals.set(key, (totals.get(key) ?? 0) + e.points)
    grandTotal += e.points
  }
  if (grandTotal === 0) return []
  return Array.from(totals.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([payCode, points], idx) => {
      const pm = paymentMethods.find((p) => p.code === payCode)
      return {
        payCode,
        label: pm?.zh ?? payCode,
        color: pm?.badge?.bg || CHART_PALETTE[idx % CHART_PALETTE.length],
        points,
        ratio: points / grandTotal,
      }
    })
}

export interface TrendSegment {
  key: string
  label: string
  color: string
  value: number
}

export interface TrendBucket {
  key: string
  label: string
  segments: TrendSegment[]
  total: number
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/** 按分类堆叠的收支趋势柱状图数据——逻辑照抄旧仓库index.html的getDailyBucketsForMonth/
 * getMonthlyBucketsForYear(只取其中一种type，不是day/month两张map都算)：每个桶(一天或
 * 一个月)按分类聚合金额，桶内按金额降序排列分类段，颜色用分类自己的color，没有就按
 * 排序位置从CHART_PALETTE兜底取色 */
function buildTrendBuckets(
  skeleton: { key: string; label: string }[],
  entries: Entry[],
  categories: Category[],
  type: EntryType
): TrendBucket[] {
  const buckets: TrendBucket[] = skeleton.map((s) => ({ ...s, segments: [], total: 0 }))
  const byKey = new Map(buckets.map((b) => [b.key, b]))
  for (const e of entries) {
    if (e.type !== type) continue
    const b = byKey.get(e.date.length === 7 ? e.date.slice(0, 7) : e.date)
    if (!b) continue
    let seg = b.segments.find((s) => s.key === e.catCode)
    if (!seg) {
      seg = { key: e.catCode, label: '', color: '', value: 0 }
      b.segments.push(seg)
    }
    seg.value += e.amount
    b.total += e.amount
  }
  for (const b of buckets) {
    b.segments.sort((a, c) => c.value - a.value)
    b.segments.forEach((seg, idx) => {
      const cat = categories.find((c) => c.code === seg.key)
      seg.label = cat?.zh ?? seg.key
      seg.color = cat?.color ?? CHART_PALETTE[idx % CHART_PALETTE.length]
    })
  }
  return buckets
}

export function dailyTrendBuckets(entries: Entry[], categories: Category[], type: EntryType, year: number, month: number): TrendBucket[] {
  const daysInMonth = new Date(year, month, 0).getDate()
  const skeleton = Array.from({ length: daysInMonth }, (_, i) => {
    const d = i + 1
    return { key: `${year}-${pad2(month)}-${pad2(d)}`, label: String(d) }
  })
  return buildTrendBuckets(skeleton, entries, categories, type)
}

export function monthlyTrendBuckets(entries: Entry[], categories: Category[], type: EntryType, year: number): TrendBucket[] {
  const skeleton = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1
    return { key: `${year}-${pad2(m)}`, label: `${m}月` }
  })
  return buildTrendBuckets(skeleton, entries, categories, type)
}

/** 积分推移柱状图数据——照旧App renderPointsTrendChart()的简化模型：只有一根jade色的柱子，
 * 不用像收支那样按分类堆叠(积分不挂分类，挂支付方式，但推移图只看每日/每月总额，不用
 * 再细分支付方式——支付方式内訳已经在PointsDonutCard那张环状图里看过了) */
function buildPointsTrendBuckets(skeleton: { key: string; label: string }[], entries: Entry[]): TrendBucket[] {
  const buckets: TrendBucket[] = skeleton.map((s) => ({ ...s, segments: [], total: 0 }))
  const byKey = new Map(buckets.map((b) => [b.key, b]))
  for (const e of entries) {
    if (e.type !== 'expense' || !e.points) continue
    const b = byKey.get(e.date.length === 7 ? e.date.slice(0, 7) : e.date)
    if (!b) continue
    b.total += e.points
  }
  for (const b of buckets) {
    if (b.total > 0) b.segments = [{ key: 'points', label: '积分', color: 'var(--color-secondary)', value: b.total }]
  }
  return buckets
}

export function dailyPointsTrendBuckets(entries: Entry[], year: number, month: number): TrendBucket[] {
  const daysInMonth = new Date(year, month, 0).getDate()
  const skeleton = Array.from({ length: daysInMonth }, (_, i) => {
    const d = i + 1
    return { key: `${year}-${pad2(month)}-${pad2(d)}`, label: String(d) }
  })
  return buildPointsTrendBuckets(skeleton, entries)
}

export function monthlyPointsTrendBuckets(entries: Entry[], year: number): TrendBucket[] {
  const skeleton = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1
    return { key: `${year}-${pad2(m)}`, label: `${m}月` }
  })
  return buildPointsTrendBuckets(skeleton, entries)
}

export function groupByDay(entries: Entry[]): { date: string; entries: Entry[] }[] {
  const map = new Map<string, Entry[]>()
  for (const e of entries) {
    const list = map.get(e.date) ?? []
    list.push(e)
    map.set(e.date, list)
  }
  return Array.from(map.entries())
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([date, list]) => ({ date, entries: list }))
}
