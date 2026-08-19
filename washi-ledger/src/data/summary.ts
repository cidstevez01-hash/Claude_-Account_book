import type { Category, Entry, EntryType, Lang, PaymentMethod, Tag } from '../types'
import { catLabel, payLabel, tagLabel } from '../lib/catalogLabel'
import { todayStr } from '../lib/date'

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

function summarize(entries: Entry[], inRange: (dateStr: string) => boolean): MonthSummary {
  let income = 0
  let expense = 0
  let points = 0
  for (const e of entries) {
    if (!inRange(e.date)) continue
    if (e.type === 'income') income += e.amount
    else expense += e.amount
    points += e.points ?? 0
  }
  return { balance: income - expense, income, expense, points }
}

export function summarizeMonth(entries: Entry[], ref: Date = new Date()): MonthSummary {
  return summarize(entries, (d) => isSameMonth(d, ref))
}

/** 按任意起止日期区间统计——仪表盘顶部换成真正的起止日期选择器(#8)后，仪表盘的
 * 结余/收支/环状图都要跟着这个区间走，不再固定按"当前日历月"算 */
export function summarizeRange(entries: Entry[], startDate: string, endDate: string): MonthSummary {
  return summarize(entries, (d) => d >= startDate && d <= endDate)
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
function breakdown(
  entries: Entry[],
  categories: Category[],
  type: EntryType,
  inRange: (dateStr: string) => boolean,
  lang: Lang
): CategoryShare[] {
  const totals = new Map<string, number>()
  let grandTotal = 0
  for (const e of entries) {
    if (e.type !== type || !inRange(e.date)) continue
    totals.set(e.catCode, (totals.get(e.catCode) ?? 0) + e.amount)
    grandTotal += e.amount
  }
  if (grandTotal === 0) return []
  return Array.from(totals.entries())
    .map(([catCode, amount]) => {
      const cat = categories.find((c) => c.code === catCode)
      return {
        catCode,
        label: cat ? catLabel(cat, lang) : catCode,
        color: cat?.color ?? '#85736d',
        amount,
        ratio: amount / grandTotal,
      }
    })
    .sort((a, b) => b.amount - a.amount)
}

export function categoryBreakdown(
  entries: Entry[],
  categories: Category[],
  type: EntryType,
  ref: Date = new Date(),
  lang: Lang = 'zh'
): CategoryShare[] {
  return breakdown(entries, categories, type, (d) => isSameMonth(d, ref), lang)
}

/** 按任意起止日期区间聚合分类占比——仪表盘换成起止日期区间选择器(#8)后的配套函数，
 * 用法/返回结构跟categoryBreakdown完全一样，只是区间判断换成起止日期而不是日历月 */
export function categoryBreakdownRange(
  entries: Entry[],
  categories: Category[],
  type: EntryType,
  startDate: string,
  endDate: string,
  lang: Lang = 'zh'
): CategoryShare[] {
  return breakdown(entries, categories, type, (d) => d >= startDate && d <= endDate, lang)
}

// 照旧App renderHomeDonut()的真实配色：标签维度不用分类各自的color，统一用这两个
// 强调色区分"匹配这个标签"/"其他"，不跟支出红(--seal)撞色
export const TAG_MATCHED_COLOR = '#e3b23c'
export const TAG_OTHER_COLOR = '#c2b8a3'

/** 环状图切到标签维度(#7)时用——按"是否匹配选中的这个标签"把entries分成两组，
 * 不是像分类维度那样按各自的catCode分好几组。照旧App renderHomeDonut()里
 * homeDonutTagFilter那条分支真实逻辑搬：key='__other__'代表"没打这个标签"的那组，
 * label/color都固定，不像分类维度那样每组各自不同 */
export function tagBreakdownRange(
  entries: Entry[],
  tag: Tag,
  type: EntryType,
  startDate: string,
  endDate: string,
  lang: Lang,
  otherLabel: string
): CategoryShare[] {
  const totals = new Map<string, number>()
  let grandTotal = 0
  for (const e of entries) {
    if (e.type !== type || e.date < startDate || e.date > endDate) continue
    const matched = e.tagCode === tag.code
    const key = matched ? tag.code : '__other__'
    totals.set(key, (totals.get(key) ?? 0) + e.amount)
    grandTotal += e.amount
  }
  if (grandTotal === 0) return []
  return Array.from(totals.entries())
    .map(([key, amount]) => ({
      catCode: key,
      label: key === '__other__' ? otherLabel : tagLabel(tag, lang),
      color: key === '__other__' ? TAG_OTHER_COLOR : TAG_MATCHED_COLOR,
      amount,
      ratio: amount / grandTotal,
    }))
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
  ref: Date = new Date(),
  lang: Lang = 'zh'
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
        label: pm ? payLabel(pm, lang) : payCode,
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
  /** 点这根柱子弹出的明细面板用的分类拆分——收支趋势图这个字段跟segments是同一份数据
   * (反正segments本来就是按分类堆叠的)；积分推移图的柱子视觉上是单色不堆叠，但点开
   * 还是要看这一天/这个月的积分是从哪些分类来的，所以单独算一份，跟segments不是同一份 */
  detailSegments: TrendSegment[]
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
  type: EntryType,
  lang: Lang
): TrendBucket[] {
  const buckets: TrendBucket[] = skeleton.map((s) => ({ ...s, segments: [], detailSegments: [], total: 0 }))
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
      seg.label = cat ? catLabel(cat, lang) : seg.key
      seg.color = cat?.color ?? CHART_PALETTE[idx % CHART_PALETTE.length]
    })
    b.detailSegments = b.segments
  }
  return buckets
}

