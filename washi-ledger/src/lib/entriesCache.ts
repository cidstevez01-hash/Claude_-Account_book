import type { Entry } from '../types'

const CACHE_KEY = 'washi_ledger_entries_cache_v1'

/** 记账记录的本地缓存——照旧仓库index.html的LocalStore/ledger_entries真实逻辑：
 * 有缓存优先读缓存(先出内容，不用等云端请求)，退出登录时不清空(见useEntries.ts)，
 * 只有真正拉到新数据时才覆盖。 */
export function loadCachedEntries(): Entry[] {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    return raw ? (JSON.parse(raw) as Entry[]) : []
  } catch (e) {
    console.error('读取本地记账缓存失败', e)
    return []
  }
}

export function saveCachedEntries(entries: Entry[]): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(entries))
  } catch (e) {
    console.error('写入本地记账缓存失败', e)
  }
}
