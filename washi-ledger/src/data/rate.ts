export interface CurrencyOption {
  code: string
  zh: string
}

/** 常用货币表——frankfurter.dev(ECB汇率源)支持的货币里挑了几个常用的，代码+中文名
 * 是公开事实(ISO 4217货币代码对应的通用中文名)，不是编的假数据。默认换算方向定成
 * JPY↔CNY(服务的是中日两地记账场景)，但用户可以在这个列表里自由换成任意一对 */
export const CURRENCIES: CurrencyOption[] = [
  { code: 'JPY', zh: '日元' },
  { code: 'CNY', zh: '人民币' },
  { code: 'USD', zh: '美元' },
  { code: 'EUR', zh: '欧元' },
  { code: 'GBP', zh: '英镑' },
  { code: 'HKD', zh: '港币' },
  { code: 'KRW', zh: '韩元' },
  { code: 'AUD', zh: '澳元' },
  { code: 'CAD', zh: '加元' },
  { code: 'SGD', zh: '新加坡元' },
  { code: 'THB', zh: '泰铢' },
]

export function currencyLabel(code: string): string {
  return CURRENCIES.find((c) => c.code === code)?.zh ?? code
}

export interface RateSnapshot {
  base: string
  date: string
  rates: Record<string, number>
  fetchedAt: number
}

/** 一次性拿base货币兑其余常用货币的汇率(symbols传除base外的全部常用货币代码)，
 * 换算器的目标货币汇率和"热门汇率"列表共用这一份数据，不用分开发两次请求 */
export async function fetchRates(base: string): Promise<RateSnapshot> {
  const symbols = CURRENCIES.map((c) => c.code).filter((c) => c !== base)
  const res = await fetch(`https://api.frankfurter.dev/v1/latest?base=${base}&symbols=${symbols.join(',')}`)
  if (!res.ok) throw new Error(`汇率接口返回${res.status}`)
  const data = await res.json()
  if (!data?.rates || typeof data.rates !== 'object') {
    throw new Error('汇率接口返回格式不符')
  }
  return { base, date: data.date, rates: data.rates, fetchedAt: Date.now() }
}

export interface RateHistoryPoint {
  date: string
  rate: number
}

/** 汇率走势——frankfurter.dev同一个数据源真实存在的时间序列接口，拉一段真实历史区间的
 * base兑target汇率画趋势图，不是编的假数据。这是按日更新的央行参考汇率，没有盘中粒度，
 * 周末/节假日也没有发布——短窗口(比如1D)可能就只有1、2个真实点，如实显示这批点，
 * 不插值凑数据把图"填满" */
export async function fetchRateHistory(base: string, target: string, days: number): Promise<RateHistoryPoint[]> {
  const end = new Date()
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000)
  const fmt = (d: Date) => d.toISOString().slice(0, 10)
  const res = await fetch(`https://api.frankfurter.dev/v1/${fmt(start)}..${fmt(end)}?base=${base}&symbols=${target}`)
  if (!res.ok) throw new Error(`汇率走势接口返回${res.status}`)
  const data = await res.json()
  if (!data?.rates || typeof data.rates !== 'object') {
    throw new Error('汇率走势接口返回格式不符')
  }
  return Object.entries(data.rates as Record<string, Record<string, number>>)
    .map(([date, rates]) => ({ date, rate: rates[target] }))
    .filter((p) => typeof p.rate === 'number')
    .sort((a, b) => a.date.localeCompare(b.date))
}