export function dailyTrendBuckets(
  entries: Entry[],
  categories: Category[],
  type: EntryType,
  year: number,
  month: number,
  lang: Lang = 'zh'
): TrendBucket[] {
  const daysInMonth = new Date(year, month, 0).getDate()
  const skeleton = Array.from({ length: daysInMonth }, (_, i) => {
    const d = i + 1
    return { key: `${year}-${pad2(month)}-${pad2(d)}`, label: String(d) }
  })
  return buildTrendBuckets(skeleton, entries, categories, type, lang)
}

export function monthlyTrendBuckets(
  entries: Entry[],
  categories: Category[],
  type: EntryType,
  year: number,
  lang: Lang = 'zh'
): TrendBucket[] {
  const skeleton = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1
    return { key: `${year}-${pad2(m)}`, label: `${m}月` }
  })
  return buildTrendBuckets(skeleton, entries, categories, type, lang)
}

/** 积分推移柱状图数据——照旧App renderPointsTrendChart()的简化模型：柱子本身只有一根
 * jade色(积分不像收支那样按分类堆叠着画)，但点开某根柱子看到的明细面板还是要按分类拆分——
 * 照旧App getDailyBucketsForMonth()里pointsByCat的口径(key=e.catCode)，这是"这一天的积分
 * 是花在哪些分类上赚回来的"，跟PointsDonutCard那张按支付方式分的环状图是两个不同维度 */
function buildPointsTrendBuckets(
  skeleton: { key: string; label: string }[],
  entries: Entry[],
  categories: Category[],
  lang: Lang
): TrendBucket[] {
  const buckets: TrendBucket[] = skeleton.map((s) => ({ ...s, segments: [], detailSegments: [], total: 0 }))
  const byKey = new Map(buckets.map((b) => [b.key, b]))
  for (const e of entries) {
    if (e.type !== 'expense' || !e.points) continue
    const b = byKey.get(e.date.length === 7 ? e.date.slice(0, 7) : e.date)
    if (!b) continue
    b.total += e.points
    let seg = b.detailSegments.find((s) => s.key === e.catCode)
    if (!seg) {
      seg = { key: e.catCode, label: '', color: '', value: 0 }
      b.detailSegments.push(seg)
    }
    seg.value += e.points
  }
  for (const b of buckets) {
    if (b.total > 0) b.segments = [{ key: 'points', label: '积分', color: 'var(--color-secondary)', value: b.total }]
    b.detailSegments.sort((a, c) => c.value - a.value)
    b.detailSegments.forEach((seg, idx) => {
      const cat = categories.find((c) => c.code === seg.key)
      seg.label = cat ? catLabel(cat, lang) : seg.key
      seg.color = cat?.color ?? CHART_PALETTE[idx % CHART_PALETTE.length]
    })
  }
  return buckets
}

