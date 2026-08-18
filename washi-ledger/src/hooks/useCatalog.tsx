import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { fetchCatalog, type Catalog } from '../data/catalog'
import { loadCachedCatalog, saveCachedCatalog } from '../lib/catalogCache'

interface CatalogContextValue {
  catalog: Catalog | null
  loading: boolean
  error: unknown
  reload: () => void
}

const CatalogContext = createContext<CatalogContextValue | null>(null)

/** 分类/支付方式/标签这套目录数据只在App根节点拉一次，通过Context分享给所有页面——
 * 之前每个页面各自调用useCatalog()、各自独立发一次网络请求，切换底部导航(每次都是
 * 全新组件挂载)就会重新拉一次catalog，从"有数据"闪回"没数据"再闪回"有数据"，看起来
 * 像点一下就白一下。改成Context后，catalog只在App启动时拉一次，页面之间切换共用
 * 同一份数据，不会重复请求也不会闪。
 *
 * 缓存优先(照旧App loadCatalogData()真实逻辑)：初始state直接读本地缓存(见
 * lib/catalogCache.ts)，有缓存就立即可用、不需要转圈圈等网络请求；不管有没有缓存，
 * 都会在后台发一次真实请求刷新最新数据(网络请求的loading态只在完全没有缓存、真的
 * 要靠这次请求才有数据可看时才会是true，否则安静地在后台替换，不打断已经在看的内容) */
export function CatalogProvider({ children }: { children: ReactNode }) {
  const [catalog, setCatalog] = useState<Catalog | null>(() => loadCachedCatalog())
  const [loading, setLoading] = useState(() => !loadCachedCatalog())
  const [error, setError] = useState<unknown>(null)

  const reload = useCallback(() => {
    setLoading((prev) => prev || !loadCachedCatalog())
    fetchCatalog()
      .then((data) => {
        setCatalog(data)
        saveCachedCatalog(data)
      })
      .catch((e) => setError(e))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <CatalogContext.Provider value={{ catalog, loading, error, reload }}>{children}</CatalogContext.Provider>
}

export function useCatalog() {
  const ctx = useContext(CatalogContext)
  if (!ctx) throw new Error('useCatalog必须在CatalogProvider内使用')
  return ctx
}
