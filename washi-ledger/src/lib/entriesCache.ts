import type { Entry } from '../types'
import { getLegacyCacheOwner } from './legacyCacheOwner'

const LEGACY_CACHE_KEY = 'washi_ledger_entries_cache_v1'
const LEGACY_OWNER_KEY = 'washi_ledger_entries_legacy_owner_v1'

function cacheKey(userId: string): string {
  return `washi_ledger_entries_cache_v2:${encodeURIComponent(userId)}`
}

function parseEntries(raw: string | null): Entry[] {
  if (!raw) return []
  try {
    return JSON.parse(raw) as Entry[]
  } catch (e) {
    console.error('读取本地记账缓存失败', e)
    return []
  }
}

/** 记账记录本地缓存，按Supabase userId分开保存；只有能确认旧缓存归属时才迁移，
 * 归属不明的数据保留在旧键中，不自动交给当前登录账号。 */
export function loadCachedEntries(userId: string | null): Entry[] {
  if (!userId) return []
  try {
    const key = cacheKey(userId)
    const scoped = localStorage.getItem(key)
    if (scoped != null) return parseEntries(scoped)

    // 旧版缓存只在能从持久 owner 标记或App启动时捕获的旧账号确认归属时迁移。
    // 没有归属信息就隔离保留，不能把它自动分给第一个登录账号。
    const legacy = localStorage.getItem(LEGACY_CACHE_KEY)
    if (!legacy) return []
    const owner = getLegacyCacheOwner(LEGACY_OWNER_KEY)
    if (!owner || owner !== userId) return []
    localStorage.setItem(key, legacy)
    return parseEntries(legacy)
  } catch (e) {
    console.error('读取本地记账缓存失败', e)
    return []
  }
}

export function saveCachedEntries(userId: string | null, entries: Entry[]): void {
  if (!userId) return
  try {
    localStorage.setItem(cacheKey(userId), JSON.stringify(entries))
  } catch (e) {
    console.error('写入本地记账缓存失败', e)
  }
}

/** Publish a successful save before navigating back; preserve the current account's other rows. */
export function upsertCachedEntry(userId: string, entry: Entry): void {
  const entries = loadCachedEntries(userId)
  const exists = entries.some((item) => item.id === entry.id)
  saveCachedEntries(userId, exists
    ? entries.map((item) => item.id === entry.id ? entry : item)
    : [...entries, entry])
}
