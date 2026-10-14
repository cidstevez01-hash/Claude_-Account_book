import type { RecurringRule } from '../types'

const CACHE_KEY = 'washi_ledger_recurring_rules_cache_v1'

/** 固定收支规则的本地缓存——照抄entriesCache.ts同款模式：有缓存优先读缓存，
 * 退出登录不清空，只有真拉到新数据才覆盖 */
export function loadCachedRecurringRules(): RecurringRule[] {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    return raw ? (JSON.parse(raw) as RecurringRule[]) : []
  } catch (e) {
    console.error('读取本地固定收支规则缓存失败', e)
    return []
  }
}

export function saveCachedRecurringRules(rules: RecurringRule[]): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(rules))
  } catch (e) {
    console.error('写入本地固定收支规则缓存失败', e)
  }
}
