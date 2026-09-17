import { apiClient } from '../lib/apiClient'

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

/** B-XX：换算卡片"当前汇率"改成主用exchangerate.fun(https://github.com/haxqer/FreeExchangeRateApi)——
 * 每小时更新，比frankfurter.dev(ECB官方参考汇率，一天只发布一次)更接近实时。这是个人
 * 维护的第三方免费服务，没有官方SLA，用户已知晓这层风险、明确要求接入；为了不因为这个
 * 服务不稳定就让换算功能整个不可用，请求失败时自动降级回退到frankfurter.dev(见下面
 * fetchRatesFallback)。响应字段是{timestamp(unix秒), base, rates}，没有现成的date
 * 字符串，从timestamp换算成YYYY-MM-DD——RateSnapshot.date这个字段其他地方(比如
 * RatePage.tsx换算卡片的显示文案)都是当YYYY-MM-DD日期串在用，不在这次改动里顺带
 * 把"小时级"这个精度也带到UI上，维持现有显示格式，范围只收在"数据源换了、日期更新
 * 更及时"这一件事上 */
async function fetchRatesPrimary(base: string): Promise<RateSnapshot> {
  const res = await fetch(`https://api.exchangerate.fun/latest?base=${base}`, { cache: 'no-store' })
  if (!res.ok) throw new Error(`汇率接口返回${res.status}`)
  const data = await res.json()
  if (!data?.rates || typeof data.rates !== 'object' || typeof data.timestamp !== 'number') {
    throw new Error('汇率接口返回格式不符')
  }
  const date = new Date(data.timestamp * 1000).toISOString().slice(0, 10)
  return { base, date, rates: data.rates, fetchedAt: Date.now() }
}

/** 走势图那边(fetchRateHistoryStats)一直用的frankfurter.dev，这里当降级来源沿用
 * 同一个数据源，不额外引入第三个供应商。之前没加cache:'no-store'是真实bug(B-XX：
 * 浏览器把frankfurter.dev响应头里的cache-control: max-age=86400缓存了一整天，
 * App显示的日期比走势图卡在旧了一天，用户真机截图实测复现过)，这次一并修掉 */
async function fetchRatesFallback(base: string): Promise<RateSnapshot> {
  const symbols = CURRENCIES.map((c) => c.code).filter((c) => c !== base)
  const res = await fetch(`https://api.frankfurter.dev/v1/latest?base=${base}&symbols=${symbols.join(',')}`, {
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`汇率接口返回${res.status}`)
  const data = await res.json()
  if (!data?.rates || typeof data.rates !== 'object') {
    throw new Error('汇率接口返回格式不符')
  }
  return { base, date: data.date, rates: data.rates, fetchedAt: Date.now() }
}

/** 一次性拿base货币兑其余常用货币的汇率——换算器的目标货币汇率和"热门汇率"列表
 * 共用这一份数据，不用分开发两次请求 */
export async function fetchRates(base: string): Promise<RateSnapshot> {
  try {
    return await fetchRatesPrimary(base)
  } catch (e) {
    console.error('主汇率数据源(exchangerate.fun)请求失败，降级回退frankfurter.dev', e)
    return await fetchRatesFallback(base)
  }
}

export interface RateHistoryPoint {
  date: string
  rate: number
}

/** 汇率走势+衍生统计(涨跌幅/区间最高/区间最低/波动区间)——R-XX走势图重设计后改成
 * 走自建后端(worker/src/rate/handlers.ts的GET /rate/history-stats)，不再前端直连
 * frankfurter.dev：这几项统计值以后可能不止一处前端要用，放后端算好一次，各端
 * 拿到的数值口径统一，不用各自实现一遍。后端那边调的还是frankfurter.dev同一个
 * 真实存在的时间序列接口，查询区间的计算方式跟原来前端直连时完全一致，数据源
 * 没有变，只是转了一手。这是按日更新的央行参考汇率，没有盘中粒度，周末/节假日
 * 也没有发布——短窗口(比如1D)可能就只有1、2个真实点，如实显示这批点，不插值
 * 凑数据把图"填满"，points长度<1时几项统计是null(见worker那边的类型定义) */
export interface RateHistoryStats {
  points: RateHistoryPoint[]
  pctChange: number | null
  high: number | null
  low: number | null
  volatilityPct: number | null
}

export async function fetchRateHistoryStats(base: string, target: string, days: number): Promise<RateHistoryStats> {
  return apiClient.get<RateHistoryStats>(`/rate/history-stats?base=${base}&target=${target}&days=${days}`)
}
