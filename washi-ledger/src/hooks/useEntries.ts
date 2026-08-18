import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchEntries, pushEntriesBulkUpsert } from '../data/catalog'
import { loadCachedEntries, saveCachedEntries } from '../lib/entriesCache'
import type { Entry } from '../types'

/** 记账记录数据层——照旧仓库index.html的真实缓存/同步逻辑搬，不是简单的"登录了就查库、
 * 没登录就清空"：
 * - 有本地缓存优先用缓存展示(初始state直接读缓存，不用等云端请求)，没缓存才是空列表
 * - 退出登录不清空当前数据(entries/缓存都保留原样，照旧App的cloudSignOutBtn真实
 *   处理——只清cloudUser、停实时订阅，从没碰过entries)，退出后应该还能正常看到之前的账目
 * - 每次"从未登录变成已登录"(含App冷启动时恢复已有会话)都做一次同步：云端已有数据就
 *   直接采用覆盖本地缓存(数据库是唯一权威源，不弹窗询问)；云端是空的就把本地现有缓存
 *   (可能是退出登录期间攒下的)推上去当种子数据。旧App里"冷启动静默恢复会话"
 *   (initCloudSync)和"交互式登录"(handleCloudSignedIn)是两条分开的代码路径，前者更
 *   简单粗暴(远端返回是空数组也会直接覆盖本地)；这里统一成后者这套更合理的逻辑，
 *   两种场景都不会把用户离线时的本地数据谁都不问就冲掉
 * - App重新回到前台时补一次同步(照旧App resyncCloudOnResume)，不是定时轮询，只在
 *   真的可能有新数据的时机(回到前台)才请求，省流量也更及时 */
export function useEntries(userId: string | null) {
  const [entries, setEntries] = useState<Entry[]>(() => loadCachedEntries())
  const [loading, setLoading] = useState(false)
  const prevUserIdRef = useRef<string | null | undefined>(undefined)

  const reload = useCallback(() => {
    if (!userId) return
    setLoading(true)
    fetchEntries(userId)
      .then((remote) => {
        setEntries(remote)
        saveCachedEntries(remote)
      })
      .catch((e) => console.error('拉取记账记录失败', e))
      .finally(() => setLoading(false))
  }, [userId])

  useEffect(() => {
    const wasUserId = prevUserIdRef.current
    prevUserIdRef.current = userId

    if (!userId) return // 退出登录：保留当前entries(内存+缓存)不变，不清空、不请求
    if (wasUserId === userId) return // 同一账号的普通重渲染，交给reload()按需触发

    // 刚从未登录/其他账号切到这个已登录账号——同步一次
    setLoading(true)
    fetchEntries(userId)
      .then(async (remote) => {
        if (remote.length > 0) {
          setEntries(remote)
          saveCachedEntries(remote)
        } else {
          const local = loadCachedEntries()
          if (local.length > 0) {
            await pushEntriesBulkUpsert(local, userId)
            setEntries(local)
            saveCachedEntries(local)
          }
        }
      })
      .catch((e) => console.error('登录同步记账记录失败', e))
      .finally(() => setLoading(false))
  }, [userId])

  useEffect(() => {
    if (!userId) return
    function onResume() {
      if (document.visibilityState === 'visible') reload()
    }
    document.addEventListener('visibilitychange', onResume)
    window.addEventListener('pageshow', onResume)
    return () => {
      document.removeEventListener('visibilitychange', onResume)
      window.removeEventListener('pageshow', onResume)
    }
  }, [userId, reload])

  return { entries, loading, reload }
}
