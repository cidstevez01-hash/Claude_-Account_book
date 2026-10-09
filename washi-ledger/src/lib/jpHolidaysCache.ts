const CACHE_KEY = 'washi_ledger_jp_holidays_cache_v1'

/** 日本法定节假日(祝日)数据本地缓存——{日期(YYYY-MM-DD): 节假日名称}。
 * R-38续：旧仓库index.html也抓同一个源(holidays-jp.github.io)，但旧App的
 * fetchJpHolidays()只留了Object.keys(data)(纯日期，给isBizDay()判休日用)，
 * 名字被扔掉了；jp_holidays这张Supabase表(给与日/家賃日营业日调整用，见
 * sql/2026-08-13_alarm_tables_字段设计.md附录)同样只有holiday_date一列，没有
 * 名字。这次日历页要点进某天显示"节假日详细"(具体是哪个节假日)，旧数据源/旧表
 * 都给不了名字，所以不复用jp_holidays表，改成前端直接请求同一个公开API、这次
 * 把名字也存下来 */
export function loadCachedJpHolidays(): Record<string, string> | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    return raw ? (JSON.parse(raw) as Record<string, string>) : null
  } catch (e) {
    console.error('读取本地节假日缓存失败', e)
    return null
  }
}

export function saveCachedJpHolidays(holidays: Record<string, string>): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(holidays))
  } catch (e) {
    console.error('写入本地节假日缓存失败', e)
  }
}
