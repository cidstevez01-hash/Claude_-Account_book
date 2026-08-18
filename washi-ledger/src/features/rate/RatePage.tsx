import { useEffect, useState } from 'react'
import { AppLayout } from '../../design-system/components/AppLayout'
import { fetchLatestRate, displayRate, type RateData, type RateDirection } from '../../data/rate'
import { useI18n } from '../../lib/i18n'

/** 汇率换算——照design-assets-v2/_6/_35的换算卡片布局做，但只做JPY↔CNY这一对，
 * 不是Stitch稿里那种USD/EUR/GBP多币种搜索列表——旧仓库index.html的真实汇率页
 * (pageRate)就是固定JPY↔CNY换算器，这个App服务的是中日两地记账场景，不需要
 * 通用多币种转换器。走势图(近30天/12个月/8年三档)和多数据源兜底这次没做，
 * 先只接frankfurter-cny一个源，能用就行 */
export function RatePage() {
  const { t } = useI18n()
  const [direction, setDirection] = useState<RateDirection>('JPY_CNY')
  const [rateData, setRateData] = useState<RateData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [amount, setAmount] = useState('1')

  async function refresh() {
    setLoading(true)
    setError('')
    try {
      const data = await fetchLatestRate()
      setRateData(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  const unitRate = rateData ? displayRate(rateData.rate, direction) : null
  const amountNum = parseFloat(amount)
  const converted = unitRate != null && !isNaN(amountNum) ? amountNum * unitRate : null
  const fromUnit = direction === 'JPY_CNY' ? 'JPY' : 'CNY'
  const toUnit = direction === 'JPY_CNY' ? 'CNY' : 'JPY'

  return (
    <AppLayout title="汇率换算">
      <div className="px-md pt-md">
        <div className="flex p-1 bg-surface-container-highest rounded-xl border border-outline-variant/30 mb-md">
          {(['JPY_CNY', 'CNY_JPY'] as const).map((dir) => (
            <button
              key={dir}
              type="button"
              onClick={() => setDirection(dir)}
              className={`flex-1 py-2 text-center rounded-lg text-body-md font-sans font-medium transition-colors ${
                direction === dir ? 'bg-surface text-primary shadow-sm' : 'text-on-surface-variant'
              }`}
            >
              {dir === 'JPY_CNY' ? t('ratePairJpyCny') : t('ratePairCnyJpy')}
            </button>
          ))}
        </div>

        <div className="bg-surface-container-lowest border-[1.5px] border-dashed border-outline-variant rounded-xl p-md papercut-shadow">
          <div className="flex flex-col gap-1">
            <span className="text-body-lg text-on-surface">{fromUnit}</span>
            <input
              type="number"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full bg-transparent border-0 border-b-2 border-outline focus:border-primary focus:outline-none focus:ring-0 px-0 py-1 font-serif text-[32px] font-semibold text-primary text-right"
            />
          </div>
          <div className="flex justify-center my-2">
            <span className="material-symbols-outlined text-outline">swap_vert</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-body-lg text-on-surface">{toUnit}</span>
            <div className="w-full border-b-2 border-outline-variant py-1 font-serif text-[32px] font-semibold text-on-surface text-right opacity-80">
              {converted != null ? converted.toFixed(2) : '--'}
            </div>
          </div>
          <div className="mt-4 text-right text-label-caps font-sans text-outline">
            {unitRate != null ? `1 ${fromUnit} = ${unitRate.toFixed(4)} ${toUnit}` : '--'}
          </div>
        </div>

        <div className="flex items-center justify-between mt-md px-1">
          <span className="text-body-md text-on-surface-variant">
            {t('rateUpdatedLabel')}：{loading ? t('rateLoading') : rateData ? rateData.date : t('rateNeverFetched')}
          </span>
          <button
            type="button"
            onClick={refresh}
            disabled={loading}
            className="flex items-center gap-1 px-3 py-1.5 rounded-full border border-primary text-primary text-body-md font-sans disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[18px]">refresh</span>
            {t('refreshRate')}
          </button>
        </div>

        {error && <p className="mt-2 text-body-md text-primary break-all">{error}</p>}
      </div>
    </AppLayout>
  )
}