export function dailyPointsTrendBuckets(
  entries: Entry[],
  categories: Category[],
  year: number,
  month: number,
  lang: Lang = 'zh'
): TrendBucket[] {
  const daysInMonth = new Date(year, month, 0).getDate()
  const skeleton = Array.from({ length: daysInMonth }, (_, i) => {
    const d = i + 1
    return { key: `${year}-${pad2(month)}-${pad2(d)}`, label: String(d) }
  })
  return buildPointsTrendBuckets(skeleton, entries, categories, lang)
}

export function monthlyPointsTrendBuckets(
  entries: Entry[],
  categories: Category[],
  year: number,
  lang: Lang = 'zh'
): TrendBucket[] {
  const skeleton = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1
    return { key: `${year}-${pad2(m)}`, label: `${m}月` }
  })
  return buildPointsTrendBuckets(skeleton, entries, categories, lang)
}

export interface TrendLegendItem {
  key: string
  label: string
  color: string
  value: number
  ratio: number
}

/** 趋势图下方默认显示的聚合图例——把可见范围内所有柱子的分类段汇总，取金额前8名，
 * 照旧App renderTrendChart()里"legendKeys = ...slice(0,8)"的逻辑。ratio是对全部分类
 * 汇总(不只是前8名)算的占比，不是"前8名互相之间"的占比 */
export function aggregateTrendSegments(buckets: TrendBucket[], limit = 8): TrendLegendItem[] {
  const totals = new Map<string, { label: string; color: string; value: number }>()
  let grandTotal = 0
  for (const b of buckets) {
    for (const seg of b.segments) {
      const cur = totals.get(seg.key) ?? { label: seg.label, color: seg.color, value: 0 }
      cur.value += seg.value
      totals.set(seg.key, cur)
      grandTotal += seg.value
    }
  }
  if (grandTotal === 0) return []
  return Array.from(totals.entries())
    .sort((a, b) => b[1].value - a[1].value)
    .slice(0, limit)
    .map(([key, v]) => ({ key, label: v.label, color: v.color, value: v.value, ratio: v.value / grandTotal }))
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

/** 仪表盘"最近明细"用——照旧App`buildDayGroupedHtml()`真实排序逻辑：今天及之前(已经
 * 发生的)按日期倒序置顶；晚于今天的(比如提前生成的下个月房租/工资这种还没发生的)统一
 * 沉到最下面，内部按日期升序排(越快发生的排越靠前)，不跟已发生的混在一起纯按日期倒序。
 * 明细页(History)不用这个特殊排序，用上面的groupByDay纯降序即可 */
export function groupByDayPinned(entries: Entry[]): { date: string; entries: Entry[] }[] {
  const today = todayStr()
  const sorted = [...entries].sort((a, b) => {
    const aFuture = a.date > today
    const bFuture = b.date > today
    if (aFuture !== bFuture) return aFuture ? 1 : -1
    if (aFuture) return a.date.localeCompare(b.date) || a.createdAt - b.createdAt
    return b.date.localeCompare(a.date) || b.createdAt - a.createdAt
  })
  const map = new Map<string, Entry[]>()
  for (const e of sorted) {
    const list = map.get(e.date) ?? []
    list.push(e)
    map.set(e.date, list)
  }
  return Array.from(map.entries()).map(([date, list]) => ({ date, entries: list }))
}
