import { useCallback, useEffect, useRef, useState } from 'react'
import { App } from '@capacitor/app'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { fetchEntries, pushEntriesBulkUpsert, subscribeEntriesRealtime } from '../data/catalog'
import { supabase } from '../lib/supabase'
import { loadCachedEntries, saveCachedEntries } from '../lib/entriesCache'
import type { Entry } from '../types'

/** 记账记录数据层——照旧仓库index.html的真实缓存/同步逻辑搬，不是简单的"登录了就查库、
 * 没登录就清空"：
 * - 有本地缓存优先用缓存展示(初始state直接读缓存，不用等云端请求)，没缓存才是空列表
 * - 退出登录不清空当前数据(entries/缓存都保留原样，照旧App的cloudSignOutBtn真实
 *   处理——只清cloudUser、停实时订阅，从没碰过entries)，退出后应该还能正常看到之前的账目
 * - 只要挂载时有userId(含App冷启动时恢复已有会话、含单纯切页面重新mount这个hook)都
 *   做一次真实同步：远端拉到的数据按id跟本机合并(见mergeRemote)，不是直接整个覆盖；
 *   云端是空的就把本地现有缓存(可能是退出登录期间攒下的)推上去当种子数据
 * - App重新回到前台时补一次同步(照旧App resyncCloudOnResume)，不是定时轮询，只在
 *   真的可能有新数据的时机(回到前台)才请求，省流量也更及时
 * - 常驻一条entries表的Realtime订阅(照旧App startCloudRealtime)：同一账号在别处(旧App/
 *   另一台设备)写入的新记录靠这条连接实时推过来，不依赖"这一端自己被唤醒才去拉"——这一层
 *   之前完全没做，只有上面那条"回前台补拉"，而visibilitychange/pageshow在iOS上不一定按预期
 *   触发(旧App代码里也这么写过)，两条腿都得有才不会出现"旧App一直在加数据、这边好几天都不更新"
 *   的情况。回前台时除了补拉一次，也重启一次这条订阅——iOS后台太久WebSocket可能被系统冻结，
 *   不指望它自己重连。 */
