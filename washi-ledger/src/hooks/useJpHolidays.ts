import { useEffect, useState } from 'react'
import { loadCachedJpHolidays, saveCachedJpHolidays } from '../lib/jpHolidaysCache'

/** 日本法定节假日(祝日)——缓存优先(照lib/catalogCache.ts同款模式)：有缓存先用缓存，
 * 后台悄悄请求holidays-jp.github.io刷新最新数据(跟旧仓库index.html的fetchJpHolidays()
 * 抓同一个免费公开API，不需要登录/Supabase，纯静态JSON)。只有日历页用，不需要像
 * catalog那样挂Context在App根节点 */
export function useJpHolidays(): Record<string, string> {
  const [holidays, setHolidays] = useState<Record<string, string>>(() => loadCachedJpHolidays() ?? {})

  useEffect(() => {
    let cancelled = false
    fetch('https://holidays-jp.github.io/api/v1/date.json')
      .then((res) => {
        if (!res.ok) throw new Error(`祝日API返回${res.status}`)
        return res.json() as Promise<Record<string, string>>
      })
      .then((data) => {
        if (cancelled) return
        setHolidays(data)
        saveCachedJpHolidays(data)
      })
      .catch((e) => console.error('拉取日本祝日数据失败', e))
    return () => {
      cancelled = true
    }
  }, [])

  return holidays
}
