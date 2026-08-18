import type { Catalog } from '../data/catalog'

const CACHE_KEY = 'washi_ledger_catalog_cache_v1'

/** 分类/支付方式/标签目录数据的本地缓存——照旧仓库index.html的ledger_catalog_cache/
 * loadCatalogCacheFromLocal()真实逻辑：有缓存就立即用缓存渲染，不用等网络请求，云端
 * 刷新放到后台悄悄做；这套数据相对静态(预设分类/支付方式基本不变)，缓存优先能省掉
 * 每次冷启动/进App都要转圈圈等这一次网络请求的等待。 */
export function loadCachedCatalog(): Catalog | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    return raw ? (JSON.parse(raw) as Catalog) : null
  } catch (e) {
    console.error('读取本地分类缓存失败', e)
    return null
  }
}

export function saveCachedCatalog(catalog: Catalog): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(catalog))
  } catch (e) {
    console.error('写入本地分类缓存失败', e)
  }
}