export function useEntries(userId: string | null) {
  const [entries, setEntries] = useState<Entry[]>(() => loadCachedEntries())
  const [loading, setLoading] = useState(false)
  const realtimeChannelRef = useRef<RealtimeChannel | null>(null)
  // reload/挂载同步的effect依赖数组里都没有entries(避免每次entries变化就重新拉)，
  // 所以不能直接闭包读entries——用ref拿实时值，规避拿到旧闭包快照
  const entriesRef = useRef(entries)
  useEffect(() => {
    entriesRef.current = entries
  }, [entries])

  // 远端拉到账目后不能直接setEntries(remote)整个覆盖本机——本机在离线/登录失效期间
  // 可能已经攒了远端还没有的新记录(真实事故：旧App index.html的B-02，一模一样的坑，
  // 三处覆盖点漏改一处就会把本机独有记录连本机缓存一起冲掉)。改成按id合并：远端已有的
  // id以远端为准(其它设备的修改要能生效)，远端没有的本机id(本机独有、还没同步过的
  // 新记录)保留下来，并立刻回推到云端补齐——reload(含前台恢复)和挂载登录同步两处
  // 都要走这一个函数，不能各写各的覆盖逻辑
  const mergeRemote = useCallback(
    (remote: Entry[]) => {
      const remoteIds = new Set(remote.map((e) => e.id))
      const localOnly = entriesRef.current.filter((e) => !remoteIds.has(e.id))
      const merged = remote.concat(localOnly)
      setEntries(merged)
      saveCachedEntries(merged)
      if (localOnly.length && userId) {
        pushEntriesBulkUpsert(localOnly, userId).catch((e) => console.error('本机独有记录回推云端失败', e))
      }
    },
    [userId]
  )

  // 返回Promise——R-17下拉刷新指示器要等这个真正拉完才收起转圈圈，不是估个时间
  const reload = useCallback(() => {
    if (!userId) return Promise.resolve()
    setLoading(true)
    return fetchEntries(userId)
      .then((remote) => mergeRemote(remote))
      .catch((e) => console.error('拉取记账记录失败', e))
      .finally(() => setLoading(false))
  }, [userId, mergeRemote])

  // 删除成功后调用方要先调这个把本地状态里的这条记录摘掉，再reload()——不然
  // mergeRemote会把"删除后就不在最新远端列表里"误判成"本机独有、还没同步的新记录"，
  // 反手又把刚删掉的记录推回云端，等于删除白做了(2026-08-23 delete回归测试时
  // 发现的真实bug，不是猜的)
  const removeLocal = useCallback((id: string) => {
    setEntries((prev) => {
      const next = prev.filter((e) => e.id !== id)
      saveCachedEntries(next)
      return next
    })
  }, [])

  const stopRealtime = useCallback(() => {
    if (realtimeChannelRef.current) {
      supabase.removeChannel(realtimeChannelRef.current)
      realtimeChannelRef.current = null
    }
  }, [])

  const startRealtime = useCallback(() => {
    if (!userId) return
    stopRealtime()
    realtimeChannelRef.current = subscribeEntriesRealtime(userId, (event) => {
      setEntries((prev) => {
        const next =
          event.type === 'delete'
            ? prev.filter((e) => e.id !== event.id)
            : prev.some((e) => e.id === event.entry.id)
              ? prev.map((e) => (e.id === event.entry.id ? event.entry : e))
              : [...prev, event.entry]
        saveCachedEntries(next)
        return next
      })
    })
  }, [userId, stopRealtime])

  useEffect(() => {
    if (!userId) {
      stopRealtime()
      return
    }
    startRealtime()
    return stopRealtime
  }, [userId, startRealtime, stopRealtime])

  useEffect(() => {
    if (!userId) return // 退出登录：保留当前entries(内存+缓存)不变，不清空、不请求

    // 每次挂载(含"从未登录切到已登录"、以及单纯换页面重新mount这个hook)都真实拉一次——
    // 之前这里用一个ref记"上一次的userId"来只在"真的刚登录"时才拉，但DashboardPage/
    // HistoryPage/StatsPage/AddTransactionPage各自独立调用这个hook、各自有自己的ref实例，
    // 单纯切页面(userId没变，只是这个hook的新实例第一次挂载)也会被那个ref误判成"刚登录"，
    // 逻辑本身没错但脆弱、容易在改动中被破坏；直接改成"只要挂载时有userId就真实拉一次"，
    // 不依赖判断是不是真的登录事件，更简单也更不容易再出现"看起来该刷新却没刷新"的情况
    setLoading(true)
    fetchEntries(userId)
      .then(async (remote) => {
        if (remote.length > 0) {
          mergeRemote(remote)
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
  }, [userId, mergeRemote])

  useEffect(() => {
    if (!userId) return
    // 用@capacitor/app的原生appStateChange事件，不是DOM的visibilitychange/pageshow——
    // 这两个web标准事件在Capacitor的WKWebView原生壳里不保证按预期触发(不是PWA场景，
    // 旧App那份注释是针对"添加到主屏幕"的PWA写的，跟这里的原生App壳是两种环境)，
    // 装了真机实测过一次"确认没有变化"才发现这个环境差异。App插件在纯浏览器/开发预览
    // 环境下也有内部的web兜底实现(同样基于visibilitychange)，两边行为一致，不用分别处理
    let handle: { remove: () => void } | undefined
    let cancelled = false
    App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) {
        reload()
        startRealtime()
      }
    }).then((h) => {
      if (cancelled) h.remove()
      else handle = h
    })
    return () => {
      cancelled = true
      handle?.remove()
    }
  }, [userId, reload, startRealtime])

  return { entries, loading, reload, removeLocal }
}
