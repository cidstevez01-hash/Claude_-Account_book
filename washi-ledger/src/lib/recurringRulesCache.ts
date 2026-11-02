import type { RecurringRule } from '../types'
import { getLegacyCacheOwner } from './legacyCacheOwner'

const LEGACY_CACHE_KEY = 'washi_ledger_recurring_rules_cache_v1'
const LEGACY_OWNER_KEY = 'washi_ledger_recurring_rules_legacy_owner_v1'

function cacheKey(userId: string): string {
  return `washi_ledger_recurring_rules_cache_v2:${encodeURIComponent(userId)}`
}

function parseRules(raw: string | null): RecurringRule[] {
  if (!raw) return []
  try {
    return JSON.parse(raw) as RecurringRule[]
  } catch (e) {
    console.error('读取本地固定收支规则缓存失败', e)
    return []
  }
}

/** 固定收支规则本地缓存，按Supabase userId分开保存；旧版无账号缓存仅迁给其旧账号。 */
export function loadCachedRecurringRules(userId: string | null): RecurringRule[] {
  if (!userId) return []
  try {
    const key = cacheKey(userId)
    const scoped = localStorage.getItem(key)
    if (scoped != null) return parseRules(scoped)

    // 旧版缓存只在能从持久 owner 标记或App启动时捕获的旧账号确认归属时迁移；否则保留隔离。
    const legacy = localStorage.getItem(LEGACY_CACHE_KEY)
    if (!legacy) return []
    const owner = getLegacyCacheOwner(LEGACY_OWNER_KEY)
    if (!owner || owner !== userId) return []
    localStorage.setItem(key, legacy)
    return parseRules(legacy)
  } catch (e) {
    console.error('读取本地固定收支规则缓存失败', e)
    return []
  }
}

export function saveCachedRecurringRules(userId: string | null, rules: RecurringRule[]): void {
  if (!userId) return
  try {
    localStorage.setItem(cacheKey(userId), JSON.stringify(rules))
  } catch (e) {
    console.error('写入本地固定收支规则缓存失败', e)
  }
}
