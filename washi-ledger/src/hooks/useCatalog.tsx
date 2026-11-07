import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { App } from '@capacitor/app'
import { fetchCatalog, type Catalog } from '../data/catalog'
import { loadCachedCatalog, saveCachedCatalog } from '../lib/catalogCache'
import { logModule } from '../lib/appLog'
import { useSettings } from './useSettings'

interface CatalogContextValue {
  catalog: Catalog | null
  loading: boolean
  error: unknown
  /** 返回Promise——R-17下拉刷新指示器要等这个真正拉完才收起转圈圈，不是估个时间 */
  reload: () => Promise<void>
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
  const { userId, authLoading } = useSettings()
  const [catalog, setCatalog] = useState<Catalog | null>(() => loadCachedCatalog(userId))
  const [loading, setLoading] = useState(() => authLoading || !loadCachedCatalog(userId))
  const [error, setError] = useState<unknown>(null)
  const activeUserIdRef = useRef(userId)
  activeUserIdRef.current = userId
  const authLoadingRef = useRef(authLoading)
  authLoadingRef.current = authLoading
  const requestIdRef = useRef(0)
  const inFlightRef = useRef<{ userId: string; promise: Promise<void> } | null>(null)
  const retryCountRef = useRef(0)

  const reload = useCallback(() => {
    // 认证尚在恢复时，null 不是“没有账号”；不要提前清缓存或显示分类请求失败。
    if (authLoading || activeUserIdRef.current !== userId) return Promise.resolve()
    if (!userId) {
      setCatalog(null)
      setError(null)
      setLoading(false)
      return Promise.resolve()
    }
    if (inFlightRef.current?.userId === userId) return inFlightRef.current.promise
    const requestId = ++requestIdRef.current
    const isCurrent = () => requestIdRef.current === requestId
      && activeUserIdRef.current === userId && !authLoadingRef.current
    setError(null)
    setLoading(!loadCachedCatalog(userId))
    const promise = fetchCatalog()
      .then((data) => {
        if (!isCurrent()) return
        setCatalog(data)
        saveCachedCatalog(userId, data)
        setError(null)
        retryCountRef.current = 0
      })
      .catch((e) => {
        if (!isCurrent()) return
        console.error('拉取分类/支付方式目录数据失败', e)
        logModule('other', '分类目录加载失败', 'error', {
          message: String((e as { message?: unknown } | null)?.message ?? e),
          cached: !!loadCachedCatalog(userId),
        })
        setError(e)
      })
      .finally(() => {
        if (!isCurrent()) return
        inFlightRef.current = null
        setLoading(false)
      })
    inFlightRef.current = { userId, promise }
    return promise
  }, [userId, authLoading])

  useLayoutEffect(() => {
    const cached = loadCachedCatalog(userId)
    setCatalog(cached)
    setError(null)
    retryCountRef.current = 0
    setLoading(authLoading || (!!userId && !cached))
    if (!authLoading && userId) void reload()
    return () => {
      // 旧账号请求的成功、失败和 finally 都不能改变新账号的状态。
      requestIdRef.current += 1
      inFlightRef.current = null
    }
  }, [userId, authLoading, reload])

  useEffect(() => {
    if (!error || authLoading || !userId || retryCountRef.current >= 2) return
    const delay = [1000, 3000][retryCountRef.current++]
    const timer = setTimeout(() => { void reload() }, delay)
    return () => clearTimeout(timer)
  }, [error, authLoading, userId, reload])

  useEffect(() => {
    const recover = () => {
      retryCountRef.current = 0
      void reload()
    }
    window.addEventListener('online', recover)
    let handle: { remove: () => void } | undefined
    let cancelled = false
    void App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) recover()
    }).then((listener) => {
      if (cancelled) listener.remove()
      else handle = listener
    })
    return () => {
      cancelled = true
      handle?.remove()
      window.removeEventListener('online', recover)
    }
  }, [reload])

  return <CatalogContext.Provider value={{ catalog, loading, error, reload }}>{children}</CatalogContext.Provider>
}

export function useCatalog() {
  const ctx = useContext(CatalogContext)
  if (!ctx) throw new Error('useCatalog必须在CatalogProvider内使用')
  return ctx
}
