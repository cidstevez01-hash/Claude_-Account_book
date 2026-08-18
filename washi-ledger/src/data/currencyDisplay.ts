import type { RateSnapshot } from './rate'
import type { Entry } from '../types'

/** 记账金额按settings.currency换算显示——照旧仓库index.html的toBase()/convForDisplay()/
 * fmtCur()真实逻辑搬，但简化了一处：旧App只支持CNY↔JPY两个方向、靠dateRateCache按
 * 记账当天的历史汇率换算；这个新App的汇率换算已经升级成11种货币(见RatePage.tsx)，
 * 历史每日汇率这套(旧App4源兜底+30天/12个月/8年走势图)RatePage.tsx那次就没做——这里
 * 保持同一个已知简化，改用"取一次settings.currency为base的最新汇率快照，统一用来换算
 * 全部条目"，不区分记账当天汇率，跟RatePage.tsx当前的简化程度对齐。
 *
 * 没有可用汇率快照时的降级行为照旧App一致：如实显示原始金额+原始币种，不假装换算成
 * 本位货币("换算所需的汇率还没取到时，先如实显示原始数据，避免把原始数据误标成本位货币") */

const SYMBOLS: Record<string, string> = {
  JPY: 'JP¥',
  CNY: 'CN¥',
  USD: '$',
  EUR: '€',
  GBP: '£',
  HKD: 'HK$',
  KRW: '₩',
  AUD: 'A$',
  CAD: 'C$',
  SGD: 'S$',
  THB: '฿',
}

/** 无小数位的货币——照旧App`decimals = cur==='JPY' ? 0 : 2`的规则，同理扩展给KRW
 * (日元/韩元现实中都不用小数位记账) */
const ZERO_DECIMAL_CURRENCIES = new Set(['JPY', 'KRW'])

export function symbolFor(code: string): string {
  return SYMBOLS[code] ?? `${code} `
}

export function formatCurrency(amount: number, code: string): string {
  const decimals = ZERO_DECIMAL_CURRENCIES.has(code) ? 0 : 2
  const numStr = Number(amount).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
  return symbolFor(code) + numStr
}

/** rates的base必须等于toCur才能换算(见useDisplayRates.ts的取数方式：固定拉
 * settings.currency为base的快照)，fromCur===toCur或汇率缺失时原样返回 */
export function convertAmount(amount: number, fromCur: string, toCur: string, rates: RateSnapshot | null): number {
  if (fromCur === toCur) return amount
  if (!rates || rates.base !== toCur) return amount
  const rate = rates.rates[fromCur]
  if (!rate) return amount
  return amount / rate
}

/** 单条记录展示用：币种和当前设置一致就原样显示，不一致且汇率可用才换算，
 * 换算不了就如实显示原始金额+原始币种(照旧App convForDisplay()逻辑) */
export function convertForDisplay(
  amount: number,
  currency: string,
  targetCurrency: string,
  rates: RateSnapshot | null
): { amount: number; cur: string } {
  if (currency === targetCurrency) return { amount, cur: currency }
  if (!rates || rates.base !== targetCurrency || !rates.rates[currency]) return { amount, cur: currency }
  return { amount: convertAmount(amount, currency, targetCurrency, rates), cur: targetCurrency }
}

/** 把整批entries换算成同一个目标币种再返回一份新数组——仪表盘/明细/统计页的月度汇总、
 * 分类占比、趋势柱状图全部是"先对每条记录做换算、再累加求和"(照旧App里dayTotal用
 * `reduce(...+ toBase(e.amount,...))`这个真实模式)，不是"先按原币种加总、最后再统一
 * 换算一次"(那样多币种混记账时汇总结果会是错的)。在这一层统一转换好，summary.ts里
 * summarizeMonth/categoryBreakdown/趋势图这些聚合函数完全不用改，直接吃转换后的
 * entries就自动正确，EntryCard等展示组件也只需要读entry.amount/entry.currency，
 * 不用再各自调用convertForDisplay */
export function toDisplayEntries(entries: Entry[], targetCurrency: string, rates: RateSnapshot | null): Entry[] {
  return entries.map((e) => {
    if (e.currency === targetCurrency) return e
    const converted = convertForDisplay(e.amount, e.currency, targetCurrency, rates)
    if (converted.cur === e.currency) return e // 换算不了，原样返回(不新建对象，减少无谓渲染)
    return { ...e, amount: converted.amount, currency: converted.cur }
  })
}
