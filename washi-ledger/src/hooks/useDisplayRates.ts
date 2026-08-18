import { useEffect, useState } from 'react'
import { fetchRates, type RateSnapshot } from '../data/rate'

/** 明细/仪表盘展示用的汇率快照——base固定是当前settings.currency，拿到之后所有条目
 * (不管各自记账时是哪个货币)都能用同一份快照换算成本位货币显示，见data/currencyDisplay.ts。
 * 请求失败就保持rates=null，各调用点会照旧App的降级逻辑原样显示原始金额+原始币种 */
export function useDisplayRates(baseCurrency: string) {
  const [rates, setRates] = useState<RateSnapshot | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchRates(baseCurrency)
      .then((data) => {
        if (!cancelled) setRates(data)
      })
      .catch((e) => console.error('拉取展示用汇率失败', e))
    return () => {
      cancelled = true
    }
  }, [baseCurrency])

  return rates
}
