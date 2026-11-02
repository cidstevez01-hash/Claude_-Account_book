import type { Catalog } from '../data/catalog'
import { getLegacyCacheOwner } from './legacyCacheOwner'

const LEGACY_CACHE_KEY = 'washi_ledger_catalog_cache_v1'
const LEGACY_OWNER_KEY = 'washi_ledger_catalog_legacy_owner_v1'

function cacheKey(userId: string): string {
  return `washi_ledger_catalog_cache_v2:${encodeURIComponent(userId)}`
}

/** 分类/支付方式/标签目录数据的本地缓存——照旧仓库index.html的ledger_catalog_cache/
 * loadCatalogCacheFromLocal()真实逻辑：有缓存就立即用缓存渲染，不用等网络请求，云端
 * 刷新放到后台悄悄做；这套数据相对静态(预设分类/支付方式基本不变)，缓存优先能省掉
 * 每次冷启动/进App都要转圈圈等这一次网络请求的等待。 */
export function loadCachedCatalog(userId: string | null): Catalog | null {
  if (!userId) return null
  try {
    const key = cacheKey(userId)
    const scoped = localStorage.getItem(key)
    if (scoped != null) return JSON.parse(scoped) as Catalog

    // 旧版目录缓存只在能从持久 owner 标记或App启动时捕获的旧账号确认归属时迁移；归属不明时保留隔离，避免把自定义目录
    // 自动分给第一个登录账号。
    const legacy = localStorage.getItem(LEGACY_CACHE_KEY)
    if (!legacy) return null
    const owner = getLegacyCacheOwner(LEGACY_OWNER_KEY)
    if (!owner || owner !== userId) return null
    localStorage.setItem(key, legacy)
    return JSON.parse(legacy) as Catalog
  } catch (e) {
    console.error('读取本地分类缓存失败', e)
    return null
  }
}

export function saveCachedCatalog(userId: string | null, catalog: Catalog): void {
  if (!userId) return
  try {
    localStorage.setItem(cacheKey(userId), JSON.stringify(catalog))
  } catch (e) {
    console.error('写入本地分类缓存失败', e)
  }
}
