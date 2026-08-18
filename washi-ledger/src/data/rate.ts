export interface RateData {
  rate: number // 1 CNY = rate JPY(汇率永远以CNY为base存，跟旧App一致，显示时再按方向转换)
  date: string
  fetchedAt: number
}

/** 汇率数据源——旧仓库index.html实际试了4个源(jsdelivr/cf-pages/frankfurter-cny/
 * frankfurter-eur)，谁的日期最新用谁。这里先只接frankfurter-cny一个源(免费、稳定、
 * 不依赖npm发包节奏)，多源兜底+取最新日期的比较逻辑留到以后再补——先保证有汇率可用 */
export async function fetchLatestRate(): Promise<RateData> {
  const res = await fetch('https://api.frankfurter.dev/v1/latest?base=CNY&symbols=JPY')
  if (!res.ok) throw new Error(`汇率接口返回${res.status}`)
  const data = await res.json()
  if (!data?.rates?.JPY || typeof data.rates.JPY !== 'number') {
    throw new Error('汇率接口返回格式不符')
  }
  return { rate: data.rates.JPY, date: data.date, fetchedAt: Date.now() }
}

export type RateDirection = 'JPY_CNY' | 'CNY_JPY'

/** rawRate永远是"1 CNY = rawRate JPY"，按方向换算成"1单位base=多少unit"——照旧App
 * displayRate()的逻辑 */
export function displayRate(rawRate: number, direction: RateDirection): number {
  return direction === 'CNY_JPY' ? rawRate : 1 / rawRate
}
