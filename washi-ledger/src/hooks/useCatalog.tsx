import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { fetchCatalog, type Catalog } from '../data/catalog'

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
 * 同一份数据，不会重复请求也不会闪。 */
export function CatalogProvider({ children }: { children: ReactNode }) {
  const [catalog, setCatalog] = useState<Catalog | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)

  const reload = useCallback(() => {
    setLoading(true)
    fetchCatalog()
      .then((data) => setCatalog(data))
      .catch((e) => setError(e))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  return <CatalogContext.Provider value={{ catalog, loading, error, reload }}>{children}</CatalogContext.Provider>
}

export function useCatalog() {
  const ctx = useContext(CatalogContext)
  if (!ctx) throw new Error('useCatalog必须在CatalogProvider内使用')
  return ctx
}
