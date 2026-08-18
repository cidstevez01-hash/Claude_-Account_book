import { useEffect, useMemo, useState } from 'react'
import { AppLayout } from '../../design-system/components/AppLayout'
import { fetchRates, CURRENCIES, type RateSnapshot } from '../../data/rate'
import { useI18n } from '../../lib/i18n'

/** 汇率换算——多货币版，照design-assets-v2/_6/_35的换算卡片+搜索+热门汇率列表布局做。
 * 默认换算方向JPY↔CNY(服务的是中日两地记账场景)，但from/to都可以在CURRENCIES列表里
 * 自由切换，不再锁死只能JPY/CNY两个方向。
 *
 * 数据源接frankfurter-cny同一个API(https://api.frankfurter.dev)，一次请求拿from货币
 * 兑其余所有常用货币的汇率，换算结果和下面的热门汇率列表共用这一份数据。旧App那套
 * 4源兜底取最新日期、近30天/12个月/8年走势图这次都还没做，跟v1版一样先只保证有汇率能用。
 *
 * 沙箱环境里api.frankfurter.dev不在代理白名单里，这次没能实际跑一遍联网验证——
 * 接口用法照官方文档写，出错时页面会显示具体错误文本，不是静默失败 */
export function RatePage() {
  const { t } = useI18n()
  const [fromCode, setFromCode] = useState('JPY')
  const [toCode, setToCode] = useState('CNY')
  const [amount, setAmount] = useState('1')
  const [search, setSearch] = useState('')
  const [snapshot, setSnapshot] = useState<RateSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function refresh(base: string) {
    setLoading(true)
    setError('')
    try {
      const data = await fetchRates(base)
      setSnapshot(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh(fromCode)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromCode])

  function handleSwap() {
    setFromCode(toCode)
    setToCode(fromCode)
  }

  const unitRate = snapshot && snapshot.base === fromCode ? snapshot.rates[toCode] : null
  const amountNum = parseFloat(amount)
  const converted = unitRate != null && !isNaN(amountNum) ? amountNum * unitRate : null

  const popularList = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    return CURRENCIES.filter((c) => c.code !== fromCode).filter(
      (c) => !keyword || c.code.toLowerCase().includes(keyword) || c.zh.includes(keyword)
    )
  }, [fromCode, search])

  return (
    <AppLayout title={t('rateNavLabel')}>
      <div className="px-md pt-md flex flex-col gap-md">
        <div className="bg-surface-container-lowest border-[1.5px] border-dashed border-outline-variant rounded-xl p-md papercut-shadow relative">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <select
                value={fromCode}
                onChange={(e) => setFromCode(e.target.value)}
                className="bg-transparent border-none text-body-lg text-on-surface focus:outline-none focus:ring-0 font-semibold"
              >
                {CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} · {c.zh}
                  </option>
                ))}
              </select>
            </div>
            <input
              type="number"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full bg-transparent border-0 border-b-2 border-primary focus:outline-none focus:ring-0 px-0 py-1 font-serif text-[32px] font-semibold text-primary text-right"
            />
          </div>

          <div className="flex justify-center my-2">
            <button
              type="button"
              onClick={handleSwap}
              aria-label={t('swapCurrencyAria')}
              className="w-10 h-10 rounded-full bg-surface border-[1.5px] border-outline-variant flex items-center justify-center text-primary"
            >
              <span className="material-symbols-outlined">swap_vert</span>
            </button>
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-end gap-2">
              <select
                value={toCode}
                onChange={(e) => setToCode(e.target.value)}
                className="bg-transparent border-none text-body-lg text-on-surface focus:outline-none focus:ring-0 font-semibold text-right"
              >
                {CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} · {c.zh}
                  </option>
                ))}
              </select>
            </div>
            <div className="w-full border-b-2 border-outline-variant py-1 font-serif text-[32px] font-semibold text-on-surface text-right opacity-80">
              {converted != null ? converted.toFixed(2) : '--'}
            </div>
          </div>

          <div className="mt-4 text-right text-label-caps font-sans text-outline">
            {unitRate != null ? `1 ${fromCode} = ${unitRate.toFixed(4)} ${toCode}` : '--'}
          </div>
        </div>

        <div className="flex items-center justify-between px-1">
          <span className="text-body-md text-on-surface-variant">
            {t('rateUpdatedLabel')}：{loading ? t('rateLoading') : snapshot ? snapshot.date : t('rateNeverFetched')}
          </span>
          <button
            type="button"
            onClick={() => refresh(fromCode)}
            disabled={loading}
            className="flex items-center gap-1 px-3 py-1.5 rounded-full border border-primary text-primary text-body-md font-sans disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[18px]">refresh</span>
            {t('refreshRate')}
          </button>
        </div>

        {error && <p className="text-body-md text-primary break-all">{error}</p>}

        <div className="relative w-full">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline">search</span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('rateSearchPlaceholder')}
            className="w-full bg-surface-container-highest border border-outline-variant rounded-full py-2.5 pl-10 pr-4 text-body-md text-on-surface placeholder:text-outline focus:outline-none focus:border-primary transition-colors"
          />
        </div>

        <div>
          <h3 className="text-label-caps font-sans text-on-surface-variant uppercase mb-xs">{t('ratePopularTitle')}</h3>
          <div className="flex flex-col bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden">
            {popularList.map((c) => {
              const rate = snapshot && snapshot.base === fromCode ? snapshot.rates[c.code] : null
              return (
                <div key={c.code} className="flex items-center justify-between p-sm border-b border-outline-variant/30 last:border-0">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full border border-outline-variant flex items-center justify-center bg-surface-container text-on-surface font-serif">
                      {c.code[0]}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-body-lg text-on-surface">{c.code}</span>
                      <span className="text-label-caps font-sans text-outline">{c.zh}</span>
                    </div>
                  </div>
                  <span className="font-serif text-entry-amount text-on-surface">{rate != null ? rate.toFixed(4) : '--'}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
