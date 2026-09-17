export interface CentralBankRateEntry {
  /** 国家/地区中文名，比如"日本"——底部统计条要求"标明国家"，跟货币中文名(如"日元")
   * 是两个不同的概念，分开存 */
  country: string
  /** 央行简称，比如"日本银行" */
  bank: string
  /** 政策利率数值(百分比)，null表示该货币对应的央行没有利率目标(目前只有SGD——
   * 新加坡金管局用汇率政策(S$NEER浮动区间)调控，不是利率，这是结构性特例，
   * 不是抓取失败 */
  rate: number | null
  /** 数据截至日期，rate为null时这个字段也是null */
  asOf: string | null
}

/** 央行法定利率——静态兜底表，2026-09-17手动核实(见每条来源链接)。这类数据没有
 * 免费实时API：unirateapi.com唯一列出30家央行利率的免费页面自己在FAQ里说明
 * "利率一年就变几次，量级太小不值得做成接口，直接给源链接"，是个季度更新的静态
 * 页面——实测其中至少2条(美联储/央行利率)已经过期6个月(还停在3月的数据，但美联储
 * 9/16已经加息)。所以这份静态表本身就是"当前最新"的数据源，getCentralBankRates()
 * 里的抓取只是锦上添花——按asOf日期比对，抓到的数据比这份表更新才会覆盖，抓取失败
 * 或数据更旧都直接用这份表，不会导致数据变得比现在更旧 */
export const CENTRAL_BANK_RATES_SEED: Record<string, CentralBankRateEntry> = {
  JPY: { country: '日本', bank: '日本银行', rate: 0.75, asOf: '2025-12-19' },
  CNY: { country: '中国', bank: '中国人民银行', rate: 3.0, asOf: '2026-08-20' },
  USD: { country: '美国', bank: '美联储', rate: 4.0, asOf: '2026-09-16' },
  EUR: { country: '欧元区', bank: '欧洲央行', rate: 2.5, asOf: '2026-09-10' },
  GBP: { country: '英国', bank: '英格兰银行', rate: 3.75, asOf: '2026-09-16' },
  HKD: { country: '香港', bank: '香港金管局', rate: 4.25, asOf: '2026-09-17' },
  KRW: { country: '韩国', bank: '韩国银行', rate: 3.0, asOf: '2026-09-01' },
  AUD: { country: '澳大利亚', bank: '澳大利亚储备银行', rate: 4.35, asOf: '2026-08-12' },
  CAD: { country: '加拿大', bank: '加拿大银行', rate: 2.25, asOf: '2026-09-02' },
  // 新加坡金管局(MAS)不设利率目标，用汇率政策(S$NEER浮动区间)调控——结构性特例
  SGD: { country: '新加坡', bank: '新加坡金融管理局', rate: null, asOf: null },
  THB: { country: '泰国', bank: '泰国银行', rate: 1.0, asOf: '2026-08-26' },
}

/** unirateapi.com/central-bank-rates表格里的国家名 → 本App货币代码。只覆盖表格里
 * 实际存在的国家/地区——HKD(香港)、SGD(新加坡)这张表没有，抓取结果里不会出现，
 * 一律用上面的静态值，见getCentralBankRates()里的处理 */
export const SCRAPE_COUNTRY_TO_CURRENCY: Record<string, string> = {
  japan: 'JPY',
  china: 'CNY',
  'united states': 'USD',
  eurozone: 'EUR',
  'united kingdom': 'GBP',
  'south korea': 'KRW',
  australia: 'AUD',
  canada: 'CAD',
  thailand: 'THB',
}

const ROW_RE = /<tr class="border-b border-slate-100 hover:bg-slate-50" data-search="[^"]*">([\s\S]*?)<\/tr>/g
const COUNTRY_RE = /<td class="px-3 py-2 text-slate-800" data-sort-value="([^"]+)">([^<]+)<\/td>/
const RATE_RE = /<td class="px-3 py-2 text-right font-mono font-semibold text-slate-900" data-sort-value="([\d.]+)">/
const ASOF_RE = /<td class="px-3 py-2 text-slate-700" data-sort-value="(\d{4}-\d{2}-\d{2})">/

/** 解析unirateapi.com/central-bank-rates的表格HTML，只挑本App用得到的9个货币
 * (HKD/SGD不在这张表里，见SCRAPE_COUNTRY_TO_CURRENCY注释)。解析不出内容(比如
 * 对方改版了页面结构)返回空对象，调用方(getCentralBankRates)会整段回退用静态表，
 * 不抛错中断请求 */
export function parseCentralBankRatesHtml(html: string): Record<string, { rate: number; asOf: string }> {
  const found: Record<string, { rate: number; asOf: string }> = {}
  for (const rowMatch of html.matchAll(ROW_RE)) {
    const row = rowMatch[1]
    const countryMatch = COUNTRY_RE.exec(row)
    const rateMatch = RATE_RE.exec(row)
    const asOfMatch = ASOF_RE.exec(row)
    if (!countryMatch || !rateMatch || !asOfMatch) continue
    const currency = SCRAPE_COUNTRY_TO_CURRENCY[countryMatch[1].trim().toLowerCase()]
    if (!currency) continue
    found[currency] = { rate: Number(rateMatch[1]), asOf: asOfMatch[1] }
  }
  return found
}

/** 静态表 + 抓取结果按asOf日期"谁更新用谁"合并——抓取失败/解析不出/数据比静态表
 * 还旧，都保留静态表原值，不会让数据变得比现在更旧 */
export function mergeCentralBankRates(
  scraped: Record<string, { rate: number; asOf: string }>,
): Record<string, CentralBankRateEntry> {
  const merged: Record<string, CentralBankRateEntry> = {}
  for (const [code, seed] of Object.entries(CENTRAL_BANK_RATES_SEED)) {
    const fresh = scraped[code]
    if (fresh && seed.asOf && fresh.asOf > seed.asOf) {
      merged[code] = { country: seed.country, bank: seed.bank, rate: fresh.rate, asOf: fresh.asOf }
    } else {
      merged[code] = seed
    }
  }
  return merged
}
